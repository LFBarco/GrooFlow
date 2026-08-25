import {
  Check,
  CheckCircle2,
  BarChart3,
  LayoutDashboard,
  Layers,
  List,
  MapPin,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import type { AsistenciaSettings, BukAsistenciaRecord, BukPunctualityStatus } from '../../types/asistencia';
import {
  buildBukDashboardSummary,
  type BukDashboardRow,
} from '../../utils/asistenciaBukDashboard';
import { getSedeProfile } from '../../utils/asistenciaStaff';
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
import { AsistenciaBukCharts } from './AsistenciaBukCharts';

type Props = {
  records: BukAsistenciaRecord[];
  settings: AsistenciaSettings;
  sedeName: string;
  date: Date;
};

type ArrivalFilter = 'all' | 'arrived' | 'absent' | 'on_time' | 'late';
const ALL_FILTER = '__all__';

function PunctualityCell({ status, arrived }: { status: BukPunctualityStatus; arrived: boolean }) {
  if (!arrived || status === 'pending') {
    return <span className="text-slate-600">—</span>;
  }
  if (status === 'on_time') {
    return (
      <span className="inline-flex items-center justify-center text-emerald-400" title="A tiempo">
        <Check className="h-5 w-5" strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center text-red-500" title="Tardanza">
      <X className="h-5 w-5" strokeWidth={2.5} />
    </span>
  );
}

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
    if (arrivalFilter === 'on_time' && row.punctuality !== 'on_time') return false;
    if (arrivalFilter === 'late' && row.punctuality !== 'late') return false;
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
        <TableRow className="border-border hover:bg-transparent dark:border-slate-800">
          <TableHead className="text-slate-400">Nombre</TableHead>
          <TableHead className="text-slate-400">Apellidos</TableHead>
          <TableHead className="text-slate-400">Área</TableHead>
          <TableHead className="text-slate-400">Especialidad</TableHead>
          <TableHead className="text-slate-400">RUT</TableHead>
          <TableHead className="text-slate-400">¿Llegó?</TableHead>
          <TableHead className="text-slate-400 text-center w-[90px]">Puntualidad</TableHead>
          <TableHead className="text-slate-400 text-right">Entrada</TableHead>
          <TableHead className="text-slate-400 text-right">Salida</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id} className="border-border/80 hover:bg-muted/40 dark:border-slate-800/80 dark:hover:bg-slate-900/50">
            <TableCell className="font-medium text-foreground">{row.nombre}</TableCell>
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
            <TableCell className="text-center">
              <PunctualityCell status={row.punctuality} arrived={row.arrived} />
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
  const [view, setView] = useState<'list' | 'specialty' | 'area' | 'charts'>('list');

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

  const sedeProfile = useMemo(() => getSedeProfile(settings, sedeName), [settings, sedeName]);
  const dayStart = sedeProfile.scheduleStart ?? '08:00';
  const toleranceMin = sedeProfile.scheduleToleranceMinutes ?? 10;
  const punctualityHint = useMemo(() => {
    const [h, m] = dayStart.split(':').map(Number);
    const total = (h ?? 8) * 60 + (m ?? 0) + toleranceMin;
    const deadline = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    return `entrada ≤ ${deadline} turno día`;
  }, [dayStart, toleranceMin]);

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
      <Card className="border-border bg-muted/40 dark:border-slate-800 dark:bg-slate-950/50">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Pulsa «Actualizar Buk» para ver el listado crudo de la API por sede y fecha.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Card className="border-border bg-card dark:border-slate-800 dark:bg-slate-950/80">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">En sede ese día</p>
            <p className="text-2xl font-bold text-foreground mt-1">{summary.total}</p>
            <p className="text-xs text-muted-foreground mt-1">{sedeName}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-950/20">
          <CardContent className="pt-5 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-emerald-400/80 uppercase tracking-wide">Llegaron</p>
              <p className="text-2xl font-bold text-emerald-300 mt-1">{summary.arrived}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-emerald-500/60 shrink-0" />
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-950/20">
          <CardContent className="pt-5 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-red-400/80 uppercase tracking-wide">Sin entrada</p>
              <p className="text-2xl font-bold text-red-300 mt-1">{summary.absent}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-500/60 shrink-0" />
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-950/20">
          <CardContent className="pt-5 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-emerald-400/80 uppercase tracking-wide">A tiempo</p>
              <p className="text-2xl font-bold text-emerald-300 mt-1">{summary.onTime}</p>
              <p className="text-[10px] text-slate-500 mt-1">{punctualityHint}</p>
            </div>
            <Check className="h-8 w-8 text-emerald-500/60 shrink-0" strokeWidth={2} />
          </CardContent>
        </Card>
        <Card className="border-orange-500/30 bg-orange-950/20">
          <CardContent className="pt-5 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-orange-400/80 uppercase tracking-wide">Tardanza</p>
              <p className="text-2xl font-bold text-orange-300 mt-1">{summary.late}</p>
            </div>
            <X className="h-8 w-8 text-orange-500/60 shrink-0" strokeWidth={2.5} />
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/20">
          <CardContent className="pt-5">
            <p className="text-xs text-amber-400/80 uppercase tracking-wide">Con salida</p>
            <p className="text-2xl font-bold text-amber-300 mt-1">{summary.leftSameDay}</p>
            <p className="text-xs text-muted-foreground mt-1">salida_format mismo día</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card dark:border-slate-800 dark:bg-slate-950/80">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-foreground text-lg">
            <LayoutDashboard className="h-5 w-5 text-indigo-400" />
            Dashboard Buk — {dateLabel}
          </CardTitle>
          <CardDescription className="text-slate-400">
            Datos directos de la API. Puntualidad turno día: entrada a las {dayStart} con {toleranceMin} min de tolerancia.
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
                className="pl-9 bg-background border-border text-foreground dark:bg-slate-900 dark:border-slate-700 dark:text-white"
              />
            </div>
            <Select value={areaFilter} onValueChange={setAreaFilter}>
              <SelectTrigger className="w-[200px] bg-background border-border text-foreground dark:bg-slate-900 dark:border-slate-700 dark:text-white">
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
              <SelectTrigger className="w-[220px] bg-background border-border text-foreground dark:bg-slate-900 dark:border-slate-700 dark:text-white">
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
              <SelectTrigger className="w-[180px] bg-background border-border text-foreground dark:bg-slate-900 dark:border-slate-700 dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos ({summary.total})</SelectItem>
                <SelectItem value="arrived">Llegaron ({summary.arrived})</SelectItem>
                <SelectItem value="absent">Sin entrada ({summary.absent})</SelectItem>
                <SelectItem value="on_time">A tiempo ({summary.onTime})</SelectItem>
                <SelectItem value="late">Tardanza ({summary.late})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs value={view} onValueChange={(v) => setView(v as 'list' | 'specialty' | 'area' | 'charts')}>
            <TabsList className="bg-muted/60 border border-border dark:bg-slate-900 dark:border-slate-800">
              <TabsTrigger
                value="list"
                className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
              >
                <List className="h-4 w-4 mr-1" /> Lista
              </TabsTrigger>
              <TabsTrigger
                value="charts"
                className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
              >
                <BarChart3 className="h-4 w-4 mr-1" /> Gráficos
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

            <TabsContent value="charts" className="mt-4">
              <AsistenciaBukCharts summary={summary} areaGroups={filteredAreaGroups} />
            </TabsContent>

            <TabsContent value="list" className="mt-4">
              <div className="rounded-xl border border-border overflow-hidden dark:border-slate-800">
                <BukRowsTable rows={filteredRows} />
              </div>
              <p className="text-xs text-muted-foreground mt-3">
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
                  <div key={group.area} className="rounded-xl border border-border overflow-hidden dark:border-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/50 dark:border-slate-800 dark:bg-slate-900/80 px-4 py-3">
                      <div>
                        <p className="font-semibold text-foreground">{group.area}</p>
                        <p className="text-xs text-muted-foreground">{group.rows.length} persona(s) en vista</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-400">
                          {group.rows.filter((r) => r.arrived).length} llegaron
                        </span>
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-400">
                          {group.rows.filter((r) => r.punctuality === 'on_time').length} a tiempo
                        </span>
                        <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-orange-400">
                          {group.rows.filter((r) => r.punctuality === 'late').length} tarde
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
              <p className="text-xs text-muted-foreground">
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
                    className="rounded-xl border border-border overflow-hidden dark:border-slate-800"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/50 dark:border-slate-800 dark:bg-slate-900/80 px-4 py-3">
                      <div>
                        <p className="font-semibold text-foreground">{group.especialidad}</p>
                        <p className="text-xs text-muted-foreground">
                          {group.rows.length} persona(s) en vista
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-400">
                          {group.rows.filter((r) => r.arrived).length} llegaron
                        </span>
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-400">
                          {group.rows.filter((r) => r.punctuality === 'on_time').length} a tiempo
                        </span>
                        <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-orange-400">
                          {group.rows.filter((r) => r.punctuality === 'late').length} tarde
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
              <p className="text-xs text-muted-foreground">
                {filteredSpecialtyGroups.length} especialidad(es) · {filteredRows.length} persona(s) en total.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
