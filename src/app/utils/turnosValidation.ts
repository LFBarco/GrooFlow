import type { TurnoShiftCode, TurnosLaborAlert, TurnosRosterEntry, TurnosSettings } from '../types/turnos';
import { toDateKey } from './turnosCalendar';

const DEFAULT_RULES = {
  maxConsecutiveNights: 4,
  minDaysOffPerMonth: 4,
  maxConsecutiveWorkDays: 6,
};

function sortedDates(dates: string[]): string[] {
  return [...dates].sort();
}

function consecutiveRun(dates: string[], predicate: (d: string) => boolean): number {
  let max = 0;
  let current = 0;
  let prev: Date | null = null;
  for (const key of sortedDates(dates)) {
    if (!predicate(key)) {
      current = 0;
      prev = null;
      continue;
    }
    const d = new Date(`${key}T12:00:00`);
    if (prev) {
      const diff = (d.getTime() - prev.getTime()) / 86400000;
      current = diff === 1 ? current + 1 : 1;
    } else {
      current = 1;
    }
    prev = d;
    max = Math.max(max, current);
  }
  return max;
}

export function computeLaborAlerts(
  settings: TurnosSettings,
  roster: TurnosRosterEntry[],
  dateKeys: string[],
  workSede: string
): TurnosLaborAlert[] {
  const rules = { ...DEFAULT_RULES, ...(settings.laborRules ?? {}) };
  const alerts: TurnosLaborAlert[] = [];
  const keySet = new Set(dateKeys);

  for (const staff of roster) {
    const rows = settings.assignments.filter((a) => {
      if (a.staffId !== staff.id || !keySet.has(a.date)) return false;
      if (workSede !== 'Todas' && a.workSede !== workSede) return false;
      return true;
    });

    const nightDates = rows.filter((a) => a.shift === 'night').map((a) => a.date);
    const maxNights = consecutiveRun(nightDates, () => true);
    if (maxNights > (rules.maxConsecutiveNights ?? 4)) {
      alerts.push({
        staffId: staff.id,
        staffName: staff.fullName,
        date: nightDates[nightDates.length - 1] ?? dateKeys[0]!,
        code: 'max_nights',
        message: `${maxNights} noches seguidas (máx. ${rules.maxConsecutiveNights})`,
        severity: 'error',
      });
    }

    const workDates = rows
      .filter((a) => a.shift === 'day' || a.shift === 'night')
      .map((a) => a.date);
    const maxWork = consecutiveRun(workDates, () => true);
    if (maxWork > (rules.maxConsecutiveWorkDays ?? 6)) {
      alerts.push({
        staffId: staff.id,
        staffName: staff.fullName,
        date: workDates[workDates.length - 1] ?? dateKeys[0]!,
        code: 'max_consecutive',
        message: `${maxWork} días laborales seguidos (máx. ${rules.maxConsecutiveWorkDays})`,
        severity: 'warning',
      });
    }

    const offCount = rows.filter((a) => a.shift === 'off').length;
    if (dateKeys.length >= 28 && offCount < (rules.minDaysOffPerMonth ?? 4)) {
      alerts.push({
        staffId: staff.id,
        staffName: staff.fullName,
        date: dateKeys[dateKeys.length - 1]!,
        code: 'min_off',
        message: `Solo ${offCount} libres en el periodo (mín. ${rules.minDaysOffPerMonth})`,
        severity: 'warning',
      });
    }
  }

  return alerts;
}

export function staffHasLaborAlert(
  alerts: TurnosLaborAlert[],
  staffId: string
): boolean {
  return alerts.some((a) => a.staffId === staffId);
}

export function shiftCodesForStaffInRange(
  settings: TurnosSettings,
  staffId: string,
  dateKeys: string[],
  workSede: string
): Map<string, TurnoShiftCode> {
  const keySet = new Set(dateKeys);
  const map = new Map<string, TurnoShiftCode>();
  for (const a of settings.assignments) {
    if (a.staffId !== staffId || !keySet.has(a.date)) continue;
    if (workSede !== 'Todas' && a.workSede !== workSede) continue;
    map.set(a.date, a.shift);
  }
  return map;
}
