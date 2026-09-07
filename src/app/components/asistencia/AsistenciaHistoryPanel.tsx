import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { History } from 'lucide-react';

import type { AsistenciaDailySnapshot } from '../../types/asistencia';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

type Props = {
  snapshots: AsistenciaDailySnapshot[];
  onSelectDate?: (dateYmd: string) => void;
  limit?: number;
};

export function AsistenciaHistoryPanel({ snapshots, onSelectDate, limit = 14 }: Props) {
  const rows = snapshots.slice(0, limit);

  if (rows.length === 0) {
    return (
      <Card className="border-dashed border-border dark:border-slate-700">
        <CardContent className="py-4 text-sm text-muted-foreground">
          Sin snapshots guardados. Se capturan al actualizar Buk (manual o auto-refresh).
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border dark:border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-teal-600" />
          Historial diario
        </CardTitle>
        <CardDescription>
          Snapshots de dotación por sede (hasta {limit} registros). Usa «Cargar rango» para
          historial Buk desde MySQL.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0 pb-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Sede</TableHead>
              <TableHead className="text-right">Trab.</TableHead>
              <TableHead className="text-right">Aus.</TableHead>
              <TableHead className="text-right">Tarde</TableHead>
              <TableHead className="text-right">Crít.</TableHead>
              <TableHead className="text-right">Cobertura</TableHead>
              <TableHead>Origen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow
                key={s.id}
                className={onSelectDate ? 'cursor-pointer hover:bg-muted/40' : undefined}
                onClick={onSelectDate ? () => onSelectDate(s.dateYmd) : undefined}
              >
                <TableCell>
                  {format(new Date(`${s.dateYmd}T12:00:00`), 'd MMM yyyy', { locale: es })}
                </TableCell>
                <TableCell>{s.sedeName}</TableCell>
                <TableCell className="text-right tabular-nums">{s.workingCount}</TableCell>
                <TableCell className="text-right tabular-nums text-red-600">{s.absentCount}</TableCell>
                <TableCell className="text-right tabular-nums text-amber-600">{s.lateCount}</TableCell>
                <TableCell className="text-right tabular-nums">{s.criticalAbsentCount}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.totalPresent}/{s.totalRequired || '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {s.source === 'auto' ? 'Auto' : 'Manual'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
