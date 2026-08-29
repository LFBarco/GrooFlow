import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';

export const TURNOS_WEEK_OPTS = { weekStartsOn: 1 as const, locale: es };

export function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function parseDateKey(key: string): Date {
  return parseISO(`${key}T12:00:00`);
}

export function weekRangeLabel(anchor: Date): string {
  const start = startOfWeek(anchor, TURNOS_WEEK_OPTS);
  const end = endOfWeek(anchor, TURNOS_WEEK_OPTS);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startFmt = format(start, sameYear ? "d MMM" : "d MMM yyyy", { locale: es });
  const endFmt = format(end, "d MMM yyyy", { locale: es });
  return `${startFmt} — ${endFmt}`;
}

export function daysInWeek(anchor: Date): Date[] {
  const start = startOfWeek(anchor, TURNOS_WEEK_OPTS);
  const end = endOfWeek(anchor, TURNOS_WEEK_OPTS);
  return eachDayOfInterval({ start, end });
}

export function daysInMonthGrid(anchor: Date): Date[] {
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const gridStart = startOfWeek(monthStart, TURNOS_WEEK_OPTS);
  const gridEnd = endOfWeek(monthEnd, TURNOS_WEEK_OPTS);
  return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

export function dayHeaderLabel(date: Date): { weekday: string; day: string } {
  return {
    weekday: format(date, 'EEE', { locale: es }).toUpperCase(),
    day: format(date, 'd'),
  };
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function isInMonth(date: Date, monthAnchor: Date): boolean {
  return isSameMonth(date, monthAnchor);
}

export function shiftAnchor(view: 'day' | 'week' | 'month', anchor: Date, delta: number): Date {
  if (view === 'day') return addDays(anchor, delta);
  if (view === 'week') return addDays(anchor, delta * 7);
  return addMonths(anchor, delta);
}
