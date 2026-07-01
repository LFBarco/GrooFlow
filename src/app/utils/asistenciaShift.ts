import type {
  AsistenciaShiftFilter,
  AsistenciaStaffMember,
  AsistenciaWeekday,
  AsistenciaWeekdayShift,
  AsistenciaWorkShift,
  BukAsistenciaRecord,
} from '../types/asistencia';
import {
  ASISTENCIA_DEFAULT_DAY_EXPECTED_TIME,
  ASISTENCIA_DEFAULT_NIGHT_EXPECTED_TIME,
  ASISTENCIA_SEDE_LEADER_CARGO,
  ASISTENCIA_WEEKDAY_LABELS,
  ASISTENCIA_WEEKDAYS,
  ASISTENCIA_WORK_SHIFT_LABELS,
} from '../types/asistencia';

/** Lunes = 0 … Domingo = 6 (date-fns getDay: 0=Dom → convertimos). */
export function weekdayKeyFromDate(date: Date): AsistenciaWeekday {
  const js = date.getDay();
  const map: AsistenciaWeekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return map[js] ?? 'mon';
}

export function hasWeeklyShiftSchedule(staff: AsistenciaStaffMember): boolean {
  return staff.shiftMode === 'weekly' && Boolean(staff.weeklyShifts);
}

export function resolveStaffShift(staff: AsistenciaStaffMember): AsistenciaWorkShift {
  return staff.shift === 'night' ? 'night' : 'day';
}

/** Turno esperado en una fecha concreta; `null` si el día es libre. */
export function resolveStaffShiftForDate(
  staff: AsistenciaStaffMember,
  date: Date
): AsistenciaWorkShift | null {
  if (hasWeeklyShiftSchedule(staff) && staff.weeklyShifts) {
    const key = weekdayKeyFromDate(date);
    const dayShift = staff.weeklyShifts[key];
    if (dayShift === 'off') return null;
    if (dayShift === 'day' || dayShift === 'night') return dayShift;
  }
  return resolveStaffShift(staff);
}

export function isStaffScheduledOnDate(staff: AsistenciaStaffMember, date: Date): boolean {
  return resolveStaffShiftForDate(staff, date) !== null;
}

export function expectedTimeForStaffOnDate(
  staff: AsistenciaStaffMember,
  date: Date
): string {
  const shift = resolveStaffShiftForDate(staff, date);
  if (shift === 'night') {
    return staff.expectedTimeNight?.trim() || ASISTENCIA_DEFAULT_NIGHT_EXPECTED_TIME;
  }
  return staff.expectedTime?.trim() || ASISTENCIA_DEFAULT_DAY_EXPECTED_TIME;
}

export function normalizeStaffShift(member: AsistenciaStaffMember): AsistenciaStaffMember {
  const cargoLabel =
    member.cargoLabel === 'Gerente' ? 'Encargado de sede' : member.cargoLabel;
  const weeklyShifts = normalizeWeeklyShifts(member.weeklyShifts);
  const shiftMode =
    member.shiftMode === 'weekly' || (weeklyShifts && Object.keys(weeklyShifts).length > 0)
      ? 'weekly'
      : member.shiftMode ?? 'fixed';

  return {
    ...member,
    cargoLabel,
    shift: resolveStaffShift(member),
    shiftMode,
    weeklyShifts: shiftMode === 'weekly' ? weeklyShifts : undefined,
    expectedTimeNight:
      member.expectedTimeNight?.trim() || ASISTENCIA_DEFAULT_NIGHT_EXPECTED_TIME,
  };
}

function normalizeWeeklyShifts(
  raw?: Partial<Record<AsistenciaWeekday, AsistenciaWeekdayShift>>
): Partial<Record<AsistenciaWeekday, AsistenciaWeekdayShift>> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Partial<Record<AsistenciaWeekday, AsistenciaWeekdayShift>> = {};
  for (const key of ASISTENCIA_WEEKDAYS) {
    const v = raw[key];
    if (v === 'day' || v === 'night' || v === 'off') out[key] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function staffMatchesShiftFilter(
  staff: AsistenciaStaffMember,
  filter: AsistenciaShiftFilter,
  date?: Date
): boolean {
  if (filter === 'all') {
    if (date && hasWeeklyShiftSchedule(staff)) {
      return isStaffScheduledOnDate(staff, date);
    }
    return true;
  }
  if (date && !isStaffScheduledOnDate(staff, date)) return false;
  const shift = date ? resolveStaffShiftForDate(staff, date) : resolveStaffShift(staff);
  if (shift === null) return false;
  return shift === filter;
}

export function isNightBukRecord(record: BukAsistenciaRecord): boolean {
  return record.turno_noche === true;
}

export function recordMatchesStaffShift(
  record: BukAsistenciaRecord,
  staff: AsistenciaStaffMember,
  date?: Date
): boolean {
  const shift = date ? resolveStaffShiftForDate(staff, date) : resolveStaffShift(staff);
  if (shift === null) return false;
  if (shift === 'night') return isNightBukRecord(record);
  return !isNightBukRecord(record);
}

export function isSedeLeaderCargo(cargoLabel: string): boolean {
  const c = cargoLabel.trim().toLowerCase();
  return (
    c === ASISTENCIA_SEDE_LEADER_CARGO.toLowerCase() ||
    c.includes('encargado') ||
    c.includes('gerente')
  );
}

export function defaultExpectedTimeForShift(shift: AsistenciaWorkShift): string {
  return shift === 'night'
    ? ASISTENCIA_DEFAULT_NIGHT_EXPECTED_TIME
    : ASISTENCIA_DEFAULT_DAY_EXPECTED_TIME;
}

export function scheduleLabelForShift(
  shift: AsistenciaShiftFilter,
  profile: {
    scheduleStart?: string;
    scheduleEnd?: string;
    scheduleNightStart?: string;
    scheduleNightEnd?: string;
  }
): string {
  const dayStart = profile.scheduleStart ?? ASISTENCIA_DEFAULT_DAY_EXPECTED_TIME;
  const dayEnd = profile.scheduleEnd ?? '18:00';
  const nightStart = profile.scheduleNightStart ?? ASISTENCIA_DEFAULT_NIGHT_EXPECTED_TIME;
  const nightEnd = profile.scheduleNightEnd ?? '08:00';

  if (shift === 'night') return `${nightStart} - ${nightEnd}`;
  if (shift === 'day') return `${dayStart} - ${dayEnd}`;
  return `Día ${dayStart}-${dayEnd} · Noche ${nightStart}-${nightEnd}`;
}

/** Resumen legible del turno mixto (ej. «Lun–Mié día · Jue–Vie noche»). */
export function formatWeeklyShiftSummary(staff: AsistenciaStaffMember): string | undefined {
  if (!hasWeeklyShiftSchedule(staff) || !staff.weeklyShifts) return undefined;
  const parts: string[] = [];
  let runStart: AsistenciaWeekday | null = null;
  let runEnd: AsistenciaWeekday | null = null;
  let runShift: AsistenciaWorkShift | null = null;

  const flush = () => {
    if (!runStart || !runEnd || !runShift) return;
    const startLabel = ASISTENCIA_WEEKDAY_LABELS[runStart];
    const endLabel = ASISTENCIA_WEEKDAY_LABELS[runEnd];
    const range = runStart === runEnd ? startLabel : `${startLabel}–${endLabel}`;
    parts.push(`${range} ${ASISTENCIA_WORK_SHIFT_LABELS[runShift].toLowerCase()}`);
    runStart = null;
    runEnd = null;
    runShift = null;
  };

  for (const day of ASISTENCIA_WEEKDAYS) {
    const v = staff.weeklyShifts[day];
    if (v !== 'day' && v !== 'night') {
      flush();
      continue;
    }
    if (runShift === v && runStart) {
      runEnd = day;
    } else {
      flush();
      runStart = day;
      runEnd = day;
      runShift = v;
    }
  }
  flush();
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export function shiftLabelForStaff(staff: AsistenciaStaffMember, date?: Date): string {
  if (date) {
    const shift = resolveStaffShiftForDate(staff, date);
    if (shift === null) return 'Libre';
    if (hasWeeklyShiftSchedule(staff)) {
      return `${ASISTENCIA_WORK_SHIFT_LABELS[shift]} (${ASISTENCIA_WEEKDAY_LABELS[weekdayKeyFromDate(date)]})`;
    }
    return ASISTENCIA_WORK_SHIFT_LABELS[shift];
  }
  const weekly = formatWeeklyShiftSummary(staff);
  if (weekly) return weekly;
  return ASISTENCIA_WORK_SHIFT_LABELS[resolveStaffShift(staff)];
}

export function createDefaultWeeklyShifts(
  baseShift: AsistenciaWorkShift
): Partial<Record<AsistenciaWeekday, AsistenciaWeekdayShift>> {
  const out: Partial<Record<AsistenciaWeekday, AsistenciaWeekdayShift>> = {};
  for (const d of ASISTENCIA_WEEKDAYS) {
    out[d] = d === 'sat' || d === 'sun' ? 'off' : baseShift;
  }
  return out;
}
