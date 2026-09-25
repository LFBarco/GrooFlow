import { format, getDaysInMonth, isAfter, startOfDay, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

import type { AsistenciaSettings, BukAsistenciaRecord } from '../types/asistencia';
import {
  hasBukEntradaMarcada,
  personFullName,
  resolveBukEntryLateMinutes,
} from './asistenciaData';
import { asistenciaRutMatchKey } from './asistenciaRut';
import { filterBukRecordsForSedeDate, getSedeProfile, staffForSede } from './asistenciaStaff';

export type BukMonthlyDayCell = 'present' | 'absent' | 'future';

export type BukMonthlyTrajectoryRow = {
  rut: string;
  fullName: string;
  /** Índice 0 = día 1 del mes. */
  days: BukMonthlyDayCell[];
  lateMinutesTotal: number;
  daysPresent: number;
  daysAbsent: number;
};

export type BukMonthlyTrajectory = {
  year: number;
  /** 1–12 */
  month: number;
  daysInMonth: number;
  monthLabel: string;
  rows: BukMonthlyTrajectoryRow[];
};

function dayCellFor(
  day: number,
  year: number,
  monthIndex: number,
  marked: boolean,
  today: Date
): BukMonthlyDayCell {
  const cellDate = startOfDay(new Date(year, monthIndex, day));
  if (isAfter(cellDate, startOfDay(today))) return 'future';
  return marked ? 'present' : 'absent';
}

/**
 * Trayectoria mensual de marcaciones por persona (sede + mes de `date`).
 * Verde = marcó entrada; rojo = no marcó (días pasados/hoy); futuro = vacío.
 */
export function buildBukMonthlyTrajectory(input: {
  records: BukAsistenciaRecord[];
  sedeName: string;
  settings: AsistenciaSettings;
  date: Date;
  /** Fecha “hoy” para no marcar ausente días futuros. */
  today?: Date;
  search?: string;
}): BukMonthlyTrajectory {
  const today = input.today ?? new Date();
  const year = input.date.getFullYear();
  const monthIndex = input.date.getMonth();
  const month = monthIndex + 1;
  const daysInMonth = getDaysInMonth(input.date);
  const profile = getSedeProfile(input.settings, input.sedeName);
  const monthLabel = format(startOfMonth(input.date), 'MMMM yyyy', { locale: es });

  type Acc = {
    rut: string;
    fullName: string;
    marked: boolean[];
    lateMinutes: number;
  };
  const byRut = new Map<string, Acc>();

  const putPerson = (rutRaw: string, fullName: string) => {
    const key = asistenciaRutMatchKey(rutRaw);
    if (!key) return;
    const prev = byRut.get(key);
    if (prev) {
      if (fullName.trim().length > prev.fullName.trim().length) {
        prev.fullName = fullName.trim();
      }
      return;
    }
    byRut.set(key, {
      rut: rutRaw.trim() || key,
      fullName: fullName.trim() || key,
      marked: Array.from({ length: daysInMonth }, () => false),
      lateMinutes: 0,
    });
  };

  for (const s of staffForSede(input.settings, input.sedeName, 'all')) {
    if (s.rut?.trim()) putPerson(s.rut, s.fullName);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dayDate = new Date(year, monthIndex, day, 12, 0, 0);
    const dayRecords = filterBukRecordsForSedeDate(
      input.records,
      input.sedeName,
      input.settings,
      dayDate
    );
    for (const r of dayRecords) {
      const name = personFullName(r);
      putPerson(r.rut_trabajador, name);
      const key = asistenciaRutMatchKey(r.rut_trabajador);
      if (!key) continue;
      const acc = byRut.get(key);
      if (!acc) continue;
      if (hasBukEntradaMarcada(r)) {
        acc.marked[day - 1] = true;
        acc.lateMinutes += resolveBukEntryLateMinutes(r, profile);
      }
    }
  }

  const search = (input.search ?? '').trim().toLowerCase();
  const rows: BukMonthlyTrajectoryRow[] = [...byRut.values()]
    .map((acc) => {
      const days: BukMonthlyDayCell[] = acc.marked.map((marked, i) =>
        dayCellFor(i + 1, year, monthIndex, marked, today)
      );
      const daysPresent = days.filter((d) => d === 'present').length;
      const daysAbsent = days.filter((d) => d === 'absent').length;
      return {
        rut: acc.rut,
        fullName: acc.fullName,
        days,
        lateMinutesTotal: acc.lateMinutes,
        daysPresent,
        daysAbsent,
      };
    })
    .filter((row) => {
      if (!search) return true;
      return (
        row.fullName.toLowerCase().includes(search) ||
        row.rut.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));

  return { year, month, daysInMonth, monthLabel, rows };
}

export function formatLateMinutesLabel(minutes: number): string {
  if (minutes <= 0) return '0 min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
