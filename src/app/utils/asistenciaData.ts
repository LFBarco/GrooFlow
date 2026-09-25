import { format, parse, isValid } from 'date-fns';

import type {
  AsistenciaAreaGroup,
  AsistenciaAreaKeywords,
  AsistenciaDaySummary,
  AsistenciaOrgRequirement,
  AsistenciaPresentPerson,
  AsistenciaRequirementCoverage,
  AsistenciaSedeCoverage,
  AsistenciaSedeProfile,
  AsistenciaSettings,
  AsistenciaStaffMember,
  BukAsistenciaRecord,
  BukPunctualityStatus,
} from '../types/asistencia';
import { normalizeStaffShift } from './asistenciaShift';
import { DEFAULT_DISPOSITIVO_SEDES, normalizeDispositivoId } from './bukAsistenciaRegistro';
import { normalizeSedeKey } from './gestionSedes';

export const DEFAULT_ASISTENCIA_AREA_KEYWORDS: AsistenciaAreaKeywords = {
  medica: [
    'MEDICO',
    'MÉDICO',
    'VETERINAR',
    'ASISTENTE VETERIN',
    'COUNTER',
    'MEDICO JEFE',
    'MEDICO JR',
  ],
  peluqueria: ['PELUQU', 'BAÑAD', 'BANAD', 'ALISTADOR', 'GROOM'],
};

export function defaultAsistenciaSettings(): AsistenciaSettings {
  return {
    buk: {
      apiBaseUrl: 'https://app.ctrlit.cl/ctrl/api/v2',
      apiToken: '',
      enabled: false,
      autoRefreshEnabled: false,
      autoRefreshIntervalMinutes: 30,
      autoRefreshWindowStart: '06:00',
      autoRefreshWindowEnd: '22:00',
      marcacionesPipelineEnabled: true,
      marcacionesPipelineIntervalMinutes: 30,
      catalogEndpoints: [
        {
          id: 'buk-asistencia-empresa',
          name: 'Asistencia empresa',
          pathOrUrl: 'asistencia-empresa?page=1&page_size=5',
          description: 'Jornadas por trabajador (rango desde/hasta).',
          enabled: true,
        },
        {
          id: 'buk-obtener-registro-asistencia',
          name: 'Registro asistencia (huellero)',
          pathOrUrl:
            'https://app.ctrlit.cl/ctrl/api/obtenerRegistroAsistencia?obra_id=1&from=01-01-2026&to=07-01-2026&page=1&page_size=5',
          description:
            'Marcas por dispositivo (campo dispositivo). Ventana incremental ≤7 días; ubica organigrama.',
          enabled: true,
        },
      ],
    },
    requirements: [],
    staff: [],
    sedeProfiles: [],
    areaKeywords: { ...DEFAULT_ASISTENCIA_AREA_KEYWORDS },
    sedeMappings: [],
    costCenterSedeMappings: [],
    dispositivoSedeMappings: Object.entries(DEFAULT_DISPOSITIVO_SEDES).map(
      ([dispositivoId, sedeName]) => ({ dispositivoId, sedeName })
    ),
  };
}

export function mergeAsistenciaSettings(
  partial?: Partial<AsistenciaSettings> | null
): AsistenciaSettings {
  const base = defaultAsistenciaSettings();
  if (!partial || typeof partial !== 'object') return { ...base };
  const spread = { ...base, ...partial };
  return {
    ...spread,
    buk: {
      ...base.buk,
      ...(partial.buk ?? {}),
      catalogEndpoints: Array.isArray(partial.buk?.catalogEndpoints)
        ? partial.buk.catalogEndpoints
        : base.buk?.catalogEndpoints ?? [],
    },
    requirements: Array.isArray(partial.requirements) ? partial.requirements : spread.requirements,
    staff: Array.isArray(partial.staff)
      ? partial.staff.map(normalizeStaffShift)
      : (spread.staff ?? []).map(normalizeStaffShift),
    sedeProfiles: Array.isArray(partial.sedeProfiles) ? partial.sedeProfiles : spread.sedeProfiles ?? [],
    areaKeywords: {
      medica:
        partial.areaKeywords?.medica?.length
          ? partial.areaKeywords.medica
          : spread.areaKeywords!.medica,
      peluqueria:
        partial.areaKeywords?.peluqueria?.length
          ? partial.areaKeywords.peluqueria
          : spread.areaKeywords!.peluqueria,
    },
    sedeMappings: Array.isArray(partial.sedeMappings) ? partial.sedeMappings : spread.sedeMappings ?? [],
    costCenterSedeMappings: Array.isArray(partial.costCenterSedeMappings)
      ? partial.costCenterSedeMappings
      : spread.costCenterSedeMappings ?? [],
    dispositivoSedeMappings: Array.isArray(partial.dispositivoSedeMappings)
      ? partial.dispositivoSedeMappings
      : spread.dispositivoSedeMappings ?? [],
  };
}

/** Une listas de personal por id (KV + SQL). */
export function mergeAsistenciaStaffLists(
  a?: AsistenciaStaffMember[] | null,
  b?: AsistenciaStaffMember[] | null
): AsistenciaStaffMember[] {
  const map = new Map<string, AsistenciaStaffMember>();
  for (const m of a ?? []) map.set(m.id, normalizeStaffShift(m));
  for (const m of b ?? []) map.set(m.id, normalizeStaffShift(m));
  return [...map.values()];
}

export function personFullName(r: BukAsistenciaRecord): string {
  return [r.nombre, r.apellido_paterno, r.apellido_materno].filter(Boolean).join(' ').trim();
}

/** Etiqueta legible del recinto Buk (código · nombre · dispositivo · obra). */
export function formatBukRecintoLabel(r: BukAsistenciaRecord): string {
  const obra = r.obra_id ?? r.id_recinto;
  const parts = [r.dispositivo, r.codigo_recinto, r.nombre_recinto];
  if (
    obra != null &&
    String(obra) !== String(r.codigo_recinto ?? '').trim() &&
    String(obra) !== String(r.dispositivo ?? '').trim()
  ) {
    parts.push(`obra:${obra}`);
  }
  return parts.filter(Boolean).join(' · ').trim();
}

function normalizeRecintoKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cruza código configurado con:
 * - obra_id / id_recinto (ID único del huellero — preferido)
 * - codigo_recinto, nombre_recinto o etiqueta combinada
 */
export function matchesBukRecintoConfig(configuredCode: string, r: BukAsistenciaRecord): boolean {
  const config = configuredCode.trim();
  if (!config) return false;

  const obraId = r.obra_id ?? r.id_recinto;
  if (obraId != null && String(obraId) === config.replace(/\s+/g, '')) {
    return true;
  }
  // Acepta "obra:24734" pegado desde diagnóstico.
  const obraMatch = /^obra\s*[:=]?\s*(\d+)$/i.exec(config);
  if (obraMatch && obraId != null && String(obraId) === obraMatch[1]) {
    return true;
  }

  const device = String(r.dispositivo ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  const configDevice = config.toUpperCase().replace(/\s+/g, '');
  if (device && configDevice && device === configDevice) {
    return true;
  }

  const recintoCode = (r.codigo_recinto || '').trim();
  const recintoName = (r.nombre_recinto || '').trim();
  const combined = formatBukRecintoLabel(r);

  const normConfig = normalizeRecintoKey(config);
  const normCode = normalizeRecintoKey(recintoCode);
  const normName = normalizeRecintoKey(recintoName);
  const normCombined = normalizeRecintoKey(combined);

  if (normConfig === normCode || normConfig === normName || normConfig === normCombined) {
    return true;
  }

  const parts = config
    .split(/\s*[·•|/]\s*/)
    .map((p) => normalizeRecintoKey(p))
    .filter(Boolean);

  if (parts.length >= 2) {
    const [codePart, ...nameParts] = parts;
    const namePart = nameParts.join(' ');
    if (normCode === codePart && (normName === namePart || normCombined === normConfig)) {
      return true;
    }
  }

  if (parts.length === 1 && (normCode === parts[0] || normName === parts[0])) {
    return true;
  }

  return false;
}

export function parseBukDayEntrada(raw?: string): Date | null {
  if (!raw) return null;
  const key = normalizeDiaEntradaKey(raw);
  if (!key) return null;
  const d = parse(key, 'dd/MM/yyyy', new Date());
  return isValid(d) ? d : null;
}

export function formatDayKey(date: Date): string {
  return format(date, 'dd/MM/yyyy');
}

/**
 * Normaliza dia_entrada Buk a dd/MM/yyyy.
 * Acepta 24/09/2026, 24-09-2026, 2026-09-24, etc.
 */
export function normalizeDiaEntradaKey(raw?: string | null): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(s);
  if (dmy) {
    return `${dmy[1]!.padStart(2, '0')}/${dmy[2]!.padStart(2, '0')}/${dmy[3]}`;
  }
  const ymd = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/.exec(s);
  if (ymd) {
    return `${ymd[3]!.padStart(2, '0')}/${ymd[2]!.padStart(2, '0')}/${ymd[1]}`;
  }
  return null;
}

export function isRecordOnDate(r: BukAsistenciaRecord, date: Date): boolean {
  const key = formatDayKey(date);
  const dia = normalizeDiaEntradaKey(r.dia_entrada);
  if (dia && dia === key) return true;
  if (r.entrada) {
    const d = new Date(r.entrada);
    if (isValid(d) && formatDayKey(d) === key) return true;
  }
  // entrada_format con fecha completa (yyyy/MM/dd HH:mm:ss)
  const fromFmt = parseBukFormatDayKey(r.entrada_format);
  if (fromFmt && fromFmt === key) return true;
  return false;
}

export function isPresentOnDate(r: BukAsistenciaRecord, date: Date): boolean {
  if (!isRecordOnDate(r, date)) return false;
  return hasBukEntradaMarcada(r);
}

const BUK_ENTRADA_FORMAT_EMPTY = new Set(['', '-', '--', '--:--', 'null', 'undefined']);

/** Extrae minutos desde entrada_format de Buk (HH:mm o yyyy/MM/dd HH:mm:ss). */
export function parseBukEntradaFormatMinutes(raw?: string | null): number | null {
  const fmt = raw?.trim();
  if (!fmt || BUK_ENTRADA_FORMAT_EMPTY.has(fmt.toLowerCase())) return null;

  const hhmm = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(fmt);
  if (hhmm && !/^\d{4}[/-]/.test(fmt) && !fmt.includes(' ')) {
    const h = Number(hhmm[1]);
    const min = Number(hhmm[2]);
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return h * 60 + min;
  }

  const datetime =
    /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(fmt) ??
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(fmt);
  if (datetime) {
    const h = Number(datetime[4]);
    const min = Number(datetime[5]);
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return h * 60 + min;
  }

  return null;
}

function hasBukEntradaTimestamp(raw?: string | null): boolean {
  const entrada = raw?.trim();
  if (!entrada) return false;
  const d = new Date(entrada);
  return !Number.isNaN(d.getTime());
}

/** Hora legible HH:mm desde entrada_format Buk o timestamp entrada. */
export function formatBukEntradaDisplay(
  entradaFormat?: string | null,
  entrada?: string | null
): string | undefined {
  const fromFormat = parseBukEntradaFormatMinutes(entradaFormat);
  if (fromFormat != null) {
    const h = Math.floor(fromFormat / 60);
    const m = fromFormat % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  if (hasBukEntradaTimestamp(entrada)) {
    const d = new Date(entrada!.trim());
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return undefined;
}

/** Hora de llegada válida en Buk (`entrada_format`). */
export function isValidBukEntradaFormat(raw?: string | null): boolean {
  return parseBukEntradaFormatMinutes(raw) != null;
}

/** Convierte HH:mm a minutos desde medianoche. */
export function parseScheduleTimeMinutes(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** Puntualidad de entrada Buk vs horario sede (día 08:00 + tolerancia; noche usa scheduleNightStart). */
export function resolveBukEntryPunctuality(
  record: BukAsistenciaRecord,
  profile: Pick<
    AsistenciaSedeProfile,
    'scheduleStart' | 'scheduleNightStart' | 'scheduleToleranceMinutes'
  >
): BukPunctualityStatus {
  if (!hasBukEntradaMarcada(record)) return 'pending';

  let entradaMin = parseBukEntradaFormatMinutes(record.entrada_format);
  if (entradaMin == null && record.entrada) {
    const d = new Date(record.entrada);
    if (!Number.isNaN(d.getTime())) entradaMin = d.getHours() * 60 + d.getMinutes();
  }
  if (entradaMin == null) return 'pending';

  const isNight = record.turno_noche === true;
  const expectedStart =
    parseScheduleTimeMinutes(
      isNight
        ? profile.scheduleNightStart ?? '20:00'
        : profile.scheduleStart ?? '08:00'
    ) ?? (isNight ? 20 * 60 : 8 * 60);
  const tolerance = profile.scheduleToleranceMinutes ?? 10;
  const deadline = expectedStart + tolerance;

  return entradaMin <= deadline ? 'on_time' : 'late';
}

/**
 * Minutos de tardanza tras horario + tolerancia.
 * 0 si a tiempo, pendiente o sin entrada válida.
 */
export function resolveBukEntryLateMinutes(
  record: BukAsistenciaRecord,
  profile: Pick<
    AsistenciaSedeProfile,
    'scheduleStart' | 'scheduleNightStart' | 'scheduleToleranceMinutes'
  >
): number {
  if (!hasBukEntradaMarcada(record)) return 0;

  let entradaMin = parseBukEntradaFormatMinutes(record.entrada_format);
  if (entradaMin == null && record.entrada) {
    const d = new Date(record.entrada);
    if (!Number.isNaN(d.getTime())) entradaMin = d.getHours() * 60 + d.getMinutes();
  }
  if (entradaMin == null) return 0;

  const isNight = record.turno_noche === true;
  const expectedStart =
    parseScheduleTimeMinutes(
      isNight
        ? profile.scheduleNightStart ?? '20:00'
        : profile.scheduleStart ?? '08:00'
    ) ?? (isNight ? 20 * 60 : 8 * 60);
  const tolerance = profile.scheduleToleranceMinutes ?? 10;
  const deadline = expectedStart + tolerance;
  if (entradaMin <= deadline) return 0;
  return entradaMin - deadline;
}

/** Marca de entrada en Buk: entrada_format (fecha+hora) o timestamp entrada. */
export function hasBukEntradaMarcada(r: BukAsistenciaRecord): boolean {
  return isValidBukEntradaFormat(r.entrada_format) || hasBukEntradaTimestamp(r.entrada);
}

/** Extrae clave dd/MM/yyyy desde un formato Buk con fecha (yyyy/MM/dd …). */
export function parseBukFormatDayKey(raw?: string | null): string | null {
  const fmt = raw?.trim();
  if (!fmt) return null;
  const iso = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(fmt);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return isValid(d) ? formatDayKey(d) : null;
  }
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(fmt);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return isValid(d) ? formatDayKey(d) : null;
  }
  return null;
}

/** Hora de salida válida en Buk (`salida_format`). */
export function isValidBukSalidaFormat(raw?: string | null): boolean {
  const fmt = raw?.trim();
  if (!fmt || BUK_ENTRADA_FORMAT_EMPTY.has(fmt.toLowerCase())) return false;
  return parseBukEntradaFormatMinutes(fmt) != null;
}

/** Salida marcada el mismo día consultado (prioriza evidencia con fecha). */
export function hasBukSalidaMarcadaOnDate(r: BukAsistenciaRecord, date: Date): boolean {
  if (!isRecordOnDate(r, date)) return false;
  const dateKey = formatDayKey(date);

  if (r.salida) {
    const d = new Date(r.salida);
    if (!Number.isNaN(d.getTime()) && formatDayKey(d) === dateKey) return true;
  }

  const fmt = r.salida_format?.trim();
  if (fmt && !BUK_ENTRADA_FORMAT_EMPTY.has(fmt.toLowerCase())) {
    const fmtDay = parseBukFormatDayKey(fmt);
    // Solo HH:mm sin fecha: no basta (agregador siempre escribe HH:mm junto a salida ISO).
    if (fmtDay) return fmtDay === dateKey;
  }
  return false;
}

/** Hora legible HH:mm desde salida_format Buk o timestamp salida. */
export function formatBukSalidaDisplay(
  salidaFormat?: string | null,
  salida?: string | null
): string | undefined {
  return formatBukEntradaDisplay(salidaFormat, salida);
}

export function classifyRecordAreaGroup(
  r: BukAsistenciaRecord,
  keywords: AsistenciaAreaKeywords
): AsistenciaAreaGroup {
  const hay = `${r.area ?? ''} ${r.especialidad ?? ''}`.toUpperCase();
  if (keywords.medica.some((k) => hay.includes(k.toUpperCase()))) return 'medica';
  if (keywords.peluqueria.some((k) => hay.includes(k.toUpperCase()))) return 'peluqueria';
  return 'global';
}

function resolveBukCodeForSede(
  sedeName: string,
  settings: AsistenciaSettings
): string | undefined {
  const map = settings.sedeMappings?.find((m) => m.sedeName === sedeName);
  return map?.bukRecintoCode?.trim() || undefined;
}

function recordMatchesSede(
  r: BukAsistenciaRecord,
  sedeName: string,
  req: AsistenciaOrgRequirement,
  settings: AsistenciaSettings
): boolean {
  const sedeKey = normalizeSedeKey(sedeName);
  if (!sedeKey) return false;

  // Prioridad 1: ID dispositivo (misma fuente que el organigrama operativo).
  const device = normalizeDispositivoId(r.dispositivo);
  if (device) {
    // Dispositivo compartido SB/Memorial: cobertura sin sedeBase solo cuenta en primaria (San Borja).
    if (device === 'UDP3244800556') {
      return sedeKey === normalizeSedeKey('San Borja');
    }
    let deviceSede: string | undefined;
    for (const row of settings.dispositivoSedeMappings ?? []) {
      if (normalizeDispositivoId(row.dispositivoId) === device && row.sedeName?.trim()) {
        deviceSede = row.sedeName.trim();
        break;
      }
    }
    if (!deviceSede) deviceSede = DEFAULT_DISPOSITIVO_SEDES[device];
    if (deviceSede && normalizeSedeKey(deviceSede) === sedeKey) {
      return true;
    }
  }

  // Prioridad 2: obra_id / código configurado en requisito o mapeo de sede.
  const code = (req.bukRecintoCode || resolveBukCodeForSede(sedeName, settings) || '').trim();
  if (code && matchesBukRecintoConfig(code, r)) return true;
  return false;
}

export function recordMatchesRequirement(
  r: BukAsistenciaRecord,
  req: AsistenciaOrgRequirement,
  settings: AsistenciaSettings,
  keywords: AsistenciaAreaKeywords
): boolean {
  if (!recordMatchesSede(r, req.sedeName, req, settings)) return false;

  const areaHay = (r.area || '').toUpperCase();
  const specHay = (r.especialidad || '').toUpperCase();

  if (req.matchArea?.trim()) {
    if (!areaHay.includes(req.matchArea.trim().toUpperCase())) return false;
  }
  if (req.matchSpecialty?.trim()) {
    if (!specHay.includes(req.matchSpecialty.trim().toUpperCase())) return false;
  }

  const inferred = classifyRecordAreaGroup(r, keywords);
  if (req.areaGroup !== 'global' && inferred !== req.areaGroup && !req.matchArea && !req.matchSpecialty) {
    return false;
  }
  return true;
}

function coverageStatus(present: number, required: number): AsistenciaRequirementCoverage['status'] {
  if (required <= 0) return present > 0 ? 'over' : 'complete';
  if (present >= required) return present > required ? 'over' : 'complete';
  if (present > 0) return 'partial';
  return 'missing';
}

function toPresentPerson(r: BukAsistenciaRecord): AsistenciaPresentPerson {
  return {
    rut: r.rut_trabajador,
    fullName: personFullName(r),
    especialidad: r.especialidad,
    area: r.area,
    entradaFormat: r.entrada_format,
    stillOnSite: !r.salida,
  };
}

export function buildRequirementCoverage(
  req: AsistenciaOrgRequirement,
  records: BukAsistenciaRecord[],
  settings: AsistenciaSettings,
  keywords: AsistenciaAreaKeywords,
  date: Date
): AsistenciaRequirementCoverage {
  const matched = records.filter(
    (r) => isPresentOnDate(r, date) && recordMatchesRequirement(r, req, settings, keywords)
  );
  const seen = new Set<string>();
  const present: AsistenciaPresentPerson[] = [];
  for (const r of matched) {
    const key = r.rut_trabajador || String(r.id);
    if (seen.has(key)) continue;
    seen.add(key);
    present.push(toPresentPerson(r));
  }
  const presentCount = present.length;
  const requiredCount = Math.max(0, req.requiredCount);
  return {
    requirement: req,
    presentCount,
    requiredCount,
    status: coverageStatus(presentCount, requiredCount),
    present,
  };
}

export function buildAsistenciaDaySummary(input: {
  date: Date;
  records: BukAsistenciaRecord[];
  settings: AsistenciaSettings;
  visibleSedes?: string[];
}): AsistenciaDaySummary {
  const settings = mergeAsistenciaSettings(input.settings);
  const keywords = settings.areaKeywords ?? DEFAULT_ASISTENCIA_AREA_KEYWORDS;
  const reqs = [...settings.requirements].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.cargoLabel.localeCompare(b.cargoLabel)
  );

  const sedeNames = [
    ...new Set(
      reqs
        .map((r) => r.sedeName)
        .filter((s) => !input.visibleSedes?.length || input.visibleSedes.includes(s))
    ),
  ];

  const globalByArea: AsistenciaDaySummary['globalByArea'] = {
    medica: { required: 0, present: 0, slots: 0, completeSlots: 0 },
    peluqueria: { required: 0, present: 0, slots: 0, completeSlots: 0 },
    global: { required: 0, present: 0, slots: 0, completeSlots: 0 },
  };

  const sedes: AsistenciaSedeCoverage[] = sedeNames.map((sedeName) => {
    const sedeReqs = reqs.filter((r) => r.sedeName === sedeName);
    const byArea: AsistenciaSedeCoverage['byArea'] = {
      medica: [],
      peluqueria: [],
      global: [],
    };

    for (const req of sedeReqs) {
      const cov = buildRequirementCoverage(req, input.records, settings, keywords, input.date);
      byArea[req.areaGroup].push(cov);
      const g = globalByArea[req.areaGroup];
      g.required += cov.requiredCount;
      g.present += cov.presentCount;
      g.slots += 1;
      if (cov.status === 'complete' || cov.status === 'over') g.completeSlots += 1;
    }

    const allCov = [...byArea.medica, ...byArea.peluqueria, ...byArea.global];
    const totalRequired = allCov.reduce((s, c) => s + c.requiredCount, 0);
    const totalPresent = allCov.reduce((s, c) => s + c.presentCount, 0);
    const completeSlots = allCov.filter((c) => c.status === 'complete' || c.status === 'over').length;

    return {
      sedeName,
      bukRecintoCode: resolveBukCodeForSede(sedeName, settings),
      byArea,
      totalRequired,
      totalPresent,
      completeSlots,
      totalSlots: allCov.length,
      isComplete: allCov.length > 0 && completeSlots === allCov.length,
    };
  });

  const uniqueRuts = new Set(
    input.records.filter((r) => isPresentOnDate(r, input.date)).map((r) => r.rut_trabajador)
  );

  return {
    dateLabel: formatDayKey(input.date),
    sedes,
    globalByArea,
    totalPresentUnique: uniqueRuts.size,
    fetchedAt: new Date().toISOString(),
  };
}

/** Plantilla inicial basada en áreas típicas de clínica veterinaria. */
export function buildDefaultRequirementsForSede(sedeName: string, bukCode?: string): AsistenciaOrgRequirement[] {
  const base = (partial: Omit<AsistenciaOrgRequirement, 'id' | 'sedeName'>): AsistenciaOrgRequirement => ({
    id: `req_${Math.random().toString(36).slice(2, 9)}`,
    sedeName,
    bukRecintoCode: bukCode,
    ...partial,
  });

  return [
    base({ areaGroup: 'medica', cargoLabel: 'Médico veterinario', matchArea: 'MEDICOS VETERINARIOS', requiredCount: 2, sortOrder: 1 }),
    base({ areaGroup: 'medica', cargoLabel: 'Asistente veterinario', matchArea: 'ASISTENTES VETERINARIOS', requiredCount: 2, sortOrder: 2 }),
    base({ areaGroup: 'medica', cargoLabel: 'Counter', matchArea: 'COUNTER', requiredCount: 1, sortOrder: 3 }),
    base({ areaGroup: 'peluqueria', cargoLabel: 'Peluquero', matchArea: 'PELUQUEROS', requiredCount: 1, sortOrder: 4 }),
    base({ areaGroup: 'peluqueria', cargoLabel: 'Bañador', matchArea: 'BANADORES', requiredCount: 1, sortOrder: 5 }),
    base({ areaGroup: 'global', cargoLabel: 'Limpieza', matchArea: 'LIMPIEZA', requiredCount: 1, sortOrder: 6 }),
    base({ areaGroup: 'global', cargoLabel: 'Mantenimiento', matchArea: 'SERVICIOS GENERALES', requiredCount: 1, sortOrder: 7 }),
  ];
}
