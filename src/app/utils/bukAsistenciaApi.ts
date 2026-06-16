/**
 * Cliente Buk Asistencia (Ctrlit) — proxy Edge Function para evitar CORS.
 */
import type { BukAsistenciaRecord, BukAsistenciaResponse } from '../types/asistencia';
import { getEdgeFunctionAccessToken, getSupabaseFunctionsUrl } from '../services/repository/supabase';

export const DEFAULT_BUK_ASISTENCIA_BASE_URL =
  'https://app.ctrlit.cl/ctrl/api/v2';

export type BukConnectionResult = {
  ok: boolean;
  status?: number;
  message: string;
  recordHint?: string;
  durationMs: number;
};

const FETCH_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 35_000;
const BUK_PAGE_SIZE = 200;
const BUK_FETCH_CONCURRENCY = 4;

async function readJsonSafe(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text.slice(0, 300) };
  }
}

function proxyErrorMessage(res: Response, json: Record<string, unknown>): string {
  if (typeof json.error === 'string') return json.error;
  if (typeof json.message === 'string') return json.message;
  if (typeof json.raw === 'string') return json.raw;
  if (res.status === 404) {
    return 'Ruta /buk/test no encontrada en el servidor. Despliega la Edge Function: supabase functions deploy server';
  }
  return `Error del servidor GrooFlow (HTTP ${res.status}).`;
}

function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

export function normalizeBukToken(raw: string): string {
  let t = raw.trim();
  if (t.toLowerCase().startsWith('bearer ')) t = t.slice(7).trim();
  return t;
}

function buildAsistenciaUrl(baseUrl: string, page = 1, pageSize = BUK_PAGE_SIZE): string {
  const base = normalizeBaseUrl(baseUrl);
  const url = new URL(`${base}/asistencia-empresa`);
  url.searchParams.set('page', String(page));
  url.searchParams.set('page_size', String(pageSize));
  return url.toString();
}

async function postBukProxy(
  path: 'test' | 'fetch',
  body: Record<string, unknown>,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const functionsUrl = getSupabaseFunctionsUrl();
  if (!functionsUrl) throw new Error('Supabase no configurado (VITE_SUPABASE_URL).');

  const accessToken = await getEdgeFunctionAccessToken();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
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
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const apiToken = normalizeBukToken(input.apiToken);

  if (!baseUrl) {
    return { ok: false, message: 'Indica la URL base de Buk Asistencia.', durationMs: 0 };
  }
  if (!apiToken) {
    return { ok: false, message: 'Indica el token de la API.', durationMs: 0 };
  }

  const backend = import.meta.env.VITE_BACKEND ?? 'supabase';
  if (backend !== 'supabase') {
    try {
      const res = await fetch(buildAsistenciaUrl(baseUrl, 1, 5), {
        headers: { token: apiToken, accept: 'application/json' },
      });
      const json = (await res.json()) as BukAsistenciaResponse;
      const count = json?.pagination?.count ?? json?.data?.length ?? 0;
      return {
        ok: res.ok,
        status: res.status,
        message: res.ok
          ? `Conexión OK. ${count} registro(s) en asistencia.`
          : `HTTP ${res.status}`,
        recordHint: res.ok ? `${count} registros` : undefined,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        message: msg.includes('Failed to fetch')
          ? 'CORS bloqueado. Usa VITE_BACKEND=supabase.'
          : msg,
        durationMs: Date.now() - start,
      };
    }
  }

  try {
    const res = await postBukProxy(
      'test',
      {
        baseUrl,
        apiToken,
        targetUrl: buildAsistenciaUrl(baseUrl, 1, 5),
      },
      TEST_TIMEOUT_MS
    );
    const json = await readJsonSafe(res);
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        message: proxyErrorMessage(res, json),
        durationMs: Date.now() - start,
      };
    }
    const ok = json.ok === true;
    const message =
      typeof json.message === 'string'
        ? json.message
        : ok
          ? 'Conexión OK.'
          : 'La API respondió pero la prueba no fue exitosa.';
    return {
      ok,
      status: typeof json.status === 'number' ? json.status : undefined,
      message,
      recordHint: typeof json.recordHint === 'string' ? json.recordHint : undefined,
      durationMs: typeof json.durationMs === 'number' ? json.durationMs : Date.now() - start,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message:
        err instanceof Error && err.name === 'AbortError'
          ? 'Tiempo de espera agotado (~35s). Verifica red o despliega la Edge Function server.'
          : msg,
      durationMs: Date.now() - start,
    };
  }
}

/** Descarga todas las páginas de asistencia-empresa (páginas en paralelo). */
export async function fetchBukAsistenciaAll(input: {
  baseUrl: string;
  apiToken: string;
  maxPages?: number;
  onProgress?: (loaded: number, totalPages: number) => void;
}): Promise<BukAsistenciaRecord[]> {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const apiToken = normalizeBukToken(input.apiToken);
  const maxPages = input.maxPages ?? 15;
  const backend = import.meta.env.VITE_BACKEND ?? 'supabase';

  async function fetchPageDirect(page: number): Promise<{
    data: BukAsistenciaRecord[];
    totalPages: number;
  }> {
    const res = await fetch(buildAsistenciaUrl(baseUrl, page, BUK_PAGE_SIZE), {
      headers: { token: apiToken, accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Buk HTTP ${res.status}`);
    const json = (await res.json()) as BukAsistenciaResponse;
    return {
      data: json.data ?? [],
      totalPages: json.pagination?.totalPages ?? page,
    };
  }

  async function fetchPageProxy(page: number): Promise<{
    data: BukAsistenciaRecord[];
    totalPages: number;
  }> {
    const res = await postBukProxy('fetch', {
      baseUrl,
      apiToken,
      page,
      pageSize: BUK_PAGE_SIZE,
    });
    const json = await readJsonSafe(res);
    if (!res.ok) throw new Error(proxyErrorMessage(res, json));
    return {
      data: Array.isArray(json.data) ? (json.data as BukAsistenciaRecord[]) : [],
      totalPages: typeof json.totalPages === 'number' ? json.totalPages : page,
    };
  }

  const fetchPage = backend !== 'supabase' ? fetchPageDirect : fetchPageProxy;

  const first = await fetchPage(1);
  const all: BukAsistenciaRecord[] = [...first.data];
  const totalPages = Math.min(first.totalPages, maxPages);
  input.onProgress?.(1, totalPages);

  const pages: number[] = [];
  for (let p = 2; p <= totalPages; p++) pages.push(p);

  for (let i = 0; i < pages.length; i += BUK_FETCH_CONCURRENCY) {
    const batch = pages.slice(i, i + BUK_FETCH_CONCURRENCY);
    const results = await Promise.all(batch.map((p) => fetchPage(p)));
    for (const r of results) all.push(...r.data);
    input.onProgress?.(Math.min(i + batch.length + 1, totalPages), totalPages);
  }

  return all;
}
