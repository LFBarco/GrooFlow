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
import {
  DEFAULT_DISPOSITIVO_SEDES,
  normalizeDispositivoId,
} from './bukAsistenciaRegistro';

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

/**
 * Dispositivos compartidos entre sedes.
 * 2º filtro = sede base del colaborador (Memorial comparte huellero con San Borja).
 */
export const SHARED_DISPOSITIVO_SEDES: Record<string, string[]> = {
  UDP3244800556: ['San Borja', 'Memorial'],
};

/** Sedes sin huellero propio: en modo operativo se listan siempre por sede base. */
export const SEDES_OPERATIVA_FIJA_BASE = ['Petmovil', 'Central'] as const;

/** Vista del organigrama en vivo. */
export type LiveOrgMode = 'operativo' | 'base';

export function normalizeCostCenterCode(raw?: string | null): string {
  if (raw == null) return '';
  const digits = String(raw).replace(/\D+/g, '');
  if (digits.length >= 6) return digits.slice(0, 6);
  return digits;
}

function canonSede(name: string, visibleSedes?: string[]): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  return visibleSedes?.length ? resolveCanonicalSedeName(trimmed, visibleSedes) : trimmed;
}

/** True si la sede base debe permanecer fija en el organigrama operativo. */
export function isSedeOperativaFijaBase(sedeBase: string | undefined | null): boolean {
  const key = normalizeSedeKey(sedeBase ?? '');
  if (!key) return false;
  return SEDES_OPERATIVA_FIJA_BASE.some((s) => normalizeSedeKey(s) === key);
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
      return canonSede(row.sedeName, visibleSedes);
    }
  }
  const fallback = DEFAULT_BUK_PE_COST_CENTER_SEDES[code];
  if (!fallback) return undefined;
  return canonSede(fallback, visibleSedes);
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
 * Mapa crudo dispositivo → sede (sin desambiguar compartidos).
 */
function lookupDispositivoSedeRaw(
  device: string,
  settings?: AsistenciaSettings | null
): string | undefined {
  const merged = settings ? mergeAsistenciaSettings(settings) : null;
  for (const row of merged?.dispositivoSedeMappings ?? []) {
    if (normalizeDispositivoId(row.dispositivoId) === device && row.sedeName?.trim()) {
      return row.sedeName.trim();
    }
  }
  return DEFAULT_DISPOSITIVO_SEDES[device];
}

/**
 * Resuelve sede desde el ID de dispositivo huellero (`dispositivo` en Ctrlit).
 * Si el dispositivo es compartido y se conoce la sede base, desambigua.
 */
export function resolveSedeFromDispositivo(
  dispositivoRaw: string | undefined | null,
  settings?: AsistenciaSettings | null,
  visibleSedes?: string[],
  sedeBase?: string | null
): string | undefined {
  const device = normalizeDispositivoId(dispositivoRaw);
  if (!device) return undefined;

  const shared = SHARED_DISPOSITIVO_SEDES[device];
  if (shared?.length) {
    const baseKey = normalizeSedeKey(sedeBase ?? '');
    if (baseKey) {
      const hit = shared.find((s) => normalizeSedeKey(s) === baseKey);
      if (hit) return canonSede(hit, visibleSedes);
    }
    // Default del mapa compartido (San Borja para UDP3244800556).
    return canonSede(shared[0]!, visibleSedes);
  }

  const raw = lookupDispositivoSedeRaw(device, settings);
  if (!raw) return undefined;
  return canonSede(raw, visibleSedes);
}

/**
 * Sede operativa del punch.
 * Prioridad: dispositivo (+ shared/base) → obra_id/código en perfil o mapeo.
 * Sin fuzzy por nombre de recinto.
 */
export function resolveSedeNameFromBukRecinto(
  record: BukAsistenciaRecord,
  settings: AsistenciaSettings,
  visibleSedes?: string[],
  sedeBase?: string | null
): string | undefined {
  const fromDevice = resolveSedeFromDispositivo(
    record.dispositivo,
    settings,
    visibleSedes,
    sedeBase
  );
  if (fromDevice) return fromDevice;

  const merged = mergeAsistenciaSettings(settings);
  const profiles = merged.sedeProfiles ?? [];
  const mappings = merged.sedeMappings ?? [];

  for (const p of profiles) {
    const code = (p.bukRecintoCode ?? '').trim();
    // Solo obra_id / código recinto — no usar UDP en perfil como fuente primaria.
    if (code && matchesBukRecintoConfig(code, record) && p.sedeName?.trim()) {
      return canonSede(p.sedeName, visibleSedes);
    }
  }
  for (const m of mappings) {
    const code = (m.bukRecintoCode ?? '').trim();
    if (code && matchesBukRecintoConfig(code, record) && m.sedeName?.trim()) {
      return canonSede(m.sedeName, visibleSedes);
    }
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
  return [...pool].sort((a, b) => {
    const ta = a.entrada_format || a.entrada || '';
    const tb = b.entrada_format || b.entrada || '';
    return String(ta).localeCompare(String(tb));
  })[0];
}

export type EffectiveSedeResolution = {
  sedeBase: string;
  sedeOperativaHoy?: string;
  /** Sede donde se lista en el organigrama según orgMode. */
  effectiveSede: string;
  coveringFromBase: boolean;
  /** Marca física distinta de la base (aunque Petmovil/Central no se muevan). */
  punchedAwayFromBase: boolean;
  orgMode: LiveOrgMode;
  bukRecintoHoy?: string;
  record?: BukAsistenciaRecord;
};

/**
 * Resuelve sede efectiva del organigrama en vivo.
 * - operativo (default): donde marcó (dispositivo), con reglas Memorial / Petmovil / Central
 * - base: siempre sede Buk.pe
 */
export function resolveEffectiveSedeForLive(
  staff: AsistenciaStaffMember,
  records: BukAsistenciaRecord[],
  date: Date,
  settings: AsistenciaSettings,
  visibleSedes?: string[],
  recordsByRut?: BukRecordsByRut,
  orgMode: LiveOrgMode = 'operativo'
): EffectiveSedeResolution {
  const sedeBase = staffSedeBase(staff, settings, visibleSedes);
  const record = findBukRecordForStaffAnySede(staff, records, date, recordsByRut);
  if (!record || !hasBukEntradaMarcada(record)) {
    return {
      sedeBase,
      effectiveSede: sedeBase,
      coveringFromBase: false,
      punchedAwayFromBase: false,
      orgMode,
    };
  }

  const punchedSede =
    resolveSedeNameFromBukRecinto(record, settings, visibleSedes, sedeBase) || undefined;

  const fijaBase = isSedeOperativaFijaBase(sedeBase);
  // Petmovil / Central: permanecen en base en modo operativo.
  const sedeOperativaHoy = fijaBase ? sedeBase : punchedSede || sedeBase;

  const punchedAwayFromBase = Boolean(
    punchedSede && sedeBase && normalizeSedeKey(punchedSede) !== normalizeSedeKey(sedeBase)
  );
  const coveringFromBase = Boolean(
    !fijaBase &&
      sedeOperativaHoy &&
      sedeBase &&
      normalizeSedeKey(sedeOperativaHoy) !== normalizeSedeKey(sedeBase)
  );

  const effectiveSede =
    orgMode === 'base'
      ? sedeBase
      : (sedeOperativaHoy || sedeBase || '').trim() || sedeBase || '';

  return {
    sedeBase,
    sedeOperativaHoy: fijaBase ? punchedSede || sedeBase : sedeOperativaHoy,
    effectiveSede,
    coveringFromBase,
    punchedAwayFromBase,
    orgMode,
    bukRecintoHoy: formatBukRecintoLabel(record) || undefined,
    record,
  };
}
