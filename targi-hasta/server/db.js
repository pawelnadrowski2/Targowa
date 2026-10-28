import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'fair_db.json');

// Domyślny stan bazy danych
const DEFAULT_DB = {
  settings: {
    adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
    erpApiKey: process.env.ERP_API_KEY || null,
    fairName: 'Targi HASta',
    allowExhibitorDelete: true,
    currency: 'PLN',
    ticketPrefix: '#'
  },
  exhibitors: [
    {
      id: 'ex-1',
      name: 'Stoisko Główne HASta',
      accessCode: 'HA-101',
      boothNumber: 'A-01',
      createdAt: Date.now() - 3600000
    },
    {
      id: 'ex-2',
      name: 'Dostawca Premium Tech',
      accessCode: 'PT-202',
      boothNumber: 'B-04',
      createdAt: Date.now() - 3000000
    }
  ],
  orders: []
};

let cachedDb = null;
let saveQueue = Promise.resolve();

// Generowanie klucza API dla integracji ERP (M2M)
export function generateErpApiKey() {
  return `erp_live_${crypto.randomBytes(24).toString('hex')}`;
}

// Generowanie unikalnego, czytelnego kodu dostępu np. AB-123
export function generateAccessCode(existingCodes = []) {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (let attempt = 0; attempt < 100; attempt++) {
    const l1 = letters.charAt(Math.floor(Math.random() * letters.length));
    const l2 = letters.charAt(Math.floor(Math.random() * letters.length));
    const num = Math.floor(100 + Math.random() * 900);
    const code = `${l1}${l2}-${num}`;
    if (!existingCodes.includes(code)) {
      return code;
    }
  }
  return `EX-${Date.now().toString().slice(-4)}`;
}

// Generowanie unikalnego numeru biletu np. #7F2B8C
export function generateTicketNumber(existingTickets = []) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const uid = crypto.randomUUID().replace(/-/g, '').toUpperCase().slice(0, 6);
    const ticket = `#${uid}`;
    if (!existingTickets.includes(ticket)) {
      return ticket;
    }
  }
  return `#${Date.now().toString().slice(-6)}`;
}

// Inicjalizacja bazy
export async function initDb() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      const data = await fs.readFile(DB_FILE, 'utf-8');
      cachedDb = JSON.parse(data);
      if (!cachedDb.settings) cachedDb.settings = { ...DEFAULT_DB.settings };
      if (!cachedDb.settings.erpApiKey) {
        cachedDb.settings.erpApiKey = generateErpApiKey();
        await atomicSave(cachedDb);
      }
      if (!Array.isArray(cachedDb.exhibitors)) cachedDb.exhibitors = [];
      if (!Array.isArray(cachedDb.orders)) cachedDb.orders = [];
    } catch {
      // Plik nie istnieje lub jest uszkodzony - zapisujemy domyślny
      cachedDb = JSON.parse(JSON.stringify(DEFAULT_DB));
      if (!cachedDb.settings.erpApiKey) {
        cachedDb.settings.erpApiKey = generateErpApiKey();
      }
      await atomicSave(cachedDb);
    }
  } catch (err) {
    console.error('[DB] Błąd inicjalizacji bazy:', err);
    cachedDb = JSON.parse(JSON.stringify(DEFAULT_DB));
  }
  return cachedDb;
}

// Atomowy zapis do pliku (przez plik .tmp + rename)
async function atomicSave(data) {
  const tmpFile = `${DB_FILE}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.writeFile(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmpFile, DB_FILE);
}

// Kolejkowanie zapisu, aby zapobiec wyścigom
export function scheduleSave() {
  saveQueue = saveQueue
    .then(async () => {
      if (cachedDb) {
        await atomicSave(cachedDb);
      }
    })
    .catch((err) => {
      console.error('[DB] Błąd atomowego zapisu bazy:', err);
    });
  return saveQueue;
}

export async function getDb() {
  if (!cachedDb) {
    await initDb();
  }
  return cachedDb;
}

// --- Ustawienia ---
export async function getSettings() {
  const db = await getDb();
  return { ...db.settings };
}

export async function updateAdminPassword(newPassword) {
  const db = await getDb();
  db.settings.adminPassword = newPassword;
  await scheduleSave();
  return true;
}

export async function getErpApiKey() {
  const db = await getDb();
  if (!db.settings.erpApiKey) {
    db.settings.erpApiKey = generateErpApiKey();
    await scheduleSave();
  }
  return db.settings.erpApiKey;
}

export async function regenerateErpApiKey() {
  const db = await getDb();
  db.settings.erpApiKey = generateErpApiKey();
  await scheduleSave();
  return db.settings.erpApiKey;
}

export async function validateErpApiKey(providedKey) {
  if (!providedKey) return false;
  const currentKey = await getErpApiKey();
  return providedKey.trim() === currentKey.trim();
}

export async function updateSettings(updates) {
  const db = await getDb();
  db.settings = { ...db.settings, ...updates };
  await scheduleSave();
  return { ...db.settings };
}

// --- Dostawcy (Exhibitors) ---
export async function getExhibitors() {
  const db = await getDb();
  return [...db.exhibitors];
}

export async function findExhibitorByCode(accessCode) {
  if (!accessCode) return null;
  const db = await getDb();
  const normalized = accessCode.trim().toUpperCase();
  return db.exhibitors.find(e => e.accessCode.toUpperCase() === normalized) || null;
}

export async function findExhibitorById(id) {
  const db = await getDb();
  return db.exhibitors.find(e => e.id === id) || null;
}

export async function addExhibitor({ name, boothNumber, customCode }) {
  const db = await getDb();
  const existingCodes = db.exhibitors.map(e => e.accessCode.toUpperCase());
  
  let accessCode = customCode ? customCode.trim().toUpperCase() : null;
  if (!accessCode || existingCodes.includes(accessCode)) {
    accessCode = generateAccessCode(existingCodes);
  }

  const newExhibitor = {
    id: crypto.randomUUID(),
    name: name.trim(),
    accessCode,
    boothNumber: boothNumber ? boothNumber.trim() : '',
    createdAt: Date.now()
  };

  db.exhibitors.push(newExhibitor);
  await scheduleSave();
  return newExhibitor;
}

export async function updateExhibitor(id, { name, boothNumber, regenerateCode }) {
  const db = await getDb();
  const index = db.exhibitors.findIndex(e => e.id === id);
  if (index === -1) return null;

  const current = db.exhibitors[index];
  let accessCode = current.accessCode;

  if (regenerateCode) {
    const existingCodes = db.exhibitors.filter(e => e.id !== id).map(e => e.accessCode.toUpperCase());
    accessCode = generateAccessCode(existingCodes);
  }

  const updated = {
    ...current,
    name: name ? name.trim() : current.name,
    boothNumber: boothNumber !== undefined ? boothNumber.trim() : current.boothNumber,
    accessCode
  };

  db.exhibitors[index] = updated;

  // Jeśli zmieniono nazwę wystawcy, zaktualizuj też etykietę createdBy w zamówieniach
  if (name && name.trim() !== current.name) {
    db.orders.forEach(o => {
      if (o.exhibitorId === id) {
        o.createdBy = name.trim();
      }
    });
  }

  await scheduleSave();
  return updated;
}

export async function deleteExhibitor(id) {
  const db = await getDb();
  const index = db.exhibitors.findIndex(e => e.id === id);
  if (index === -1) return false;

  db.exhibitors.splice(index, 1);
  await scheduleSave();
  return true;
}

// --- Zamówienia (Orders) ---
export async function getOrders(exhibitorId = null) {
  const db = await getDb();
  if (exhibitorId) {
    return db.orders.filter(o => o.exhibitorId === exhibitorId);
  }
  return [...db.orders];
}

export async function findOrderById(id) {
  const db = await getDb();
  return db.orders.find(o => o.id === id) || null;
}

export async function addOrder({ clientName, orderValue, exhibitorId, createdBy }) {
  const db = await getDb();
  const existingTickets = db.orders.map(o => o.ticketNumber);

  const newOrder = {
    id: crypto.randomUUID(),
    clientName: clientName.trim(),
    orderValue: Math.round(Number(orderValue) * 100) / 100,
    ticketNumber: generateTicketNumber(existingTickets),
    createdAt: Date.now(),
    isWinner: false,
    exhibitorId: exhibitorId || null,
    createdBy: createdBy || 'Nieznany',
    syncedToErp: false,
    erpSyncedAt: null,
    erpReference: null
  };

  db.orders.push(newOrder);
  await scheduleSave();
  return newOrder;
}

export async function deleteOrder(id, exhibitorId = null) {
  const db = await getDb();
  const index = db.orders.findIndex(o => o.id === id);
  if (index === -1) return false;

  // Jeśli usuwa dostawca, upewnij się, że to jego zamówienie
  if (exhibitorId && db.orders[index].exhibitorId !== exhibitorId) {
    throw new Error('Brak uprawnień do usunięcia tego zamówienia');
  }

  db.orders.splice(index, 1);
  await scheduleSave();
  return true;
}

export async function setOrderWinner(id, isWinner = true) {
  const db = await getDb();
  const order = db.orders.find(o => o.id === id);
  if (!order) return null;

  order.isWinner = isWinner;
  await scheduleSave();
  return order;
}

export async function clearAllOrders() {
  const db = await getDb();
  const backup = JSON.parse(JSON.stringify(db.orders));
  db.orders = [];
  await scheduleSave();
  return backup;
}

// --- Integracja z systemami ERP (M2M) ---
export async function getOrdersForErp({
  since,
  synced,
  exhibitorId,
  limit = 100,
  offset = 0
} = {}) {
  const db = await getDb();
  const exhibitorMap = new Map(db.exhibitors.map(e => [e.id, e]));

  let filtered = [...db.orders];

  // Filtr po znaczniku czasu lub ISO (np. since=1716710000000 lub since=2026-10-27T08:00:00Z)
  if (since) {
    const sinceTime = typeof since === 'string' && isNaN(Number(since)) ? Date.parse(since) : Number(since);
    if (!isNaN(sinceTime)) {
      filtered = filtered.filter(o => o.createdAt >= sinceTime);
    }
  }

  // Filtr po statusie synchronizacji z ERP (synced=false zwraca tylko nowe, jeszcze niepobrane zamówienia)
  if (synced === 'false' || synced === false) {
    filtered = filtered.filter(o => !o.syncedToErp);
  } else if (synced === 'true' || synced === true) {
    filtered = filtered.filter(o => !!o.syncedToErp);
  }

  // Filtr po konkretnym dostawcy
  if (exhibitorId) {
    filtered = filtered.filter(o => o.exhibitorId === exhibitorId);
  }

  const totalMatching = filtered.length;
  const parsedLimit = Math.min(Math.max(1, Number(limit) || 100), 1000);
  const parsedOffset = Math.max(0, Number(offset) || 0);

  const paginated = filtered.slice(parsedOffset, parsedOffset + parsedLimit);

  // Wzbogacenie o pełne struktury dostawcy i daty ISO dla parserów ERP
  const enriched = paginated.map(order => {
    const exhibitor = order.exhibitorId ? exhibitorMap.get(order.exhibitorId) : null;
    return {
      id: order.id,
      ticketNumber: order.ticketNumber,
      clientName: order.clientName,
      orderValue: Number(order.orderValue),
      currency: db.settings.currency || 'PLN',
      isWinner: !!order.isWinner,
      createdAt: order.createdAt,
      createdAtIso: new Date(order.createdAt).toISOString(),
      syncedToErp: !!order.syncedToErp,
      erpSyncedAt: order.erpSyncedAt || null,
      erpSyncedAtIso: order.erpSyncedAt ? new Date(order.erpSyncedAt).toISOString() : null,
      erpReference: order.erpReference || null,
      exhibitor: {
        id: order.exhibitorId || null,
        name: exhibitor ? exhibitor.name : (order.createdBy || 'Nieznany'),
        boothNumber: exhibitor ? (exhibitor.boothNumber || '') : ''
      }
    };
  });

  return {
    status: 'success',
    totalMatching,
    limit: parsedLimit,
    offset: parsedOffset,
    hasMore: parsedOffset + parsedLimit < totalMatching,
    currency: db.settings.currency || 'PLN',
    orders: enriched
  };
}

export async function acknowledgeErpOrders(orderIds, erpReference = null) {
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return { updatedCount: 0, acknowledgedIds: [] };
  }
  const db = await getDb();
  const now = Date.now();
  const acknowledgedIds = [];

  db.orders.forEach(order => {
    if (orderIds.includes(order.id)) {
      order.syncedToErp = true;
      order.erpSyncedAt = now;
      if (erpReference) {
        order.erpReference = String(erpReference);
      }
      acknowledgedIds.push(order.id);
    }
  });

  if (acknowledgedIds.length > 0) {
    await scheduleSave();
  }

  return {
    status: 'success',
    updatedCount: acknowledgedIds.length,
    acknowledgedIds,
    erpReference: erpReference || null,
    acknowledgedAt: now,
    acknowledgedAtIso: new Date(now).toISOString()
  };
}

export async function getExhibitorsForErp() {
  const db = await getDb();
  return {
    status: 'success',
    total: db.exhibitors.length,
    exhibitors: db.exhibitors.map(e => ({
      id: e.id,
      name: e.name,
      boothNumber: e.boothNumber || '',
      createdAtIso: e.createdAt ? new Date(e.createdAt).toISOString() : null
    }))
  };
}

export async function getSummaryForErp() {
  const db = await getDb();
  const totalOrders = db.orders.length;
  const totalValue = db.orders.reduce((sum, o) => sum + (Number(o.orderValue) || 0), 0);
  const syncedOrdersCount = db.orders.filter(o => o.syncedToErp).length;
  const pendingOrdersCount = totalOrders - syncedOrdersCount;

  return {
    status: 'success',
    fairName: db.settings.fairName || 'Targi HASta',
    currency: db.settings.currency || 'PLN',
    totalOrders,
    totalValue: Math.round(totalValue * 100) / 100,
    syncedOrdersCount,
    pendingOrdersCount,
    exhibitorsCount: db.exhibitors.length,
    timestamp: Date.now(),
    timestampIso: new Date().toISOString()
  };
}

// --- Statystyki i Raporty ---
export async function getStats() {
  const db = await getDb();
  const totalOrders = db.orders.length;
  const totalValue = db.orders.reduce((sum, o) => sum + (Number(o.orderValue) || 0), 0);
  const eligibleCount = db.orders.filter(o => !o.isWinner).length;
  const winnersCount = db.orders.filter(o => o.isWinner).length;
  const exhibitorsCount = db.exhibitors.length;

  // Statystyki dostawców
  const exhibitorMap = {};
  db.exhibitors.forEach(ex => {
    exhibitorMap[ex.id] = {
      id: ex.id,
      name: ex.name,
      boothNumber: ex.boothNumber || '',
      accessCode: ex.accessCode,
      count: 0,
      totalValue: 0
    };
  });

  db.orders.forEach(o => {
    const key = o.exhibitorId || 'unknown';
    if (!exhibitorMap[key]) {
      exhibitorMap[key] = {
        id: key,
        name: o.createdBy || 'Nieznany',
        boothNumber: '',
        accessCode: '-',
        count: 0,
        totalValue: 0
      };
    }
    exhibitorMap[key].count++;
    exhibitorMap[key].totalValue += (Number(o.orderValue) || 0);
  });

  const exhibitorRanking = Object.values(exhibitorMap).sort((a, b) => b.totalValue - a.totalValue);

  // Statystyki klientów
  const clientMap = {};
  db.orders.forEach(o => {
    const name = o.clientName;
    if (!clientMap[name]) {
      clientMap[name] = { name, count: 0, totalValue: 0 };
    }
    clientMap[name].count++;
    clientMap[name].totalValue += (Number(o.orderValue) || 0);
  });

  const clientRanking = Object.values(clientMap).sort((a, b) => b.totalValue - a.totalValue);

  return {
    totalOrders,
    totalValue,
    eligibleCount,
    winnersCount,
    exhibitorsCount,
    exhibitorRanking,
    clientRanking
  };
}

// --- Kopia zapasowa / Przywracanie ---
export async function createBackup() {
  const db = await getDb();
  return {
    version: '2.0.0',
    timestamp: Date.now(),
    system: 'HASta Targi System',
    data: {
      settings: { ...db.settings, adminPassword: '***' },
      exhibitors: db.exhibitors,
      orders: db.orders
    }
  };
}

export async function restoreBackup(backupData) {
  if (!backupData || !backupData.data) {
    throw new Error('Nieprawidłowa struktura pliku backupu');
  }

  const { exhibitors, orders } = backupData.data;
  if (!Array.isArray(exhibitors) || !Array.isArray(orders)) {
    throw new Error('Backup musi zawierać tablice exhibitors i orders');
  }

  const db = await getDb();
  db.exhibitors = exhibitors;
  db.orders = orders;
  await scheduleSave();
  return { exhibitorsCount: db.exhibitors.length, ordersCount: db.orders.length };
}
