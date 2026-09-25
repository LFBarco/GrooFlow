import { Check, X } from 'lucide-react';
import { useMemo } from 'react';

import type { AsistenciaFilters, AsistenciaSettings, BukAsistenciaRecord } from '../../types/asistencia';
import {
  buildBukMonthlyTrajectory,
  formatLateMinutesLabel,
  type BukMonthlyDayCell,
} from '../../utils/asistenciaBukMonthlyTrajectory';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

type Props = {
  records: BukAsistenciaRecord[];
  settings: AsistenciaSettings;
  sedeName: string;
  date: Date;
  filters: AsistenciaFilters;
};

function DayCellIcon({ cell, day }: { cell: BukMonthlyDayCell; day: number }) {
  if (cell === 'future') {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center text-[10px] text-muted-foreground/50">
        ·
      </span>
    );
  }
  if (cell === 'present') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-emerald-500/15">
            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
          </span>
        </TooltipTrigger>
        <TooltipContent>Día {day}: marcó</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-red-500/15">
          <X className="h-3.5 w-3.5 text-red-600 dark:text-red-400" strokeWidth={3} />
        </span>
      </TooltipTrigger>
      <TooltipContent>Día {day}: sin marcación</TooltipContent>
    </Tooltip>
  );
}

export function AsistenciaBukMonthlyTrajectory({
  records,
  settings,
  sedeName,
  date,
  filters,
}: Props) {
  const trajectory = useMemo(
    () =>
      buildBukMonthlyTrajectory({
        records,
        settings,
        sedeName,
        date,
        search: filters.search,
      }),
    [records, settings, sedeName, date, filters.search]
  );

  const dayNums = useMemo(
    () => Array.from({ length: trajectory.daysInMonth }, (_, i) => i + 1),
    [trajectory.daysInMonth]
  );

  if (trajectory.rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Sin personal ni marcaciones en {trajectory.monthLabel} para esta sede.
        {filters.search.trim() ? ' Prueba otro filtro de búsqueda.' : ''}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Trayectoria de {trajectory.monthLabel} · {sedeName}. ✓ verde = marcó entrada · ✗ rojo =
        sin marcación · · = día futuro. Columna final: minutos de tardanza acumulados (tras
        tolerancia del horario).
      </p>
      <div className="rounded-xl border border-border overflow-auto max-h-[70vh] dark:border-slate-800">
        <Table className="min-w-max text-xs">
          <TableHeader className="sticky top-0 z-20 bg-muted/95 backdrop-blur dark:bg-slate-900/95">
            <TableRow className="border-border dark:border-slate-800 hover:bg-transparent">
              <TableHead className="sticky left-0 z-30 min-w-[180px] bg-muted/95 dark:bg-slate-900/95 font-semibold text-foreground">
                Nombre completo
              </TableHead>
              {dayNums.map((d) => (
                <TableHead
                  key={d}
                  className="w-8 min-w-[2rem] px-0.5 text-center tabular-nums text-muted-foreground"
                >
                  {d}
                </TableHead>
              ))}
              <TableHead className="sticky right-0 z-30 min-w-[100px] bg-muted/95 dark:bg-slate-900/95 text-right font-semibold text-foreground">
                Min. tarde
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trajectory.rows.map((row) => (
              <TableRow
                key={row.rut}
                className="border-border dark:border-slate-800"
              >
                <TableCell className="sticky left-0 z-10 min-w-[180px] bg-card dark:bg-slate-950 font-medium text-foreground whitespace-nowrap">
                  <div className="flex flex-col gap-0.5">
                    <span>{row.fullName}</span>
                    <span className="text-[10px] font-normal text-muted-foreground">{row.rut}</span>
                  </div>
                </TableCell>
                {row.days.map((cell, idx) => (
                  <TableCell key={idx} className="w-8 min-w-[2rem] px-0.5 text-center">
                    <DayCellIcon cell={cell} day={idx + 1} />
                  </TableCell>
                ))}
                <TableCell className="sticky right-0 z-10 min-w-[100px] bg-card dark:bg-slate-950 text-right tabular-nums font-medium">
                  <span
                    className={
                      row.lateMinutesTotal > 0
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-muted-foreground'
                    }
                  >
                    {formatLateMinutesLabel(row.lateMinutesTotal)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        {trajectory.rows.length} persona(s) · mes con {trajectory.daysInMonth} días.
      </p>
    </div>
  );
}
