import crypto from 'node:crypto';
import { getSettings, findExhibitorByCode, validateErpApiKey } from './db.js';

// Przechowalnia aktywnych sesji w pamięci
// token -> { role, name, id, accessCode, createdAt, expiresAt }
const sessions = new Map();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 godziny

// Czyszczenie wygasłych sesji
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      sessions.delete(token);
    }
  }
}, 60 * 60 * 1000);

export function createSession(data) {
  const token = crypto.randomBytes(32).toString('hex');
  const session = {
    ...data,
    token,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS
  };
  sessions.set(token, session);
  return session;
}

export function getSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

export function removeSession(token) {
  if (token) {
    sessions.delete(token);
  }
}

// Logowanie administratora
export async function authenticateAdmin(password) {
  const settings = await getSettings();
  const superuserToken = process.env.VITE_SUPERUSER_TOKEN || process.env.SUPERUSER_TOKEN;

  if (superuserToken && password === superuserToken) {
    return createSession({
      role: 'SUPERUSER',
      name: 'Główny Administrator (Superuser)'
    });
  }

  if (password === settings.adminPassword) {
    return createSession({
      role: 'ADMIN',
      name: 'Administrator Targów'
    });
  }

  return null;
}

// Logowanie dostawcy za pomocą otrzymanego kodu dostępu (np. AB-123)
export async function authenticateExhibitor(accessCode) {
  if (!accessCode) return null;
  const exhibitor = await findExhibitorByCode(accessCode);
  if (!exhibitor) return null;

  return createSession({
    role: 'EXHIBITOR',
    name: exhibitor.name,
    id: exhibitor.id,
    accessCode: exhibitor.accessCode,
    boothNumber: exhibitor.boothNumber || ''
  });
}

// Pomocnik do pobierania sesji z nagłówka żądania
export function getSessionFromRequest(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return getSession(match[1]);
}

// Weryfikacja dostępu dla integracji ERP (Machine-to-Machine)
export async function verifyErpAccess(req, queryParams = {}) {
  // 1. Sprawdź dedykowany nagłówek X-API-Key
  const apiKeyHeader = req.headers['x-api-key'];
  if (apiKeyHeader && (await validateErpApiKey(apiKeyHeader))) {
    return { authorized: true, source: 'API_KEY_HEADER' };
  }

  // 2. Sprawdź parametr w URL ?api_key=...
  if (queryParams.api_key && (await validateErpApiKey(queryParams.api_key))) {
    return { authorized: true, source: 'API_KEY_QUERY' };
  }

  // 3. Sprawdź nagłówek Authorization: Bearer <key>
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (token && (await validateErpApiKey(token))) {
      return { authorized: true, source: 'BEARER_API_KEY' };
    }

    // 4. Ewentualnie zezwól aktywnej sesji administratora
    const session = getSession(token);
    if (session && (session.role === 'ADMIN' || session.role === 'SUPERUSER')) {
      return { authorized: true, source: 'ADMIN_SESSION' };
    }
  }

  return { authorized: false };
}
