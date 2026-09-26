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

function DayCellIcon({ cell, dayLabel }: { cell: BukMonthlyDayCell; dayLabel: string }) {
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
        <TooltipContent>{dayLabel}: entrada + salida</TooltipContent>
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
      <TooltipContent>{dayLabel}: sin jornada completa</TooltipContent>
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
        Trayectoria de {trajectory.monthLabel} · {sedeName}. ✓ = entrada y salida (como reporte Buk) ·
        ✗ = incompleto o sin marca · · = día futuro. Min. tarde: acumulación tras tolerancia.
      </p>
      <div className="rounded-xl border border-border overflow-auto max-h-[70vh] dark:border-slate-800">
        <Table className="min-w-max text-xs">
          <TableHeader className="sticky top-0 z-20 bg-muted/95 backdrop-blur dark:bg-slate-900/95">
            <TableRow className="border-border dark:border-slate-800 hover:bg-transparent">
              <TableHead
                rowSpan={2}
                className="sticky left-0 z-30 min-w-[180px] bg-muted/95 dark:bg-slate-900/95 font-semibold text-foreground align-bottom"
              >
                Nombre completo
              </TableHead>
              {trajectory.dayHeaders.map((h) => (
                <TableHead
                  key={`d-${h.day}`}
                  className="w-9 min-w-[2.25rem] px-0.5 text-center tabular-nums text-[10px] font-semibold text-foreground leading-tight"
                >
                  {h.label}
                </TableHead>
              ))}
              <TableHead
                rowSpan={2}
                className="sticky right-0 z-30 min-w-[100px] bg-muted/95 dark:bg-slate-900/95 text-right font-semibold text-foreground align-bottom"
              >
                Min. tarde
              </TableHead>
            </TableRow>
            <TableRow className="border-border dark:border-slate-800 hover:bg-transparent">
              {trajectory.dayHeaders.map((h) => (
                <TableHead
                  key={`w-${h.day}`}
                  className="w-9 min-w-[2.25rem] px-0.5 pb-1.5 text-center text-[10px] font-medium text-muted-foreground"
                >
                  {h.weekdayLetter}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {trajectory.rows.map((row) => (
              <TableRow key={row.rut} className="border-border dark:border-slate-800">
                <TableCell className="sticky left-0 z-10 min-w-[180px] bg-card dark:bg-slate-950 font-medium text-foreground whitespace-nowrap">
                  <div className="flex flex-col gap-0.5">
                    <span>{row.fullName}</span>
                    <span className="text-[10px] font-normal text-muted-foreground">{row.rut}</span>
                  </div>
                </TableCell>
                {row.days.map((cell, idx) => (
                  <TableCell key={idx} className="w-9 min-w-[2.25rem] px-0.5 text-center">
                    <DayCellIcon
                      cell={cell}
                      dayLabel={trajectory.dayHeaders[idx]?.label ?? `Día ${idx + 1}`}
                    />
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
