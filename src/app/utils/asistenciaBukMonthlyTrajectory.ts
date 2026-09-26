import { format, getDaysInMonth, getDay, isAfter, startOfDay, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

import type { AsistenciaSettings, BukAsistenciaRecord } from '../types/asistencia';
import {
  hasBukEntradaMarcada,
  hasBukJornadaCompletaInRecords,
  personFullName,
  resolveBukEntryLateMinutes,
  isRecordOnDate,
} from './asistenciaData';
import { asistenciaRutMatchKey, asistenciaRutsMatch } from './asistenciaRut';
import { filterBukRecordsForSedeDate, getSedeProfile, staffForSede } from './asistenciaStaff';

export type BukMonthlyDayCell = 'present' | 'absent' | 'future';

export type BukMonthlyDayHeader = {
  day: number;
  /** Ej. "1-Set" */
  label: string;
  /** Inicial del día: L M M J V S D */
  weekdayLetter: string;
};

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
  dayHeaders: BukMonthlyDayHeader[];
  rows: BukMonthlyTrajectoryRow[];
};

/** Abreviaturas tipo reporte Buk (Set = septiembre). */
const MONTH_ABBR_ES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Oct',
  'Nov',
  'Dic',
] as const;

/** getDay(): 0=Dom … 6=Sáb */
const WEEKDAY_LETTER = ['D', 'L', 'M', 'M', 'J', 'V', 'S'] as const;

export function buildMonthDayHeaders(year: number, monthIndex: number, daysInMonth: number): BukMonthlyDayHeader[] {
  const abbr = MONTH_ABBR_ES[monthIndex] ?? 'Mes';
  const out: BukMonthlyDayHeader[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, monthIndex, day);
    out.push({
      day,
      label: `${day}-${abbr}`,
      weekdayLetter: WEEKDAY_LETTER[getDay(d)] ?? '',
    });
  }
  return out;
}

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
 * ✓ = jornada completa (entrada + salida) ese día, como en el reporte Buk.
 * Las marcaciones se buscan por RUT en todo el dataset (no se pierden por filtro de sede/huellero).
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
  const dayHeaders = buildMonthDayHeaders(year, monthIndex, daysInMonth);

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

  // Personas de la plantilla de la sede.
  for (const s of staffForSede(input.settings, input.sedeName, 'all')) {
    if (s.rut?.trim()) putPerson(s.rut, s.fullName);
  }

  // También quien marcó en el huellero de esta sede (descubrimiento).
  for (let day = 1; day <= daysInMonth; day++) {
    const dayDate = new Date(year, monthIndex, day, 12, 0, 0);
    for (const r of filterBukRecordsForSedeDate(
      input.records,
      input.sedeName,
      input.settings,
      dayDate
    )) {
      putPerson(r.rut_trabajador, personFullName(r));
    }
  }

  // Marcas por RUT+día en TODOS los registros (✓ = entrada + salida, como reporte Buk).
  for (const [key, acc] of byRut) {
    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(year, monthIndex, day, 12, 0, 0);
      const dayRecords = input.records.filter(
        (r) =>
          isRecordOnDate(r, dayDate) && asistenciaRutsMatch(key, r.rut_trabajador)
      );
      if (!hasBukJornadaCompletaInRecords(dayRecords, dayDate)) continue;
      acc.marked[day - 1] = true;
      const entradaRec = dayRecords.find((r) => hasBukEntradaMarcada(r));
      if (entradaRec) {
        acc.lateMinutes += resolveBukEntryLateMinutes(entradaRec, profile);
      }
    }
  }

  const search = (input.search ?? '').trim().toLowerCase();
  const rows: BukMonthlyTrajectoryRow[] = [...byRut.values()]
    .map((acc) => {
      const days: BukMonthlyDayCell[] = acc.marked.map((marked, i) =>
        dayCellFor(i + 1, year, monthIndex, marked, today)
      );
      return {
        rut: acc.rut,
        fullName: acc.fullName,
        days,
        lateMinutesTotal: acc.lateMinutes,
        daysPresent: days.filter((d) => d === 'present').length,
        daysAbsent: days.filter((d) => d === 'absent').length,
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

  return { year, month, daysInMonth, monthLabel, dayHeaders, rows };
}

export function formatLateMinutesLabel(minutes: number): string {
  if (minutes <= 0) return '0 min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
