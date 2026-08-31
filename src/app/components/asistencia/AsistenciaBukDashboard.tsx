import {
  Check,
  CheckCircle2,
  BarChart3,
  CircleHelp,
  Download,
  LayoutDashboard,
  Layers,
  List,
  MapPin,
  X,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import type { AsistenciaFilters, AsistenciaSettings, BukAsistenciaRecord, BukPunctualityStatus } from '../../types/asistencia';
import {
  buildBukDashboardSummary,
  type BukDashboardRow,
} from '../../utils/asistenciaBukDashboard';
import { filterBukDashboardRows } from '../../utils/asistenciaFilters';
import { getSedeProfile } from '../../utils/asistenciaStaff';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
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
  filters: AsistenciaFilters;
  onRowClick?: (row: BukDashboardRow) => void;
  onExport?: () => void;
};

function KpiCard({
  title,
  value,
  subtitle,
  help,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  help: string;
  icon: typeof CheckCircle2;
  accent: string;
}) {
  return (
    <Card className={`relative border-border dark:border-slate-800 ${accent}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="absolute right-2.5 top-2.5 z-10 rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Qué significa: ${title}`}
          >
            <CircleHelp className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={6}
          className="max-w-[260px] bg-popover text-popover-foreground border border-border shadow-md dark:border-slate-700"
        >
          <p className="text-xs leading-relaxed">{help}</p>
        </TooltipContent>
      </Tooltip>
      <CardContent className="pt-5 pr-8 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          {subtitle ? <p className="text-[10px] text-muted-foreground mt-1">{subtitle}</p> : null}
        </div>
        <Icon className="h-8 w-8 opacity-60 shrink-0" />
      </CardContent>
    </Card>
  );
}

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

function BukRowsTable({
  rows,
  onRowClick,
}: {
  rows: BukDashboardRow[];
  onRowClick?: (row: BukDashboardRow) => void;
}) {
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
          <TableRow
            key={row.id}
            className={`border-border/80 dark:border-slate-800/80 dark:hover:bg-slate-900/50 ${
              onRowClick ? 'cursor-pointer hover:bg-muted/40' : 'hover:bg-muted/40'
            }`}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
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

export function AsistenciaBukDashboard({
  records,
  settings,
  sedeName,
  date,
  filters,
  onRowClick,
  onExport,
}: Props) {
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

  const filteredRows = useMemo(
    () => filterBukDashboardRows(summary.rows, filters),
    [summary.rows, filters]
  );

  const filteredStats = useMemo(
    () => ({
      total: filteredRows.length,
      arrived: filteredRows.filter((r) => r.arrived).length,
      absent: filteredRows.filter((r) => !r.arrived).length,
      onTime: filteredRows.filter((r) => r.punctuality === 'on_time').length,
      late: filteredRows.filter((r) => r.punctuality === 'late').length,
      leftSameDay: filteredRows.filter((r) => r.leftSameDay).length,
    }),
    [filteredRows]
  );

  const filteredSpecialtyGroups = useMemo(
    () =>
      summary.specialtyGroups
        .map((group) => ({
          ...group,
          rows: filterBukDashboardRows(group.rows, filters),
        }))
        .filter((group) => group.rows.length > 0),
    [summary.specialtyGroups, filters]
  );

  const filteredAreaGroups = useMemo(
    () =>
      summary.areaGroups
        .map((group) => ({
          ...group,
          rows: filterBukDashboardRows(group.rows, filters),
        }))
        .filter((group) => group.rows.length > 0),
    [summary.areaGroups, filters]
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
        <KpiCard
          title="En sede ese día"
          value={filteredStats.total}
          subtitle={sedeName}
          help="Personas con registro Buk asociado a esta sede y fecha, según los filtros activos."
          icon={LayoutDashboard}
          accent="bg-card dark:bg-slate-950/80"
        />
        <KpiCard
          title="Llegaron"
          value={filteredStats.arrived}
          help="Marcaron entrada válida ese día en Buk (entrada_format o timestamp de entrada)."
          icon={CheckCircle2}
          accent="border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-950/20"
        />
        <KpiCard
          title="Sin entrada"
          value={filteredStats.absent}
          help="Registros del día sin hora de entrada válida en Buk."
          icon={XCircle}
          accent="border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-950/20"
        />
        <KpiCard
          title="A tiempo"
          value={filteredStats.onTime}
          subtitle={punctualityHint}
          help={`Puntualidad turno día: entrada antes o igual a ${dayStart} + ${toleranceMin} min de tolerancia configurados en la sede.`}
          icon={Check}
          accent="border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-950/20"
        />
        <KpiCard
          title="Tardanza"
          value={filteredStats.late}
          help="Entrada registrada después del límite de puntualidad del turno día."
          icon={X}
          accent="border-orange-500/30 bg-orange-950/20"
        />
        <KpiCard
          title="Con salida"
          value={filteredStats.leftSameDay}
          subtitle="salida mismo día"
          help="Personas que marcaron salida el mismo día calendario (salida_format)."
          icon={CheckCircle2}
          accent="border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/20"
        />
      </div>

      <Card className="border-border bg-card dark:border-slate-800 dark:bg-slate-950/80">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-foreground text-lg">
                <LayoutDashboard className="h-5 w-5 text-indigo-400" />
                Dashboard Buk — {dateLabel}
              </CardTitle>
              <CardDescription className="text-slate-400">
                Datos directos de la API. Puntualidad turno día: entrada a las {dayStart} con {toleranceMin} min de tolerancia.
              </CardDescription>
            </div>
            {onExport ? (
              <Button type="button" variant="outline" size="sm" onClick={onExport}>
                <Download className="mr-1 h-4 w-4" />
                Exportar Excel
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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
                <BukRowsTable rows={filteredRows} onRowClick={onRowClick} />
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Mostrando {filteredRows.length} de {summary.total} persona(s).
                {onRowClick ? ' Clic en una fila para ver detalle.' : ''}
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
                    <BukRowsTable rows={group.rows} onRowClick={onRowClick} />
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
                    <BukRowsTable rows={group.rows} onRowClick={onRowClick} />
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
