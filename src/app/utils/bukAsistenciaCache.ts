import type { BukAsistenciaRecord } from '../types/asistencia';
import { sanitizeBukBaseUrl, normalizeBukToken } from './bukAsistenciaApi';
import { formatDayKey, hasBukEntradaMarcada, normalizeDiaEntradaKey } from './asistenciaData';
import { asistenciaRutMatchKey } from './asistenciaRut';
import { normalizeBukAsistenciaRecords } from './bukAsistenciaRegistro';

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

/** Clave estable persona+día (evita duplicar empresa vs registro por id distinto). */
export function bukRecordRutDiaKey(r: BukAsistenciaRecord): string | null {
  const rut = asistenciaRutMatchKey(r.rut_trabajador);
  const dia = normalizeDiaEntradaKey(r.dia_entrada) ?? (r.dia_entrada ?? '').trim();
  if (!rut || !dia) return null;
  return `rd:${rut}|${dia}`;
}

export function bukRecordMergeKey(r: BukAsistenciaRecord): string {
  const rd = bukRecordRutDiaKey(r);
  if (rd) return rd;
  if (r.id != null) return `id:${r.id}`;
  return `r:${r.trab_id}:${r.dia_entrada ?? ''}:${r.rut_trabajador ?? ''}`;
}

function recordRichness(r: BukAsistenciaRecord): number {
  let score = 0;
  if (hasBukEntradaMarcada(r)) score += 8;
  if (r.dispositivo) score += 4;
  if (r.nombre?.trim()) score += 2;
  if (r.salida || r.salida_format) score += 1;
  if (r.obra_id || r.codigo_recinto) score += 1;
  return score;
}

/** Conserva el registro más completo al fusionar (no pisar sync fresca con historial pobre). */
export function preferRicherBukRecord(
  a: BukAsistenciaRecord,
  b: BukAsistenciaRecord
): BukAsistenciaRecord {
  const sa = recordRichness(a);
  const sb = recordRichness(b);
  if (sb > sa) return { ...a, ...b, ...pickFilled(a, b) };
  if (sa > sb) return { ...b, ...a, ...pickFilled(b, a) };
  // Empate: incoming (b) gana campos, pero rellena huecos desde a.
  return { ...a, ...b, ...pickFilled(a, b) };
}

function pickFilled(
  older: BukAsistenciaRecord,
  newer: BukAsistenciaRecord
): Partial<BukAsistenciaRecord> {
  return {
    nombre: newer.nombre?.trim() ? newer.nombre : older.nombre,
    apellido_paterno: newer.apellido_paterno || older.apellido_paterno,
    apellido_materno: newer.apellido_materno || older.apellido_materno,
    dispositivo: newer.dispositivo || older.dispositivo,
    entrada: newer.entrada || older.entrada,
    salida: newer.salida || older.salida,
    entrada_format: newer.entrada_format || older.entrada_format,
    salida_format: newer.salida_format || older.salida_format,
    obra_id: newer.obra_id ?? older.obra_id,
    codigo_recinto: newer.codigo_recinto || older.codigo_recinto,
    nombre_recinto: newer.nombre_recinto || older.nombre_recinto,
    area: newer.area || older.area,
    especialidad: newer.especialidad || older.especialidad,
  };
}

/**
 * Une registros Buk por RUT+día (y id como respaldo).
 * Si hay choque, conserva el más completo (entrada/dispositivo/nombre).
 */
export function mergeBukAsistenciaRecords(
  existing: BukAsistenciaRecord[],
  incoming: BukAsistenciaRecord[]
): BukAsistenciaRecord[] {
  const map = new Map<string, BukAsistenciaRecord>();
  const put = (r: BukAsistenciaRecord) => {
    const key = bukRecordMergeKey(r);
    const prev = map.get(key);
    map.set(key, prev ? preferRicherBukRecord(prev, r) : r);
  };
  for (const r of normalizeBukAsistenciaRecords(existing)) put(r);
  for (const r of normalizeBukAsistenciaRecords(incoming)) put(r);
  return [...map.values()];
}

function recordDayTime(r: BukAsistenciaRecord): number {
  const dia = normalizeDiaEntradaKey(r.dia_entrada);
  if (dia) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dia);
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
}): BukAsistenciaCachePayload | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(input.baseUrl, input.apiToken));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BukAsistenciaCachePayload;
    if (!parsed?.fetchedAt || !Array.isArray(parsed.records)) return null;
    return {
      ...parsed,
      records: normalizeBukAsistenciaRecords(parsed.records),
    };
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

  const tight = pruneBukRecordsToHotWindow(input.records, 30);
  if (tryWrite(tight)) {
    return { ok: true, pruned: true, savedCount: tight.length };
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
    const dia = normalizeDiaEntradaKey(r.dia_entrada);
    if (dia) set.add(dia);
    else if (r.entrada) {
      const d = new Date(r.entrada);
      if (!Number.isNaN(d.getTime())) set.add(formatDayKey(d));
    }
  }
  return set.size;
}
