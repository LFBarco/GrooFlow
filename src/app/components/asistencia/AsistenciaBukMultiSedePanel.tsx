import { Building2, Check, CheckCircle2, X, XCircle } from 'lucide-react';
import { useMemo } from 'react';

import type { AsistenciaFilters } from '../../types/asistencia';
import type { BukDashboardRow, BukMultiSedeDashboard } from '../../utils/asistenciaBukDashboard';
import { filterBukDashboardRows } from '../../utils/asistenciaFilters';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

type Props = {
  multi: BukMultiSedeDashboard;
  filters: AsistenciaFilters;
  onRowClick?: (row: BukDashboardRow, sedeName: string) => void;
};

export function AsistenciaBukMultiSedePanel({ multi, filters, onRowClick }: Props) {
  const filteredSedes = useMemo(
    () =>
      multi.sedes
        .map((s) => ({
          ...s,
          rows: filterBukDashboardRows(s.summary.rows, filters),
        }))
        .filter((s) => s.rows.length > 0 || filters.search.trim() === ''),
    [multi.sedes, filters]
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Card className="border-border dark:border-slate-800">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase">Total sedes</p>
            <p className="text-2xl font-bold">{multi.totals.total}</p>
            <p className="text-xs text-muted-foreground">{multi.sedes.length} sede(s)</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-950/20">
          <CardContent className="pt-5 flex justify-between">
            <div>
              <p className="text-xs text-emerald-600 uppercase">Llegaron</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{multi.totals.arrived}</p>
            </div>
            <CheckCircle2 className="h-7 w-7 text-emerald-500/60" />
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-950/20">
          <CardContent className="pt-5 flex justify-between">
            <div>
              <p className="text-xs text-red-600 uppercase">Sin entrada</p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">{multi.totals.absent}</p>
            </div>
            <XCircle className="h-7 w-7 text-red-500/60" />
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-950/20">
          <CardContent className="pt-5 flex justify-between">
            <div>
              <p className="text-xs text-emerald-600 uppercase">A tiempo</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{multi.totals.onTime}</p>
            </div>
            <Check className="h-7 w-7 text-emerald-500/60" strokeWidth={2} />
          </CardContent>
        </Card>
        <Card className="border-orange-500/30 bg-orange-950/10">
          <CardContent className="pt-5 flex justify-between">
            <div>
              <p className="text-xs text-orange-600 uppercase">Tardanza</p>
              <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{multi.totals.late}</p>
            </div>
            <X className="h-7 w-7 text-orange-500/60" strokeWidth={2.5} />
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/20">
          <CardContent className="pt-5">
            <p className="text-xs text-amber-600 uppercase">Con salida</p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{multi.totals.leftSameDay}</p>
          </CardContent>
        </Card>
      </div>

      {filteredSedes.map(({ sedeName, rows }) => (
        <Card key={sedeName} className="border-border overflow-hidden dark:border-slate-800">
          <CardHeader className="border-b border-border bg-muted/40 py-3 dark:border-slate-800">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-teal-600" />
              {sedeName}
              <span className="text-sm font-normal text-muted-foreground">
                {rows.length} persona(s) en vista
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sin resultados para los filtros.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>RUT</TableHead>
                    <TableHead>Llegó</TableHead>
                    <TableHead>Entrada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={`${sedeName}-${row.id}`}
                      className={onRowClick ? 'cursor-pointer hover:bg-muted/40' : undefined}
                      onClick={onRowClick ? () => onRowClick(row, sedeName) : undefined}
                    >
                      <TableCell className="font-medium">
                        {row.nombre} {row.apellidos}
                      </TableCell>
                      <TableCell>{row.area}</TableCell>
                      <TableCell className="font-mono text-xs">{row.rut}</TableCell>
                      <TableCell>{row.arrived ? 'Sí' : 'No'}</TableCell>
                      <TableCell className="tabular-nums">{row.entradaHora ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
