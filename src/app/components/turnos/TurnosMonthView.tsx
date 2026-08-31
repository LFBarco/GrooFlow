import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import type { TurnosSettings } from '../../types/turnos';
import { summarizeDay } from '../../utils/turnosData';
import { daysInMonthGrid, isInMonth, isToday, toDateKey } from '../../utils/turnosCalendar';
import { isWeekendColumn, TODAY_COLUMN_CLASS, WEEKEND_COLUMN_CLASS } from '../../utils/turnosStyles';
import { cn } from '../ui/utils';

type Props = {
  settings: TurnosSettings;
  monthAnchor: Date;
  workSede: string;
  onSelectDay: (date: Date) => void;
};

function staffingHeatClass(summary: ReturnType<typeof summarizeDay>, inMonth: boolean): string {
  if (!inMonth) return '';
  const total = summary.dayCount + summary.nightCount;
  if (summary.understaffed) {
    return 'ring-1 ring-inset ring-rose-400/70 bg-rose-50/50 dark:bg-rose-950/20';
  }
  if (total === 0) return '';
  if (summary.staffingGaps.length === 0 && total >= 2) {
    return 'bg-emerald-50/40 dark:bg-emerald-950/15';
  }
  return 'bg-amber-50/40 dark:bg-amber-950/15';
}

function ShiftStackBar({
  dayCount,
  nightCount,
  offCount,
  trainingCount,
}: {
  dayCount: number;
  nightCount: number;
  offCount: number;
  trainingCount: number;
}) {
  const total = dayCount + nightCount + offCount + trainingCount;
  if (total === 0) return null;
  const pct = (n: number) => (n / total) * 100;
  return (
    <div className="mt-2 space-y-1">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted/60">
        {dayCount > 0 ? (
          <div className="bg-[#F59E0B]" style={{ width: `${pct(dayCount)}%` }} title={`Día ${dayCount}`} />
        ) : null}
        {nightCount > 0 ? (
          <div className="bg-[#7C3AED]" style={{ width: `${pct(nightCount)}%` }} title={`Noche ${nightCount}`} />
        ) : null}
        {offCount > 0 ? (
          <div className="bg-[#94A3B8]" style={{ width: `${pct(offCount)}%` }} title={`Libre ${offCount}`} />
        ) : null}
        {trainingCount > 0 ? (
          <div className="bg-[#10B981]" style={{ width: `${pct(trainingCount)}%` }} title={`Cap. ${trainingCount}`} />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1 text-[9px] text-muted-foreground">
        {dayCount > 0 ? <span>D{dayCount}</span> : null}
        {nightCount > 0 ? <span>N{nightCount}</span> : null}
        {offCount > 0 ? <span>L{offCount}</span> : null}
        {trainingCount > 0 ? <span>C{trainingCount}</span> : null}
      </div>
    </div>
  );
}

export function TurnosMonthView({ settings, monthAnchor, workSede, onSelectDay }: Props) {
  const days = useMemo(() => daysInMonthGrid(monthAnchor), [monthAnchor]);
  const resolvedSede = workSede === 'Todas' ? undefined : workSede;

  const weekTotals = useMemo(() => {
    const totals: { day: number; night: number; key: string }[] = [];
    for (let i = 0; i < days.length; i += 7) {
      const slice = days.slice(i, i + 7);
      let day = 0;
      let night = 0;
      for (const d of slice) {
        if (!isInMonth(d, monthAnchor)) continue;
        const s = summarizeDay(settings, toDateKey(d), resolvedSede);
        day += s.dayCount;
        night += s.nightCount;
      }
      totals.push({ day, night, key: toDateKey(slice[6] ?? slice[0]!) });
    }
    return totals;
  }, [days, monthAnchor, settings, resolvedSede]);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm dark:border-slate-700">
      <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-center text-[11px] font-semibold uppercase text-muted-foreground dark:border-slate-700 dark:bg-slate-900/40">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d, i) => (
          <div key={d} className={cn('px-1 py-2', (i === 5 || i === 6) && 'text-muted-foreground/80')}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const key = toDateKey(day);
          const inMonth = isInMonth(day, monthAnchor);
          const summary = summarizeDay(settings, key, resolvedSede);
          const today = isToday(day);
          const weekend = isWeekendColumn(day);
          const hasShifts =
            summary.dayCount + summary.nightCount + summary.offCount + summary.trainingCount > 0;
          const isSunday = day.getDay() === 0;
          const weekIndex = Math.floor(index / 7);
          const weekTotal = weekTotals[weekIndex];

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(day)}
              className={cn(
                'min-h-[100px] border-b border-r border-border/60 p-2 text-left transition-colors hover:bg-muted/40 dark:border-slate-800 dark:hover:bg-slate-900/40',
                !inMonth && 'bg-muted/20 text-muted-foreground/60 dark:bg-slate-950/50',
                inMonth && weekend && !today && WEEKEND_COLUMN_CLASS,
                today && TODAY_COLUMN_CLASS,
                staffingHeatClass(summary, inMonth)
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn('text-sm font-semibold', today && 'text-sky-600 dark:text-sky-400')}>
                  {format(day, 'd')}
                </span>
                {summary.understaffed && inMonth ? (
                  <AlertTriangle
                    className="h-3.5 w-3.5 text-rose-500"
                    title={
                      summary.staffingGaps.length > 0
                        ? summary.staffingGaps
                            .map(
                              (g) =>
                                `${g.workArea}: faltan ${g.missing} (${g.shift === 'day' ? 'día' : 'noche'})`
                            )
                            .join(' · ')
                        : 'Dotación bajo umbral global'
                    }
                  />
                ) : null}
              </div>
              {inMonth && hasShifts ? (
                <ShiftStackBar
                  dayCount={summary.dayCount}
                  nightCount={summary.nightCount}
                  offCount={summary.offCount}
                  trainingCount={summary.trainingCount}
                />
              ) : inMonth ? (
                <p className="mt-3 text-[10px] text-muted-foreground/70">Sin turnos</p>
              ) : null}
              {inMonth && summary.coverCount > 0 ? (
                <p className="mt-1 text-[10px] text-cyan-700 dark:text-cyan-300">
                  {summary.coverCount} cobertura
                </p>
              ) : null}
              {inMonth && isSunday && weekTotal ? (
                <p className="mt-2 border-t border-border/60 pt-1 text-[9px] font-medium text-muted-foreground dark:border-slate-700">
                  Σ sem: D{weekTotal.day} N{weekTotal.night}
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-border px-3 py-2 text-[11px] text-muted-foreground dark:border-slate-700">
        <span>Vista mensual · {format(monthAnchor, 'MMMM yyyy', { locale: es })}</span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> OK
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> Justo
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-rose-400" /> Bajo mínimo
        </span>
      </div>
    </div>
  );
}
