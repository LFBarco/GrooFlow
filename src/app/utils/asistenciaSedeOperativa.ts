import type {
  AsistenciaSettings,
  AsistenciaStaffMember,
  BukAsistenciaRecord,
} from '../types/asistencia';
import { normalizeSedeKey, resolveCanonicalSedeName } from './gestionSedes';
import {
  formatBukRecintoLabel,
  hasBukEntradaMarcada,
  isRecordOnDate,
  matchesBukRecintoConfig,
  mergeAsistenciaSettings,
} from './asistenciaData';
import { recordMatchesStaffShift } from './asistenciaShift';

/** Mapa por defecto: centro de costo Buk.pe → sede operativa GrooFlow. */
export const DEFAULT_BUK_PE_COST_CENTER_SEDES: Record<string, string> = {
  '101010': 'Benavides',
  '202020': 'Jorge Chavez',
  '303030': 'Petmovil',
  '404040': 'San Borja',
  '505050': 'La Molina',
  '606060': 'Magdalena',
  '707070': 'Memorial',
  '999999': 'Central',
};

export function normalizeCostCenterCode(raw?: string | null): string {
  if (raw == null) return '';
  const digits = String(raw).replace(/\D+/g, '');
  if (digits.length >= 6) return digits.slice(0, 6);
  return digits;
}

/** Resuelve sede base desde código de centro de costo (overrides en settings si existen). */
export function resolveSedeFromCostCenterCode(
  codeRaw: string | undefined | null,
  settings?: AsistenciaSettings | null,
  visibleSedes?: string[]
): string | undefined {
  const code = normalizeCostCenterCode(codeRaw);
  if (!code) return undefined;
  const merged = settings ? mergeAsistenciaSettings(settings) : null;
  const overrides = merged?.costCenterSedeMappings ?? [];
  for (const row of overrides) {
    if (normalizeCostCenterCode(row.costCenterCode) === code && row.sedeName?.trim()) {
      const name = row.sedeName.trim();
      return visibleSedes?.length ? resolveCanonicalSedeName(name, visibleSedes) : name;
    }
  }
  const fallback = DEFAULT_BUK_PE_COST_CENTER_SEDES[code];
  if (!fallback) return undefined;
  return visibleSedes?.length ? resolveCanonicalSedeName(fallback, visibleSedes) : fallback;
}

export function staffSedeBase(
  staff: AsistenciaStaffMember,
  settings?: AsistenciaSettings | null,
  visibleSedes?: string[]
): string {
  const explicit = staff.sedeBase?.trim();
  if (explicit) return explicit;
  if (staff.homeCostCenterCode) {
    const fromCc = resolveSedeFromCostCenterCode(
      staff.homeCostCenterCode,
      settings,
      visibleSedes
    );
    if (fromCc) return fromCc;
  }
  return (staff.sedeName?.trim() || '').trim();
}

function rutMatchKey(raw?: string): string {
  const n = (raw ?? '').replace(/[.\-\s]/g, '').toUpperCase();
  if (!n) return '';
  if (/^\d{7,8}$/.test(n)) return n;
  if (/^\d{7,8}[0-9K]$/.test(n)) return n.slice(0, -1);
  return n;
}

function rutsMatch(a?: string, b?: string): boolean {
  const x = rutMatchKey(a);
  const y = rutMatchKey(b);
  return Boolean(x && y && x === y);
}

/** Índice RUT → marcaciones del día (evita O(staff × records) en el vivo). */
export type BukRecordsByRut = Map<string, BukAsistenciaRecord[]>;

export function indexBukRecordsForDate(
  records: BukAsistenciaRecord[],
  date: Date
): BukRecordsByRut {
  const map: BukRecordsByRut = new Map();
  for (const r of records) {
    if (!isRecordOnDate(r, date)) continue;
    const key = rutMatchKey(r.rut_trabajador);
    if (!key) continue;
    const list = map.get(key);
    if (list) list.push(r);
    else map.set(key, [r]);
  }
  return map;
}

/**
 * Resuelve sede GrooFlow desde el recinto/huellero de una marcación Buk Asistencia.
 * Prioridad: obra_id / id_recinto configurado en la sede → código/nombre recinto → fuzzy.
 */
export function resolveSedeNameFromBukRecinto(
  record: BukAsistenciaRecord,
  settings: AsistenciaSettings,
  visibleSedes?: string[]
): string | undefined {
  const merged = mergeAsistenciaSettings(settings);
  const profiles = merged.sedeProfiles ?? [];
  const mappings = merged.sedeMappings ?? [];

  for (const p of profiles) {
    const code = (p.bukRecintoCode ?? '').trim();
    if (code && matchesBukRecintoConfig(code, record) && p.sedeName?.trim()) {
      const name = p.sedeName.trim();
      return visibleSedes?.length ? resolveCanonicalSedeName(name, visibleSedes) : name;
    }
  }
  for (const m of mappings) {
    const code = (m.bukRecintoCode ?? '').trim();
    if (code && matchesBukRecintoConfig(code, record) && m.sedeName?.trim()) {
      const name = m.sedeName.trim();
      return visibleSedes?.length ? resolveCanonicalSedeName(name, visibleSedes) : name;
    }
  }

  const recintoName = (record.nombre_recinto || '').trim();
  if (recintoName) {
    const knownFromSettings = [
      ...(merged.sedeProfiles ?? []).map((p) => p.sedeName),
      ...(merged.sedeMappings ?? []).map((m) => m.sedeName),
      ...(merged.staff ?? []).map((s) => s.sedeBase || s.sedeName),
    ].filter((s): s is string => Boolean(s?.trim()));
    const knownSedes = [...new Set([...(visibleSedes ?? []), ...knownFromSettings])];
    const rk = normalizeSedeKey(recintoName);
    for (const sede of knownSedes) {
      const sk = normalizeSedeKey(sede);
      if (sk && rk && (sk.includes(rk) || rk.includes(sk) || normalizeSedeKey(sede) === rk)) {
        return visibleSedes?.length ? resolveCanonicalSedeName(sede, visibleSedes) : sede.trim();
      }
    }
    if (visibleSedes?.length) {
      const canon = resolveCanonicalSedeName(recintoName, visibleSedes);
      if (
        normalizeSedeKey(canon) === normalizeSedeKey(recintoName) ||
        visibleSedes.some((s) => normalizeSedeKey(s) === normalizeSedeKey(recintoName))
      ) {
        return resolveCanonicalSedeName(recintoName, visibleSedes);
      }
    }
    return recintoName;
  }
  return undefined;
}

/** Marcación del día por RUT (sin filtrar sede); prioriza con entrada marcada. */
export function findBukRecordForStaffAnySede(
  staff: AsistenciaStaffMember,
  records: BukAsistenciaRecord[],
  date: Date,
  recordsByRut?: BukRecordsByRut
): BukAsistenciaRecord | undefined {
  const key = rutMatchKey(staff.rut);
  const candidates =
    recordsByRut && key
      ? recordsByRut.get(key) ?? []
      : records.filter(
          (r) => isRecordOnDate(r, date) && rutsMatch(staff.rut, r.rut_trabajador)
        );
  const onDate = candidates.filter((r) => recordMatchesStaffShift(r, staff, date));
  if (onDate.length === 0) return undefined;
  const withEntrada = onDate.filter((r) => hasBukEntradaMarcada(r));
  const pool = withEntrada.length > 0 ? withEntrada : onDate;
  // Primera entrada del día (orden por hora si hay).
  return [...pool].sort((a, b) => {
    const ta = a.entrada_format || a.entrada || '';
    const tb = b.entrada_format || b.entrada || '';
    return String(ta).localeCompare(String(tb));
  })[0];
}

export type EffectiveSedeResolution = {
  sedeBase: string;
  sedeOperativaHoy?: string;
  effectiveSede: string;
  coveringFromBase: boolean;
  bukRecintoHoy?: string;
  record?: BukAsistenciaRecord;
};

/** Sede efectiva del organigrama en vivo: marcación del día (huellero) o sede base. */
export function resolveEffectiveSedeForLive(
  staff: AsistenciaStaffMember,
  records: BukAsistenciaRecord[],
  date: Date,
  settings: AsistenciaSettings,
  visibleSedes?: string[],
  recordsByRut?: BukRecordsByRut
): EffectiveSedeResolution {
  const sedeBase = staffSedeBase(staff, settings, visibleSedes);
  const record = findBukRecordForStaffAnySede(staff, records, date, recordsByRut);
  if (!record || !hasBukEntradaMarcada(record)) {
    return {
      sedeBase,
      effectiveSede: sedeBase,
      coveringFromBase: false,
    };
  }
  const sedeOperativaHoy =
    resolveSedeNameFromBukRecinto(record, settings, visibleSedes) || undefined;
  const effectiveSede = (sedeOperativaHoy || sedeBase || '').trim() || sedeBase || '';
  const coveringFromBase = Boolean(
    sedeOperativaHoy &&
      sedeBase &&
      normalizeSedeKey(sedeOperativaHoy) !== normalizeSedeKey(sedeBase)
  );
  return {
    sedeBase,
    sedeOperativaHoy,
    effectiveSede,
    coveringFromBase,
    bukRecintoHoy: formatBukRecintoLabel(record) || undefined,
    record,
  };
}
