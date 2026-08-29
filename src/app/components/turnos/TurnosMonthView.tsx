import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import type { TurnosSettings } from '../../types/turnos';
import { summarizeDay } from '../../utils/turnosData';
import { daysInMonthGrid, isInMonth, isToday, toDateKey } from '../../utils/turnosCalendar';
import { cn } from '../ui/utils';

type Props = {
  settings: TurnosSettings;
  monthAnchor: Date;
  workSede: string;
  onSelectDay: (date: Date) => void;
};

export function TurnosMonthView({ settings, monthAnchor, workSede, onSelectDay }: Props) {
  const days = useMemo(() => daysInMonthGrid(monthAnchor), [monthAnchor]);
  const resolvedSede = workSede === 'Todas' ? undefined : workSede;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm dark:border-slate-700">
      <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-center text-[11px] font-semibold uppercase text-muted-foreground dark:border-slate-700 dark:bg-slate-900/40">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
          <div key={d} className="px-1 py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = toDateKey(day);
          const inMonth = isInMonth(day, monthAnchor);
          const summary = summarizeDay(settings, key, resolvedSede);
          const today = isToday(day);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(day)}
              className={cn(
                'min-h-[88px] border-b border-r border-border/60 p-2 text-left transition-colors hover:bg-muted/40 dark:border-slate-800 dark:hover:bg-slate-900/40',
                !inMonth && 'bg-muted/20 text-muted-foreground/60 dark:bg-slate-950/50',
                today && 'bg-sky-50/60 ring-1 ring-inset ring-sky-300 dark:bg-sky-950/20 dark:ring-sky-700'
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn('text-sm font-semibold', today && 'text-sky-600 dark:text-sky-400')}>
                  {format(day, 'd')}
                </span>
                {summary.understaffed && inMonth ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                ) : null}
              </div>
              {inMonth ? (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {summary.dayCount > 0 ? (
                      <span className="rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-900 dark:bg-amber-500/20 dark:text-amber-100">
                        D {summary.dayCount}
                      </span>
                    ) : null}
                    {summary.nightCount > 0 ? (
                      <span className="rounded bg-indigo-100 px-1 text-[10px] font-medium text-indigo-900 dark:bg-indigo-500/20 dark:text-indigo-100">
                        N {summary.nightCount}
                      </span>
                    ) : null}
                  </div>
                  {summary.coverCount > 0 ? (
                    <p className="text-[10px] text-cyan-700 dark:text-cyan-300">
                      {summary.coverCount} cobertura
                    </p>
                  ) : null}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="px-3 py-2 text-[11px] text-muted-foreground">
        Vista mensual de {format(monthAnchor, 'MMMM yyyy', { locale: es })} · clic en un día para ver detalle
      </p>
    </div>
  );
}
