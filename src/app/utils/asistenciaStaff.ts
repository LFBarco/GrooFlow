import type {
  AsistenciaLiveSedeSummary,
  AsistenciaLiveStatus,
  AsistenciaSettings,
  AsistenciaSedeProfile,
  AsistenciaStaffArea,
  AsistenciaStaffLiveState,
  AsistenciaStaffMember,
  BukAsistenciaRecord,
} from '../types/asistencia';
import { ASISTENCIA_STAFF_AREAS } from '../types/asistencia';
import {
  formatBukRecintoLabel,
  formatDayKey,
  hasBukEntradaMarcada,
  isRecordOnDate,
  matchesBukRecintoConfig,
  mergeAsistenciaSettings,
} from './asistenciaData';

const DEFAULT_SCHEDULE = { start: '08:00', end: '18:00' };

function normalizeRut(raw?: string): string {
  return (raw ?? '').replace(/[.\-\s]/g, '').toUpperCase();
}

function parseTimeToMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function entradaMinutes(record?: BukAsistenciaRecord): number | null {
  if (!record) return null;
  if (record.entrada_format?.trim()) {
    return parseTimeToMinutes(record.entrada_format);
  }
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
  const staffRut = normalizeRut(staff.rut);
  const recordRut = normalizeRut(r.rut_trabajador);
  if (!staffRut || !recordRut) return false;
  return staffRut === recordRut;
}

function hasEntradaMarcada(r: BukAsistenciaRecord): boolean {
  return hasBukEntradaMarcada(r);
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
  const staffRut = normalizeRut(input.staff.rut);

  if (onDate.length === 0) {
    return `Buk no tiene marcaciones para el ${dateKey}. Revisa la fecha del panel.`;
  }

  if (!staffRut) {
    return 'Configura el RUT del trabajador (debe coincidir con rut_trabajador en Buk).';
  }

  const byRutOnDate = onDate.filter((r) => normalizeRut(r.rut_trabajador) === staffRut);
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
    return `RUT coincide el ${dateKey} en «${input.sedeName}», pero sin hora en entrada_format (aún no marca entrada).`;
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
  record: BukAsistenciaRecord | undefined
): Pick<AsistenciaStaffLiveState, 'status' | 'entradaFormat' | 'stillOnSite'> {
  if (!record || !hasEntradaMarcada(record)) {
    return { status: 'ausente', stillOnSite: false };
  }
  const expected = parseTimeToMinutes(staff.expectedTime);
  const arrived = entradaMinutes(record);
  const entradaFormat = record.entrada_format || staff.expectedTime;
  const stillOnSite = !record.salida;

  if (stillOnSite) {
    return { status: 'trabajando', entradaFormat, stillOnSite: true };
  }
  if (expected != null && arrived != null && arrived > expected + 5) {
    return { status: 'tarde', entradaFormat, stillOnSite: false };
  }
  return { status: 'presente', entradaFormat, stillOnSite: false };
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
  };
}

export function staffForSede(settings: AsistenciaSettings, sedeName: string): AsistenciaStaffMember[] {
  const merged = mergeAsistenciaSettings(settings);
  return (merged.staff ?? [])
    .filter((s) => s.sedeName === sedeName)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.fullName.localeCompare(b.fullName));
}

export function defaultMatchHints(cargoLabel: string, area: AsistenciaStaffArea): {
  matchArea?: string;
  matchSpecialty?: string;
} {
  const c = cargoLabel.toLowerCase();
  if (c.includes('recep') || c.includes('counter')) {
    return { matchArea: area === 'administracion' ? 'COUNTER' : 'COUNTER' };
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
    const live = resolveLiveStatus(staff, buk);
    const matchHint =
      live.status === 'ausente' && input.records.length > 0
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

  const areas = ASISTENCIA_STAFF_AREAS.map((area) => {
    const areaStaff = liveStates.filter((s) => s.staff.area === area);
    const activeCount = areaStaff.filter(
      (s) => s.status === 'trabajando' || s.status === 'presente'
    ).length;
    return {
      area,
      staff: areaStaff,
      activeCount,
      totalCount: areaStaff.length,
    };
  });

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
