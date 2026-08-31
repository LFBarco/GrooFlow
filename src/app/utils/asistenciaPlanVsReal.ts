import type { AsistenciaSettings, AsistenciaStaffMember, BukAsistenciaRecord } from '../types/asistencia';
import type { TurnosPlanVsReal, TurnosRosterEntry, TurnosSettings } from '../types/turnos';
import { comparePlanVsReal } from './turnosAsistenciaBridge';
import { assignmentForCell } from './turnosData';
import { toDateKey } from './turnosCalendar';

export function findRosterForAsistenciaStaff(
  roster: TurnosRosterEntry[],
  staff: AsistenciaStaffMember
): TurnosRosterEntry | undefined {
  const byId = roster.find((r) => r.asistenciaStaffId === staff.id);
  if (byId) return byId;
  const byAsistId = roster.find((r) => r.id === `asist-${staff.id}`);
  if (byAsistId) return byAsistId;
  const nameKey = staff.fullName.trim().toLowerCase();
  return roster.find(
    (r) =>
      r.fullName.trim().toLowerCase() === nameKey &&
      r.homeSede.trim().toLowerCase() === staff.sedeName.trim().toLowerCase()
  );
}

export function planVsRealForStaffMember(input: {
  staff: AsistenciaStaffMember;
  turnosSettings: TurnosSettings;
  asistencia: AsistenciaSettings;
  bukRecords: BukAsistenciaRecord[];
  date: Date;
}): TurnosPlanVsReal {
  const roster = findRosterForAsistenciaStaff(input.turnosSettings.roster, input.staff);
  if (!roster) {
    return { status: 'na', label: '—', detail: 'Sin roster en Turnos' };
  }
  const assignment = assignmentForCell(
    input.turnosSettings,
    roster.id,
    toDateKey(input.date),
    input.staff.sedeName
  );
  return comparePlanVsReal({
    roster,
    assignment,
    asistencia: input.asistencia,
    bukRecords: input.bukRecords,
    date: input.date,
    workSede: input.staff.sedeName,
  });
}
