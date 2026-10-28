import http from 'node:http';
import { URL } from 'node:url';
import {
  initDb,
  getSettings,
  updateAdminPassword,
  updateSettings,
  getExhibitors,
  addExhibitor,
  updateExhibitor,
  deleteExhibitor,
  getOrders,
  addOrder,
  deleteOrder,
  setOrderWinner,
  clearAllOrders,
  getStats,
  createBackup,
  restoreBackup,
  getErpApiKey,
  regenerateErpApiKey,
  getOrdersForErp,
  acknowledgeErpOrders,
  getExhibitorsForErp,
  getSummaryForErp,
  findOrderById
} from './db.js';
import {
  authenticateAdmin,
  authenticateExhibitor,
  getSessionFromRequest,
  removeSession,
  verifyErpAccess
} from './auth.js';

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Lista aktywnych połączeń Server-Sent Events (SSE)
const sseClients = new Set();

export function broadcastEvent(eventType, payload = {}) {
  const data = JSON.stringify({ type: eventType, payload, timestamp: Date.now() });
  const message = `event: message\ndata: ${data}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Heartbeat SSE co 25 sekund
setInterval(() => {
  const ping = `: ping ${Date.now()}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(ping);
    } catch {
      sseClients.delete(client);
    }
  }
}, 25000);

// Pomocnik do wysyłania odpowiedzi JSON
function sendJson(res, statusCode, data, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...headers
  });
  res.end(JSON.stringify(data));
}

// Pomocnik do parsowania ciała żądania JSON
async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) { // limit 10MB (dla backupów)
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Niepoprawny format JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Serwer HTTP
const server = http.createServer(async (req, res) => {
  // Obsługa CORS Pre-flight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;
  const queryParams = Object.fromEntries(parsedUrl.searchParams.entries());

  try {
    // -------------------------------------------------------------
    // Status serwera & SSE
    // -------------------------------------------------------------
    if (method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, {
        status: 'ok',
        version: '2.0.0',
        uptime: Math.floor(process.uptime()),
        timestamp: Date.now(),
        sseClientsCount: sseClients.size
      });
    }

    if (method === 'GET' && pathname === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write(`: connected ${Date.now()}\n\n`);
      sseClients.add(res);

      req.on('close', () => {
        sseClients.delete(res);
      });
      return;
    }

    // -------------------------------------------------------------
    // Dokumentacja i Specyfikacja API dla ERP (Publiczna)
    // -------------------------------------------------------------
    if (method === 'GET' && (pathname === '/api/erp/docs' || pathname === '/api/erp')) {
      return sendJson(res, 200, {
        name: 'Targi HASta - ERP Integration API',
        version: '1.0.0',
        description: 'Interfejs API do pobierania i synchronizacji zamówień targowych oraz dostawców z systemami ERP (np. Comarch ERP Optima, InsERT Subiekt GT/Nexo, Enova365, SAP, Odoo).',
        authentication: {
          type: 'API Key (Machine-to-Machine)',
          recommendedHeader: 'X-API-Key: erp_live_...',
          bearerHeader: 'Authorization: Bearer erp_live_...',
          queryParam: '?api_key=erp_live_...'
        },
        endpoints: [
          {
            endpoint: 'GET /api/erp/orders',
            description: 'Pobiera listę zamówień targowych ze szczegółami klienta, stoiska i kwotami',
            parameters: {
              since: 'Timestamp (np. 1716710000000) lub ISO data - pobiera zamówienia od wskazanego momentu',
              synced: 'false (tylko nowe/niepobrane), true (już pobrane), all (wszystkie)',
              exhibitorId: 'Filtruje zamówienia po ID stoiska/dostawcy',
              limit: 'Liczba rekordów (domyślnie 100, max 1000)',
              offset: 'Przesunięcie stronicowania (domyślnie 0)'
            },
            exampleCurl: `curl -H "X-API-Key: TWOJ_KLUCZ" "http://${req.headers.host || 'localhost:3001'}/api/erp/orders?synced=false"`
          },
          {
            endpoint: 'POST /api/erp/orders/acknowledge',
            description: 'Oznacza zamówienia jako pomyślnie zaimportowane do ERP (zapisuje znacznik czasu i opcjonalny numer dokumentu w ERP)',
            bodySchema: {
              orderIds: 'Tablica ID zamówień, np. ["uuid-1", "uuid-2"]',
              erpReference: 'Opcjonalny numer w ERP, np. "ZK-2026/10/012"'
            },
            exampleCurl: `curl -X POST -H "X-API-Key: TWOJ_KLUCZ" -H "Content-Type: application/json" -d '{"orderIds":["uuid-1"],"erpReference":"ZK-2026/01"}' "http://${req.headers.host || 'localhost:3001'}/api/erp/orders/acknowledge"`
          },
          {
            endpoint: 'GET /api/erp/orders/:id',
            description: 'Pobiera szczegółowe dane pojedynczego zamówienia'
          },
          {
            endpoint: 'GET /api/erp/exhibitors',
            description: 'Zwraca listę zarejestrowanych stoisk i dostawców do mapowania wymiarów / centrów kosztowych w ERP'
          },
          {
            endpoint: 'GET /api/erp/summary',
            description: 'Podsumowanie obrotów i liczby zamówień (łączny obrót, zsynchronizowane vs oczekujące)'
          }
        ]
      });
    }

    // -------------------------------------------------------------
    // Trasy Integracji ERP (Wymagają Klucza API ERP)
    // -------------------------------------------------------------
    if (pathname.startsWith('/api/erp/')) {
      const authResult = await verifyErpAccess(req, queryParams);
      if (!authResult.authorized) {
        return sendJson(res, 401, {
          error: 'Brak autoryzacji do API ERP.',
          hint: 'Podaj poprawny klucz w nagłówku "X-API-Key: erp_live_..." lub parametrze "?api_key=erp_live_...". Klucz można sprawdzić w Panelu Administratora -> Baza Danych i Serwer -> Integracja ERP.'
        });
      }

      // 1. Pobieranie zamówień dla ERP
      if (method === 'GET' && pathname === '/api/erp/orders') {
        const result = await getOrdersForErp(queryParams);
        return sendJson(res, 200, result);
      }

      // 2. Potwierdzenie zsynchronizowania partii zamówień w ERP
      if (method === 'POST' && pathname === '/api/erp/orders/acknowledge') {
        const body = await parseJsonBody(req);
        if (!body.orderIds || !Array.isArray(body.orderIds)) {
          return sendJson(res, 400, { error: 'Wymagane pole "orderIds" jako tablica identyfikatorów zamówień.' });
        }
        const result = await acknowledgeErpOrders(body.orderIds, body.erpReference);
        broadcastEvent('ERP_ORDERS_SYNCED', result);
        return sendJson(res, 200, result);
      }

      // 3. Szczegóły pojedynczego zamówienia
      const singleOrderMatch = pathname.match(/^\/api\/erp\/orders\/([a-zA-Z0-9_-]+)$/);
      if (method === 'GET' && singleOrderMatch) {
        const orderId = singleOrderMatch[1];
        const order = await findOrderById(orderId);
        if (!order) {
          return sendJson(res, 404, { error: 'Nie znaleziono zamówienia o podanym identyfikatorze.' });
        }
        return sendJson(res, 200, { status: 'success', order });
      }

      // 4. Lista dostawców dla ERP
      if (method === 'GET' && pathname === '/api/erp/exhibitors') {
        const result = await getExhibitorsForErp();
        return sendJson(res, 200, result);
      }

      // 5. Podsumowanie finansowe dla ERP
      if (method === 'GET' && pathname === '/api/erp/summary') {
        const result = await getSummaryForErp();
        return sendJson(res, 200, result);
      }
    }

    // -------------------------------------------------------------
    // Autoryzacja
    // -------------------------------------------------------------
    // Logowanie administratora hasłem
    if (method === 'POST' && pathname === '/api/auth/login-admin') {
      const body = await parseJsonBody(req);
      const session = await authenticateAdmin(body.password);
      if (!session) {
        return sendJson(res, 401, { error: 'Nieprawidłowe hasło administratora.' });
      }
      return sendJson(res, 200, { session });
    }

    // Logowanie dostawcy za pomocą otrzymanego kodu dostępu (np. AB-123)
    if (method === 'POST' && pathname === '/api/auth/login-exhibitor') {
      const body = await parseJsonBody(req);
      const session = await authenticateExhibitor(body.accessCode);
      if (!session) {
        return sendJson(res, 401, {
          error: 'Nieprawidłowy kod dostępu dostawcy. Upewnij się, że wpisujesz dokładnie kod otrzymany od organizatora.'
        });
      }
      return sendJson(res, 200, { session });
    }

    // Weryfikacja aktywnej sesji
    if (method === 'GET' && pathname === '/api/auth/me') {
      const session = getSessionFromRequest(req);
      if (!session) {
        return sendJson(res, 401, { error: 'Brak aktywnej sesji.' });
      }
      return sendJson(res, 200, { session });
    }

    // Wylogowanie
    if (method === 'POST' && pathname === '/api/auth/logout') {
      const authHeader = req.headers['authorization'];
      if (authHeader) {
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        removeSession(token);
      }
      return sendJson(res, 200, { success: true });
    }

    // -------------------------------------------------------------
    // Middleware sprawdzania sesji dla pozostałych tras API
    // -------------------------------------------------------------
    const session = getSessionFromRequest(req);

    // -------------------------------------------------------------
    // Trasy: Dostawcy (Exhibitors) - tylko ADMIN / SUPERUSER
    // -------------------------------------------------------------
    if (pathname === '/api/exhibitors') {
      if (method === 'GET') {
        if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERUSER')) {
          return sendJson(res, 403, { error: 'Wymagane uprawnienia administratora.' });
        }
        const exhibitors = await getExhibitors();
        return sendJson(res, 200, { exhibitors });
      }

      if (method === 'POST') {
        if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERUSER')) {
          return sendJson(res, 403, { error: 'Wymagane uprawnienia administratora.' });
        }
        const body = await parseJsonBody(req);
        if (!body.name || !body.name.trim()) {
          return sendJson(res, 400, { error: 'Nazwa dostawcy jest wymagana.' });
        }
        const exhibitor = await addExhibitor({
          name: body.name,
          boothNumber: body.boothNumber,
          customCode: body.customCode
        });
        broadcastEvent('EXHIBITOR_CREATED', exhibitor);
        return sendJson(res, 201, { exhibitor });
      }
    }

    // Edycja lub usunięcie dostawcy
    const exhibitorMatch = pathname.match(/^\/api\/exhibitors\/([a-zA-Z0-9_-]+)$/);
    if (exhibitorMatch) {
      const exhibitorId = exhibitorMatch[1];

      if (method === 'PUT') {
        if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERUSER')) {
          return sendJson(res, 403, { error: 'Wymagane uprawnienia administratora.' });
        }
        const body = await parseJsonBody(req);
        const updated = await updateExhibitor(exhibitorId, body);
        if (!updated) {
          return sendJson(res, 404, { error: 'Nie znaleziono dostawcy.' });
        }
        broadcastEvent('EXHIBITOR_UPDATED', updated);
        return sendJson(res, 200, { exhibitor: updated });
      }

      if (method === 'DELETE') {
        if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERUSER')) {
          return sendJson(res, 403, { error: 'Wymagane uprawnienia administratora.' });
        }
        const success = await deleteExhibitor(exhibitorId);
        if (!success) {
          return sendJson(res, 404, { error: 'Nie znaleziono dostawcy.' });
        }
        broadcastEvent('EXHIBITOR_DELETED', { id: exhibitorId });
        return sendJson(res, 200, { success: true, id: exhibitorId });
      }
    }

    // -------------------------------------------------------------
    // Trasy: Zamówienia (Orders)
    // -------------------------------------------------------------
    if (pathname === '/api/orders') {
      if (method === 'GET') {
        if (!session) {
          return sendJson(res, 401, { error: 'Wymagane zalogowanie.' });
        }
        // Jeśli dostawca, pobierz tylko jego zamówienia; jeśli admin, wszystkie
        const filterExhibitorId = session.role === 'EXHIBITOR' ? session.id : null;
        const orders = await getOrders(filterExhibitorId);
        return sendJson(res, 200, { orders });
      }

      if (method === 'POST') {
        if (!session) {
          return sendJson(res, 401, { error: 'Wymagane zalogowanie.' });
        }
        const body = await parseJsonBody(req);
        if (!body.clientName || body.orderValue === undefined) {
          return sendJson(res, 400, { error: 'Nazwa klienta oraz wartość zamówienia są wymagane.' });
        }

        const numericValue = parseFloat(body.orderValue);
        if (isNaN(numericValue) || numericValue < 0) {
          return sendJson(res, 400, { error: 'Wartość zamówienia musi być poprawną liczbą dodatnią.' });
        }

        const newOrder = await addOrder({
          clientName: body.clientName,
          orderValue: numericValue,
          exhibitorId: session.role === 'EXHIBITOR' ? session.id : (body.exhibitorId || null),
          createdBy: session.role === 'EXHIBITOR' ? session.name : (body.createdBy || 'Administrator')
        });

        broadcastEvent('ORDER_CREATED', newOrder);
        return sendJson(res, 201, { order: newOrder });
      }
    }

    // Usunięcie zamówienia
    const orderMatch = pathname.match(/^\/api\/orders\/([a-zA-Z0-9_-]+)$/);
    if (orderMatch) {
      const orderId = orderMatch[1];

      if (method === 'DELETE') {
        if (!session) {
          return sendJson(res, 401, { error: 'Wymagane zalogowanie.' });
        }
        // Dostawca może usunąć tylko swoje zamówienie; admin każde
        const checkExhibitorId = session.role === 'EXHIBITOR' ? session.id : null;
        try {
          const success = await deleteOrder(orderId, checkExhibitorId);
          if (!success) {
            return sendJson(res, 404, { error: 'Nie znaleziono zamówienia.' });
          }
          broadcastEvent('ORDER_DELETED', { id: orderId });
          return sendJson(res, 200, { success: true, id: orderId });
        } catch (err) {
          return sendJson(res, 403, { error: err.message });
        }
      }
    }

    // Oznaczenie wygranej w loterii
    const winMatch = pathname.match(/^\/api\/orders\/([a-zA-Z0-9_-]+)\/win$/);
    if (winMatch && method === 'POST') {
      if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERUSER')) {
        return sendJson(res, 403, { error: 'Tylko administrator może oznaczać wygrane.' });
      }
      const orderId = winMatch[1];
      const updated = await setOrderWinner(orderId, true);
      if (!updated) {
        return sendJson(res, 404, { error: 'Nie znaleziono zamówienia.' });
      }
      broadcastEvent('LOTTERY_WINNER', updated);
      return sendJson(res, 200, { order: updated });
    }

    // -------------------------------------------------------------
    // Statystyki i Raporty (Dla panelu administratora)
    // -------------------------------------------------------------
    if (method === 'GET' && pathname === '/api/stats') {
      if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERUSER')) {
        return sendJson(res, 403, { error: 'Wymagane uprawnienia administratora.' });
      }
      const stats = await getStats();
      return sendJson(res, 200, { stats });
    }

    // Eksport CSV z polskimi znakami (BOM UTF-8)
    if (method === 'GET' && pathname === '/api/export/csv') {
      if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERUSER')) {
        return sendJson(res, 403, { error: 'Wymagane uprawnienia administratora.' });
      }
      const orders = await getOrders();
      const BOM = '\uFEFF';
      const headers = ['Nr Biletu', 'Klient', 'Wartość (PLN)', 'Dostawca', 'Data Rejestracji', 'Status Loterii'];
      const rows = orders.map(o => [
        o.ticketNumber,
        `"${(o.clientName || '').replace(/"/g, '""')}"`,
        (Number(o.orderValue) || 0).toFixed(2).replace('.', ','),
        `"${(o.createdBy || '').replace(/"/g, '""')}"`,
        `"${new Date(o.createdAt).toLocaleString('pl-PL')}"`,
        o.isWinner ? 'WYGRANA' : 'OCZEKUJE'
      ]);

      const csvContent = BOM + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="zamowienia_targi_${Date.now()}.csv"`,
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(csvContent);
    }

    // -------------------------------------------------------------
    // Backup i Ustawienia Systemowe
    // -------------------------------------------------------------
    if (pathname === '/api/backup') {
      if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERUSER')) {
        return sendJson(res, 403, { error: 'Wymagane uprawnienia administratora.' });
      }

      if (method === 'GET') {
        const backup = await createBackup();
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="targi_backup_${Date.now()}.json"`,
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(JSON.stringify(backup, null, 2));
      }

      if (method === 'POST') {
        const body = await parseJsonBody(req);
        try {
          const result = await restoreBackup(body);
          broadcastEvent('DATABASE_RESTORED', result);
          return sendJson(res, 200, { success: true, result });
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }
    }

    // Wyczyszczenie zamówień (np. na rozpoczęcie nowego dnia targów)
    if (method === 'POST' && pathname === '/api/admin/clear-data') {
      if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERUSER')) {
        return sendJson(res, 403, { error: 'Wymagane uprawnienia administratora.' });
      }
      const previousOrders = await clearAllOrders();
      broadcastEvent('ORDERS_CLEARED', { count: previousOrders.length });
      return sendJson(res, 200, { success: true, clearedCount: previousOrders.length });
    }

    // Zmiana hasła administratora
    if (method === 'PUT' && pathname === '/api/admin/password') {
      if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERUSER')) {
        return sendJson(res, 403, { error: 'Wymagane uprawnienia administratora.' });
      }
      const body = await parseJsonBody(req);
      if (!body.newPassword || body.newPassword.length < 5) {
        return sendJson(res, 400, { error: 'Nowe hasło musi zawierać co najmniej 5 znaków.' });
      }
      await updateAdminPassword(body.newPassword);
      return sendJson(res, 200, { success: true });
    }

    // Pobranie lub regeneracja klucza API dla ERP (Tylko Admin)
    if (pathname === '/api/admin/erp-key') {
      if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERUSER')) {
        return sendJson(res, 403, { error: 'Wymagane uprawnienia administratora.' });
      }
      if (method === 'GET') {
        const erpApiKey = await getErpApiKey();
        return sendJson(res, 200, { erpApiKey });
      }
      if (method === 'POST') {
        const newKey = await regenerateErpApiKey();
        return sendJson(res, 200, {
          erpApiKey: newKey,
          message: 'Klucz API ERP został pomyślnie zregenerowany.'
        });
      }
    }

    // 404 dla nieznanych endpointów
    return sendJson(res, 404, { error: `Endpoint ${method} ${pathname} nie istnieje.` });

  } catch (err) {
    console.error('[Server Error]', err);
    return sendJson(res, 500, { error: 'Wewnętrzny błąd serwera', details: err.message });
  }
});

// Start serwera
initDb().then(() => {
  server.listen(PORT, HOST, () => {
    console.log(`=========================================`);
    console.log(`🎯 Backend Targi HASta uruchomiony!`);
    console.log(`📡 URL API: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/api`);
    console.log(`⚡ Tryb SSE Live: Aktywny na /api/events`);
    console.log(`=========================================`);
  });
});
