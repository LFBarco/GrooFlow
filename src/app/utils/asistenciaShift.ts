import type {
  AsistenciaShiftFilter,
  AsistenciaStaffMember,
  AsistenciaWorkShift,
  BukAsistenciaRecord,
} from '../types/asistencia';
import {
  ASISTENCIA_DEFAULT_DAY_EXPECTED_TIME,
  ASISTENCIA_DEFAULT_NIGHT_EXPECTED_TIME,
  ASISTENCIA_SEDE_LEADER_CARGO,
} from '../types/asistencia';

export function resolveStaffShift(staff: AsistenciaStaffMember): AsistenciaWorkShift {
  return staff.shift === 'night' ? 'night' : 'day';
}

export function normalizeStaffShift(member: AsistenciaStaffMember): AsistenciaStaffMember {
  const cargoLabel =
    member.cargoLabel === 'Gerente' ? 'Encargado de sede' : member.cargoLabel;
  return {
    ...member,
    cargoLabel,
    shift: resolveStaffShift(member),
  };
}

export function staffMatchesShiftFilter(
  staff: AsistenciaStaffMember,
  filter: AsistenciaShiftFilter
): boolean {
  if (filter === 'all') return true;
  return resolveStaffShift(staff) === filter;
}

export function isNightBukRecord(record: BukAsistenciaRecord): boolean {
  return record.turno_noche === true;
}

export function recordMatchesStaffShift(
  record: BukAsistenciaRecord,
  staff: AsistenciaStaffMember
): boolean {
  const shift = resolveStaffShift(staff);
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
