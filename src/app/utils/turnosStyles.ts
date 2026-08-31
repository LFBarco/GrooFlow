import type { TurnoCoverageKind, TurnoShiftCode } from '../types/turnos';

/** Tokens CSS para paleta de turnos (modo claro/oscuro vía variables). */
export const TURNOS_CSS_VARS = {
  dayBg: 'var(--turno-day-bg, #FEF3C7)',
  dayFg: 'var(--turno-day-fg, #92400E)',
  nightBg: 'var(--turno-night-bg, #EDE9FE)',
  nightFg: 'var(--turno-night-fg, #5B21B6)',
  offBg: 'var(--turno-off-bg, #F1F5F9)',
  trainingBg: 'var(--turno-training-bg, #D1FAE5)',
  trainingFg: 'var(--turno-training-fg, #047857)',
  covRing: 'var(--turno-cov-ring, #06B6D4)',
  extRing: 'var(--turno-ext-ring, #F97316)',
} as const;

export const TURNO_SHIFT_STYLES: Record<
  TurnoShiftCode,
  { pill: string; dot: string; legend: string; icon: string; empty: string }
> = {
  day: {
    pill: 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D] dark:bg-amber-500/25 dark:text-amber-100 dark:border-amber-500/45',
    dot: 'bg-[#F59E0B]',
    legend: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A] dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/30',
    icon: '☀️',
    empty: 'border-dashed border-amber-200/60 dark:border-amber-500/20',
  },
  night: {
    pill: 'bg-[#EDE9FE] text-[#5B21B6] border-[#C4B5FD] dark:bg-violet-500/25 dark:text-violet-100 dark:border-violet-500/45',
    dot: 'bg-[#7C3AED]',
    legend: 'bg-[#EDE9FE] text-[#5B21B6] border-[#DDD6FE] dark:bg-violet-500/15 dark:text-violet-200 dark:border-violet-500/30',
    icon: '🌙',
    empty: 'border-dashed border-violet-200/60 dark:border-violet-500/20',
  },
  off: {
    pill: 'bg-[#F1F5F9] text-[#64748B] border-[#CBD5E1] dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-600',
    dot: 'bg-[#94A3B8]',
    legend: 'bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0] dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700',
    icon: '—',
    empty: 'border-dashed border-slate-200 dark:border-slate-700',
  },
  training: {
    pill: 'bg-[#D1FAE5] text-[#047857] border-[#6EE7B7] dark:bg-emerald-500/25 dark:text-emerald-100 dark:border-emerald-500/45',
    dot: 'bg-[#10B981]',
    legend: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0] dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-500/30',
    icon: '📚',
    empty: 'border-dashed border-emerald-200/60 dark:border-emerald-500/20',
  },
};

export function coverageVisual(kind: TurnoCoverageKind | 'regular'): {
  ring: string;
  badge: string | null;
  label: string;
} {
  if (kind === 'external') {
    return {
      ring: 'ring-2 ring-[#F97316] ring-offset-1 ring-offset-background dark:ring-orange-400',
      badge: 'EXT',
      label: 'Personal externo',
    };
  }
  if (kind === 'inter_sede') {
    return {
      ring: 'ring-2 ring-[#06B6D4] ring-offset-1 ring-offset-background dark:ring-cyan-400',
      badge: 'COV',
      label: 'Cobertura inter-sede',
    };
  }
  return { ring: '', badge: null, label: 'Asignación regular' };
}

/** @deprecated Use coverageVisual */
export function coverShiftRing(isCover: boolean): string {
  return isCover
    ? 'ring-2 ring-[#06B6D4] ring-offset-1 ring-offset-background dark:ring-cyan-400'
    : '';
}

export const TURNOS_GRID_DENSITY = {
  compact: { row: 'py-1', cell: 'h-8', avatar: 'h-7 w-7' },
  comfortable: { row: 'py-2', cell: 'h-10', avatar: 'h-8 w-8' },
  spacious: { row: 'py-3', cell: 'h-12', avatar: 'h-9 w-9' },
} as const;

export const TURNOS_PRINT_CLASS = 'turnos-print-root';

/** Avatar por área operativa. */
export function workAreaAvatarClass(workArea?: string): string {
  const area = (workArea || '').toLowerCase();
  if (area.includes('méd') || area.includes('med') || area.includes('vet')) {
    return 'bg-sky-100 text-sky-800 dark:bg-sky-500/25 dark:text-sky-100';
  }
  if (area.includes('groom') || area.includes('pelu')) {
    return 'bg-pink-100 text-pink-800 dark:bg-pink-500/25 dark:text-pink-100';
  }
  if (area.includes('recep') || area.includes('counter') || area.includes('admin')) {
    return 'bg-slate-200 text-slate-700 dark:bg-slate-600/40 dark:text-slate-100';
  }
  if (area.includes('farm')) {
    return 'bg-teal-100 text-teal-800 dark:bg-teal-500/25 dark:text-teal-100';
  }
  if (area.includes('lab')) {
    return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/25 dark:text-cyan-100';
  }
  if (area.includes('mant') || area.includes('limp')) {
    return 'bg-orange-100 text-orange-800 dark:bg-orange-500/25 dark:text-orange-100';
  }
  if (area.includes('flota') || area.includes('chofer')) {
    return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/25 dark:text-indigo-100';
  }
  if (area.includes('bode') || area.includes('almac')) {
    return 'bg-amber-100 text-amber-900 dark:bg-amber-500/25 dark:text-amber-100';
  }
  return 'bg-violet-100 text-violet-800 dark:bg-violet-500/25 dark:text-violet-200';
}

export function isWeekendColumn(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export const TODAY_COLUMN_CLASS =
  'bg-[#E0F2FE]/80 dark:bg-sky-950/35 border-l-[3px] border-l-[#0EA5E9]';

export const WEEKEND_COLUMN_CLASS = 'bg-muted/25 dark:bg-slate-900/25';
