import type { BukAsistenciaRecord } from '../types/asistencia';
import { sanitizeBukBaseUrl, normalizeBukToken } from './bukAsistenciaApi';
import { formatDayKey } from './asistenciaData';

/** @deprecated Ya no se usa para invalidar; se mantiene por compatibilidad de imports. */
export const BUK_ASISTENCIA_CACHE_TTL_MS = Number.POSITIVE_INFINITY;

/** Días a conservar en localStorage como working set caliente. */
export const BUK_ASISTENCIA_LOCAL_HOT_DAYS = 90;

const STORAGE_PREFIX = 'gooflow:buk-asistencia:v1:';

export type BukAsistenciaCachePayload = {
  fetchedAt: number;
  baseUrl: string;
  records: BukAsistenciaRecord[];
};

export type BukAsistenciaCacheSaveResult = {
  ok: boolean;
  quotaExceeded?: boolean;
  pruned?: boolean;
  savedCount: number;
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

function recordDayTime(r: BukAsistenciaRecord): number {
  if (r.dia_entrada) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(r.dia_entrada.trim());
    if (m) return new Date(+m[3], +m[2] - 1, +m[1], 12).getTime();
  }
  if (r.entrada) {
    const t = new Date(r.entrada).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

/** Conserva registros dentro de una ventana de días (working set local). */
export function pruneBukRecordsToHotWindow(
  records: BukAsistenciaRecord[],
  hotDays = BUK_ASISTENCIA_LOCAL_HOT_DAYS,
  now = Date.now()
): BukAsistenciaRecord[] {
  const cutoff = now - hotDays * 24 * 60 * 60 * 1000;
  const kept = records.filter((r) => {
    const t = recordDayTime(r);
    return t === 0 || t >= cutoff;
  });
  return kept.length > 0 ? kept : records;
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
    // Sin TTL: el historial completo vive en MySQL; local es working set.
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
}): BukAsistenciaCacheSaveResult {
  if (typeof localStorage === 'undefined') {
    return { ok: false, savedCount: 0 };
  }
  const key = storageKey(input.baseUrl, input.apiToken);
  const fetchedAt = input.fetchedAt ?? Date.now();

  const tryWrite = (records: BukAsistenciaRecord[]): boolean => {
    const payload: BukAsistenciaCachePayload = {
      fetchedAt,
      baseUrl: input.baseUrl.trim().replace(/\/+$/, ''),
      records,
    };
    try {
      localStorage.setItem(key, JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  };

  if (tryWrite(input.records)) {
    return { ok: true, savedCount: input.records.length };
  }

  const pruned = pruneBukRecordsToHotWindow(input.records);
  if (pruned.length !== input.records.length && tryWrite(pruned)) {
    return { ok: true, pruned: true, savedCount: pruned.length };
  }

  // Último intento: solo últimos 30 días
  const tight = pruneBukRecordsToHotWindow(input.records, 30);
  if (tryWrite(tight)) {
    return { ok: true, pruned: true, quotaExceeded: false, savedCount: tight.length };
  }

  return { ok: false, quotaExceeded: true, savedCount: 0 };
}

export function cacheAgeLabel(fetchedAt: number, now = Date.now()): string {
  const mins = Math.floor((now - fetchedAt) / 60_000);
  if (mins < 1) return 'hace un momento';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

/** Cuenta días distintos presentes en el blob local (formato dd/MM/yyyy). */
export function countDistinctLocalBukDays(records: BukAsistenciaRecord[]): number {
  const set = new Set<string>();
  for (const r of records) {
    if (r.dia_entrada) set.add(r.dia_entrada);
    else if (r.entrada) {
      const d = new Date(r.entrada);
      if (!Number.isNaN(d.getTime())) set.add(formatDayKey(d));
    }
  }
  return set.size;
}
