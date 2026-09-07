import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

import type { AsistenciaSettings, BukAsistenciaRecord } from '../types/asistencia';
import { buildBukDashboardSummary } from './asistenciaBukDashboard';
import { toDateKey } from './turnosCalendar';

export type AsistenciaWeekTrendDay = {
  dateKey: string;
  label: string;
  weekday: string;
  total: number;
  arrived: number;
  absent: number;
  late: number;
  onTime: number;
};

export function buildAsistenciaTrendDays(input: {
  records: BukAsistenciaRecord[];
  settings: AsistenciaSettings;
  sedeName: string;
  days: Date[];
}): AsistenciaWeekTrendDay[] {
  return input.days.map((day) => {
    const summary = buildBukDashboardSummary({
      records: input.records,
      sedeName: input.sedeName,
      settings: input.settings,
      date: day,
    });
    const dateKey = toDateKey(day);
    return {
      dateKey,
      label: format(day, 'd MMM', { locale: es }),
      weekday: format(day, 'EEE', { locale: es }),
      total: summary.total,
      arrived: summary.arrived,
      absent: summary.absent,
      late: summary.late,
      onTime: summary.onTime,
    };
  });
}

export function buildAsistenciaMultiSedeTrendDays(input: {
  records: BukAsistenciaRecord[];
  settings: AsistenciaSettings;
  sedeNames: string[];
  days: Date[];
}): AsistenciaWeekTrendDay[] {
  return input.days.map((day) => {
    let total = 0;
    let arrived = 0;
    let absent = 0;
    let late = 0;
    let onTime = 0;
    for (const sedeName of input.sedeNames) {
      const s = buildBukDashboardSummary({
        records: input.records,
        sedeName,
        settings: input.settings,
        date: day,
      });
      total += s.total;
      arrived += s.arrived;
      absent += s.absent;
      late += s.late;
      onTime += s.onTime;
    }
    const dateKey = toDateKey(day);
    return {
      dateKey,
      label: format(day, 'd MMM', { locale: es }),
      weekday: format(day, 'EEE', { locale: es }),
      total,
      arrived,
      absent,
      late,
      onTime,
    };
  });
}

/** @deprecated usar buildAsistenciaTrendDays */
export function buildAsistenciaWeekTrend(input: {
  records: BukAsistenciaRecord[];
  settings: AsistenciaSettings;
  sedeName: string;
  weekDays: Date[];
}): AsistenciaWeekTrendDay[] {
  return buildAsistenciaTrendDays({
    records: input.records,
    settings: input.settings,
    sedeName: input.sedeName,
    days: input.weekDays,
  });
}

/** @deprecated usar buildAsistenciaMultiSedeTrendDays */
export function buildAsistenciaMultiSedeWeekTrend(input: {
  records: BukAsistenciaRecord[];
  settings: AsistenciaSettings;
  sedeNames: string[];
  weekDays: Date[];
}): AsistenciaWeekTrendDay[] {
  return buildAsistenciaMultiSedeTrendDays({
    records: input.records,
    settings: input.settings,
    sedeNames: input.sedeNames,
    days: input.weekDays,
  });
}

/** Genera N días hacia atrás incluyendo el día ancla. */
export function trendDaysEndingAt(anchor: Date, count: number): Date[] {
  const n = Math.max(1, Math.min(90, count));
  const days: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    days.push(subDays(anchor, i));
  }
  return days;
}

export function trendRangeLabel(days: Date[]): string {
  if (!days.length) return '';
  const a = days[0]!;
  const b = days[days.length - 1]!;
  return `${format(a, 'd MMM', { locale: es })} – ${format(b, 'd MMM yyyy', { locale: es })}`;
}
