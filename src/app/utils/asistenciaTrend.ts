import { format } from 'date-fns';
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

export function buildAsistenciaWeekTrend(input: {
  records: BukAsistenciaRecord[];
  settings: AsistenciaSettings;
  sedeName: string;
  weekDays: Date[];
}): AsistenciaWeekTrendDay[] {
  return input.weekDays.map((day) => {
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

export function buildAsistenciaMultiSedeWeekTrend(input: {
  records: BukAsistenciaRecord[];
  settings: AsistenciaSettings;
  sedeNames: string[];
  weekDays: Date[];
}): AsistenciaWeekTrendDay[] {
  return input.weekDays.map((day) => {
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
