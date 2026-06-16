import type { BukAsistenciaRecord } from '../types/asistencia';
import { sanitizeBukBaseUrl, normalizeBukToken } from './bukAsistenciaApi';

export const BUK_ASISTENCIA_CACHE_TTL_MS = 48 * 60 * 60 * 1000;
const STORAGE_PREFIX = 'gooflow:buk-asistencia:v1:';

export type BukAsistenciaCachePayload = {
  fetchedAt: number;
  baseUrl: string;
  records: BukAsistenciaRecord[];
};

function storageKey(baseUrl: string, apiToken: string): string {
  const base = sanitizeBukBaseUrl(baseUrl).toLowerCase();
  const token = normalizeBukToken(apiToken);
  let fp = 0;
  for (let i = 0; i < token.length; i++) fp = (fp * 31 + token.charCodeAt(i)) | 0;
  return `${STORAGE_PREFIX}${base}|${Math.abs(fp).toString(36)}`;
}

export function bukRecordMergeKey(r: BukAsistenciaRecord): string {
  if (r.id != null) return `id:${r.id}`;
  return `r:${r.trab_id}:${r.dia_entrada ?? ''}:${r.rut_trabajador ?? ''}`;
}

/** Une registros Buk; los más recientes en `incoming` sobrescriben por id. */
export function mergeBukAsistenciaRecords(
  existing: BukAsistenciaRecord[],
  incoming: BukAsistenciaRecord[]
): BukAsistenciaRecord[] {
  const map = new Map<string, BukAsistenciaRecord>();
  for (const r of existing) map.set(bukRecordMergeKey(r), r);
  for (const r of incoming) map.set(bukRecordMergeKey(r), r);
  return [...map.values()];
}

export function loadBukAsistenciaCache(input: {
  baseUrl: string;
  apiToken: string;
  now?: number;
}): BukAsistenciaCachePayload | null {
  if (typeof localStorage === 'undefined') return null;
  const key = storageKey(input.baseUrl, input.apiToken);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BukAsistenciaCachePayload;
    if (!parsed?.fetchedAt || !Array.isArray(parsed.records)) return null;
    const age = (input.now ?? Date.now()) - parsed.fetchedAt;
    if (age > BUK_ASISTENCIA_CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveBukAsistenciaCache(input: {
  baseUrl: string;
  apiToken: string;
  records: BukAsistenciaRecord[];
  fetchedAt?: number;
}): void {
  if (typeof localStorage === 'undefined') return;
  const key = storageKey(input.baseUrl, input.apiToken);
  const payload: BukAsistenciaCachePayload = {
    fetchedAt: input.fetchedAt ?? Date.now(),
    baseUrl: input.baseUrl.trim().replace(/\/+$/, ''),
    records: input.records,
  };
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Quota exceeded — ignorar sin romper el flujo.
  }
}

export function cacheAgeLabel(fetchedAt: number, now = Date.now()): string {
  const mins = Math.floor((now - fetchedAt) / 60_000);
  if (mins < 1) return 'hace un momento';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}
