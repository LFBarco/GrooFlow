import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChevronDown, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import type { AsistenciaWeekTrendDay } from '../../utils/asistenciaTrend';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { cn } from '../ui/utils';

type Props = {
  days: AsistenciaWeekTrendDay[];
  selectedDateKey: string;
  onSelectDate: (dateKey: string) => void;
  sedeLabel: string;
  rangeLabel?: string;
  daysCount?: 7 | 14 | 30;
  onDaysCountChange?: (n: 7 | 14 | 30) => void;
  /** Por defecto colapsado para liberar espacio al organigrama. */
  defaultOpen?: boolean;
};

export function AsistenciaWeekTrendPanel({
  days,
  selectedDateKey,
  onSelectDate,
  sedeLabel,
  rangeLabel,
  daysCount = 7,
  onDaysCountChange,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  if (days.every((d) => d.total === 0)) {
    return (
      <Card className="border-dashed border-border dark:border-slate-700">
        <CardContent className="py-3 text-sm text-muted-foreground">
          Sin marcaciones Buk en el período para {sedeLabel}. Actualiza Buk, carga historial del
          servidor o elige otro rango.
        </CardContent>
      </Card>
    );
  }

  const chartData = days.map((d) => ({
    name: days.length > 10 ? d.label : d.weekday,
    Ausentes: d.absent,
    Tardanzas: d.late,
    dateKey: d.dateKey,
  }));

  const peakAbsent = Math.max(...days.map((d) => d.absent));
  const peakLate = Math.max(...days.map((d) => d.late));
  const selected = days.find((d) => d.dateKey === selectedDateKey);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-border bg-card dark:border-slate-800">
        <CardHeader className="py-3 pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="h-auto flex-1 justify-start gap-2 px-2 py-1.5 text-left hover:bg-muted/60"
              >
                <TrendingDown className="h-4 w-4 shrink-0 text-teal-600" />
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm sm:text-base">Tendencia operativa</CardTitle>
                  <CardDescription className="text-xs truncate">
                    {sedeLabel}
                    {rangeLabel ? ` · ${rangeLabel}` : ''}
                    {!open && selected
                      ? ` · ${selected.absent} aus. · ${selected.late} tarde`
                      : !open
                        ? ` · máx ${peakAbsent} aus. / ${peakLate} tarde`
                        : null}
                  </CardDescription>
                </div>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                    open && 'rotate-180'
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            {onDaysCountChange ? (
              <div className="flex gap-1">
                {([7, 14, 30] as const).map((n) => (
                  <Button
                    key={n}
                    type="button"
                    size="sm"
                    variant={daysCount === n ? 'default' : 'outline'}
                    className={
                      daysCount === n
                        ? 'h-7 bg-teal-600 text-white hover:bg-teal-500'
                        : 'h-7'
                    }
                    onClick={() => onDaysCountChange(n)}
                  >
                    {n}d
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            <div
              className={
                days.length > 14
                  ? 'h-[160px] w-full min-w-0 sm:h-[180px]'
                  : 'h-[130px] w-full min-w-0 sm:h-[140px]'
              }
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    interval={days.length > 14 ? 2 : 0}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                  <RechartsTooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const dk = payload[0]?.payload?.dateKey as string;
                      const day = days.find((d) => d.dateKey === dk);
                      return (
                        <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md dark:border-slate-700">
                          <p className="font-medium">
                            {day
                              ? format(new Date(`${day.dateKey}T12:00:00`), 'EEE d MMM', {
                                  locale: es,
                                })
                              : label}
                          </p>
                          <p className="text-red-500">Ausentes: {day?.absent ?? 0}</p>
                          <p className="text-amber-600">Tardanzas: {day?.late ?? 0}</p>
                          <p className="text-muted-foreground">Total sede: {day?.total ?? 0}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="Ausentes" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Tardanzas" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {days.map((d) => (
                <button
                  key={d.dateKey}
                  type="button"
                  onClick={() => onSelectDate(d.dateKey)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors',
                    selectedDateKey === d.dateKey
                      ? 'border-teal-500 bg-teal-50 text-teal-900 dark:border-teal-400 dark:bg-teal-950/40 dark:text-teal-100'
                      : 'border-border bg-muted/40 hover:bg-muted dark:border-slate-700'
                  )}
                >
                  <span className="block font-medium">{d.weekday}</span>
                  <span className="text-muted-foreground">{d.label}</span>
                  {(d.absent > 0 || d.late > 0) && (
                    <span className="mt-0.5 block text-[10px] text-red-600 dark:text-red-400">
                      {d.absent} aus. · {d.late} tarde
                    </span>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
