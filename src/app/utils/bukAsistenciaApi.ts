/**
 * Cliente Buk Asistencia (Ctrlit) — proxy Edge Function para evitar CORS.
 */
import type { BukAsistenciaRecord, BukAsistenciaResponse } from '../types/asistencia';
import { getEdgeFunctionAccessTokenLazy, getSupabaseFunctionsUrlLazy } from '../services/repository/supabaseLazy';
import { getGrooflowApiBase, getGrooflowToken } from '../services/repository/apiBase';
import { getGrooflowBackend } from '../config/backend';

export const DEFAULT_BUK_ASISTENCIA_BASE_URL =
  'https://app.ctrlit.cl/ctrl/api/v2';

export type BukConnectionResult = {
  ok: boolean;
  status?: number;
  message: string;
  recordHint?: string;
  durationMs: number;
  triedUrl?: string;
};

const FETCH_TIMEOUT_MS = 120_000;
const TEST_TIMEOUT_MS = 45_000;
const BUK_PAGE_SIZE = 100;

async function readJsonSafe(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text.slice(0, 300) };
  }
}

/** Extrae registros Buk del JSON del proxy (soporta respuesta plana o anidada legacy). */
function extractBukRecordsFromProxyJson(json: Record<string, unknown>): BukAsistenciaRecord[] {
  const raw = json.data;
  if (Array.isArray(raw)) {
    if (raw.length === 0) return [];
    const first = raw[0];
    if (first && typeof first === 'object' && first !== null) {
      return raw as BukAsistenciaRecord[];
    }
    return [];
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const nested = (raw as { data?: unknown }).data;
    if (Array.isArray(nested) && nested.length > 0) {
      return nested as BukAsistenciaRecord[];
    }
  }
  return [];
}

function extractBukTotalPages(json: Record<string, unknown>, fallback = 1): number {
  if (typeof json.totalPages === 'number' && json.totalPages > 0) {
    return json.totalPages;
  }
  const raw = json.data;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const pagination = (raw as { pagination?: { totalPages?: number } }).pagination;
    if (typeof pagination?.totalPages === 'number' && pagination.totalPages > 0) {
      return pagination.totalPages;
    }
  }
  return fallback;
}

function proxyErrorMessage(res: Response, json: Record<string, unknown>): string {
  if (typeof json.error === 'string') return json.error;
  if (typeof json.message === 'string') return json.message;
  if (typeof json.raw === 'string') return json.raw;
  if (res.status === 401) {
    return 'Sesión caducada. Cierra sesión, recarga (Ctrl+F5) e inicia sesión de nuevo.';
  }
  if (res.status === 404) {
    return 'Ruta Buk no encontrada en el servidor GrooFlow. Ejecuta: npm run supabase:deploy:server';
  }
  return `Error del servidor GrooFlow (HTTP ${res.status}).`;
}

/**
 * Normaliza la URL base que pega el usuario.
 * Postman suele usar la URL completa; aquí solo va la base hasta /ctrl/api/v2.
 */
export function sanitizeBukBaseUrl(raw: string): string {
  let s = raw.trim();
  if (!s) return DEFAULT_BUK_ASISTENCIA_BASE_URL;

  s = s.split('#')[0].split('?')[0].trim();
  s = s.replace(/\/+$/, '');
  // Quitar endpoint si pegaron la URL completa de Postman
  s = s.replace(/\/asistencia-empresa\/?$/i, '');
  s = s.replace(/\/+$/, '');

  try {
    const u = new URL(s.startsWith('http') ? s : `https://${s}`);
    const host = u.hostname.toLowerCase();
    if (host === 'app.ctrlit.cl' || host.endsWith('.ctrlit.cl')) {
      const path = u.pathname.replace(/\/+$/, '');
      if (!path || path === '/') return DEFAULT_BUK_ASISTENCIA_BASE_URL;
      if (path === '/ctrl' || path === '/ctrl/api') return DEFAULT_BUK_ASISTENCIA_BASE_URL;
      if (!path.includes('/api/v2')) return DEFAULT_BUK_ASISTENCIA_BASE_URL;
      return `${u.origin}${path}`;
    }
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return DEFAULT_BUK_ASISTENCIA_BASE_URL;
  }
}

export function normalizeBukToken(raw: string): string {
  let t = raw.trim();
  if (t.toLowerCase().startsWith('bearer ')) t = t.slice(7).trim();
  return t;
}

export function buildBukAsistenciaUrl(baseUrl: string, page = 1, pageSize = BUK_PAGE_SIZE): string {
  const base = sanitizeBukBaseUrl(baseUrl);
  const url = new URL(`${base}/asistencia-empresa`);
  url.searchParams.set('page', String(page));
  url.searchParams.set('page_size', String(pageSize));
  return url.toString();
}

function bukHttpErrorMessage(status: number, triedUrl: string, bodyPreview?: string): string {
  if (status === 404) {
    return (
      `HTTP 404 — la URL no existe en Buk. ` +
      `Usa solo la base: ${DEFAULT_BUK_ASISTENCIA_BASE_URL} ` +
      `(sin /asistencia-empresa al final). ` +
      `URL probada: ${triedUrl}`
    );
  }
  if (status === 403) {
    return 'HTTP 403 — token inválido o no enviado. Revisa el token en Buk Asistencia.';
  }
  if (bodyPreview?.includes('<!DOCTYPE')) {
    return `HTTP ${status} — Buk devolvió HTML (ruta incorrecta). URL probada: ${triedUrl}`;
  }
  return bodyPreview
    ? `HTTP ${status}: ${bodyPreview.slice(0, 160).replace(/\s+/g, ' ')}`
    : `HTTP ${status} — URL probada: ${triedUrl}`;
}

async function postBukProxy(
  path: 'test' | 'fetch' | 'fetch-all' | 'sync-usuarios',
  body: Record<string, unknown>,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const backend = getGrooflowBackend();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (backend === 'rest') {
      const token = getGrooflowToken();
      if (!token) throw new Error('Sesión caducada. Vuelve a iniciar sesión.');
      return await fetch(`${getGrooflowApiBase()}/proxy/buk/${path}`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    }

    const functionsUrl = await getSupabaseFunctionsUrlLazy();
    if (!functionsUrl) throw new Error('Supabase no configurado (VITE_SUPABASE_URL).');

    const accessToken = await getEdgeFunctionAccessTokenLazy();
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    return await fetch(`${functionsUrl}/buk/${path}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function validateBukAsistenciaConnection(input: {
  baseUrl: string;
  apiToken: string;
}): Promise<BukConnectionResult> {
  const start = Date.now();
  const baseUrl = sanitizeBukBaseUrl(input.baseUrl);
  const apiToken = normalizeBukToken(input.apiToken);
  const triedUrl = buildBukAsistenciaUrl(baseUrl, 1, 5);

  if (!apiToken) {
    return { ok: false, message: 'Indica el token de la API.', durationMs: 0 };
  }

  const backend = getGrooflowBackend();
  if (backend === 'local') {
    try {
      const res = await fetch(triedUrl, {
        headers: { token: apiToken, accept: 'application/json' },
      });
      const text = await res.text();
      let json: BukAsistenciaResponse | null = null;
      try {
        json = text ? (JSON.parse(text) as BukAsistenciaResponse) : null;
      } catch {
        json = null;
      }
      const count = json?.pagination?.count ?? json?.data?.length ?? 0;
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          message: bukHttpErrorMessage(res.status, triedUrl, text),
          triedUrl,
          durationMs: Date.now() - start,
        };
      }
      return {
        ok: true,
        status: res.status,
        message: `Conexión OK. ${count} registro(s) en asistencia.`,
        recordHint: `${count} registros`,
        triedUrl,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        message: msg.includes('Failed to fetch')
          ? 'CORS bloqueado. Usa VITE_BACKEND=supabase.'
          : msg,
        triedUrl,
        durationMs: Date.now() - start,
      };
    }
  }

  try {
    const res = await postBukProxy(
      'test',
      { baseUrl, apiToken, targetUrl: triedUrl },
      TEST_TIMEOUT_MS
    );
    const json = await readJsonSafe(res);
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        message: proxyErrorMessage(res, json),
        triedUrl,
        durationMs: Date.now() - start,
      };
    }
    const ok = json.ok === true;
    const status = typeof json.status === 'number' ? json.status : undefined;
    const serverMessage = typeof json.message === 'string' ? json.message : '';
    const message = ok
      ? serverMessage || 'Conexión OK.'
      : status != null
        ? bukHttpErrorMessage(status, triedUrl, serverMessage)
        : serverMessage || 'La API respondió pero la prueba no fue exitosa.';
    return {
      ok,
      status,
      message,
      recordHint: typeof json.recordHint === 'string' ? json.recordHint : undefined,
      triedUrl,
      durationMs: typeof json.durationMs === 'number' ? json.durationMs : Date.now() - start,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message:
        err instanceof Error && err.name === 'AbortError'
          ? 'Tiempo de espera agotado (~45s). Verifica red o despliega la Edge Function server.'
          : msg,
      triedUrl,
      durationMs: Date.now() - start,
    };
  }
}

async function fetchPageDirect(
  baseUrl: string,
  apiToken: string,
  page: number
): Promise<{ data: BukAsistenciaRecord[]; totalPages: number }> {
  const triedUrl = buildBukAsistenciaUrl(baseUrl, page, BUK_PAGE_SIZE);
  const res = await fetch(triedUrl, {
    headers: { token: apiToken, accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(bukHttpErrorMessage(res.status, triedUrl, text));
  }
  const json = (await res.json()) as BukAsistenciaResponse;
  return {
    data: json.data ?? [],
    totalPages: json.pagination?.totalPages ?? page,
  };
}

async function fetchAllViaProxy(input: {
  baseUrl: string;
  apiToken: string;
  maxPages: number;
}): Promise<BukAsistenciaRecord[]> {
  const res = await postBukProxy('fetch-all', {
    baseUrl: sanitizeBukBaseUrl(input.baseUrl),
    apiToken: input.apiToken,
    maxPages: input.maxPages,
    pageSize: BUK_PAGE_SIZE,
  });
  const json = await readJsonSafe(res);
  if (!res.ok) throw new Error(proxyErrorMessage(res, json));
  const records = extractBukRecordsFromProxyJson(json);
  if (records.length > 0) return records;
  const serverMessage = typeof json.message === 'string' ? json.message : '';
  if (serverMessage && json.ok === false) {
    throw new Error(serverMessage);
  }
  return records;
}

async function fetchAllViaProxyPages(input: {
  baseUrl: string;
  apiToken: string;
  maxPages: number;
  onProgress?: (loaded: number, totalPages: number) => void;
}): Promise<BukAsistenciaRecord[]> {
  const baseUrl = sanitizeBukBaseUrl(input.baseUrl);

  async function fetchPage(page: number): Promise<{
    data: BukAsistenciaRecord[];
    totalPages: number;
  }> {
    const res = await postBukProxy('fetch', {
      baseUrl,
      apiToken: input.apiToken,
      page,
      pageSize: BUK_PAGE_SIZE,
    });
    const json = await readJsonSafe(res);
    if (!res.ok) throw new Error(proxyErrorMessage(res, json));
    const records = extractBukRecordsFromProxyJson(json);
    return {
      data: records,
      totalPages: extractBukTotalPages(json, page),
    };
  }

  const first = await fetchPage(1);
  const all: BukAsistenciaRecord[] = [...first.data];
  const totalPages = Math.min(first.totalPages, input.maxPages);
  input.onProgress?.(1, totalPages);

  for (let page = 2; page <= totalPages; page++) {
    const next = await fetchPage(page);
    all.push(...next.data);
    input.onProgress?.(page, totalPages);
  }

  return all;
}

async function fetchAllDirect(input: {
  baseUrl: string;
  apiToken: string;
  maxPages: number;
  onProgress?: (loaded: number, totalPages: number) => void;
}): Promise<BukAsistenciaRecord[]> {
  const baseUrl = sanitizeBukBaseUrl(input.baseUrl);
  const first = await fetchPageDirect(baseUrl, input.apiToken, 1);
  const all: BukAsistenciaRecord[] = [...first.data];
  const totalPages = Math.min(first.totalPages, input.maxPages);
  input.onProgress?.(1, totalPages);

  for (let page = 2; page <= totalPages; page++) {
    const next = await fetchPageDirect(baseUrl, input.apiToken, page);
    all.push(...next.data);
    input.onProgress?.(page, totalPages);
  }

  return all;
}

/** Descarga todas las páginas de asistencia-empresa (una petición al proxy cuando está disponible). */
export async function fetchBukAsistenciaAll(input: {
  baseUrl: string;
  apiToken: string;
  maxPages?: number;
  onProgress?: (loaded: number, totalPages: number) => void;
}): Promise<BukAsistenciaRecord[]> {
  const baseUrl = sanitizeBukBaseUrl(input.baseUrl);
  const apiToken = normalizeBukToken(input.apiToken);
  const maxPages = input.maxPages ?? 15;
  const backend = getGrooflowBackend();

  if (!apiToken) {
    throw new Error('Falta el token de Buk. Configúralo en Integraciones y guarda los cambios.');
  }

  if (backend === 'local') {
    return fetchAllDirect({ baseUrl, apiToken, maxPages, onProgress: input.onProgress });
  }

  input.onProgress?.(0, 1);

  try {
    const all = await fetchAllViaProxy({ baseUrl, apiToken, maxPages });
    if (all.length > 0) {
      const totalPages =
        Math.min(maxPages, Math.ceil(all.length / BUK_PAGE_SIZE) || 1);
      input.onProgress?.(totalPages, totalPages);
      return all;
    }
    // fetch-all vacío pero HTTP 200: proxy PHP incompleto → paginar con /fetch.
    return fetchAllViaProxyPages({
      baseUrl,
      apiToken,
      maxPages,
      onProgress: input.onProgress,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('404') || msg.includes('no encontrada')) {
      return fetchAllViaProxyPages({
        baseUrl,
        apiToken,
        maxPages,
        onProgress: input.onProgress,
      });
    }
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        'Tiempo de espera agotado (~2 min) al descargar Buk. Reintenta o verifica que la Edge Function server esté desplegada.'
      );
    }
    throw err;
  }
}

export type BukStaffSyncResult = {
  ok: boolean;
  matched?: number;
  updated?: number;
  unmatched_buk?: number;
  users_scanned?: number;
  by_source?: { nomina?: number; asistencia?: number; turnos?: number };
  message?: string;
  error?: string;
  duration_ms?: number;
  synced_at?: string;
};

/** Sincroniza nómina/asistencia/turnos Buk → app_usuarios (vía API GrooFlow). */
export async function syncBukUsuariosToGestion(input?: {
  baseUrl?: string;
  apiToken?: string;
}): Promise<BukStaffSyncResult> {
  const backend = getGrooflowBackend();
  if (backend === 'local') {
    throw new Error('El sync Buk requiere el backend REST de GrooFlow.');
  }
  const body: Record<string, unknown> = {};
  if (input?.baseUrl) body.baseUrl = sanitizeBukBaseUrl(input.baseUrl);
  if (input?.apiToken) body.apiToken = normalizeBukToken(input.apiToken);

  const res = await postBukProxy('sync-usuarios', body, 180_000);
  const json = await readJsonSafe(res);
  if (!res.ok || json.ok === false) {
    return {
      ok: false,
      error: String(json.error ?? json.message ?? `HTTP ${res.status}`),
      duration_ms: typeof json.duration_ms === 'number' ? json.duration_ms : undefined,
    };
  }
  return {
    ok: true,
    matched: Number(json.matched ?? 0),
    updated: Number(json.updated ?? 0),
    unmatched_buk: Number(json.unmatched_buk ?? 0),
    users_scanned: Number(json.users_scanned ?? 0),
    by_source: (json.by_source as BukStaffSyncResult['by_source']) ?? undefined,
    message: String(json.message ?? ''),
    duration_ms: typeof json.duration_ms === 'number' ? json.duration_ms : undefined,
    synced_at: typeof json.synced_at === 'string' ? json.synced_at : undefined,
  };
}
