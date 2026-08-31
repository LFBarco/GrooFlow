import type { TurnosPlanVsReal } from '../../types/turnos';
import { cn } from '../ui/utils';

const STATUS_CLASS: Record<TurnosPlanVsReal['status'], string> = {
  ok: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  absent: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
  off_ok: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  unplanned: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
  mismatch: 'bg-orange-100 text-orange-900 dark:bg-orange-500/20 dark:text-orange-200',
  pending: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200',
  na: 'text-transparent',
};

type Props = {
  compare: TurnosPlanVsReal;
  compact?: boolean;
};

export function TurnosPlanVsRealBadge({ compare, compact }: Props) {
  if (compare.status === 'na') return null;

  return (
    <span
      title={compare.detail}
      className={cn(
        'inline-flex items-center justify-center rounded font-semibold',
        compact ? 'h-4 min-w-[1.75rem] px-1 text-[9px]' : 'h-5 min-w-[2rem] px-1.5 text-[10px]',
        STATUS_CLASS[compare.status]
      )}
    >
      {compare.label}
    </span>
  );
}
