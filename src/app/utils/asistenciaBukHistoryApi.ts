/**
 * Cliente REST — historial de marcaciones Buk en MySQL (GrooFlow backend).
 */
import type { BukAsistenciaRecord } from '../types/asistencia';
import { getGrooflowApiBase, getGrooflowToken } from '../services/repository/apiBase';
import { getGrooflowBackend } from '../config/backend';

async function historyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getGrooflowToken();
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('X-Groomers-Client', 'grooflow');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${getGrooflowApiBase()}${path}`, { ...init, headers });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  if (text.trim()) {
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = { error: text.slice(0, 200) };
    }
  }
  if (!res.ok) {
    const err =
      typeof json.error === 'string' && json.error.length < 180
        ? json.error
        : `HTTP ${res.status}`;
    throw new Error(err);
  }
  return json as T;
}

const UPSERT_CHUNK = 400;

export async function upsertBukAsistenciaHistory(
  records: BukAsistenciaRecord[],
  fetchedAt?: number
): Promise<{ upserted: number }> {
  if (getGrooflowBackend() === 'local') {
    return { upserted: 0 };
  }
  if (!records.length) return { upserted: 0 };

  let upserted = 0;
  const fetchedAtIso = fetchedAt
    ? new Date(fetchedAt).toISOString().slice(0, 19).replace('T', ' ')
    : undefined;

  for (let i = 0; i < records.length; i += UPSERT_CHUNK) {
    const chunk = records.slice(i, i + UPSERT_CHUNK);
    const res = await historyFetch<{ ok: boolean; upserted?: number }>(
      '/asistencia/buk-records/upsert',
      {
        method: 'POST',
        body: JSON.stringify({ records: chunk, fetchedAt: fetchedAtIso }),
      }
    );
    upserted += res.upserted ?? chunk.length;
  }
  return { upserted };
}

export async function fetchBukAsistenciaHistory(input: {
  fromYmd: string;
  toYmd: string;
  recinto?: string;
}): Promise<BukAsistenciaRecord[]> {
  if (getGrooflowBackend() === 'local') {
    return [];
  }
  const qs = new URLSearchParams({
    from: input.fromYmd,
    to: input.toYmd,
  });
  if (input.recinto?.trim()) qs.set('recinto', input.recinto.trim());
  const res = await historyFetch<{ ok: boolean; data?: BukAsistenciaRecord[] }>(
    `/asistencia/buk-records?${qs.toString()}`
  );
  return Array.isArray(res.data) ? res.data : [];
}

export async function fetchBukAsistenciaHistoryStats(): Promise<{
  days: number;
  records: number;
  min_ymd: string | null;
  max_ymd: string | null;
} | null> {
  if (getGrooflowBackend() === 'local') return null;
  try {
    const res = await historyFetch<{
      ok: boolean;
      days?: number;
      records?: number;
      min_ymd?: string | null;
      max_ymd?: string | null;
    }>('/asistencia/buk-records/stats');
    return {
      days: res.days ?? 0,
      records: res.records ?? 0,
      min_ymd: res.min_ymd ?? null,
      max_ymd: res.max_ymd ?? null,
    };
  } catch {
    return null;
  }
}
