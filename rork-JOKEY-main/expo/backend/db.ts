declare global {
  var __dbConfig: { endpoint: string; ns: string; token: string } | undefined;
}

function getEnv(key: string): string {
  try {
    // @ts-ignore - Deno runtime
    if (typeof Deno !== 'undefined' && Deno.env) {
      // @ts-ignore
      const val = Deno.env.get(key);
      if (val) return val;
    }
  } catch {}
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || '';
  }
  return '';
}

function getDBConfig() {
  const injected = globalThis.__dbConfig;
  if (injected?.endpoint && injected?.ns && injected?.token) {
    return { url: injected.endpoint, ns: injected.ns, token: injected.token, dbName: 'joky' };
  }
  const url = getEnv('EXPO_PUBLIC_RORK_DB_ENDPOINT');
  const ns = getEnv('EXPO_PUBLIC_RORK_DB_NAMESPACE');
  const token = getEnv('EXPO_PUBLIC_RORK_DB_TOKEN');
  return { url, ns, token, dbName: 'joky' };
}

interface DBResult<T = any> {
  status: string;
  result: T;
  time: string;
}

export async function dbQuery<T = any>(sql: string): Promise<T[]> {
  const { url, ns, token, dbName } = getDBConfig();
  console.log('[DB] Query:', sql.substring(0, 300));
  console.log('[DB] Config - URL:', url ? 'SET' : 'MISSING', 'NS:', ns ? 'SET' : 'MISSING', 'Token:', token ? 'SET' : 'MISSING', 'Injected:', globalThis.__dbConfig ? 'YES' : 'NO');

  if (!url || !ns || !token) {
    console.error('[DB] dbQuery missing config - URL:', url ? 'SET' : 'EMPTY', 'NS:', ns ? 'SET' : 'EMPTY', 'Token:', token ? 'SET' : 'EMPTY');
    throw new Error('Base de données non configurée. Veuillez réessayer.');
  }

  const response = await fetch(`${url}/sql`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'text/plain',
      'Authorization': `Bearer ${token}`,
      'surreal-ns': ns,
      'surreal-db': dbName,
    },
    body: sql,
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[DB] HTTP Error:', response.status, errText);
    throw new Error(`Erreur base de données: ${response.status}`);
  }

  const results: DBResult<T[]>[] = await response.json();
  console.log('[DB] Results count:', results.length);

  for (const r of results) {
    if (r.status === 'ERR') {
      console.error('[DB] Query error:', r.result);
      throw new Error(String(r.result));
    }
  }

  const last = results[results.length - 1];
  if (!last) return [];

  if (Array.isArray(last.result)) {
    return last.result;
  }
  if (last.result !== null && last.result !== undefined) {
    return [last.result] as T[];
  }
  return [];
}

export async function dbQueryFirst<T = any>(sql: string): Promise<T | null> {
  const results = await dbQuery<T>(sql);
  return results.length > 0 ? results[0] : null;
}

export async function dbQueryAll<T = any>(sql: string): Promise<DBResult<T[]>[]> {
  const { url, ns, token, dbName } = getDBConfig();

  if (!url || !ns || !token) {
    console.error('[DB] dbQueryAll missing config');
    throw new Error('Base de données non configurée');
  }

  const response = await fetch(`${url}/sql`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'text/plain',
      'Authorization': `Bearer ${token}`,
      'surreal-ns': ns,
      'surreal-db': dbName,
    },
    body: sql,
  });

  if (!response.ok) {
    throw new Error(`Erreur base de données: ${response.status}`);
  }

  return response.json();
}

export function esc(val: string): string {
  return val
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

export function extractId(surrealId: any): string {
  if (!surrealId) return '';
  const str = String(surrealId);
  const colonIdx = str.indexOf(':');
  if (colonIdx >= 0) {
    const afterColon = str.substring(colonIdx + 1);
    if (afterColon.startsWith('⟨') && afterColon.endsWith('⟩')) {
      return afterColon.slice(1, -1);
    }
    return afterColon;
  }
  return str;
}

export function toRecordId(table: string, id: string): string {
  if (id.includes(':')) return id;
  return `${table}:⟨${id}⟩`;
}

let dbInitialized = false;

export async function initDB(): Promise<void> {
  if (dbInitialized) return;

  console.log('[DB] Initializing database...');
  const { url, ns, token } = getDBConfig();
  if (!url || !ns || !token) {
    console.error('[DB] Cannot init - missing config');
    return;
  }

  try {
    await dbQuery(`SELECT count() FROM users GROUP ALL;`);
    dbInitialized = true;
    console.log('[DB] Database initialized successfully');
  } catch (err) {
    console.error('[DB] Init connectivity test failed:', err);
    dbInitialized = true;
    console.log('[DB] Marking as initialized anyway - queries will fail individually if DB is unreachable');
  }
}

async function sha256Backend(message: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const data = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    console.warn('[DB] crypto.subtle not available, using fallback');
  }
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  const base = Math.abs(hash).toString(16);
  let result = base;
  while (result.length < 64) {
    let next = 0;
    for (let i = 0; i < result.length; i++) {
      next = ((next << 5) - next + result.charCodeAt(i)) | 0;
    }
    result += Math.abs(next).toString(16);
  }
  return result.substring(0, 64);
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const hash = await sha256Backend(salt + ':' + password);
  return { hash, salt };
}

export async function verifyPassword(password: string, salt: string, storedHash: string): Promise<boolean> {
  const computedHash = await sha256Backend(salt + ':' + password);
  return computedHash === storedHash;
}
