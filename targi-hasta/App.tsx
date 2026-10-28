import React, { useState, useEffect, useRef } from 'react';
import { AppView, TradeOrder, WinnerContext, UserSession, ExhibitorAccount, ServerHealth } from './types';
import { ExhibitorForm } from './components/ExhibitorForm';
import { AdminDashboard } from './components/AdminDashboard';
import { LotteryWheel } from './components/LotteryWheel';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { generateCongratulationMessage } from './services/geminiService';
import { api } from './services/api';
import { ArrowLeft, PartyPopper, X, LogOut, Printer, Server, Store, Shield } from 'lucide-react';
import confetti from 'canvas-confetti';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LANDING);
  const [orders, setOrders] = useState<TradeOrder[]>([]);
  const [exhibitors, setExhibitors] = useState<ExhibitorAccount[]>([]);
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [lastWinnerContext, setLastWinnerContext] = useState<WinnerContext | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(false);

  // Status backendu
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [serverHealth, setServerHealth] = useState<ServerHealth | null>(null);

  const LOGO_URL = 'https://hurt.hasta.pl/themes/appwise-nowy-20190822135112/assets/img/logo.png';

  // --------------------------------------------------------------------------
  // Inicjalizacja i połączenie z Backendem
  // --------------------------------------------------------------------------
  useEffect(() => {
    let unsubscribeSSE: (() => void) | null = null;

    const initSystem = async () => {
      // 1. Sprawdź stan serwera API
      const health = await api.checkHealth();
      if (health) {
        setIsBackendConnected(true);
        setServerHealth(health);

        // Subskrybuj zdarzenia na żywo (Server-Sent Events)
        unsubscribeSSE = api.subscribeEvents((event) => {
          console.log('[SSE Event]', event);
          if (event.type === 'ORDER_CREATED') {
            setOrders(prev => {
              if (prev.some(o => o.id === event.payload.id)) return prev;
              return [event.payload, ...prev];
            });
          } else if (event.type === 'ORDER_DELETED') {
            setOrders(prev => prev.filter(o => o.id !== event.payload.id));
          } else if (event.type === 'LOTTERY_WINNER') {
            setOrders(prev => prev.map(o => o.id === event.payload.id ? { ...o, isWinner: true } : o));
          } else if (event.type === 'ORDERS_CLEARED') {
            setOrders([]);
          } else if (event.type === 'EXHIBITOR_CREATED') {
            setExhibitors(prev => {
              if (prev.some(e => e.id === event.payload.id)) return prev;
              return [...prev, event.payload];
            });
          } else if (event.type === 'EXHIBITOR_UPDATED') {
            setExhibitors(prev => prev.map(e => e.id === event.payload.id ? event.payload : e));
          } else if (event.type === 'EXHIBITOR_DELETED') {
            setExhibitors(prev => prev.filter(e => e.id !== event.payload.id));
          } else if (event.type === 'DATABASE_RESTORED') {
            loadDataFromApi();
          }
        });
      } else {
        setIsBackendConnected(false);
      }

      // 2. Sprawdź, czy mamy aktywną sesję w tokenie
      try {
        const session = await api.getMe();
        if (session) {
          setCurrentUser(session);
          setCurrentView(session.role === 'EXHIBITOR' ? AppView.EXHIBITOR : AppView.ADMIN);
        }
      } catch {
        // brak sesji
      }

      // 3. Pobierz wstępne dane
      await loadData();
    };

    initSystem();

    // Okresowy ping sprawdzający status serwera co 15s
    const pingInterval = setInterval(async () => {
      const h = await api.checkHealth();
      setIsBackendConnected(!!h);
      if (h) setServerHealth(h);
    }, 15000);

    return () => {
      clearInterval(pingInterval);
      if (unsubscribeSSE) unsubscribeSSE();
    };
  }, []);

  const loadDataFromApi = async (role?: string) => {
    try {
      const fetchedOrders = await api.getOrders();
      setOrders(fetchedOrders);
    } catch {
      // ignore
    }

    // Tylko administrator ma dostęp do listy wszystkich wystawców i ich kodów
    const currentRole = role || currentUser?.role;
    if (currentRole === 'ADMIN' || currentRole === 'SUPERUSER') {
      try {
        const fetchedExhibitors = await api.getExhibitors();
        setExhibitors(fetchedExhibitors);
      } catch {
        // ignore
      }
    } else {
      setExhibitors([]);
    }
  };

  const loadData = async () => {
    if (api.getIsConnected()) {
      await loadDataFromApi();
    }
  };

  // Synchronizacja do localStorage jako kopia bezpieczeństwa offline (tylko dla admina)
  useEffect(() => {
    if (currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPERUSER') {
      if (orders.length > 0) {
        localStorage.setItem('fair_orders_offline', JSON.stringify(orders));
      }
      if (exhibitors.length > 0) {
        localStorage.setItem('fair_exhibitors_offline', JSON.stringify(exhibitors));
      }
    }
  }, [orders, exhibitors, currentUser]);

  // --------------------------------------------------------------------------
  // Logowanie i wylogowanie
  // --------------------------------------------------------------------------
  const handleLoginSubmit = async (
    input: string,
    isAdmin: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (isAdmin) {
        // Logowanie administratora hasłem
        const session = await api.loginAdmin(input);
        setCurrentUser(session);
        setCurrentView(AppView.ADMIN);
        await loadDataFromApi('ADMIN');
        return { success: true };
      } else {
        // Logowanie dostawcy za pomocą otrzymanego kodu dostępu
        const session = await api.loginExhibitor(input);
        setCurrentUser(session);
        setCurrentView(AppView.EXHIBITOR);
        await loadDataFromApi('EXHIBITOR');
        return { success: true };
      }
    } catch (err: any) {
      // Fallback jeśli backend nie działa (tylko weryfikacja hasła admina)
      if (!isBackendConnected) {
        if (isAdmin && (input === 'admin123' || input === 'admin')) {
          const localSession: UserSession = { role: 'ADMIN', name: 'Administrator (Offline)' };
          setCurrentUser(localSession);
          setCurrentView(AppView.ADMIN);
          return { success: true };
        }
      }
      return {
        success: false,
        error: err.message || 'Nieprawidłowe dane logowania. Sprawdź wprowadzony kod lub hasło.'
      };
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    setOrders([]);
    setExhibitors([]);
    setCurrentView(AppView.LANDING);
  };

  // --------------------------------------------------------------------------
  // Rejestracja i usuwanie zamówień
  // --------------------------------------------------------------------------
  const handleAddOrder = async (clientName: string, orderValue: number): Promise<TradeOrder | null> => {
    try {
      if (isBackendConnected) {
        const newOrder = await api.createOrder(clientName, orderValue);
        // Zaktualizuj lokalny stan natychmiast (lub przez SSE)
        setOrders(prev => {
          if (prev.some(o => o.id === newOrder.id)) return prev;
          return [newOrder, ...prev];
        });
        return newOrder;
      } else {
        // Tryb lokalny
        const localOrder: TradeOrder = {
          id: crypto.randomUUID(),
          clientName,
          orderValue,
          ticketNumber: `#${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
          createdAt: Date.now(),
          isWinner: false,
          createdBy: currentUser?.name || 'Dostawca',
          exhibitorId: currentUser?.id
        };
        setOrders(prev => [localOrder, ...prev]);
        return localOrder;
      }
    } catch (err: any) {
      alert(`Błąd podczas rejestracji zamówienia: ${err.message}`);
      return null;
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      if (isBackendConnected) {
        await api.deleteOrder(orderId);
      }
      setOrders(prev => prev.filter(o => o.id !== orderId));
    } catch (err: any) {
      alert(`Nie udało się usunąć zamówienia: ${err.message}`);
    }
  };

  // --------------------------------------------------------------------------
  // Zarządzanie dostawcami (Panel Admina)
  // --------------------------------------------------------------------------
  const handleAddExhibitor = async (name: string, boothNumber?: string, customCode?: string) => {
    try {
      if (isBackendConnected) {
        const created = await api.createExhibitor(name, boothNumber, customCode);
        setExhibitors(prev => [...prev, created]);
      } else {
        const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const rand = (n: number) => letters.charAt(Math.floor(Math.random() * n));
        const code = customCode || `${rand(letters.length)}${rand(letters.length)}-${Math.floor(100 + Math.random() * 900)}`;
        const localEx: ExhibitorAccount = {
          id: crypto.randomUUID(),
          name,
          accessCode: code,
          boothNumber,
          createdAt: Date.now()
        };
        setExhibitors(prev => [...prev, localEx]);
      }
    } catch (err: any) {
      alert(`Błąd dodawania dostawcy: ${err.message}`);
    }
  };

  const handleRemoveExhibitor = async (id: string) => {
    if (!window.confirm('Czy na pewno chcesz usunąć tego dostawcę z systemu?')) return;
    try {
      if (isBackendConnected) {
        await api.deleteExhibitor(id);
      }
      setExhibitors(prev => prev.filter(e => e.id !== id));
    } catch (err: any) {
      alert(`Błąd usuwania dostawcy: ${err.message}`);
    }
  };

  // --------------------------------------------------------------------------
  // Loteria i losowanie nagród
  // --------------------------------------------------------------------------
  const handleWinnerSelected = async (winner: TradeOrder) => {
    confetti({
      particleCount: 160,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#4F46E5', '#10B981', '#FFFFFF']
    });

    setLoadingMessage(true);

    try {
      if (isBackendConnected) {
        await api.markOrderAsWinner(winner.id);
      }
      setOrders(prev => prev.map(o => o.id === winner.id ? { ...o, isWinner: true } : o));

      const message = await generateCongratulationMessage(winner);
      setLastWinnerContext({ winner: { ...winner, isWinner: true }, congratulationMessage: message });
    } catch (err: any) {
      console.error('Błąd oznaczania wygranej:', err);
    } finally {
      setLoadingMessage(false);
    }
  };

  const handlePrintWinnerTicket = (winnerCtx: WinnerContext) => {
    const printWindow = window.open('', '_blank', 'width=450,height=550');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pl">
      <head>
        <meta charset="UTF-8">
        <title>Zwycięski Los - ${winnerCtx.winner.ticketNumber}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; text-align: center; color: #1e293b; background: #fff; }
          .certificate { border: 4px double #4f46e5; border-radius: 20px; padding: 28px; max-width: 380px; margin: 0 auto; background: #fefce8; }
          .trophy { font-size: 48px; margin-bottom: 8px; }
          .header { font-size: 13px; font-weight: 800; letter-spacing: 0.15em; color: #b45309; text-transform: uppercase; }
          .title { font-size: 26px; font-weight: 900; color: #0f172a; margin: 6px 0 16px; }
          .ticket-num { font-size: 42px; font-family: monospace; font-weight: 900; color: #4f46e5; background: #fff; padding: 10px 18px; border-radius: 14px; border: 2px dashed #4f46e5; display: inline-block; margin: 8px 0; }
          .client-name { font-size: 22px; font-weight: 800; color: #0f172a; margin: 16px 0 6px; }
          .details { font-size: 13px; color: #64748b; line-height: 1.6; margin-top: 12px; }
          .quote { font-style: italic; color: #4338ca; background: #e0e7ff; padding: 12px; border-radius: 12px; margin: 16px 0; font-size: 13px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="certificate">
          <div class="trophy">🏆</div>
          <div class="header">TARGI HASta 2026</div>
          <div class="title">OFICJALNY ZWYCIĘZCA</div>
          <div class="ticket-num">${winnerCtx.winner.ticketNumber}</div>
          <div class="client-name">${winnerCtx.winner.clientName}</div>
          <div class="details">
            Dostawca / Stoisko: <strong>${winnerCtx.winner.createdBy || '—'}</strong><br/>
            Wartość zamówienia: <strong>${winnerCtx.winner.orderValue.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</strong><br/>
            Data losowania: ${new Date().toLocaleString('pl-PL')}
          </div>
          ${winnerCtx.congratulationMessage ? `<div class="quote">"${winnerCtx.congratulationMessage}"</div>` : ''}
        </div>
        <script>
          window.onload = function() {
            window.print();
            window.close();
          };
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // --------------------------------------------------------------------------
  // Kopia zapasowa, reset i eksport CSV
  // --------------------------------------------------------------------------
  const handleClearData = async () => {
    if (!window.confirm('CZY NA PEWNO? Ta operacja usunie wszystkie zamówienia i losy z bieżącego dnia targów!')) {
      return;
    }
    try {
      if (isBackendConnected) {
        await api.clearAllOrders();
      }
      setOrders([]);
      alert('Baza zamówień została pomyślnie zresetowana do nowego dnia targów.');
    } catch (err: any) {
      alert(`Błąd podczas czyszczenia bazy: ${err.message}`);
    }
  };

  const handleChangeAdminPassword = async (newPass: string) => {
    try {
      if (isBackendConnected) {
        await api.updateAdminPassword(newPass);
      }
      alert('Hasło administratora zostało zaktualizowane.');
    } catch (err: any) {
      alert(`Błąd zmiany hasła: ${err.message}`);
    }
  };

  const handleDownloadCSV = async () => {
    try {
      if (isBackendConnected) {
        await api.downloadCSV();
      } else {
        // Fallback offline
        const BOM = '\uFEFF';
        const headers = ['Nr Biletu', 'Klient', 'Wartosc (PLN)', 'Dostawca', 'Data', 'Wygrana'];
        const rows = orders.map(o => [
          o.ticketNumber,
          `"${o.clientName.replace(/"/g, '""')}"`,
          o.orderValue.toFixed(2).replace('.', ','),
          `"${(o.createdBy || '').replace(/"/g, '""')}"`,
          new Date(o.createdAt).toLocaleString('pl-PL'),
          o.isWinner ? 'TAK' : 'NIE'
        ]);
        const csv = BOM + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
        const link = Object.assign(document.createElement('a'), {
          href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
          download: `raport_targi_${Date.now()}.csv`
        });
        link.click();
      }
    } catch (err: any) {
      alert(`Błąd eksportu CSV: ${err.message}`);
    }
  };

  const handleExportBackup = async () => {
    try {
      if (isBackendConnected) {
        await api.downloadBackup();
      } else {
        const payload = {
          version: '2.0.0',
          timestamp: Date.now(),
          system: 'HASta Targi System',
          data: { orders, exhibitors }
        };
        const link = Object.assign(document.createElement('a'), {
          href: URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })),
          download: `backup_targi_${Date.now()}.json`
        });
        link.click();
      }
    } catch (err: any) {
      alert(`Błąd pobierania backupu: ${err.message}`);
    }
  };

  const handleImportBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (isBackendConnected) {
          const res = await api.restoreBackup(parsed);
          alert(`Przywrócono bazę danych: ${res.result?.ordersCount || 0} zamówień, ${res.result?.exhibitorsCount || 0} dostawców.`);
          await loadDataFromApi();
        } else {
          if (parsed.data?.orders) setOrders(parsed.data.orders);
          if (parsed.data?.exhibitors) setExhibitors(parsed.data.exhibitors);
          alert('Przywrócono bazę danych offline.');
        }
      } catch (err: any) {
        alert(`Błąd importu pliku: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // --------------------------------------------------------------------------
  // Renderowanie Głównego Widoku
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900 selection:bg-indigo-500 selection:text-white">
      {/* Główny pasek nawigacyjny */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo i status */}
            <div
              className="flex items-center gap-4 cursor-pointer"
              onClick={() => !currentUser && setCurrentView(AppView.LANDING)}
            >
              <img src={LOGO_URL} alt="Logo Targi HASta" className="h-9 object-contain" />
              {isBackendConnected ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  SERWER LIVE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  TRYB OFFLINE
                </span>
              )}
            </div>

            {/* Zalogowany użytkownik */}
            {currentUser && (
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    {currentUser.role === 'ADMIN' || currentUser.role === 'SUPERUSER' ? 'Administrator' : 'Stoisko Dostawcy'}
                  </p>
                  <p className="font-extrabold text-sm text-slate-900">{currentUser.name}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors border border-slate-200"
                  title="Wyloguj się"
                >
                  <LogOut size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Treść podstrony */}
      <main className="flex-grow flex flex-col">
        <div className="w-full max-w-7xl mx-auto px-4 py-8 flex-grow flex flex-col">
          {/* 1. Strona Główna / Wybór roli */}
          {currentView === AppView.LANDING && (
            <LandingPage onNavigate={setCurrentView} logoUrl={LOGO_URL} />
          )}

          {/* 2. Ekran Logowania */}
          {(currentView === AppView.LOGIN_ADMIN || currentView === AppView.LOGIN_EXHIBITOR) && (
            <LoginPage
              view={currentView}
              onLogin={(session) => {
                setCurrentUser(session);
                setCurrentView(session.role === 'EXHIBITOR' ? AppView.EXHIBITOR : AppView.ADMIN);
              }}
              onBack={() => setCurrentView(AppView.LANDING)}
              onLoginSubmit={handleLoginSubmit}
              logoUrl={LOGO_URL}
              isBackendConnected={isBackendConnected}
            />
          )}

          {/* 3. Panel Użytkowy Dostawcy */}
          {currentView === AppView.EXHIBITOR && currentUser && (
            <ExhibitorForm
              onAddOrder={handleAddOrder}
              onDeleteOrder={handleDeleteOrder}
              exhibitorName={currentUser.name}
              boothNumber={currentUser.boothNumber}
              accessCode={currentUser.accessCode}
              orders={orders.filter(o => o.exhibitorId === currentUser.id || o.createdBy === currentUser.name)}
            />
          )}

          {/* 4. Panel Administracyjny */}
          {currentView === AppView.ADMIN && currentUser && (
            <AdminDashboard
              orders={orders}
              exhibitors={exhibitors}
              onClearData={handleClearData}
              onChangeView={setCurrentView}
              onAddExhibitor={handleAddExhibitor}
              onRemoveExhibitor={handleRemoveExhibitor}
              onDeleteOrder={handleDeleteOrder}
              onChangePassword={handleChangeAdminPassword}
              isSuperuser={currentUser.role === 'SUPERUSER'}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
              onDownloadCSV={handleDownloadCSV}
              isBackendConnected={isBackendConnected}
              serverHealth={serverHealth}
            />
          )}

          {/* 5. Moduł Loterii (Koło Fortuny) */}
          {currentView === AppView.LOTTERY && (
            <div className="relative">
              <button
                onClick={() => setCurrentView(AppView.ADMIN)}
                className="absolute top-0 left-0 bg-white px-4 py-2.5 rounded-xl shadow-sm border border-slate-200 flex gap-2 items-center text-sm font-bold z-10 hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft size={16} /> Powrót do Panelu
              </button>

              <div className="py-12 flex justify-center">
                <div className="bg-white/40 backdrop-blur-md rounded-[3rem] p-10 shadow-2xl border border-white/60">
                  <LotteryWheel
                    candidates={orders.filter(o => !o.isWinner)}
                    onWinnerSelected={handleWinnerSelected}
                    logoUrl={LOGO_URL}
                  />
                </div>
              </div>

              {/* Modal z ogłoszeniem zwycięzcy */}
              {lastWinnerContext && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
                  <div className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full text-center relative overflow-hidden shadow-2xl border border-slate-100">
                    <button
                      onClick={() => setLastWinnerContext(null)}
                      className="absolute top-5 right-5 p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                      <X />
                    </button>
                    <PartyPopper className="w-16 h-16 text-amber-500 mx-auto mb-4 animate-bounce" />
                    <h2 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">MAMY ZWYCIĘZCĘ!</h2>

                    <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl mb-6">
                      <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Numer Wylosowanego Losu</p>
                      <p className="text-4xl font-mono font-black text-indigo-600 mt-1">{lastWinnerContext.winner.ticketNumber}</p>
                    </div>

                    <h3 className="text-2xl font-black text-slate-900 mb-1">{lastWinnerContext.winner.clientName}</h3>
                    <p className="text-slate-500 text-sm mb-6">
                      Dostawca: <strong className="text-slate-800">{lastWinnerContext.winner.createdBy}</strong>
                    </p>

                    <div className="bg-slate-50 p-5 rounded-2xl text-slate-700 italic mb-6 text-sm border border-slate-200">
                      {loadingMessage ? 'Generowanie dedykowanych gratulacji…' : `"${lastWinnerContext.congratulationMessage}"`}
                    </div>

                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={() => handlePrintWinnerTicket(lastWinnerContext)}
                        className="flex items-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors text-sm shadow-lg shadow-indigo-200"
                      >
                        <Printer size={18} /> Drukuj Certyfikat Zwycięzcy
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
