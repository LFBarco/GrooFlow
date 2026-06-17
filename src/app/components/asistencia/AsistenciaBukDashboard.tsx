import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, LayoutDashboard, Layers, List, MapPin, Search, XCircle } from 'lucide-react';

import type { AsistenciaSettings, BukAsistenciaRecord } from '../../types/asistencia';
import {
  buildBukDashboardSummary,
  type BukDashboardRow,
} from '../../utils/asistenciaBukDashboard';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

type Props = {
  records: BukAsistenciaRecord[];
  settings: AsistenciaSettings;
  sedeName: string;
  date: Date;
};

type ArrivalFilter = 'all' | 'arrived' | 'absent';
const ALL_FILTER = '__all__';

function filterRows(
  rows: BukDashboardRow[],
  search: string,
  arrivalFilter: ArrivalFilter,
  areaFilter: string,
  specialtyFilter: string
): BukDashboardRow[] {
  const q = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (arrivalFilter === 'arrived' && !row.arrived) return false;
    if (arrivalFilter === 'absent' && row.arrived) return false;
    if (areaFilter !== ALL_FILTER && row.area !== areaFilter) return false;
    if (specialtyFilter !== ALL_FILTER && row.especialidad !== specialtyFilter) return false;
    if (!q) return true;
    const hay = `${row.nombre} ${row.apellidos} ${row.especialidad} ${row.area} ${row.rut}`.toLowerCase();
    return hay.includes(q);
  });
}

function BukRowsTable({ rows }: { rows: BukDashboardRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-center text-slate-500 py-6 text-sm">Sin resultados para los filtros aplicados.</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-slate-800 hover:bg-transparent">
          <TableHead className="text-slate-400">Nombre</TableHead>
          <TableHead className="text-slate-400">Apellidos</TableHead>
          <TableHead className="text-slate-400">Área</TableHead>
          <TableHead className="text-slate-400">Especialidad</TableHead>
          <TableHead className="text-slate-400">RUT</TableHead>
          <TableHead className="text-slate-400">¿Llegó?</TableHead>
          <TableHead className="text-slate-400 text-right">Entrada</TableHead>
          <TableHead className="text-slate-400 text-right">Salida</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id} className="border-slate-800/80 hover:bg-slate-900/50">
            <TableCell className="font-medium text-white">{row.nombre}</TableCell>
            <TableCell className="text-slate-300">{row.apellidos || '—'}</TableCell>
            <TableCell className="text-slate-300 max-w-[180px] truncate" title={row.area}>
              {row.area}
            </TableCell>
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
            <TableCell className="text-right text-slate-300 tabular-nums">
              {row.salidaHora ?? '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function AsistenciaBukDashboard({ records, settings, sedeName, date }: Props) {
  const [search, setSearch] = useState('');
  const [arrivalFilter, setArrivalFilter] = useState<ArrivalFilter>('all');
  const [areaFilter, setAreaFilter] = useState(ALL_FILTER);
  const [specialtyFilter, setSpecialtyFilter] = useState(ALL_FILTER);
  const [view, setView] = useState<'list' | 'specialty' | 'area'>('list');

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

  const areaOptions = useMemo(
    () => [...new Set(summary.rows.map((r) => r.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [summary.rows]
  );

  const specialtyOptions = useMemo(
    () =>
      [...new Set(summary.rows.map((r) => r.especialidad).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'es')
      ),
    [summary.rows]
  );

  const filteredRows = useMemo(
    () => filterRows(summary.rows, search, arrivalFilter, areaFilter, specialtyFilter),
    [summary.rows, search, arrivalFilter, areaFilter, specialtyFilter]
  );

  const filteredSpecialtyGroups = useMemo(
    () =>
      summary.specialtyGroups
        .map((group) => ({
          ...group,
          rows: filterRows(group.rows, search, arrivalFilter, areaFilter, specialtyFilter),
        }))
        .filter((group) => group.rows.length > 0),
    [summary.specialtyGroups, search, arrivalFilter, areaFilter, specialtyFilter]
  );

  const filteredAreaGroups = useMemo(
    () =>
      summary.areaGroups
        .map((group) => ({
          ...group,
          rows: filterRows(group.rows, search, arrivalFilter, areaFilter, specialtyFilter),
        }))
        .filter((group) => group.rows.length > 0),
    [summary.areaGroups, search, arrivalFilter, areaFilter, specialtyFilter]
  );

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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        <Card className="border-amber-500/30 bg-amber-950/20">
          <CardContent className="pt-5">
            <p className="text-xs text-amber-400/80 uppercase tracking-wide">Con salida</p>
            <p className="text-2xl font-bold text-amber-300 mt-1">{summary.leftSameDay}</p>
            <p className="text-xs text-slate-500 mt-1">salida_format mismo día</p>
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
            Datos directos de la API: área, especialidad, entrada y salida por persona.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nombre, apellido, área, especialidad o RUT…"
                className="pl-9 bg-slate-900 border-slate-700 text-white"
              />
            </div>
            <Select value={areaFilter} onValueChange={setAreaFilter}>
              <SelectTrigger className="w-[200px] bg-slate-900 border-slate-700 text-white">
                <SelectValue placeholder="Área" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>Todas las áreas</SelectItem>
                {areaOptions.map((area) => (
                  <SelectItem key={area} value={area}>{area}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
              <SelectTrigger className="w-[220px] bg-slate-900 border-slate-700 text-white">
                <SelectValue placeholder="Especialidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>Todas las especialidades</SelectItem>
                {specialtyOptions.map((esp) => (
                  <SelectItem key={esp} value={esp}>{esp}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          <Tabs value={view} onValueChange={(v) => setView(v as 'list' | 'specialty' | 'area')}>
            <TabsList className="bg-slate-900 border border-slate-800">
              <TabsTrigger
                value="list"
                className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
              >
                <List className="h-4 w-4 mr-1" /> Lista
              </TabsTrigger>
              <TabsTrigger
                value="area"
                className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
              >
                <MapPin className="h-4 w-4 mr-1" /> Por área
              </TabsTrigger>
              <TabsTrigger
                value="specialty"
                className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
              >
                <Layers className="h-4 w-4 mr-1" /> Por especialidad
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-4">
              <div className="rounded-xl border border-slate-800 overflow-hidden">
                <BukRowsTable rows={filteredRows} />
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Mostrando {filteredRows.length} de {summary.total} persona(s).
              </p>
            </TabsContent>

            <TabsContent value="area" className="mt-4 space-y-4">
              {filteredAreaGroups.length === 0 ? (
                <p className="text-center text-slate-500 py-8 text-sm">
                  Sin resultados para los filtros aplicados.
                </p>
              ) : (
                filteredAreaGroups.map((group) => (
                  <div key={group.area} className="rounded-xl border border-slate-800 overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/80 px-4 py-3">
                      <div>
                        <p className="font-semibold text-white">{group.area}</p>
                        <p className="text-xs text-slate-500">{group.rows.length} persona(s) en vista</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-400">
                          {group.rows.filter((r) => r.arrived).length} llegaron
                        </span>
                        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-red-400">
                          {group.rows.filter((r) => !r.arrived).length} sin entrada
                        </span>
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-400">
                          {group.rows.filter((r) => r.leftSameDay).length} con salida
                        </span>
                      </div>
                    </div>
                    <BukRowsTable rows={group.rows} />
                  </div>
                ))
              )}
              <p className="text-xs text-slate-500">
                {filteredAreaGroups.length} área(s) · {filteredRows.length} persona(s) en total.
              </p>
            </TabsContent>

            <TabsContent value="specialty" className="mt-4 space-y-4">
              {filteredSpecialtyGroups.length === 0 ? (
                <p className="text-center text-slate-500 py-8 text-sm">
                  Sin resultados para los filtros aplicados.
                </p>
              ) : (
                filteredSpecialtyGroups.map((group) => (
                  <div
                    key={group.especialidad}
                    className="rounded-xl border border-slate-800 overflow-hidden"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/80 px-4 py-3">
                      <div>
                        <p className="font-semibold text-white">{group.especialidad}</p>
                        <p className="text-xs text-slate-500">
                          {group.rows.length} persona(s) en vista
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-400">
                          {group.rows.filter((r) => r.arrived).length} llegaron
                        </span>
                        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-red-400">
                          {group.rows.filter((r) => !r.arrived).length} sin entrada
                        </span>
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-400">
                          {group.rows.filter((r) => r.leftSameDay).length} con salida
                        </span>
                      </div>
                    </div>
                    <BukRowsTable rows={group.rows} />
                  </div>
                ))
              )}
              <p className="text-xs text-slate-500">
                {filteredSpecialtyGroups.length} especialidad(es) · {filteredRows.length} persona(s) en total.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
