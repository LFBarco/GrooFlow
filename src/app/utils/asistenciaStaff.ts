import type {
  AsistenciaLiveConsolidatedSummary,
  AsistenciaLiveSedeSummary,
  AsistenciaLiveStatus,
  AsistenciaSettings,
  AsistenciaSedeProfile,
  AsistenciaStaffLiveState,
  AsistenciaStaffMember,
  BukAsistenciaRecord,
} from '../types/asistencia';
import { resolveOrgColumns } from './asistenciaOrgColumns';
import {
  formatBukEntradaDisplay,
  formatBukRecintoLabel,
  formatBukSalidaDisplay,
  formatDayKey,
  hasBukEntradaMarcada,
  hasBukSalidaMarcadaOnDate,
  isRecordOnDate,
  matchesBukRecintoConfig,
  mergeAsistenciaSettings,
  parseBukEntradaFormatMinutes,
} from './asistenciaData';

const DEFAULT_SCHEDULE = { start: '08:00', end: '18:00' };

function normalizeRut(raw?: string): string {
  return (raw ?? '').replace(/[.\-\s]/g, '').toUpperCase();
}

/** Cuerpo numérico del RUT (sin dígito verificador) para cruzar con Buk. */
function rutMatchKey(raw?: string): string {
  const n = normalizeRut(raw);
  if (!n) return '';
  // Buk suele enviar solo el cuerpo (7-8 dígitos), sin DV.
  if (/^\d{7,8}$/.test(n)) return n;
  if (/^\d{7,8}[0-9K]$/.test(n)) return n.slice(0, -1);
  return n;
}

function rutsMatch(staffRut?: string, recordRut?: string): boolean {
  const a = rutMatchKey(staffRut);
  const b = rutMatchKey(recordRut);
  return Boolean(a && b && a === b);
}

function entradaMinutes(record?: BukAsistenciaRecord): number | null {
  if (!record) return null;
  const fromFormat = parseBukEntradaFormatMinutes(record.entrada_format);
  if (fromFormat != null) return fromFormat;
  if (record.entrada) {
    const d = new Date(record.entrada);
    if (!Number.isNaN(d.getTime())) return d.getHours() * 60 + d.getMinutes();
  }
  return null;
}

const SEDE_STOPWORDS = new Set(['la', 'el', 'los', 'las', 'de', 'del', 'y', 'san', 'santa']);

function sedeMatchTokens(sedeName: string): string[] {
  return sedeName
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/[\s\-_./]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !SEDE_STOPWORDS.has(t));
}

function haystackIncludesToken(haystack: string, token: string): boolean {
  const h = haystack.toLowerCase();
  return h.includes(token) || token.includes(h);
}

function recordMatchesSede(
  r: BukAsistenciaRecord,
  sedeName: string,
  profile: AsistenciaSedeProfile | undefined,
  settings: AsistenciaSettings
): boolean {
  const code = (
    profile?.bukRecintoCode ??
    settings.sedeMappings?.find((m) => m.sedeName === sedeName)?.bukRecintoCode ??
    ''
  ).trim();
  const recintoCode = (r.codigo_recinto || '').trim().toLowerCase();
  const recintoName = (r.nombre_recinto || '').trim().toLowerCase();
  const sedeLower = sedeName.trim().toLowerCase();

  if (code && matchesBukRecintoConfig(code, r)) return true;
  if (recintoName && (recintoName.includes(sedeLower) || sedeLower.includes(recintoName))) {
    return true;
  }

  const tokens = sedeMatchTokens(sedeName);
  if (tokens.length > 0) {
    const hay = `${recintoCode} ${recintoName}`;
    if (tokens.some((t) => haystackIncludesToken(hay, t))) return true;
  }

  return !code && !recintoName;
}

function recordMatchesStaff(r: BukAsistenciaRecord, staff: AsistenciaStaffMember): boolean {
  return rutsMatch(staff.rut, r.rut_trabajador);
}

function hasEntradaMarcada(r: BukAsistenciaRecord): boolean {
  return hasBukEntradaMarcada(r);
}

export function filterBukRecordsForSedeDate(
  records: BukAsistenciaRecord[],
  sedeName: string,
  settings: AsistenciaSettings,
  date: Date
): BukAsistenciaRecord[] {
  const merged = mergeAsistenciaSettings(settings);
  const profile = getSedeProfile(merged, sedeName);
  return records.filter(
    (r) => isRecordOnDate(r, date) && recordMatchesSede(r, sedeName, profile, merged)
  );
}

/** Explica por qué no hubo match Buk para un trabajador registrado. */
export function diagnoseStaffBukMatch(input: {
  staff: AsistenciaStaffMember;
  records: BukAsistenciaRecord[];
  sedeName: string;
  settings: AsistenciaSettings;
  date: Date;
}): string | undefined {
  const settings = mergeAsistenciaSettings(input.settings);
  const profile = getSedeProfile(settings, input.sedeName);
  const dateKey = formatDayKey(input.date);
  const onDate = input.records.filter((r) => isRecordOnDate(r, input.date));
  const staffRut = rutMatchKey(input.staff.rut);

  if (onDate.length === 0) {
    return `Buk no tiene marcaciones para el ${dateKey}. Revisa la fecha del panel.`;
  }

  if (!staffRut) {
    return 'Configura el RUT del trabajador (debe coincidir con rut_trabajador en Buk).';
  }

  const byRutOnDate = onDate.filter((r) => rutsMatch(input.staff.rut, r.rut_trabajador));
  if (byRutOnDate.length === 0) {
    return `Buk no tiene marcación con RUT ${input.staff.rut?.trim()} el ${dateKey}.`;
  }

  const atSede = byRutOnDate.filter((r) =>
    recordMatchesSede(r, input.sedeName, profile, settings)
  );
  const bukCode = profile.bukRecintoCode?.trim();
  if (atSede.length === 0) {
    const recinto = formatBukRecintoLabel(byRutOnDate[0]!);
    const codeHint = bukCode
      ? ` Código configurado: «${bukCode}».`
      : ' Configura el código recinto Buk en Configuración sede.';
    return `RUT coincide en Buk pero en otro recinto: «${recinto}».${codeHint}`;
  }

  const record = atSede[0]!;
  if (!hasEntradaMarcada(record)) {
    const fmt = record.entrada_format?.trim() || '—';
    return `RUT coincide el ${dateKey} en «${input.sedeName}», pero sin hora de entrada válida (entrada_format: «${fmt}»).`;
  }

  return undefined;
}

function findBukRecordForStaff(
  staff: AsistenciaStaffMember,
  records: BukAsistenciaRecord[],
  sedeName: string,
  profile: AsistenciaSedeProfile | undefined,
  settings: AsistenciaSettings,
  date: Date
): BukAsistenciaRecord | undefined {
  return records.find(
    (r) =>
      isRecordOnDate(r, date) &&
      recordMatchesSede(r, sedeName, profile, settings) &&
      recordMatchesStaff(r, staff)
  );
}

function resolveLiveStatus(
  staff: AsistenciaStaffMember,
  record: BukAsistenciaRecord | undefined,
  date: Date
): Pick<AsistenciaStaffLiveState, 'status' | 'entradaFormat' | 'stillOnSite' | 'statusNote'> {
  if (!record || !hasEntradaMarcada(record)) {
    return { status: 'ausente', stillOnSite: false };
  }

  const entradaFormat =
    formatBukEntradaDisplay(record.entrada_format, record.entrada) ?? staff.expectedTime;

  if (hasBukSalidaMarcadaOnDate(record, date)) {
    const salidaDisplay =
      formatBukSalidaDisplay(record.salida_format, record.salida) ??
      record.salida_format?.trim();
    return {
      status: 'ausente',
      entradaFormat,
      stillOnSite: false,
      statusNote: salidaDisplay
        ? `Marcó salida ${salidaDisplay} (mismo día)`
        : 'Marcó salida el mismo día',
    };
  }

  return { status: 'trabajando', entradaFormat, stillOnSite: true };
}

function areaOrderForProfile(profile: AsistenciaSedeProfile): string[] {
  return resolveOrgColumns(profile).map((c) => c.id);
}

function areaLabelForProfile(profile: AsistenciaSedeProfile, columnId: string): string {
  return resolveOrgColumns(profile).find((c) => c.id === columnId)?.label ?? columnId;
}

export function getSedeProfile(
  settings: AsistenciaSettings,
  sedeName: string
): AsistenciaSedeProfile {
  const merged = mergeAsistenciaSettings(settings);
  const found = merged.sedeProfiles?.find((p) => p.sedeName === sedeName);
  const map = merged.sedeMappings?.find((m) => m.sedeName === sedeName);
  return {
    sedeName,
    scheduleStart: found?.scheduleStart ?? DEFAULT_SCHEDULE.start,
    scheduleEnd: found?.scheduleEnd ?? DEFAULT_SCHEDULE.end,
    bukRecintoCode: found?.bukRecintoCode ?? map?.bukRecintoCode,
    areaLabels: found?.areaLabels,
    areaOrder: found?.areaOrder,
    customOrgColumns: found?.customOrgColumns,
    cargoByColumn: found?.cargoByColumn,
    hideEmptyAreas: found?.hideEmptyAreas,
  };
}

export function staffForSede(settings: AsistenciaSettings, sedeName: string): AsistenciaStaffMember[] {
  const merged = mergeAsistenciaSettings(settings);
  return (merged.staff ?? [])
    .filter((s) => s.sedeName === sedeName)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.fullName.localeCompare(b.fullName));
}

export function defaultMatchHints(cargoLabel: string, area: string): {
  matchArea?: string;
  matchSpecialty?: string;
} {
  const c = cargoLabel.toLowerCase();
  if (c.includes('recep') || c.includes('counter')) {
    return { matchArea: 'COUNTER' };
  }
  if (c.includes('médico') || c.includes('medico')) {
    return { matchArea: 'MEDICOS VETERINARIOS', matchSpecialty: 'MEDICO' };
  }
  if (c.includes('asistente')) {
    return { matchArea: 'ASISTENTES VETERINARIOS' };
  }
  if (c.includes('peluqu')) return { matchArea: 'PELUQUEROS' };
  if (c.includes('bañ') || c.includes('banad')) return { matchArea: 'BANADORES' };
  if (c.includes('limpieza')) return { matchArea: 'LIMPIEZA' };
  if (c.includes('manten')) return { matchArea: 'SERVICIOS GENERALES' };
  if (area === 'medica') return { matchArea: 'MEDICOS VETERINARIOS' };
  if (area === 'peluqueria') return { matchArea: 'PELUQUEROS' };
  if (area === 'administracion') return { matchArea: 'COUNTER' };
  return {};
}

export function buildLiveSedeSummary(input: {
  sedeName: string;
  settings: AsistenciaSettings;
  records: BukAsistenciaRecord[];
  date: Date;
}): AsistenciaLiveSedeSummary {
  const settings = mergeAsistenciaSettings(input.settings);
  const profile = getSedeProfile(settings, input.sedeName);
  const staffList = staffForSede(settings, input.sedeName);

  const liveStates: AsistenciaStaffLiveState[] = staffList.map((staff) => {
    const buk = findBukRecordForStaff(
      staff,
      input.records,
      input.sedeName,
      profile,
      settings,
      input.date
    );
    const live = resolveLiveStatus(staff, buk, input.date);
    const matchHint =
      live.status === 'ausente' && !live.statusNote && input.records.length > 0
        ? diagnoseStaffBukMatch({
            staff,
            records: input.records,
            sedeName: input.sedeName,
            settings: input.settings,
            date: input.date,
          })
        : undefined;
    return { staff, ...live, matchHint };
  });

  const onDate = input.records.filter((r) => isRecordOnDate(r, input.date));
  const bukRecintosOnDate = [
    ...new Set(onDate.map((r) => formatBukRecintoLabel(r)).filter(Boolean)),
  ];

  const managerState =
    liveStates.find((s) => s.staff.isManager) ??
    liveStates.find((s) => s.staff.cargoLabel.toLowerCase().includes('gerente')) ??
    null;

  const areas = areaOrderForProfile(profile)
    .map((columnId) => {
      const areaStaff = liveStates.filter((s) => s.staff.area === columnId);
      const activeCount = areaStaff.filter(
        (s) => s.status === 'trabajando' || s.status === 'presente'
      ).length;
      return {
        area: columnId,
        label: areaLabelForProfile(profile, columnId),
        staff: areaStaff,
        activeCount,
        totalCount: areaStaff.length,
      };
    })
    .filter((block) => !(profile.hideEmptyAreas && block.totalCount === 0));

  const workingCount = liveStates.filter((s) => s.status === 'trabajando').length;
  const absentCount = liveStates.filter((s) => s.status === 'ausente').length;
  const lateCount = liveStates.filter((s) => s.status === 'tarde').length;

  const criticalMissing = liveStates
    .filter((s) => s.staff.isCritical && s.status === 'ausente')
    .map((s) => s.staff);

  const scheduleLabel = `${profile.scheduleStart ?? DEFAULT_SCHEDULE.start} - ${profile.scheduleEnd ?? DEFAULT_SCHEDULE.end}`;

  return {
    sedeName: input.sedeName,
    scheduleLabel,
    workingCount,
    absentCount,
    lateCount,
    manager: managerState,
    areas,
    isOperational: criticalMissing.length === 0,
    criticalMissing,
    bukRecintosOnDate,
    recordsOnDateCount: onDate.length,
  };
}

export function isActiveStatus(status: AsistenciaLiveStatus): boolean {
  return status === 'trabajando' || status === 'presente';
}

export function formatSedeDateLabel(date: Date): string {
  return formatDayKey(date);
}

export function buildLiveConsolidatedSummary(input: {
  sedeNames: string[];
  settings: AsistenciaSettings;
  records: BukAsistenciaRecord[];
  date: Date;
}): AsistenciaLiveConsolidatedSummary {
  const sedes = input.sedeNames.map((sedeName) =>
    buildLiveSedeSummary({
      sedeName,
      settings: input.settings,
      records: input.records,
      date: input.date,
    })
  );
  return {
    workingCount: sedes.reduce((n, s) => n + s.workingCount, 0),
    absentCount: sedes.reduce((n, s) => n + s.absentCount, 0),
    lateCount: sedes.reduce((n, s) => n + s.lateCount, 0),
    isFullyOperational: sedes.every((s) => s.isOperational),
    sedes,
  };
}
