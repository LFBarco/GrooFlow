/**
 * ============================================================
 *  GROOFLOW — SUPABASE ADAPTER
 * ============================================================
 *
 * Implements IDataRepository using:
 *   - Supabase Auth  (authentication)
 *   - Supabase Edge Function (KV store — current approach)
 *   - Supabase Tables (future — uncomment table sections below)
 *
 * When Supabase tables are ready, you only need to:
 *   1. Create the tables (see BACKEND_MIGRATION.md)
 *   2. Uncomment the table implementations below
 *   3. Remove / comment the Edge Function KV calls
 * ============================================================
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  IDataRepository,
  IAuthRepository,
  IKVRepository,
  ICollectionRepository,
  AuthUser,
} from '../types';

// ─── Config ──────────────────────────────────────────────────

const env = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env
  : {} as Record<string, string | undefined>;

/** Valores vacíos en .env cuentan como "no definido" (evita URL "" → Failed to fetch) */
function envStr(key: string): string | undefined {
  const v = env[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

/**
 * Sin proyecto “por defecto” en el código: si no hay .env, no apuntamos a otro Supabase ajeno.
 * Crea .env en la raíz con VITE_SUPABASE_URL (o PROJECT_ID) + VITE_SUPABASE_ANON_KEY.
 */
const projectRef = envStr('VITE_SUPABASE_PROJECT_ID');
const SUPABASE_URL =
  envStr('VITE_SUPABASE_URL') ??
  (projectRef ? `https://${projectRef}.supabase.co` : '');

const SUPABASE_ANON_KEY = envStr('VITE_SUPABASE_ANON_KEY') ?? '';

/** Para mostrar en UI (diagnóstico) qué proyecto está usando la app */
export function getConfiguredSupabaseUrl(): string {
  if (!SUPABASE_URL || !SUPABASE_URL.includes('.supabase.co')) {
    return '(no configurado — falta .env; ver docs/CREAR_ARCHIVO_ENV.md)';
  }
  return SUPABASE_URL;
}

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error(
      '[GrooFlow] Falta .env con Supabase. En la raíz del proyecto crea .env con:\n' +
      '  VITE_SUPABASE_URL=https://TU-REF.supabase.co\n' +
      '  VITE_SUPABASE_ANON_KEY=eyJ... (Settings → API → anon public)\n' +
      'Luego: Ctrl+C y npm run dev'
    );
  } else if (!SUPABASE_ANON_KEY.startsWith('eyJ')) {
    console.warn('[GrooFlow] Revisa VITE_SUPABASE_ANON_KEY en .env');
  }
}

/**
 * Base de la función Edge `server` + prefijo Hono `make-server-674cc941`.
 * Override: VITE_SUPABASE_FUNCTIONS_URL=https://REF.supabase.co/functions/v1/server/make-server-674cc941
 */
const FUNCTIONS_URL =
  envStr('VITE_SUPABASE_FUNCTIONS_URL') ??
  (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/server/make-server-674cc941` : '');

/** Las claves tipo `data:users` llevan `:`; deben ir codificadas en el path o el gateway devuelve 404. */
function kvPathSegment(key: string): string {
  return encodeURIComponent(key);
}

/** True si el JWT falta o expira en menos de ~2 min (evita 401 en Edge con token viejo en storage). */
function accessTokenNeedsRefresh(accessToken: string | undefined): boolean {
  if (!accessToken) return true;
  try {
    const parts = accessToken.split('.');
    if (parts.length < 2) return true;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const json = atob(b64 + pad);
    const payload = JSON.parse(json) as { exp?: number };
    const exp = typeof payload.exp === 'number' ? payload.exp : 0;
    const now = Date.now() / 1000;
    return now >= exp - 120;
  } catch {
    return true;
  }
}

function parseJwtPayload(accessToken: string): Record<string, unknown> | null {
  try {
    const parts = accessToken.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const json = atob(b64 + pad);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Evita enviar un JWT de otro proyecto (mezcla de storage / .env distintos). */
function assertAccessTokenMatchesProject(accessToken: string, supabaseUrl: string): void {
  if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) return;
  const host = new URL(supabaseUrl).hostname;
  const payload = parseJwtPayload(accessToken);
  if (!payload) return;
  const iss = typeof payload.iss === 'string' ? payload.iss : '';
  if (iss && !iss.includes(host)) {
    throw new Error(
      `El token de sesión no pertenece a este proyecto Supabase (${host}). ` +
        'Cierra sesión, borra datos del sitio para este dominio (opcional) y vuelve a entrar con el mismo proyecto que está en tu .env.'
    );
  }
}

const REFRESH_SESSION_TIMEOUT_MS = 45_000;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label}: tiempo agotado (${ms / 1000}s). Revisa la conexión e inténtalo de nuevo.`)),
      ms
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * Token para Edge Functions (admin-create-user, KV, etc.).
 * IMPORTANTE: si el JWT aún es válido, se reutiliza sin llamar a refreshSession()
 * (refreshSession puede tardar mucho o quedar colgado en algunos entornos/redes).
 */
async function getFreshAccessTokenForEdge(sb: SupabaseClient): Promise<string> {
  const { data: existing } = await sb.auth.getSession();
  const existingToken = existing.session?.access_token;
  if (existingToken && !accessTokenNeedsRefresh(existingToken)) {
    assertAccessTokenMatchesProject(existingToken, SUPABASE_URL);
    return existingToken;
  }

  const { data, error } = await withTimeout(
    sb.auth.refreshSession(),
    REFRESH_SESSION_TIMEOUT_MS,
    'Renovar sesión (Supabase)'
  );
  if (error) {
    throw new Error(
      `No se pudo renovar la sesión: ${error.message}. ` +
        'Cierra sesión, recarga la página (Ctrl+F5) e inicia sesión de nuevo. ' +
        'Si el error es invalid_grant, tu refresh token caducó: vuelve a iniciar sesión.'
    );
  }
  const token = data.session?.access_token;
  if (!token) {
    throw new Error(
      'Sesión sin token de acceso. Cierra sesión e inicia sesión de nuevo (no uses acceso demo si VITE_BACKEND=supabase).'
    );
  }
  assertAccessTokenMatchesProject(token, SUPABASE_URL);
  return token;
}

/** Evita que el botón "Creando…" quede colgado si la Edge Function no responde. */
const EDGE_FETCH_TIMEOUT_MS = 55_000;

async function postEdgeFunctionJson(
  functionName: string,
  body: Record<string, unknown>,
  accessToken: string
): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
  if (!SUPABASE_URL?.startsWith('https://')) {
    throw new Error(
      'Falta VITE_SUPABASE_URL en el build. Reconstruye la app con el .env correcto (misma carpeta que package.json).'
    );
  }
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.length < 40) {
    throw new Error(
      'Falta VITE_SUPABASE_ANON_KEY en el build. Reconstruye la app tras corregir .env.'
    );
  }
  const endpoint = `${SUPABASE_URL}/functions/v1/${functionName}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EDGE_FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(
        `La función "${functionName}" no respondió en ${EDGE_FETCH_TIMEOUT_MS / 1000}s. ` +
          'Revisa red, que la Edge Function esté desplegada y CORS/ALLOWED_ORIGINS en Supabase.'
      );
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text };
}

// ─── Supabase client singleton ───────────────────────────────

let _client: SupabaseClient | null = null;

/** URL/clave mínimas para que createClient no reciba "" (evita pantalla en blanco si .env falla). */
const FALLBACK_URL = 'https://invalid-env-placeholder.supabase.co';
const FALLBACK_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24ifQ.placeholder';

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    const urlOk =
      typeof SUPABASE_URL === 'string' &&
      SUPABASE_URL.startsWith('https://') &&
      SUPABASE_URL.includes('.supabase.co');
    const keyOk =
      typeof SUPABASE_ANON_KEY === 'string' && SUPABASE_ANON_KEY.length >= 40;
    _client = createClient(
      urlOk ? SUPABASE_URL : FALLBACK_URL,
      keyOk ? SUPABASE_ANON_KEY : FALLBACK_KEY
    );
  }
  return _client;
}

// ─── Auth Implementation ─────────────────────────────────────

class SupabaseAuthRepository implements IAuthRepository {
  private get sb() { return getSupabaseClient(); }

  async getSession(): Promise<AuthUser | null> {
    const { data } = await this.sb.auth.getSession();
    const u = data.session?.user;
    if (!u) return null;
    return { id: u.id, email: u.email!, name: u.user_metadata?.name };
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    const u = data.user!;
    return { id: u.id, email: u.email!, name: u.user_metadata?.name };
  }

  async signOut(): Promise<void> {
    await this.sb.auth.signOut({ scope: 'global' });
  }

  async createUser(email: string, password: string, name: string): Promise<AuthUser> {
    // NO usar auth.signUp aquí (cambia la sesión al usuario nuevo).
    // Invocamos la Edge Function con fetch explícito: evita interacción rara del SDK
    // (fetchWithAuth / getSession puede mandar anon si el token caducó).
    const accessToken = await getFreshAccessTokenForEdge(this.sb);
    assertAccessTokenMatchesProject(accessToken, SUPABASE_URL);

    const result = await postEdgeFunctionJson(
      'admin-create-user',
      { email, password, name },
      accessToken
    );

    const raw = result.json;
    const payload =
      raw && typeof raw === 'object'
        ? (raw as { user?: { id: string; email?: string }; error?: string; message?: string })
        : null;

    if (result.ok && payload?.user?.id) {
      return { id: payload.user.id, email: payload.user.email ?? email, name };
    }

    const apiMsg = typeof payload?.message === 'string' ? payload.message : '';
    const fnErr = typeof payload?.error === 'string' ? payload.error : '';
    const detail =
      fnErr.trim() ||
      apiMsg.trim() ||
      (typeof result.text === 'string' ? result.text.trim() : '') ||
      `HTTP ${result.status}`;

    if (detail.toLowerCase().includes('invalid jwt')) {
      throw new Error(
        'Supabase rechazó el JWT en el gateway. Suele pasar si el token caducó y se reutilizó uno viejo, ' +
          'o si el navegador mezcla sesiones de otro proyecto. Cierra sesión, borra datos del sitio para este dominio, ' +
          'Ctrl+F5 y entra otra vez. Verifica que el build use el mismo VITE_SUPABASE_URL y anon key del proyecto.'
      );
    }

    throw new Error(detail || 'Error al crear el usuario');
  }

  async updateUserPassword(userIdOrEmail: string, newPassword: string): Promise<void> {
    const accessToken = await getFreshAccessTokenForEdge(this.sb);
    assertAccessTokenMatchesProject(accessToken, SUPABASE_URL);
    const body = userIdOrEmail.includes('@')
      ? { email: userIdOrEmail, newPassword }
      : { userId: userIdOrEmail, newPassword };
    const result = await postEdgeFunctionJson('admin-update-password', body, accessToken);
    if (result.ok) return;

    const raw = result.json;
    const payload =
      raw && typeof raw === 'object'
        ? (raw as { error?: string; message?: string })
        : null;
    const apiMsg = typeof payload?.message === 'string' ? payload.message : '';
    const fnErr = typeof payload?.error === 'string' ? payload.error : '';
    const detail =
      fnErr.trim() || apiMsg.trim() || (typeof result.text === 'string' ? result.text.trim() : '') || `HTTP ${result.status}`;
    throw new Error(detail || 'No se pudo actualizar la contraseña');
  }

  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    const { data } = this.sb.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      callback(u ? { id: u.id, email: u.email!, name: u.user_metadata?.name } : null);
    });
    return () => data.subscription.unsubscribe();
  }
}

// ─── KV Implementation (Edge Function store) ─────────────────
//
// MODO PRODUCCIÓN: SOLO NUBE.
// No se usan lecturas/escrituras en localStorage para evitar datos fantasma
// o divergencias entre navegadores/sesiones.
//
// FUTURE: Replace with a real `app_kv` Supabase table:
//   CREATE TABLE app_kv (key text PRIMARY KEY, value jsonb, updated_at timestamptz DEFAULT now());
//   Then swap the fetch() calls for supabase.from('app_kv').upsert(...)

class SupabaseKVRepository implements IKVRepository {
  private async authHeaders(): Promise<Record<string, string>> {
    const sb = getSupabaseClient();
    const token = await getFreshAccessTokenForEdge(sb);
    return {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    };
  }

  async getWithStatus<T = unknown>(key: string): Promise<{ ok: boolean; value: T | null }> {
    try {
      const headers = await this.authHeaders();
      const res = await fetch(`${FUNCTIONS_URL}/kv/${kvPathSegment(key)}`, {
        method: 'GET',
        headers,
      });
      if (!res.ok) {
        console.error(`[kv:getWithStatus] ${key} HTTP ${res.status}`);
        return { ok: false, value: null };
      }
      const payload = (await res.json()) as { data?: T | null };
      return { ok: true, value: (payload.data ?? null) as T | null };
    } catch (e) {
      console.error(`[kv:getWithStatus] ${key}`, e);
      return { ok: false, value: null };
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const { value } = await this.getWithStatus<T>(key);
    return value;
  }

  async set(key: string, value: unknown): Promise<void> {
    const headers = await this.authHeaders();
    const res = await fetch(`${FUNCTIONS_URL}/kv/${kvPathSegment(key)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(value),
    });
    if (!res.ok) {
      throw new Error(`KV SET failed (${res.status})`);
    }
  }

  async delete(key: string): Promise<void> {
    // Mantener compatibilidad: no-op remoto (endpoint DELETE aún no expuesto).
    // Importante: no borrar local porque ya no usamos almacenamiento local.
    console.warn(`[kv:delete] no-op for key "${key}" (DELETE endpoint not implemented)`);
  }
}

// ─── Generic Collection — localStorage + KV store ────────────
//
// CURRENT: Each collection is serialised as a single JSON blob in KV.
//
// FUTURE (Supabase tables): Replace with direct supabase.from() calls.
// Template shown below. Just swap the class body when tables exist.
//
// class SupabaseCollectionRepository<T extends { id: string }>
//   implements ICollectionRepository<T> {
//
//   constructor(private readonly table: string) {}
//   private get sb() { return getSupabaseClient(); }
//
//   async getAll(filters?: Partial<T>) {
//     let q = this.sb.from(this.table).select('*');
//     if (filters) {
//       Object.entries(filters).forEach(([k, v]) => { q = q.eq(k, v); });
//     }
//     const { data, error } = await q;
//     if (error) throw error;
//     return (data ?? []) as T[];
//   }
//
//   async getById(id: string) {
//     const { data, error } = await this.sb.from(this.table).select('*').eq('id', id).single();
//     if (error) return null;
//     return data as T;
//   }
//
//   async create(record: T) {
//     const { data, error } = await this.sb.from(this.table).insert(record).select().single();
//     if (error) throw error;
//     return data as T;
//   }
//
//   async update(id: string, record: Partial<T>) {
//     const { data, error } = await this.sb.from(this.table).update(record).eq('id', id).select().single();
//     if (error) throw error;
//     return data as T;
//   }
//
//   async delete(id: string) {
//     const { error } = await this.sb.from(this.table).delete().eq('id', id);
//     if (error) throw error;
//   }
//
//   async upsertMany(records: T[]) {
//     if (!records.length) return;
//     const { error } = await this.sb.from(this.table).upsert(records);
//     if (error) throw error;
//   }
// }

class KVCollectionRepository<T extends { id: string }>
  implements ICollectionRepository<T> {

  private readonly kv: IKVRepository;

  constructor(private readonly key: string, kv: IKVRepository) {
    this.kv = kv;
  }

  private async load(): Promise<T[]> {
    return (await this.kv.get<T[]>(this.key)) ?? [];
  }

  private async save(records: T[]): Promise<void> {
    await this.kv.set(this.key, records);
  }

  async getAll(filters?: Partial<T>): Promise<T[]> {
    const all = await this.load();
    if (!filters) return all;
    return all.filter(item =>
      Object.entries(filters).every(([k, v]) => (item as any)[k] === v)
    );
  }

  async getById(id: string): Promise<T | null> {
    const all = await this.load();
    return all.find(r => r.id === id) ?? null;
  }

  async create(record: T): Promise<T> {
    const all = await this.load();
    const exists = all.some(r => r.id === record.id);
    if (exists) throw new Error(`Record ${record.id} already exists in ${this.key}`);
    await this.save([record, ...all]);
    return record;
  }

  async update(id: string, partial: Partial<T>): Promise<T> {
    const all = await this.load();
    const idx = all.findIndex(r => r.id === id);
    if (idx === -1) throw new Error(`Record ${id} not found in ${this.key}`);
    const updated = { ...all[idx], ...partial } as T;
    all[idx] = updated;
    await this.save(all);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const all = await this.load();
    await this.save(all.filter(r => r.id !== id));
  }

  async upsertMany(records: T[]): Promise<void> {
    if (!records.length) return;
    const existing = await this.load();
    const map = new Map(existing.map(r => [r.id, r]));
    records.forEach(r => map.set(r.id, r));
    await this.save(Array.from(map.values()));
  }
}

// ─── Repository factory ───────────────────────────────────────

function buildSupabaseRepository(): IDataRepository {
  const kv = new SupabaseKVRepository();

  return {
    auth:         new SupabaseAuthRepository(),
    kv,
    transactions: new KVCollectionRepository('data:transactions', kv),
    providers:    new KVCollectionRepository('data:providers', kv),
    requests:     new KVCollectionRepository('data:requests', kv),
    invoices:     new KVCollectionRepository('data:invoices', kv),
    pettyCash:    new KVCollectionRepository('data:pettyCash', kv),
    users:        new KVCollectionRepository('data:users', kv),
    roles:        new KVCollectionRepository('data:roles', kv),
    requisitions: new KVCollectionRepository('data:requisitions', kv),
  };
}

export const supabaseRepository: IDataRepository = buildSupabaseRepository();
