import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, LayoutDashboard, Search, XCircle } from 'lucide-react';

import type { AsistenciaSettings, BukAsistenciaRecord } from '../../types/asistencia';
import { buildBukDashboardSummary } from '../../utils/asistenciaBukDashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

type Props = {
  records: BukAsistenciaRecord[];
  settings: AsistenciaSettings;
  sedeName: string;
  date: Date;
};

type ArrivalFilter = 'all' | 'arrived' | 'absent';

export function AsistenciaBukDashboard({ records, settings, sedeName, date }: Props) {
  const [search, setSearch] = useState('');
  const [arrivalFilter, setArrivalFilter] = useState<ArrivalFilter>('all');

  const summary = useMemo(
    () =>
      buildBukDashboardSummary({
        records,
        sedeName,
        settings,
        date,
      }),
    [records, sedeName, settings, date]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return summary.rows.filter((row) => {
      if (arrivalFilter === 'arrived' && !row.arrived) return false;
      if (arrivalFilter === 'absent' && row.arrived) return false;
      if (!q) return true;
      const hay = `${row.nombre} ${row.apellidos} ${row.especialidad} ${row.rut}`.toLowerCase();
      return hay.includes(q);
    });
  }, [summary.rows, search, arrivalFilter]);

  const dateLabel = format(date, "d 'de' MMMM yyyy", { locale: es });

  if (records.length === 0) {
    return (
      <Card className="border-slate-800 bg-slate-950/50">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Pulsa «Actualizar Buk» para ver el listado crudo de la API por sede y fecha.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-slate-800 bg-slate-950/80">
          <CardContent className="pt-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide">En sede ese día</p>
            <p className="text-2xl font-bold text-white mt-1">{summary.total}</p>
            <p className="text-xs text-slate-500 mt-1">{sedeName}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/30 bg-emerald-950/20">
          <CardContent className="pt-5 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-emerald-400/80 uppercase tracking-wide">Llegaron</p>
              <p className="text-2xl font-bold text-emerald-300 mt-1">{summary.arrived}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-emerald-500/60 shrink-0" />
          </CardContent>
        </Card>
        <Card className="border-red-500/30 bg-red-950/20">
          <CardContent className="pt-5 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-red-400/80 uppercase tracking-wide">Sin entrada</p>
              <p className="text-2xl font-bold text-red-300 mt-1">{summary.absent}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-500/60 shrink-0" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-950/80">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-white text-lg">
            <LayoutDashboard className="h-5 w-5 text-indigo-400" />
            Dashboard Buk — {dateLabel}
          </CardTitle>
          <CardDescription className="text-slate-400">
            Datos directos de la API: nombre, apellidos, especialidad y si marcó entrada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nombre, apellido, especialidad o RUT…"
                className="pl-9 bg-slate-900 border-slate-700 text-white"
              />
            </div>
            <Select value={arrivalFilter} onValueChange={(v) => setArrivalFilter(v as ArrivalFilter)}>
              <SelectTrigger className="w-[180px] bg-slate-900 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos ({summary.total})</SelectItem>
                <SelectItem value="arrived">Llegaron ({summary.arrived})</SelectItem>
                <SelectItem value="absent">Sin entrada ({summary.absent})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400">Nombre</TableHead>
                  <TableHead className="text-slate-400">Apellidos</TableHead>
                  <TableHead className="text-slate-400">Especialidad</TableHead>
                  <TableHead className="text-slate-400">RUT</TableHead>
                  <TableHead className="text-slate-400">¿Llegó?</TableHead>
                  <TableHead className="text-slate-400 text-right">Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                      Sin resultados para los filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={row.id} className="border-slate-800/80 hover:bg-slate-900/50">
                      <TableCell className="font-medium text-white">{row.nombre}</TableCell>
                      <TableCell className="text-slate-300">{row.apellidos || '—'}</TableCell>
                      <TableCell className="text-slate-300 max-w-[220px] truncate" title={row.especialidad}>
                        {row.especialidad}
                      </TableCell>
                      <TableCell className="text-slate-400 font-mono text-xs">{row.rut}</TableCell>
                      <TableCell>
                        {row.arrived ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> Sí
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
                            <XCircle className="h-3 w-3" /> No
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-slate-300 tabular-nums">
                        {row.entradaHora ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-slate-500">
            Mostrando {filteredRows.length} de {summary.total} persona(s) en Buk para esta sede y fecha.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
