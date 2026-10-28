import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TradeOrder, AppView, ExhibitorAccount, ServerHealth } from '../types';
import { api } from '../services/api';
import {
  Trash2,
  Gift,
  Users,
  DollarSign,
  Plus,
  Copy,
  UserMinus,
  BarChart3,
  PieChart,
  Download,
  Settings,
  KeyRound,
  AlertTriangle,
  Upload,
  Database,
  FileSpreadsheet,
  Globe,
  Clock,
  Printer,
  Sparkles,
  Search,
  CheckCircle2,
  RefreshCw,
  Server,
  Store,
  ExternalLink,
  Network,
  Code2,
  Terminal,
  Eye,
  EyeOff,
  Check
} from 'lucide-react';

interface AdminDashboardProps {
  orders: TradeOrder[];
  exhibitors: ExhibitorAccount[];
  onClearData: () => void;
  onChangeView: (view: AppView) => void;
  onAddExhibitor: (name: string, boothNumber?: string, customCode?: string) => void;
  onRemoveExhibitor: (id: string) => void;
  onUpdateExhibitor?: (id: string, updates: { name?: string; boothNumber?: string; regenerateCode?: boolean }) => void;
  onDeleteOrder: (id: string) => void;
  onChangePassword: (newPass: string) => void;
  isSuperuser?: boolean;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onDownloadCSV: () => void;
  isBackendConnected: boolean;
  serverHealth?: ServerHealth | null;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  orders,
  exhibitors,
  onClearData,
  onChangeView,
  onAddExhibitor,
  onRemoveExhibitor,
  onUpdateExhibitor,
  onDeleteOrder,
  onChangePassword,
  isSuperuser = false,
  onExportBackup,
  onImportBackup,
  onDownloadCSV,
  isBackendConnected,
  serverHealth
}) => {
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'EXHIBITORS' | 'REPORTS' | 'SETTINGS' | 'ERP'>('ORDERS');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExhibitorFilter, setSelectedExhibitorFilter] = useState<string>('ALL');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal usuwania zamówienia
  const [orderToDelete, setOrderToDelete] = useState<TradeOrder | null>(null);

  // Dodawanie nowego dostawcy
  const [newExhibitorName, setNewExhibitorName] = useState('');
  const [newBoothNumber, setNewBoothNumber] = useState('');
  const [newCustomCode, setNewCustomCode] = useState('');

  // Zmiana hasła
  const [passInput1, setPassInput1] = useState('');
  const [passInput2, setPassInput2] = useState('');
  const [passMessage, setPassMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Stan Integracji ERP
  const [erpApiKey, setErpApiKey] = useState<string>('');
  const [showErpKey, setShowErpKey] = useState<boolean>(false);
  const [isCopiedKey, setIsCopiedKey] = useState<boolean>(false);
  const [isRegeneratingKey, setIsRegeneratingKey] = useState(false);
  const [erpSummary, setErpSummary] = useState<{
    totalOrders: number;
    totalValue: number;
    syncedOrdersCount: number;
    pendingOrdersCount: number;
  } | null>(null);

  // Pobieranie danych ERP po wejściu w zakładkę
  useEffect(() => {
    if (activeTab === 'ERP' && isBackendConnected) {
      api.getErpApiKey().then(setErpApiKey).catch(console.error);
      api.getErpSummary().then(setErpSummary).catch(console.error);
    }
  }, [activeTab, isBackendConnected, orders]);

  const handleCopyErpKey = () => {
    if (!erpApiKey) return;
    navigator.clipboard.writeText(erpApiKey);
    setIsCopiedKey(true);
    setTimeout(() => setIsCopiedKey(false), 2500);
  };

  const handleRegenerateErpKey = async () => {
    if (!window.confirm('Czy na pewno chcesz zregenerować klucz API ERP? Dotychczasowy klucz przestanie działać, a zewnętrzne oprogramowanie ERP utraci połączenie do momentu aktualizacji klucza.')) {
      return;
    }
    setIsRegeneratingKey(true);
    try {
      const newKey = await api.regenerateErpApiKey();
      setErpApiKey(newKey);
      alert('Wygenerowano nowy klucz API dla systemów ERP.');
    } catch (err: any) {
      alert(`Błąd regeneracji klucza: ${err.message}`);
    } finally {
      setIsRegeneratingKey(false);
    }
  };

  // Statystyki
  const totalValue = orders.reduce((acc, curr) => acc + (Number(curr.orderValue) || 0), 0);
  const eligibleCount = orders.filter(o => !o.isWinner).length;
  const winnersCount = orders.filter(o => o.isWinner).length;

  // Filtrowanie zamówień
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchSearch =
        o.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.createdBy && o.createdBy.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchExhibitor =
        selectedExhibitorFilter === 'ALL' ||
        o.exhibitorId === selectedExhibitorFilter ||
        o.createdBy === selectedExhibitorFilter;

      return matchSearch && matchExhibitor;
    });
  }, [orders, searchTerm, selectedExhibitorFilter]);

  // Statystyki dla Raportów
  const exhibitorStats = useMemo(() => {
    const acc: Record<string, { count: number; value: number; boothNumber?: string; accessCode?: string }> = {};

    // Inicjalizacja z listy zarejestrowanych wystawców
    exhibitors.forEach(ex => {
      acc[ex.name] = { count: 0, value: 0, boothNumber: ex.boothNumber, accessCode: ex.accessCode };
    });

    orders.forEach(o => {
      const name = o.createdBy || 'Nieznany';
      if (!acc[name]) acc[name] = { count: 0, value: 0 };
      acc[name].count++;
      acc[name].value += Number(o.orderValue) || 0;
    });

    return Object.entries(acc)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value);
  }, [orders, exhibitors]);

  const clientStats = useMemo(() => {
    const acc: Record<string, { count: number; value: number }> = {};
    orders.forEach(o => {
      const name = o.clientName;
      if (!acc[name]) acc[name] = { count: 0, value: 0 };
      acc[name].count++;
      acc[name].value += Number(o.orderValue) || 0;
    });
    return Object.entries(acc)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value);
  }, [orders]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(`Skopiowano kod do schowka: ${text}`);
  };

  const handleCreateExhibitor = (e: React.FormEvent) => {
    e.preventDefault();
    if (newExhibitorName.trim()) {
      onAddExhibitor(newExhibitorName.trim(), newBoothNumber.trim(), newCustomCode.trim());
      setNewExhibitorName('');
      setNewBoothNumber('');
      setNewCustomCode('');
    }
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (passInput1.length < 5) {
      setPassMessage({ text: 'Hasło musi mieć minimum 5 znaków.', isError: true });
      return;
    }
    if (passInput1 !== passInput2) {
      setPassMessage({ text: 'Podane hasła nie są identyczne.', isError: true });
      return;
    }
    onChangePassword(passInput1);
    setPassMessage({ text: 'Hasło administratora zostało pomyślnie zmienione!', isError: false });
    setPassInput1('');
    setPassInput2('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportBackup(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmDeleteOrder = () => {
    if (orderToDelete) {
      onDeleteOrder(orderToDelete.id);
      setOrderToDelete(null);
    }
  };

  // Drukowanie pojedynczej karty dostępowej dla dostawcy
  const printExhibitorCard = (ex: ExhibitorAccount) => {
    const printWindow = window.open('', '_blank', 'width=500,height=400');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pl">
      <head>
        <meta charset="UTF-8">
        <title>Karta Dostępu - ${ex.name}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; text-align: center; color: #0f172a; }
          .badge-card { border: 3px solid #312e81; border-radius: 20px; padding: 28px; max-width: 380px; margin: 20px auto; background: #faf5ff; }
          .header { font-size: 13px; font-weight: 800; letter-spacing: 0.15em; color: #4338ca; text-transform: uppercase; margin-bottom: 6px; }
          .fair-title { font-size: 22px; font-weight: 900; margin: 0 0 16px; color: #1e1b4b; }
          .exhibitor-name { font-size: 20px; font-weight: 800; color: #1e293b; margin: 12px 0 4px; }
          .booth { font-size: 14px; font-weight: 700; color: #64748b; margin-bottom: 16px; }
          .code-box { background: #ffffff; border: 2px dashed #6366f1; border-radius: 14px; padding: 14px; margin: 16px 0; }
          .code-label { font-size: 11px; text-transform: uppercase; color: #6366f1; font-weight: 800; letter-spacing: 0.05em; margin-bottom: 4px; }
          .code-value { font-size: 38px; font-family: monospace; font-weight: 900; color: #312e81; letter-spacing: 2px; }
          .instructions { font-size: 12px; color: #475569; margin-top: 16px; line-height: 1.5; background: #fff; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="badge-card">
          <div class="header">TARGI HASta 2026</div>
          <div class="fair-title">Karta Dostępu Dostawcy</div>
          
          <div class="exhibitor-name">${ex.name}</div>
          <div class="booth">${ex.boothNumber ? `Stoisko: ${ex.boothNumber}` : 'Stoisko Targowe'}</div>

          <div class="code-box">
            <div class="code-label">Twój Kod Logowania</div>
            <div class="code-value">${ex.accessCode}</div>
          </div>

          <div class="instructions">
            <strong>Instrukcja dla obsługi stoiska:</strong><br/>
            1. Wejdź na stronę systemu targów.<br/>
            2. Wybierz <strong>Strefa Dostawcy</strong>.<br/>
            3. Wpisz powyższy kod, aby rejestrować zamówienia i wydawać losy klientom.
          </div>
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

  // Drukowanie wszystkich kart dostępowych na arkuszach
  const printAllExhibitorCards = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    const cardsHtml = exhibitors
      .map(
        ex => `
        <div class="badge-card">
          <div class="header">TARGI HASta</div>
          <div class="exhibitor-name">${ex.name}</div>
          <div class="booth">${ex.boothNumber ? `Stoisko: ${ex.boothNumber}` : 'Stoisko Targowe'}</div>
          <div class="code-box">
            <div class="code-label">KOD DOSTĘPU</div>
            <div class="code-value">${ex.accessCode}</div>
          </div>
          <div class="instructions">Logowanie w Strefie Dostawcy na stronie targów</div>
        </div>
      `
      )
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pl">
      <head>
        <meta charset="UTF-8">
        <title>Wszystkie Karty Dostępu Dostawców</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 20px; color: #0f172a; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
          .badge-card { border: 2px dashed #4338ca; border-radius: 16px; padding: 18px; text-align: center; background: #faf5ff; page-break-inside: avoid; }
          .header { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; color: #4338ca; text-transform: uppercase; }
          .exhibitor-name { font-size: 18px; font-weight: 800; color: #1e293b; margin: 6px 0 2px; }
          .booth { font-size: 13px; font-weight: 700; color: #64748b; margin-bottom: 8px; }
          .code-box { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 8px; margin: 8px 0; }
          .code-label { font-size: 10px; text-transform: uppercase; color: #6366f1; font-weight: 800; }
          .code-value { font-size: 28px; font-family: monospace; font-weight: 900; color: #312e81; letter-spacing: 2px; }
          .instructions { font-size: 11px; color: #64748b; margin-top: 6px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="grid">${cardsHtml}</div>
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

  return (
    <div className="max-w-7xl mx-auto w-full space-y-6">
      {/* Modal usuwania zamówienia */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full border border-slate-100">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-4 mx-auto">
              <Trash2 size={28} />
            </div>
            <h3 className="text-xl font-bold text-center text-slate-900 mb-2">Usunąć zamówienie?</h3>
            <p className="text-center text-slate-600 mb-6 text-sm">
              Zamierzasz bezpowrotnie usunąć bilet <strong>{orderToDelete.ticketNumber}</strong> dla klienta <strong>{orderToDelete.clientName}</strong>.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setOrderToDelete(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={confirmDeleteOrder}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors"
              >
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nagłówek administracyjny i status serwera */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Panel Zarządzania Targami</h1>
            {isSuperuser && (
              <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-purple-200">
                Superuser
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">Obsługa dostawców, rejestracja obrotów, loteria i raporty sprzedaży.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700">
            <span className={`w-2.5 h-2.5 rounded-full ${isBackendConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            {isBackendConnected ? 'Backend: LIVE (Node.js)' : 'Backend: Tryb Lokalny'}
          </div>

          <button
            onClick={() => onChangeView(AppView.LOTTERY)}
            disabled={eligibleCount === 0}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all ${
              eligibleCount > 0
                ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-200'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Gift size={16} /> Koło Fortuny ({eligibleCount})
          </button>
        </div>
      </div>

      {/* Zakładki nawigacyjne */}
      <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('ORDERS')}
          className={`pb-3 px-5 font-bold text-sm border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'ORDERS' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Zamówienia Targowe ({orders.length})
        </button>

        <button
          onClick={() => setActiveTab('EXHIBITORS')}
          className={`pb-3 px-5 font-bold text-sm border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'EXHIBITORS' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Store size={16} /> Dostawcy i Dostęp ({exhibitors.length})
        </button>

        <button
          onClick={() => setActiveTab('REPORTS')}
          className={`pb-3 px-5 font-bold text-sm border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'REPORTS' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 size={16} /> Raporty i Rankingi
        </button>

        <button
          onClick={() => setActiveTab('SETTINGS')}
          className={`pb-3 px-5 font-bold text-sm border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'SETTINGS' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Settings size={16} /> Baza Danych i Serwer
        </button>

        <button
          onClick={() => setActiveTab('ERP')}
          className={`pb-3 px-5 font-bold text-sm border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'ERP' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Network size={16} /> Integracja ERP (API)
        </button>
      </div>

      {/* ========================================================================= */}
      {/* ZAKŁADKA 1: ZAMÓWIENIA                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'ORDERS' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Karty podsumowania live */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4">
              <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl">
                <Users size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Wszystkie Zamówienia</p>
                <p className="text-2xl font-black text-slate-900">{orders.length}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4">
              <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                <DollarSign size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Łączny Obrót Targów</p>
                <p className="text-2xl font-black text-slate-900">
                  {totalValue.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4">
              <div className="p-3.5 bg-purple-50 text-purple-600 rounded-2xl">
                <Gift size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Bilety w Grze</p>
                <p className="text-2xl font-black text-purple-700">{eligibleCount}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4">
              <div className="p-3.5 bg-amber-50 text-amber-600 rounded-2xl">
                <Store size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Aktywni Dostawcy</p>
                <p className="text-2xl font-black text-slate-900">{exhibitors.length}</p>
              </div>
            </div>
          </div>

          {/* Filtry i akcje */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Szukajka */}
              <div className="relative flex-grow sm:flex-grow-0 sm:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Szukaj klienta, losu, stoiska…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              {/* Filtr dostawcy */}
              <select
                value={selectedExhibitorFilter}
                onChange={(e) => setSelectedExhibitorFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600 bg-white"
              >
                <option value="ALL">Wszyscy dostawcy</option>
                {exhibitors.map(ex => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} {ex.boothNumber ? `(${ex.boothNumber})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                onClick={onDownloadCSV}
                className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 border border-emerald-200"
              >
                <FileSpreadsheet size={16} /> Eksportuj CSV
              </button>
            </div>
          </div>

          {/* Tabela zamówień */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-extrabold border-b border-slate-200">
                    <th className="px-6 py-4">Nr Biletu</th>
                    <th className="px-6 py-4">Klient / Firma</th>
                    <th className="px-6 py-4">Dostawca / Wystawca</th>
                    <th className="px-6 py-4 text-right">Wartość</th>
                    <th className="px-6 py-4">Data i Godzina</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredOrders.length > 0 ? (
                    filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-indigo-600">
                          <span className="bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
                            {order.ticketNumber}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900">{order.clientName}</td>
                        <td className="px-6 py-4 text-slate-600">
                          <span className="inline-flex items-center gap-1.5">
                            <Store size={14} className="text-slate-400" />
                            {order.createdBy || '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono font-extrabold text-slate-900 text-right">
                          {order.orderValue.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-xs">
                          {new Date(order.createdAt).toLocaleString('pl-PL')}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {order.isWinner ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
                              🏆 Wygrany
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                              Oczekuje
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setOrderToDelete(order)}
                            className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Usuń zamówienie"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                        Brak zamówień spełniających wybrane kryteria wyszukiwania.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ZAKŁADKA 2: DOSTAWCY I DOSTĘP                                             */}
      {/* ========================================================================= */}
      {activeTab === 'EXHIBITORS' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Formularz dodawania nowego dostawcy */}
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 p-6 rounded-3xl shadow-sm">
            <h3 className="text-lg font-black text-indigo-950 mb-1 flex items-center gap-2">
              <Store size={20} className="text-indigo-600" /> Dodaj Nowego Dostawcę Targowego
            </h3>
            <p className="text-xs text-indigo-700 mb-4">
              Po dodaniu dostawcy system automatycznie wygeneruje unikalny kod dostępu (np. <strong>HA-101</strong>). Będziesz mógł wydrukować dla niego kartę dostępu.
            </p>

            <form onSubmit={handleCreateExhibitor} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-indigo-900 mb-1">Nazwa Firmy / Dostawcy</label>
                <input
                  type="text"
                  value={newExhibitorName}
                  onChange={(e) => setNewExhibitorName(e.target.value)}
                  placeholder="np. Meble Biurowe Novum Sp. z o.o."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-200 focus:ring-2 focus:ring-indigo-600 outline-none text-sm bg-white"
                  required
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-indigo-900 mb-1">Numer Stoiska</label>
                <input
                  type="text"
                  value={newBoothNumber}
                  onChange={(e) => setNewBoothNumber(e.target.value)}
                  placeholder="np. A-14 / Hala 2"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-200 focus:ring-2 focus:ring-indigo-600 outline-none text-sm bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-indigo-900 mb-1">Własny Kod (Opcja)</label>
                <input
                  type="text"
                  value={newCustomCode}
                  onChange={(e) => setNewCustomCode(e.target.value.toUpperCase())}
                  placeholder="Auto (np. AB-123)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-200 focus:ring-2 focus:ring-indigo-600 outline-none text-sm bg-white font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus size={16} /> Dodaj Dostawcę
                </button>
              </div>
            </form>
          </div>

          {/* Belka akcji zbiorczych dla dostawców */}
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div>
              <p className="font-bold text-slate-800 text-sm">Zarejestrowani Dostawcy ({exhibitors.length})</p>
              <p className="text-xs text-slate-500">Przekaż każdemu stoisku jego kod, aby mógł rejestrować transakcje.</p>
            </div>
            <button
              onClick={printAllExhibitorCards}
              disabled={exhibitors.length === 0}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-2"
            >
              <Printer size={16} /> Drukuj Wszystkie Karty Dostępu (Arkusz)
            </button>
          </div>

          {/* Tabela dostawców */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-extrabold border-b border-slate-200">
                  <th className="px-6 py-4">Dostawca</th>
                  <th className="px-6 py-4">Stoisko</th>
                  <th className="px-6 py-4">Kod Dostępu (Logowanie)</th>
                  <th className="px-6 py-4 text-center">Zamówienia</th>
                  <th className="px-6 py-4 text-right">Obrót Stoiska</th>
                  <th className="px-6 py-4 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {exhibitors.map((ex) => {
                  const exOrders = orders.filter(o => o.exhibitorId === ex.id || o.createdBy === ex.name);
                  const exTotal = exOrders.reduce((sum, o) => sum + (Number(o.orderValue) || 0), 0);

                  return (
                    <tr key={ex.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold text-xs border border-indigo-100">
                            {ex.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p>{ex.name}</p>
                            <p className="text-[11px] text-slate-400 font-normal">ID: {ex.id.slice(0, 8)}…</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-slate-600 font-medium">
                        {ex.boothNumber ? (
                          <span className="bg-slate-100 px-2.5 py-1 rounded-md text-xs font-bold text-slate-700">
                            {ex.boothNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="inline-flex items-center gap-2">
                          <code className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1 rounded-lg font-mono font-bold text-sm">
                            {ex.accessCode}
                          </code>
                          <button
                            onClick={() => copyToClipboard(ex.accessCode)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                            title="Kopiuj kod"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center font-bold text-slate-700">
                        {exOrders.length}
                      </td>

                      <td className="px-6 py-4 font-mono font-extrabold text-slate-900 text-right">
                        {exTotal.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => printExhibitorCard(ex)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                            title="Drukuj kartę dostępową"
                          >
                            <Printer size={14} /> Karta
                          </button>

                          <button
                            onClick={() => onRemoveExhibitor(ex.id)}
                            className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Usuń dostawcę"
                          >
                            <UserMinus size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ZAKŁADKA 3: RAPORTY                                                       */}
      {/* ========================================================================= */}
      {activeTab === 'REPORTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
          {/* Ranking dostawców */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col h-full">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 size={20} className="text-indigo-600" />
                <h3 className="font-bold text-slate-900">Ranking Dostawców (Według Obrotu)</h3>
              </div>
            </div>

            <div className="overflow-x-auto flex-grow">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-500 text-[11px] uppercase tracking-wider font-extrabold">
                    <th className="px-6 py-3">Miejsce & Dostawca</th>
                    <th className="px-6 py-3 text-center">Zamówienia</th>
                    <th className="px-6 py-3 text-right">Łączna Wartość</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {exhibitorStats.map((stat, idx) => (
                    <tr key={stat.name} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          idx === 0 ? 'bg-amber-100 text-amber-800' : idx === 1 ? 'bg-slate-200 text-slate-700' : idx === 2 ? 'bg-orange-100 text-orange-800' : 'text-slate-400'
                        }`}>
                          #{idx + 1}
                        </span>
                        <div>
                          <p>{stat.name}</p>
                          {stat.boothNumber && <p className="text-[11px] text-slate-400">Stoisko {stat.boothNumber}</p>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-600 bg-slate-50/30">
                        {stat.count}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-extrabold text-slate-900">
                        {stat.value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ranking klientów */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col h-full">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChart size={20} className="text-purple-600" />
                <h3 className="font-bold text-slate-900">Najwięksi Klienci Targów</h3>
              </div>
            </div>

            <div className="overflow-x-auto flex-grow">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-500 text-[11px] uppercase tracking-wider font-extrabold">
                    <th className="px-6 py-3">Klient / Firma</th>
                    <th className="px-6 py-3 text-center">Liczba Zakupów</th>
                    <th className="px-6 py-3 text-right">Suma Zamówień</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clientStats.map((stat, idx) => (
                    <tr key={stat.name} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-3">
                        <span className="text-slate-400 text-xs w-5">#{idx + 1}</span>
                        {stat.name}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-600 bg-slate-50/30">
                        {stat.count}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-extrabold text-slate-900">
                        {stat.value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ZAKŁADKA 4: USTAWIENIA I BAZA                                             */}
      {/* ========================================================================= */}
      {activeTab === 'SETTINGS' && (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
          {/* Informacja o stanie serwera */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 flex items-start gap-4">
            <div className={`p-3.5 rounded-2xl ${isBackendConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              <Server size={28} />
            </div>
            <div className="flex-grow">
              <h3 className="text-lg font-bold text-slate-900">Status Serwera API Targów</h3>
              <p className="text-slate-600 text-xs mt-1">
                {isBackendConnected
                  ? 'Połączono z lokalnym/zdalnym backendem Node.js. Wszystkie transakcje zapisywane są bezpośrednio w bazie fair_db.json na serwerze i rozsyłane na żywo.'
                  : 'Serwer backendu nie odpowiada — system działa w bezpiecznym trybie awaryjnym przeglądarki.'}
              </p>
              {serverHealth && (
                <div className="mt-3 flex gap-4 text-xs text-slate-500 font-mono">
                  <span>Wersja API: <strong>v{serverHealth.version}</strong></span>
                  <span>Uptime: <strong>{serverHealth.uptime}s</strong></span>
                  {serverHealth.sseClientsCount !== undefined && (
                    <span>Aktywne ekrany LIVE: <strong>{serverHealth.sseClientsCount}</strong></span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Kopie zapasowe */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
                <Database size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Kopia Zapasowa Bazy Danych</h3>
                <p className="text-xs text-slate-500">Pobierz lub przywróć pełny stan targów (zamówienia, dostawcy, kody).</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <button
                onClick={onExportBackup}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm shadow-md shadow-blue-100"
              >
                <Download size={16} /> Pobierz Kopię (JSON)
              </button>

              <div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 px-4 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Upload size={16} /> Wgraj Kopię Zapasową
                </button>
              </div>
            </div>
          </div>

          {/* Zmiana hasła administratora */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                <KeyRound size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Zmiana Hasła Administratora</h3>
                <p className="text-xs text-slate-500">Zaktualizuj hasło zabezpieczające panel administratora.</p>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nowe hasło</label>
                  <input
                    type="password"
                    value={passInput1}
                    onChange={(e) => setPassInput1(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-600 outline-none text-sm"
                    placeholder="Min. 5 znaków"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Powtórz hasło</label>
                  <input
                    type="password"
                    value={passInput2}
                    onChange={(e) => setPassInput2(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-600 outline-none text-sm"
                    placeholder="Powtórz nowe hasło"
                  />
                </div>
              </div>

              {passMessage && (
                <p className={`text-xs font-bold ${passMessage.isError ? 'text-red-600' : 'text-emerald-600'}`}>
                  {passMessage.text}
                </p>
              )}

              <button
                type="submit"
                className="py-2.5 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors"
              >
                Zmień Hasło
              </button>
            </form>
          </div>

          {/* Reset zamówień (Strefa niebezpieczna) */}
          <div className="bg-red-50/60 border border-red-200 rounded-3xl p-6">
            <h3 className="text-lg font-bold text-red-900 mb-1 flex items-center gap-2">
              <AlertTriangle size={20} className="text-red-600" /> Nowy Dzień Targów / Reset Bazy
            </h3>
            <p className="text-xs text-red-700 mb-4">
              Wyczyszczenie usunie wszystkie dotychczasowe zamówienia i bilety z loterii. Lista wystawców i ich kody dostępu zostaną zachowane. Przed wyczyszczeniem automatycznie zostanie pobrana kopia zapasowa.
            </p>
            <button
              onClick={onClearData}
              className="py-2.5 px-5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-2 shadow-sm"
            >
              <Trash2 size={16} /> Wyczyść Zamówienia i Rozpocznij Nowy Dzień
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ZAKŁADKA 5: INTEGRACJA ERP (API M2M)                                      */}
      {/* ========================================================================= */}
      {activeTab === 'ERP' && (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
          {/* Baner nagłówkowy ERP */}
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 text-white shadow-xl border border-indigo-900/40 relative overflow-hidden">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-3">
                <Network size={14} /> Dedykowane API dla ERP / Finanse & Księgowość
              </div>
              <h2 className="text-3xl font-black tracking-tight mb-2">Integracja z Systemami ERP</h2>
              <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
                Połącz swój system ERP (np. <strong>Comarch ERP Optima</strong>, <strong>InsERT Subiekt GT / Nexo</strong>, <strong>Enova365</strong>, <strong>SAP</strong>, <strong>Odoo</strong> lub własny system CRM) bezpośrednio z bazą zamówień targowych.
              </p>
            </div>
          </div>

          {/* Karty podsumowania synchronizacji ERP */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <FileSpreadsheet size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Wszystkie Zamówienia</p>
                <p className="text-2xl font-black text-slate-900">{orders.length}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Zsynchronizowane z ERP</p>
                <p className="text-2xl font-black text-emerald-600">
                  {erpSummary?.syncedOrdersCount ?? orders.filter(o => (o as any).syncedToErp).length}
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Oczekujące na pobranie</p>
                <p className="text-2xl font-black text-amber-600">
                  {erpSummary?.pendingOrdersCount ?? orders.filter(o => !(o as any).syncedToErp).length}
                </p>
              </div>
            </div>
          </div>

          {/* Sekcja Klucza API */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <KeyRound size={20} className="text-indigo-600" /> Klucz Autoryzacji API ERP (M2M Key)
                </h3>
                <p className="text-xs text-slate-500">
                  Podaj ten klucz w nagłówku <code className="bg-slate-100 text-indigo-700 px-1.5 py-0.5 rounded font-mono font-bold">X-API-Key</code> każdego żądania z oprogramowania ERP.
                </p>
              </div>

              <button
                onClick={handleRegenerateErpKey}
                disabled={isRegeneratingKey}
                className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-xl border border-red-200 transition-colors flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw size={14} className={isRegeneratingKey ? 'animate-spin' : ''} />
                Regeneruj Klucz
              </button>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
              <input
                type={showErpKey ? 'text' : 'password'}
                readOnly
                value={erpApiKey || 'Pobieranie klucza…'}
                className="bg-transparent font-mono text-sm font-bold text-slate-800 flex-grow px-3 outline-none select-all"
              />
              <button
                type="button"
                onClick={() => setShowErpKey(!showErpKey)}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white rounded-xl transition-colors"
                title={showErpKey ? 'Ukryj klucz' : 'Pokaż klucz'}
              >
                {showErpKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <button
                type="button"
                onClick={handleCopyErpKey}
                className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                  isCopiedKey
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100'
                }`}
              >
                {isCopiedKey ? <Check size={16} /> : <Copy size={16} />}
                {isCopiedKey ? 'Skopiowano!' : 'Kopiuj Klucz'}
              </button>
            </div>
          </div>

          {/* Dostępne Endpointy API */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Code2 size={20} className="text-indigo-600" /> Endpointy Integracyjne dla ERP
                </h3>
                <p className="text-xs text-slate-500">Format wymiany danych: JSON (REST). Kodowanie: UTF-8.</p>
              </div>

              <a
                href={`/api/erp/docs`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-200 transition-colors flex items-center gap-1"
              >
                Dokumentacja JSON <ExternalLink size={14} />
              </a>
            </div>

            <div className="space-y-3">
              {/* Endpoint 1: Pobieranie zamówień */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-600 text-white text-[11px] font-black px-2 py-0.5 rounded-md font-mono">GET</span>
                  <code className="text-sm font-mono font-bold text-slate-900">/api/erp/orders</code>
                </div>
                <p className="text-xs text-slate-600">
                  Zwraca listę zamówień targowych wraz z pełnymi danymi klienta, stoiska, kwotami i znacznikami czasu.
                </p>
                <div className="text-[11px] text-slate-500 bg-white p-2.5 rounded-xl border border-slate-200 font-mono space-y-1">
                  <div><strong>Parametry URL (opcjonalne):</strong></div>
                  <div>• <code className="text-indigo-600">synced=false</code> — pobiera <strong>tylko nowe</strong>, jeszcze niepobrane przez ERP zamówienia.</div>
                  <div>• <code className="text-indigo-600">since=1716710000000</code> — pobiera zamówienia zarejestrowane po określonym znaczniku czasu lub dacie ISO.</div>
                  <div>• <code className="text-indigo-600">exhibitorId=ID</code> — filtruje po konkretnym stoisku/dostawcy.</div>
                  <div>• <code className="text-indigo-600">limit=100&offset=0</code> — stronicowanie (domyślnie 100, max 1000).</div>
                </div>
              </div>

              {/* Endpoint 2: Potwierdzenie zaimportowania */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-600 text-white text-[11px] font-black px-2 py-0.5 rounded-md font-mono">POST</span>
                  <code className="text-sm font-mono font-bold text-slate-900">/api/erp/orders/acknowledge</code>
                </div>
                <p className="text-xs text-slate-600">
                  Oznacza pobrane zamówienia jako pomyślnie zapisane w ERP, zapisując czas synchronizacji i numer dokumentu w ERP.
                </p>
                <div className="text-[11px] text-slate-500 bg-white p-2.5 rounded-xl border border-slate-200 font-mono">
                  <strong>Body (JSON):</strong>
                  <pre className="text-slate-700 mt-1">{JSON.stringify({ orderIds: ["uuid-zamowienia-1", "uuid-zamowienia-2"], erpReference: "ZK-2026/10/004" }, null, 2)}</pre>
                </div>
              </div>

              {/* Endpoint 3: Lista dostawców */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-600 text-white text-[11px] font-black px-2 py-0.5 rounded-md font-mono">GET</span>
                  <code className="text-sm font-mono font-bold text-slate-900">/api/erp/exhibitors</code>
                </div>
                <p className="text-xs text-slate-600">
                  Pobiera listę zarejestrowanych stoisk i dostawców do zmapowania kontrahentów / centrów kosztowych w ERP.
                </p>
              </div>

              {/* Endpoint 4: Podsumowanie finansowe */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-600 text-white text-[11px] font-black px-2 py-0.5 rounded-md font-mono">GET</span>
                  <code className="text-sm font-mono font-bold text-slate-900">/api/erp/summary</code>
                </div>
                <p className="text-xs text-slate-600">
                  Podsumowanie obrotów targów (łączny wolumen, kwota, liczba zsynchronizowanych transakcji).
                </p>
              </div>
            </div>
          </div>

          {/* Przykłady wywołań cURL dla integratora */}
          <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl space-y-4">
            <h3 className="text-base font-bold flex items-center gap-2 text-indigo-400">
              <Terminal size={18} /> Przykłady wywołania API (cURL)
            </h3>

            <div>
              <p className="text-xs text-slate-400 mb-1 font-medium">1. Pobieranie nowych zamówień (oczekujących na eksport):</p>
              <pre className="bg-slate-950 p-3.5 rounded-xl text-xs font-mono text-emerald-400 overflow-x-auto border border-slate-800">
{`curl -X GET "http://localhost:3001/api/erp/orders?synced=false" \\
  -H "X-API-Key: ${erpApiKey || 'TWOJ_KLUCZ_ERP'}"`}
              </pre>
            </div>

            <div>
              <p className="text-xs text-slate-400 mb-1 font-medium">2. Potwierdzenie zaimportowania dokumentów do ERP:</p>
              <pre className="bg-slate-950 p-3.5 rounded-xl text-xs font-mono text-emerald-400 overflow-x-auto border border-slate-800">
{`curl -X POST "http://localhost:3001/api/erp/orders/acknowledge" \\
  -H "X-API-Key: ${erpApiKey || 'TWOJ_KLUCZ_ERP'}" \\
  -H "Content-Type: application/json" \\
  -d '{"orderIds": ["ID_ZAMOWIENIA"], "erpReference": "WZ-2026/041"}'`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
