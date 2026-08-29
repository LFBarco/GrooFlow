import type { TurnoShiftCode } from '../types/turnos';

export const TURNO_SHIFT_STYLES: Record<
  TurnoShiftCode,
  { pill: string; dot: string; legend: string; icon: string }
> = {
  day: {
    pill: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-500/20 dark:text-amber-100 dark:border-amber-500/40',
    dot: 'bg-amber-400',
    legend: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/30',
    icon: '☀️',
  },
  night: {
    pill: 'bg-indigo-100 text-indigo-900 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-100 dark:border-indigo-500/40',
    dot: 'bg-indigo-400',
    legend: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-200 dark:border-indigo-500/30',
    icon: '🌙',
  },
  off: {
    pill: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
    legend: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700',
    icon: '—',
  },
  training: {
    pill: 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-100 dark:border-emerald-500/40',
    dot: 'bg-emerald-400',
    legend: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-500/30',
    icon: '📚',
  },
};

export function coverShiftRing(isCover: boolean): string {
  return isCover
    ? 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-background dark:ring-cyan-500'
    : '';
}
