import React, { useState } from 'react';
import { TradeOrder } from '../types';
import { Sparkles, CheckCircle, Plus, Store, History, Calendar, Trash2, Printer, DollarSign, Tag, RefreshCw } from 'lucide-react';

interface ExhibitorFormProps {
  onAddOrder: (clientName: string, orderValue: number) => Promise<TradeOrder | null> | TradeOrder;
  onDeleteOrder: (id: string) => Promise<void> | void;
  exhibitorName: string;
  boothNumber?: string;
  accessCode?: string;
  orders: TradeOrder[];
}

export const ExhibitorForm: React.FC<ExhibitorFormProps> = ({
  onAddOrder,
  onDeleteOrder,
  exhibitorName,
  boothNumber,
  accessCode,
  orders
}) => {
  const [clientName, setClientName] = useState('');
  const [orderValue, setOrderValue] = useState('');
  const [lastOrder, setLastOrder] = useState<TradeOrder | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<TradeOrder | null>(null);

  // Obliczenia statystyk tego dostawcy
  const totalValue = orders.reduce((sum, o) => sum + (Number(o.orderValue) || 0), 0);
  const totalCount = orders.length;
  const winnersCount = orders.filter(o => o.isWinner).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !orderValue) return;

    const numericValue = parseFloat(orderValue);
    if (isNaN(numericValue) || numericValue < 0) return;

    setIsSubmitting(true);
    try {
      const newOrder = await onAddOrder(clientName.trim(), numericValue);
      if (newOrder) {
        setLastOrder(newOrder);
        setClientName('');
        setOrderValue('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (orderToDelete) {
      await onDeleteOrder(orderToDelete.id);
      if (lastOrder?.id === orderToDelete.id) {
        setLastOrder(null);
      }
      setOrderToDelete(null);
    }
  };

  // Funkcja drukowania biletu klienta
  const handlePrintTicket = (order: TradeOrder) => {
    const printWindow = window.open('', '_blank', 'width=420,height=520');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pl">
      <head>
        <meta charset="UTF-8">
        <title>Bilet Targowy - ${order.ticketNumber}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; text-align: center; color: #1e293b; background: #fff; }
          .ticket-card { border: 2px dashed #4f46e5; border-radius: 16px; padding: 24px; max-width: 340px; margin: 0 auto; background: #fdfdfd; }
          .header { font-size: 13px; font-weight: 800; letter-spacing: 0.1em; color: #6366f1; text-transform: uppercase; margin-bottom: 4px; }
          .title { font-size: 20px; font-weight: 900; margin: 4px 0 16px; color: #0f172a; }
          .ticket-num { font-size: 38px; font-family: monospace; font-weight: 900; color: #4f46e5; background: #e0e7ff; padding: 8px 16px; border-radius: 12px; display: inline-block; margin: 8px 0; letter-spacing: 2px; }
          .client-box { margin: 16px 0; padding: 12px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; }
          .label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 2px; }
          .val { font-size: 16px; font-weight: 800; color: #1e293b; }
          .amount { font-size: 18px; font-weight: 900; color: #16a34a; }
          .meta { font-size: 12px; color: #94a3b8; margin-top: 12px; line-height: 1.5; }
          .badge { margin-top: 12px; padding: 6px 12px; background: #fef08a; color: #854d0e; font-weight: 800; font-size: 13px; border-radius: 20px; display: inline-block; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="ticket-card">
          <div class="header">Targi HASta 2026</div>
          <div class="title">Potwierdzenie Loterii</div>
          <div class="ticket-num">${order.ticketNumber}</div>
          
          <div class="client-box">
            <div class="label">Klient / Firma</div>
            <div class="val">${order.clientName}</div>
          </div>

          <div class="client-box">
            <div class="label">Wartość Zamówienia</div>
            <div class="amount">${order.orderValue.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</div>
          </div>

          <div class="meta">
            Wystawca: <strong>${order.createdBy || exhibitorName}</strong><br/>
            ${boothNumber ? `Stoisko: <strong>${boothNumber}</strong><br/>` : ''}
            Data: ${new Date(order.createdAt).toLocaleString('pl-PL')}
          </div>

          ${order.isWinner ? '<div class="badge">🏆 ZWYCIĘZCA LOTERII!</div>' : ''}
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

  const handleQuickAddValue = (add: number) => {
    const cur = parseFloat(orderValue) || 0;
    setOrderValue((cur + add).toFixed(2));
  };

  // Sortowanie zamówień od najnowszych
  const sortedOrders = [...orders].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      
      {/* Pasek nagłówka dostawcy ze statystykami */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-200 text-xs font-bold uppercase tracking-wider mb-1">
            <Store size={16} />
            Strefa Dostawcy
            {boothNumber && <span className="bg-white/20 px-2 py-0.5 rounded-full text-white">Stoisko {boothNumber}</span>}
          </div>
          <h1 className="text-3xl font-black tracking-tight">{exhibitorName}</h1>
          {accessCode && (
            <p className="text-xs text-indigo-200 mt-1">
              Twój kod dostępu: <code className="bg-white/10 px-2 py-0.5 rounded font-mono font-bold text-white">{accessCode}</code>
            </p>
          )}
        </div>

        {/* Wskaźniki obrotu i biletów tego dostawcy */}
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 flex-1 md:flex-none min-w-[120px]">
            <p className="text-xs text-indigo-200 font-medium">Twoje zamówienia</p>
            <p className="text-2xl font-black">{totalCount}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 flex-1 md:flex-none min-w-[140px]">
            <p className="text-xs text-indigo-200 font-medium">Łączny obrót</p>
            <p className="text-2xl font-black">{totalValue.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</p>
          </div>
          {winnersCount > 0 && (
            <div className="bg-yellow-400 text-slate-900 px-4 py-3 rounded-2xl font-bold flex-1 md:flex-none min-w-[100px] flex flex-col justify-center">
              <p className="text-[10px] uppercase tracking-wider font-extrabold opacity-80">Wygrane losy</p>
              <p className="text-2xl font-black">{winnersCount} 🏆</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal potwierdzenia usunięcia */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full border border-slate-100">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-4 mx-auto">
              <Trash2 size={28} />
            </div>
            <h3 className="text-xl font-bold text-center text-slate-900 mb-2">Usunąć zamówienie?</h3>
            <p className="text-center text-slate-600 mb-6 text-sm">
              Czy na pewno chcesz usunąć bilet <strong>{orderToDelete.ticketNumber}</strong> dla klienta <strong>{orderToDelete.clientName}</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setOrderToDelete(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors"
              >
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Główna sekcja z formularzem i historią */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Kolumna lewa: Formularz rejestracji (5 kolumn) */}
        <div className="lg:col-span-5 bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/70">
            <h2 className="text-xl font-bold text-slate-900">Nowe Zamówienie Targowe</h2>
            <p className="text-slate-500 text-xs mt-1">Zarejestruj transakcję z klientem, aby wydać los na loterię.</p>
          </div>

          <div className="p-6">
            {lastOrder ? (
              <div className="animate-in fade-in zoom-in-95 duration-300 text-center py-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full mb-4">
                  <CheckCircle size={36} />
                </div>
                <h3 className="text-2xl font-black text-slate-900">Zarejestrowano Pomyślnie!</h3>
                <p className="text-slate-500 text-sm mt-1">Bilet dla: <strong className="text-slate-800">{lastOrder.clientName}</strong></p>
                
                {/* Karta biletu */}
                <div className="my-6 bg-amber-50/80 border-2 border-amber-300 border-dashed rounded-2xl p-6 relative overflow-hidden shadow-inner">
                  <p className="text-xs uppercase tracking-wider text-amber-800 font-bold mb-1">Numer Losu Klienta</p>
                  <p className="text-4xl font-black text-amber-600 font-mono tracking-widest">{lastOrder.ticketNumber}</p>
                  <p className="text-lg font-bold text-slate-800 mt-2">
                    {lastOrder.orderValue.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                  </p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => handlePrintTicket(lastOrder)}
                    className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-md shadow-indigo-200"
                  >
                    <Printer size={18} /> Drukuj / Wydaj Bilet Klientowi
                  </button>

                  <button
                    onClick={() => setLastOrder(null)}
                    className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Plus size={16} /> Dodaj kolejne zamówienie
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="clientName" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Nazwa Klienta / Przedsiębiorstwa
                  </label>
                  <input
                    id="clientName"
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none font-medium"
                    placeholder="np. Sklep Ogrodniczy Zielone Wzgórze"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="orderValue" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                      Wartość Zamówienia (PLN)
                    </label>
                    <span className="text-[11px] text-slate-400">Kwota brutto</span>
                  </div>
                  <div className="relative">
                    <input
                      id="orderValue"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={orderValue}
                      onChange={(e) => setOrderValue(e.target.value)}
                      className="w-full px-4 py-3.5 pl-9 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none font-mono text-lg font-bold text-slate-800"
                      placeholder="0.00"
                      required
                    />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">zł</span>
                  </div>

                  {/* Szybkie przyciski kwot */}
                  <div className="flex gap-2 mt-2">
                    {[500, 1000, 5000].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleQuickAddValue(val)}
                        className="text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors font-medium"
                      >
                        +{val} zł
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 transition-all transform active:scale-98 flex items-center justify-center gap-2"
                >
                  <Sparkles size={20} />
                  {isSubmitting ? 'Generowanie Losu…' : 'Zarejestruj i Wygeneruj Los'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Kolumna prawa: Historia zamówień dostawcy (7 kolumn) */}
        <div className="lg:col-span-7 bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-6 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History size={20} className="text-slate-500" />
              <h3 className="font-bold text-slate-900">Historia Zamówień Twojego Stoiska</h3>
            </div>
            <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full">
              {orders.length} pozycji
            </span>
          </div>

          <div className="overflow-y-auto flex-grow p-0">
            {sortedOrders.length === 0 ? (
              <div className="p-16 text-center text-slate-400">
                <Store size={48} className="mx-auto mb-3 opacity-30" />
                <p className="font-semibold text-slate-600">Brak zarejestrowanych zamówień na tym stoisku.</p>
                <p className="text-xs text-slate-400 mt-1">Użyj formularza po lewej stronie, aby dodać pierwsze zamówienie klienta.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {sortedOrders.map((order) => (
                  <div key={order.id} className="p-5 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg text-sm border border-indigo-100">
                          {order.ticketNumber}
                        </span>
                        {order.isWinner && (
                          <span className="text-xs font-extrabold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full border border-amber-200">
                            🏆 WYGRANY
                          </span>
                        )}
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar size={12} />
                          {new Date(order.createdAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}, {new Date(order.createdAt).toLocaleDateString('pl-PL')}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 text-base">{order.clientName}</div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-mono font-extrabold text-slate-900 text-base">
                          {order.orderValue.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handlePrintTicket(order)}
                          className="text-slate-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Drukuj bilet"
                        >
                          <Printer size={16} />
                        </button>
                        {!order.isWinner && (
                          <button
                            onClick={() => setOrderToDelete(order)}
                            className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Usuń wpis"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
