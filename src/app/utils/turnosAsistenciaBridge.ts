import type { AsistenciaSettings, AsistenciaStaffMember, BukAsistenciaRecord } from '../types/asistencia';
import type { TurnoAssignment, TurnosPlanVsReal, TurnosRosterEntry } from '../types/turnos';
import { TURNO_SHIFT_LABELS } from '../types/turnos';
import { mergeAsistenciaSettings, isRecordOnDate, hasBukEntradaMarcada } from './asistenciaData';
import { filterBukRecordsForSedeDate } from './asistenciaStaff';
import { isNightBukRecord } from './asistenciaShift';

function normalizeRut(rut?: string): string {
  return (rut ?? '').replace(/[.\-\s]/g, '').toLowerCase();
}

export function findAsistenciaStaffForRoster(
  roster: TurnosRosterEntry,
  asistencia: AsistenciaSettings
): AsistenciaStaffMember | undefined {
  const merged = mergeAsistenciaSettings(asistencia);
  const staff = merged.staff ?? [];
  if (roster.asistenciaStaffId) {
    return staff.find((s) => s.id === roster.asistenciaStaffId);
  }
  const byName = staff.find(
    (s) =>
      s.fullName.trim().toLowerCase() === roster.fullName.trim().toLowerCase() &&
      s.sedeName === roster.homeSede
  );
  if (byName) return byName;
  if (roster.email) {
    return staff.find((s) => s.email?.toLowerCase() === roster.email?.toLowerCase());
  }
  return undefined;
}

function findBukRecordForRoster(
  roster: TurnosRosterEntry,
  staff: AsistenciaStaffMember | undefined,
  records: BukAsistenciaRecord[],
  sedeName: string,
  asistencia: AsistenciaSettings,
  date: Date
): BukAsistenciaRecord | undefined {
  const onSede = filterBukRecordsForSedeDate(records, sedeName, asistencia, date);
  const staffRut = normalizeRut(staff?.rut);
  if (staffRut) {
    const byRut = onSede.find((r) => normalizeRut(r.rut_trabajador) === staffRut);
    if (byRut) return byRut;
  }
  const nameKey = roster.fullName.trim().toLowerCase();
  return onSede.find((r) => {
    const full = `${r.nombre ?? ''} ${r.apellido_paterno ?? ''} ${r.apellido_materno ?? ''}`
      .trim()
      .toLowerCase();
    return full.includes(nameKey.split(' ')[0] ?? '') || nameKey.includes((r.nombre ?? '').toLowerCase());
  });
}

function plannedIsWorkShift(assignment?: TurnoAssignment): boolean {
  return assignment?.shift === 'day' || assignment?.shift === 'night';
}

export function comparePlanVsReal(input: {
  roster: TurnosRosterEntry;
  assignment?: TurnoAssignment;
  asistencia?: AsistenciaSettings | null;
  bukRecords: BukAsistenciaRecord[];
  date: Date;
  workSede: string;
}): TurnosPlanVsReal {
  const bukEnabled = Boolean(input.asistencia?.buk?.enabled && input.asistencia.buk.apiToken?.trim());
  if (!bukEnabled || input.bukRecords.length === 0) {
    return { status: 'na', label: '—' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(input.date);
  target.setHours(0, 0, 0, 0);
  if (target > today) {
    return { status: 'pending', label: 'Pend.', detail: 'Fecha futura' };
  }

  const sede = input.workSede === 'Todas' ? input.roster.homeSede : input.workSede;
  const staff = findAsistenciaStaffForRoster(input.roster, input.asistencia ?? {});
  const record = findBukRecordForRoster(
    input.roster,
    staff,
    input.bukRecords,
    sede,
    input.asistencia ?? {},
    input.date
  );

  const hasEntrada = record ? hasBukEntradaMarcada(record) : false;
  const planned = input.assignment;

  if (!plannedIsWorkShift(planned)) {
    if (hasEntrada) {
      return {
        status: 'unplanned',
        label: 'Sin plan',
        detail: 'Marcó asistencia sin turno día/noche planificado',
      };
    }
    return { status: 'off_ok', label: 'Libre', detail: 'Sin turno operativo planificado' };
  }

  if (!hasEntrada) {
    return {
      status: 'absent',
      label: 'Ausente',
      detail: `Planificado: ${TURNO_SHIFT_LABELS[planned!.shift]}`,
    };
  }

  const bukNight = isNightBukRecord(record!);
  const plannedNight = planned!.shift === 'night';
  if (bukNight !== plannedNight) {
    return {
      status: 'mismatch',
      label: 'Turno ≠',
      detail: `Plan: ${plannedNight ? 'noche' : 'día'} · Buk: ${bukNight ? 'noche' : 'día'}`,
    };
  }

  const entrada = record!.entrada_format?.trim() || record!.entrada || '';
  return {
    status: 'ok',
    label: 'OK',
    detail: entrada ? `Entrada ${entrada}` : 'Marcación confirmada',
  };
}

export function bukRecordsForDateRange(
  records: BukAsistenciaRecord[],
  dateKeys: string[]
): BukAsistenciaRecord[] {
  const keySet = new Set(dateKeys);
  return records.filter((r) => {
    const key = r.dia_entrada?.slice(0, 10);
    if (key && keySet.has(key)) return true;
    return dateKeys.some((dk) => isRecordOnDate(r, new Date(`${dk}T12:00:00`)));
  });
}
