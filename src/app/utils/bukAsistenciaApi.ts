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

const FETCH_TIMEOUT_MS = 90_000;

function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

export function normalizeBukToken(raw: string): string {
  let t = raw.trim();
  if (t.toLowerCase().startsWith('bearer ')) t = t.slice(7).trim();
  return t;
}

function buildAsistenciaUrl(baseUrl: string, page = 1, pageSize = 100): string {
  const base = normalizeBaseUrl(baseUrl);
  const url = new URL(`${base}/asistencia-empresa`);
  url.searchParams.set('page', String(page));
  url.searchParams.set('page_size', String(pageSize));
  return url.toString();
}

async function postBukProxy(
  path: 'test' | 'fetch',
  body: Record<string, unknown>
): Promise<Response> {
  const functionsUrl = getSupabaseFunctionsUrl();
  if (!functionsUrl) throw new Error('Supabase no configurado (VITE_SUPABASE_URL).');

  const accessToken = await getEdgeFunctionAccessToken();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

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
    const res = await postBukProxy('test', {
      baseUrl,
      apiToken,
      targetUrl: buildAsistenciaUrl(baseUrl, 1, 5),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        message: typeof json.error === 'string' ? json.error : `Error ${res.status}`,
        durationMs: Date.now() - start,
      };
    }
    return {
      ok: Boolean(json.ok),
      status: typeof json.status === 'number' ? json.status : undefined,
      message: typeof json.message === 'string' ? json.message : 'Conexión OK.',
      recordHint: typeof json.recordHint === 'string' ? json.recordHint : undefined,
      durationMs: typeof json.durationMs === 'number' ? json.durationMs : Date.now() - start,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: err instanceof Error && err.name === 'AbortError' ? 'Tiempo de espera agotado.' : msg,
      durationMs: Date.now() - start,
    };
  }
}

/** Descarga todas las páginas de asistencia-empresa. */
export async function fetchBukAsistenciaAll(input: {
  baseUrl: string;
  apiToken: string;
  maxPages?: number;
}): Promise<BukAsistenciaRecord[]> {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const apiToken = normalizeBukToken(input.apiToken);
  const maxPages = input.maxPages ?? 20;
  const backend = import.meta.env.VITE_BACKEND ?? 'supabase';

  const all: BukAsistenciaRecord[] = [];

  if (backend !== 'supabase') {
    let page = 1;
    while (page <= maxPages) {
      const res = await fetch(buildAsistenciaUrl(baseUrl, page), {
        headers: { token: apiToken, accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Buk HTTP ${res.status}`);
      const json = (await res.json()) as BukAsistenciaResponse;
      all.push(...(json.data ?? []));
      if (!json.pagination?.next || page >= (json.pagination.totalPages ?? page)) break;
      page += 1;
    }
    return all;
  }

  let page = 1;
  let totalPages = 1;
  while (page <= totalPages && page <= maxPages) {
    const res = await postBukProxy('fetch', {
      baseUrl,
      apiToken,
      page,
      pageSize: 100,
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(typeof json.error === 'string' ? json.error : `Error ${res.status}`);
    }
    const data = Array.isArray(json.data) ? (json.data as BukAsistenciaRecord[]) : [];
    all.push(...data);
    totalPages = typeof json.totalPages === 'number' ? json.totalPages : page;
    if (data.length === 0) break;
    page += 1;
  }
  return all;
}
