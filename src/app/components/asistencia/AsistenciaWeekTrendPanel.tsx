import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import type { AsistenciaWeekTrendDay } from '../../utils/asistenciaTrend';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../ui/utils';

type Props = {
  days: AsistenciaWeekTrendDay[];
  selectedDateKey: string;
  onSelectDate: (dateKey: string) => void;
  sedeLabel: string;
};

export function AsistenciaWeekTrendPanel({
  days,
  selectedDateKey,
  onSelectDate,
  sedeLabel,
}: Props) {
  if (days.every((d) => d.total === 0)) {
    return (
      <Card className="border-dashed border-border dark:border-slate-700">
        <CardContent className="py-4 text-sm text-muted-foreground">
          Sin marcaciones Buk en la semana para {sedeLabel}. Actualiza Buk o elige otra semana.
        </CardContent>
      </Card>
    );
  }

  const chartData = days.map((d) => ({
    name: d.weekday,
    Ausentes: d.absent,
    Tardanzas: d.late,
    dateKey: d.dateKey,
  }));

  return (
    <Card className="border-border bg-card dark:border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Tendencia semanal</CardTitle>
        <CardDescription>
          Ausencias y tardanzas por día · {sedeLabel}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-[140px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <RechartsTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const dk = payload[0]?.payload?.dateKey as string;
                  const day = days.find((d) => d.dateKey === dk);
                  return (
                    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md dark:border-slate-700">
                      <p className="font-medium">
                        {day ? format(new Date(`${day.dateKey}T12:00:00`), "EEE d MMM", { locale: es }) : label}
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

        <div className="flex flex-wrap gap-1.5">
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
    </Card>
  );
}
