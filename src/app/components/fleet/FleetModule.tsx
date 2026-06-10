/**
 * Gestión vehicular — flota, mantenimiento, combustible, alertas y reportes.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Truck,
  Activity,
  Wrench,
  Fuel,
  ClipboardCheck,
  Bell,
  FileSpreadsheet,
  Plus,
  Pencil,
  ArrowRightCircle,
  CheckCircle2,
  AlertTriangle,
  Gauge,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import type {
  FleetDataset,
  FleetFuelEntry,
  FleetMaintenanceKind,
  FleetMaintenanceRecord,
  FleetVehicle,
  FleetVehicleStatus,
} from '../../types/fleet';
import {
  avgFleetConsumptionLPer100,
  buildFleetAlerts,
  computeFleetKpis,
  fuelTypeLabel,
  monthlyCostsSeries,
  statusLabelSpanish,
  vehicleConsumptionLPer100,
} from '../../utils/fleetData';
import { formatCurrencyEs } from '../../utils/numberFormat';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { toast } from 'sonner';
import {
  FleetChecklistConfigurator,
  FleetInspectionsGlobalTable,
  FleetVehicleInspectionBar,
} from './FleetInspectionComponents';
import { FleetSedeField, useFleetSedeOptions } from './FleetSedeField';
import { applyFleetDatasetChange, type FleetPersistFn } from '../../utils/fleetPersist';

const PIE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#64748b'];

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}_${Date.now().toString(36)}`;
}

export interface FleetModuleProps {
  dataset: FleetDataset;
  setDataset: React.Dispatch<React.SetStateAction<FleetDataset>>;
  /** Guardado inmediato en nube (KV + SQL). Si falta, solo actualiza state local. */
  onPersistDataset?: FleetPersistFn;
  /** Sedes habilitadas / visibles según configuración del sistema y permisos del usuario. */
  visibleSedes?: string[];
  /** Sede predeterminada al registrar un vehículo nuevo. */
  defaultHomeBase?: string;
}

type FleetTab =
  | 'dashboard'
  | 'fleet'
  | 'maintenance'
  | 'fuel'
  | 'alerts'
  | 'reports'
  | 'inspections';

export function FleetModule({ dataset, setDataset, onPersistDataset, visibleSedes, defaultHomeBase }: FleetModuleProps) {
  const [fleetTab, setFleetTab] = useState<FleetTab>('dashboard');
  const kpis = useMemo(() => computeFleetKpis(dataset), [dataset]);
  const alerts = useMemo(() => buildFleetAlerts(dataset), [dataset]);
  const costBars = useMemo(() => monthlyCostsSeries(dataset, 6), [dataset]);

  const statusPie = useMemo(() => {
    const c = { available: 0, in_use: 0, maintenance: 0, out_of_service: 0 } as Record<
      FleetVehicleStatus,
      number
    >;
    for (const v of dataset.vehicles) c[v.status] += 1;
    return [
      { name: 'Disponibles', value: c.available },
      { name: 'En uso', value: c.in_use },
      { name: 'Mantenimiento', value: c.maintenance },
      { name: 'Fuera servicio', value: c.out_of_service },
    ].filter((x) => x.value > 0);
  }, [dataset.vehicles]);

  const avgCons = avgFleetConsumptionLPer100(dataset);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 -mt-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-slate-950/90 via-[#151025] to-slate-900/95 p-3 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-500/15 p-2.5 border border-emerald-500/30">
            <Truck className="h-8 w-8 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">Gestión vehicular — Flota clínica</h2>
            <p className="text-sm text-slate-400 max-w-xl">
              Control integral de disponibilidad, mantenimiento, combustible y cumplimiento (SOAT · revisión técnica).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FleetExportCsv dataset={dataset} />
        </div>
      </div>

      <div className="min-w-0">
        <div className="space-y-4">
      <Tabs value={fleetTab} onValueChange={(v) => setFleetTab(v as FleetTab)} className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1 bg-slate-900/80 border border-white/10 p-1 rounded-xl">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="fleet">Flota</TabsTrigger>
          <TabsTrigger value="maintenance">Mantenimiento</TabsTrigger>
          <TabsTrigger value="fuel">Combustible</TabsTrigger>
          <TabsTrigger value="alerts">Alertas ({alerts.filter((a) => a.severity !== 'info').length})</TabsTrigger>
          <TabsTrigger value="reports">Reportes</TabsTrigger>
          <TabsTrigger value="inspections">Inspecciones</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 focus-visible:outline-none">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <KpiTile
              icon={CheckCircle2}
              label="Disponibles"
              value={kpis.available}
              sub={`de ${kpis.total} vehículos`}
              color="text-emerald-400"
              border="border-emerald-500/35"
              bg="bg-emerald-500/10"
            />
            <KpiTile
              icon={ArrowRightCircle}
              label="En uso"
              value={kpis.inUse}
              sub="En ruta u operativo"
              color="text-sky-400"
              border="border-sky-500/35"
              bg="bg-sky-500/10"
            />
            <KpiTile
              icon={Wrench}
              label="Mantenimiento"
              value={kpis.maintenance}
              sub={`Fuera servicio · ${kpis.outOfService}`}
              color="text-amber-400"
              border="border-amber-500/35"
              bg="bg-amber-500/10"
            />
            <KpiTile
              icon={AlertTriangle}
              label="Alertas críticas"
              value={kpis.criticalAlerts}
              sub={`Advertencias · ${kpis.warningAlerts}`}
              color="text-red-400"
              border="border-red-500/40"
              bg="bg-red-500/12"
            />
            <KpiTile
              icon={Gauge}
              label="Combustible (mes)"
              value={kpis.monthFuelLiters.toFixed(1) + ' L'}
              sub={formatMoneyStr(kpis.monthFuelSpend)}
              color="text-violet-300"
              border="border-violet-500/35"
              bg="bg-violet-500/10"
            />
          </div>

          <div className="grid lg:grid-cols-5 gap-4">
            <Card className="lg:col-span-2 bg-slate-950/70 border-white/10 text-white overflow-hidden">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-teal-400" />
                  Estado de la flota
                </CardTitle>
                <CardDescription className="text-slate-400">Distribución por disponibilidad</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px]">
                {statusPie.length === 0 ? (
                  <p className="text-sm text-slate-500">Sin vehículos registrados.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}>
                        {statusPie.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="rgba(0,0,0,0.4)" />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`${value} u.`, '']}
                        contentStyle={{ background: '#14121f', border: '1px solid rgba(139,92,246,0.25)' }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-3 bg-slate-950/70 border-white/10 text-white">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                <div>
                  <CardTitle className="text-base">Costos flota vs combustible</CardTitle>
                  <CardDescription className="text-slate-400">Últimos 6 meses (S/&nbsp;mensual)</CardDescription>
                </div>
                <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-200 border-emerald-500/30">
                  Mant. este mes · {formatMoneyStr(kpis.monthMaintenanceSpend)}
                </Badge>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costBars}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} stroke="#64748b" />
                    <XAxis dataKey="label" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        background: '#14121f',
                        border: '1px solid rgba(139,92,246,0.25)',
                      }}
                      formatter={(v: number, name: string) => [`S/${v.toLocaleString('es-PE')}`, name === 'fuel' ? 'Combustible' : 'Mantenimiento']}
                    />
                    <Legend formatter={(value) => (value === 'fuel' ? 'Combustible' : 'Mantenimiento')} />
                    <Bar dataKey="maintenance" fill="#a855f7" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="fuel" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-gradient-to-br from-slate-900/95 to-emerald-950/20 border-white/10 text-white">
            <CardContent className="pt-6 flex flex-wrap gap-8 items-center">
              <div>
                <div className="text-xs uppercase tracking-wider text-emerald-200/70">Consumo flota observado</div>
                <div className="text-3xl font-bold text-white tabular-nums">
                  {avgCons != null ? `${avgCons.toFixed(1)}` : '—'} <span className="text-lg text-slate-400">L / 100&nbsp;km</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Promedio entre vehículos con al menos dos repostajes encadenados.</p>
              </div>
              <div className="h-px w-full sm:h-16 sm:w-px bg-white/15" />
              <div className="text-sm text-slate-400">
                Actualizado vista <span className="text-teal-300 font-semibold">{kpis.lastSyncedAtLabel}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fleet" className="focus-visible:outline-none">
          <FleetVehiclesSection
            dataset={dataset}
            setDataset={setDataset}
            onPersistDataset={onPersistDataset}
            visibleSedes={visibleSedes}
            defaultHomeBase={defaultHomeBase}
          />
        </TabsContent>

        <TabsContent value="maintenance" className="focus-visible:outline-none">
          <FleetMaintenanceSection
            dataset={dataset}
            setDataset={setDataset}
            onPersistDataset={onPersistDataset}
            visibleSedes={visibleSedes}
            defaultHomeBase={defaultHomeBase}
          />
        </TabsContent>

        <TabsContent value="fuel" className="focus-visible:outline-none">
          <FleetFuelSection
            dataset={dataset}
            setDataset={setDataset}
            onPersistDataset={onPersistDataset}
            visibleSedes={visibleSedes}
            defaultHomeBase={defaultHomeBase}
          />
        </TabsContent>

        <TabsContent value="alerts" className="focus-visible:outline-none">
          <FleetAlertsSection alerts={alerts} />
        </TabsContent>

        <TabsContent value="reports" className="focus-visible:outline-none">
          <FleetReportsSection dataset={dataset} />
        </TabsContent>

        <TabsContent value="inspections" className="focus-visible:outline-none space-y-6">
          <Card className="border-white/10 bg-slate-950/70 text-white">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-teal-400" />
                Inspección vehicular — movilidad canina
              </CardTitle>
              <CardDescription className="text-slate-400">
                Configure plantillas editables, revise el historial global y registre checklist desde cada tarjeta de vehículo.
              </CardDescription>
            </CardHeader>
          </Card>
          <Tabs defaultValue="checklist-config" className="space-y-4">
            <TabsList className="flex-wrap h-auto gap-1 bg-slate-900/80 border border-white/10 p-1 rounded-xl">
              <TabsTrigger value="checklist-config">Plantilla del checklist</TabsTrigger>
              <TabsTrigger value="inspection-global-hist">Historial global</TabsTrigger>
            </TabsList>
            <TabsContent value="checklist-config" className="focus-visible:outline-none">
              <FleetChecklistConfigurator
                dataset={dataset}
                setDataset={setDataset}
                onPersistDataset={onPersistDataset}
              />
            </TabsContent>
            <TabsContent value="inspection-global-hist" className="focus-visible:outline-none">
              <FleetInspectionsGlobalTable dataset={dataset} />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
        </div>
      </div>
    </div>
  );
}

function formatMoneyStr(n: number) {
  return `S/${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function KpiTile({
  icon: Icon,
  label,
  value,
  sub,
  color,
  border,
  bg,
}: {
  icon: typeof Truck;
  label: string;
  value: string | number;
  sub: string;
  color: string;
  border: string;
  bg: string;
}) {
  return (
    <Card className={`relative overflow-hidden border ${border} ${bg} backdrop-blur-md`}>
      <CardHeader className="pb-2">
        <div className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider ${color}`}>
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </div>
        <CardTitle className={`text-2xl mt-2 ${color.includes('red') ? 'text-red-200' : 'text-white'} tabular-nums`}>{value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-xs text-slate-500">{sub}</CardContent>
    </Card>
  );
}

/** ---- Flota CRUD ---- */
function FleetVehiclesSection({
  dataset,
  setDataset,
  onPersistDataset,
  visibleSedes,
  defaultHomeBase,
}: {
  dataset: FleetDataset;
  setDataset: FleetModuleProps['setDataset'];
  onPersistDataset?: FleetModuleProps['onPersistDataset'];
  visibleSedes?: string[];
  defaultHomeBase?: string;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FleetVehicle | null>(null);
  const [form, setForm] = useState<Partial<FleetVehicle>>({});

  const resolvedDefaultHomeBase =
    defaultHomeBase?.trim() || visibleSedes?.[0]?.trim() || 'Principal';

  const { options: sedeSelectOptions } = useFleetSedeOptions(
    visibleSedes,
    defaultHomeBase,
    form.homeBase
  );

  const openNew = () => {
    setEditing(null);
    setForm({
      status: 'available',
      fuelType: 'gasoline',
      currentOdometerKm: 0,
      year: new Date().getFullYear(),
      homeBase: resolvedDefaultHomeBase,
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open || editing) return;
    if (sedeSelectOptions.length === 0) return;
    const current = (form.homeBase || '').trim();
    if (!current || !sedeSelectOptions.includes(current)) {
      setForm((f) => ({ ...f, homeBase: sedeSelectOptions[0] }));
    }
  }, [open, editing, sedeSelectOptions, form.homeBase]);

  const openEdit = (v: FleetVehicle) => {
    setEditing(v);
    setForm({ ...v });
    setOpen(true);
  };

  const save = async () => {
    const plate = (form.plate || '').trim();
    const brand = (form.brand || '').trim();
    const model = (form.model || '').trim();
    if (!plate || !brand || !model) {
      toast.error('Completa placa, marca y modelo.');
      return;
    }
    const now = new Date().toISOString();
    const id = editing?.id ?? newId('fv');

    const row: FleetVehicle = {
      id,
      plate,
      brand,
      model: model || '—',
      year: Number(form.year) || new Date().getFullYear(),
      color: form.color?.trim() || undefined,
      vin: form.vin?.trim() || undefined,
      fuelType: (form.fuelType as FleetVehicle['fuelType']) || 'gasoline',
      status: (form.status as FleetVehicleStatus) || 'available',
      currentOdometerKm: Number(form.currentOdometerKm) || 0,
      assignedDriverName: form.assignedDriverName?.trim() || undefined,
      assignedDriverLicense: form.assignedDriverLicense?.trim() || undefined,
      homeBase: form.homeBase?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
      technicalInspectionDue: form.technicalInspectionDue || undefined,
      insuranceDue: form.insuranceDue || undefined,
      insuranceCompany: form.insuranceCompany?.trim() || undefined,
      registrationDue: form.registrationDue || undefined,
      nextServiceKm: form.nextServiceKm ? Number(form.nextServiceKm) : undefined,
      nextOilChangeDate: form.nextOilChangeDate || undefined,
      lastInspectionCompliance: editing?.lastInspectionCompliance,
      lastInspectionAt: editing?.lastInspectionAt,
      driverInspectionDemerits: editing?.driverInspectionDemerits,
      driverPerformanceScore: editing?.driverPerformanceScore,
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
    };

    const next: FleetDataset = {
      ...dataset,
      vehicles: editing
        ? dataset.vehicles.map((v) => (v.id === id ? row : v))
        : [...dataset.vehicles, row],
    };
    const ok = await applyFleetDatasetChange(
      setDataset,
      onPersistDataset,
      next,
      editing ? 'Vehículo actualizado.' : 'Vehículo agregado.'
    );
    if (ok) setOpen(false);
  };

  const removeVehicle = async (v: FleetVehicle) => {
    if (!confirm(`¿Eliminar ${v.plate} y sus referencias locales? Mantenimiento/combustible quedarán huérfanos en reportes hasta que los borre.`)) return;
    const next: FleetDataset = {
      ...dataset,
      vehicles: dataset.vehicles.filter((x) => x.id !== v.id),
      maintenance: dataset.maintenance.filter((m) => m.vehicleId !== v.id),
      fuelEntries: dataset.fuelEntries.filter((f) => f.vehicleId !== v.id),
      inspections: dataset.inspections.filter((i) => i.vehicleId !== v.id),
    };
    await applyFleetDatasetChange(setDataset, onPersistDataset, next, 'Vehículo eliminado.');
  };

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button onClick={openNew} className="gap-2 bg-teal-600 hover:bg-teal-500">
          <Plus className="h-4 w-4" />
          Alta de vehículo
        </Button>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {dataset.vehicles.map((v) => (
          <Card key={v.id} className="border-white/10 bg-slate-950/80 text-white">
            <CardHeader className="pb-2">
              <div className="flex justify-between gap-2">
                <Badge className="text-base font-bold tracking-wide bg-emerald-500/20 text-emerald-200 border border-emerald-500/35">
                  {v.plate}
                </Badge>
                <Badge variant="outline" className="capitalize shrink-0">
                  {statusLabelSpanish(v.status)}
                </Badge>
              </div>
              <CardTitle className="text-lg pt-2">
                {v.brand} {v.model} <span className="text-muted-foreground text-sm">{v.year}</span>
              </CardTitle>
              <CardDescription className="text-slate-400">
                {fuelTypeLabel(v.fuelType)} · {v.currentOdometerKm.toLocaleString('es-PE')} km · {v.homeBase || '—'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-400">
              {v.assignedDriverName && (
                <p>
                  Conductor habitual:{' '}
                  <span className="text-white font-medium">{v.assignedDriverName}</span>
                  {v.assignedDriverLicense && (
                    <span className="text-slate-400"> · Lic. {v.assignedDriverLicense}</span>
                  )}
                </p>
              )}
              {(v.insuranceDue || v.technicalInspectionDue) && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {v.insuranceDue && (
                    <span className="rounded-md bg-teal-500/15 px-2 py-1 border border-teal-500/25 text-teal-200">
                      SOAT / seg · {v.insuranceDue}
                    </span>
                  )}
                  {v.technicalInspectionDue && (
                    <span className="rounded-md bg-sky-500/15 px-2 py-1 border border-sky-500/25 text-sky-200">
                      Rev. técnica · {v.technicalInspectionDue}
                    </span>
                  )}
                </div>
              )}
              <div className="flex gap-2 pt-2 flex-wrap">
                <Button variant="outline" size="sm" className="h-8" onClick={() => openEdit(v)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Detalle / editar
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-red-400 hover:text-red-300" onClick={() => removeVehicle(v)}>
                  Eliminar
                </Button>
              </div>
              <FleetVehicleInspectionBar
                vehicle={v}
                dataset={dataset}
                setDataset={setDataset}
                onPersistDataset={onPersistDataset}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-slate-950 border-white/15 text-white">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar vehículo' : 'Nuevo vehículo'}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Alta unificada: seguros, revisiones programadas y seguimiento de odómetro.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Placa *</Label>
              <Input value={form.plate ?? ''} onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Marca *</Label>
              <Input value={form.brand ?? ''} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Modelo *</Label>
              <Input value={form.model ?? ''} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Año</Label>
              <Input type="number" value={form.year ?? ''} onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Combustible</Label>
              <Select value={form.fuelType ?? 'gasoline'} onValueChange={(v) => setForm((f) => ({ ...f, fuelType: v as FleetVehicle['fuelType'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gasoline">Gasolina</SelectItem>
                  <SelectItem value="diesel">Diésel</SelectItem>
                  <SelectItem value="cng">GNV</SelectItem>
                  <SelectItem value="hybrid">Híbrido</SelectItem>
                  <SelectItem value="electric">Eléctrico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Estado</Label>
              <Select value={form.status ?? 'available'} onValueChange={(v) => setForm((f) => ({ ...f, status: v as FleetVehicleStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Disponible</SelectItem>
                  <SelectItem value="in_use">En uso</SelectItem>
                  <SelectItem value="maintenance">Mantenimiento</SelectItem>
                  <SelectItem value="out_of_service">Fuera de servicio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Km actual</Label>
              <Input type="number" value={form.currentOdometerKm ?? ''} onChange={(e) => setForm((f) => ({ ...f, currentOdometerKm: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-slate-300">Conductor / responsable</Label>
              <Input value={form.assignedDriverName ?? ''} onChange={(e) => setForm((f) => ({ ...f, assignedDriverName: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-slate-300">Nro de licencia del conductor</Label>
              <Input value={form.assignedDriverLicense ?? ''} onChange={(e) => setForm((f) => ({ ...f, assignedDriverLicense: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
            <FleetSedeField
              label="Base / sede"
              value={form.homeBase || resolvedDefaultHomeBase}
              onChange={(val) => setForm((f) => ({ ...f, homeBase: val }))}
              visibleSedes={visibleSedes}
              defaultSede={defaultHomeBase}
            />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Vencimiento SOAT (yyyy-MM-dd)</Label>
              <Input type="date" value={(form.insuranceDue || '').slice(0, 10)} onChange={(e) => setForm((f) => ({ ...f, insuranceDue: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Rev. técnica (fecha)</Label>
              <Input type="date" value={(form.technicalInspectionDue || '').slice(0, 10)} onChange={(e) => setForm((f) => ({ ...f, technicalInspectionDue: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Próximo servicio KM</Label>
              <Input type="number" value={form.nextServiceKm ?? ''} onChange={(e) => setForm((f) => ({ ...f, nextServiceKm: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Próx. cambio aceite</Label>
              <Input type="date" value={(form.nextOilChangeDate || '').slice(0, 10)} onChange={(e) => setForm((f) => ({ ...f, nextOilChangeDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-slate-300">Aseguradora</Label>
              <Input value={form.insuranceCompany ?? ''} onChange={(e) => setForm((f) => ({ ...f, insuranceCompany: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-slate-300">Notas internas</Label>
              <Textarea value={form.notes ?? ''} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} className="bg-teal-600 hover:bg-teal-500">{editing ? 'Guardar cambios' : 'Registrar vehículo'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Mantenimiento */
function FleetMaintenanceSection({
  dataset,
  setDataset,
  onPersistDataset,
  visibleSedes,
  defaultHomeBase,
}: {
  dataset: FleetDataset;
  setDataset: FleetModuleProps['setDataset'];
  onPersistDataset?: FleetModuleProps['onPersistDataset'];
  visibleSedes?: string[];
  defaultHomeBase?: string;
}) {
  const [open, setOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState('');
  const [location, setLocation] = useState('');
  const [kind, setKind] = useState<FleetMaintenanceKind>('preventive');
  const [dateStr, setDateStr] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [odometer, setOdometer] = useState<number>(0);
  const [workshop, setWorkshop] = useState('');
  const [description, setDescription] = useState('');
  const [labor, setLabor] = useState<number>(0);
  const [partsCost, setPartsCost] = useState<number>(0);
  const [partsTxt, setPartsTxt] = useState('');

  const { resolvedDefault } = useFleetSedeOptions(visibleSedes, defaultHomeBase, location);

  const vehiclesForSede = useMemo(() => {
    const loc = (location || resolvedDefault).trim();
    if (!loc) return dataset.vehicles;
    const atBase = dataset.vehicles.filter((v) => (v.homeBase || '').trim() === loc);
    return atBase.length > 0 ? atBase : dataset.vehicles;
  }, [dataset.vehicles, location, resolvedDefault]);

  const openDialog = () => {
    const sede = resolvedDefault;
    setLocation(sede);
    const candidates = dataset.vehicles.filter((v) => (v.homeBase || '').trim() === sede);
    const first = (candidates[0] ?? dataset.vehicles[0])?.id ?? '';
    setVehicleId(first);
    setOdometer(dataset.vehicles.find((v) => v.id === first)?.currentOdometerKm ?? 0);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    if (!vehicleId && vehiclesForSede[0]) {
      setVehicleId(vehiclesForSede[0].id);
      setOdometer(vehiclesForSede[0].currentOdometerKm);
    } else if (vehicleId && !vehiclesForSede.some((v) => v.id === vehicleId) && vehiclesForSede[0]) {
      setVehicleId(vehiclesForSede[0].id);
      setOdometer(vehiclesForSede[0].currentOdometerKm);
    }
  }, [open, vehicleId, vehiclesForSede]);

  const parseParts = (): { name: string; qty: number; unitCost: number }[] => {
    const lines = partsTxt.split('\n').map((l) => l.trim()).filter(Boolean);
    const out: { name: string; qty: number; unitCost: number }[] = [];
    for (const line of lines) {
      const m = line.match(/^(.+?)\s*[x×]\s*(\d+)(?:\s*@\s*([\d.]+))?$/iu);
      if (m)
        out.push({
          name: m[1]!.trim(),
          qty: Number(m[2]),
          unitCost: m[3] != null ? Number(m[3]) : 0,
        });
      else out.push({ name: line, qty: 1, unitCost: 0 });
    }
    return out;
  };

  const submit = async () => {
    const v = dataset.vehicles.find((x) => x.id === vehicleId);
    if (!v) {
      toast.error('Seleccione un vehículo.');
      return;
    }
    if (!description.trim()) {
      toast.error('Describe el trabajo.');
      return;
    }
    const now = new Date().toISOString();
    const rec: FleetMaintenanceRecord = {
      id: newId('fm'),
      vehicleId: v.id,
      kind,
      date: dateStr,
      odometerKm: odometer,
      workshopName: workshop.trim() || undefined,
      location: location.trim() || resolvedDefault,
      description: description.trim(),
      laborCost: labor,
      partsCost,
      parts: parseParts(),
      createdAt: now,
    };
    const next: FleetDataset = {
      ...dataset,
      maintenance: [rec, ...dataset.maintenance],
      vehicles: dataset.vehicles.map((x) =>
        x.id === v.id ? { ...x, currentOdometerKm: Math.max(x.currentOdometerKm, odometer), updatedAt: now } : x
      ),
    };
    const ok = await applyFleetDatasetChange(setDataset, onPersistDataset, next, 'Mantenimiento registrado.');
    if (ok) {
      setOpen(false);
      setVehicleId('');
      setDescription('');
    }
  };

  const rows = [...dataset.maintenance].sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button onClick={openDialog} className="gap-2" disabled={!dataset.vehicles.length}>
          <Plus className="h-4 w-4" />
          Registrar mantenimiento
        </Button>
      </div>
      <ScrollArea className="h-[min(520px,70vh)] rounded-xl border border-white/10 bg-slate-950/60">
        <Table>
          <TableHeader className="sticky top-0 bg-slate-900/95 z-[1]">
            <TableRow className="border-white/10">
              <TableHead>Fecha</TableHead>
              <TableHead>Vehículo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Sede</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Costo tot.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const v = dataset.vehicles.find((x) => x.id === r.vehicleId);
              const tot = Number(r.laborCost) + Number(r.partsCost);
              return (
                <TableRow key={r.id} className="border-white/10 text-slate-200">
                  <TableCell>{r.date}</TableCell>
                  <TableCell className="font-mono">{v?.plate ?? r.vehicleId}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={r.kind === 'preventive' ? 'bg-teal-500/20 text-teal-200' : ''}>
                      {r.kind === 'preventive' ? 'Preventivo' : 'Correctivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-400">{r.location || v?.homeBase || '—'}</TableCell>
                  <TableCell className="max-w-[240px] truncate text-slate-400">{r.description}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoneyStr(tot)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-slate-950 border-white/15 text-white max-h-[90vh] overflow-y-auto max-w-lg">
          <DialogHeader>
            <DialogTitle>Mantenimiento preventivo / correctivo</DialogTitle>
            <DialogDescription className="text-slate-400">Registrar costos y repuestos (una línea por repuesto).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <FleetSedeField
              label="Sede / base"
              value={location || resolvedDefault}
              onChange={setLocation}
              visibleSedes={visibleSedes}
              defaultSede={defaultHomeBase}
            />
            <div className="space-y-1.5">
              <Label>Vehículo</Label>
              <Select
                value={vehicleId}
                onValueChange={(id) => {
                  setVehicleId(id);
                  const v = dataset.vehicles.find((x) => x.id === id);
                  if (v) setOdometer(v.currentOdometerKm);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                <SelectContent>
                  {vehiclesForSede.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Fecha</Label>
                <Input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Odómetro (km)</Label>
                <Input type="number" value={odometer || ''} onChange={(e) => setOdometer(Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as FleetMaintenanceKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="preventive">Preventivo</SelectItem>
                  <SelectItem value="corrective">Correctivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Taller</Label>
              <Input value={workshop} onChange={(e) => setWorkshop(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción *</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Mano de obra (S/)</Label>
                <Input type="number" value={labor || ''} onChange={(e) => setLabor(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Costo repuestos (S/) total opcional</Label>
                <Input type="number" value={partsCost || ''} onChange={(e) => setPartsCost(Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Detalle repuestos (opcional)</Label>
              <Textarea
                placeholder={`Filtro x1 @45\nAceite x4 @12`}
                value={partsTxt}
                onChange={(e) => setPartsTxt(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Combustible */
function FleetFuelSection({
  dataset,
  setDataset,
  onPersistDataset,
  visibleSedes,
  defaultHomeBase,
}: {
  dataset: FleetDataset;
  setDataset: FleetModuleProps['setDataset'];
  onPersistDataset?: FleetModuleProps['onPersistDataset'];
  visibleSedes?: string[];
  defaultHomeBase?: string;
}) {
  const [open, setOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState('');
  const [location, setLocation] = useState('');
  const [dateStr, setDateStr] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [odometer, setOdometer] = useState<number>(0);
  const [liters, setLiters] = useState<number>(0);
  const [cost, setCost] = useState<number>(0);
  const [station, setStation] = useState('');

  const { resolvedDefault } = useFleetSedeOptions(visibleSedes, defaultHomeBase, location);

  const vehiclesForSede = useMemo(() => {
    const loc = (location || resolvedDefault).trim();
    if (!loc) return dataset.vehicles;
    const atBase = dataset.vehicles.filter((v) => (v.homeBase || '').trim() === loc);
    return atBase.length > 0 ? atBase : dataset.vehicles;
  }, [dataset.vehicles, location, resolvedDefault]);

  const openDialog = () => {
    const sede = resolvedDefault;
    setLocation(sede);
    const candidates = dataset.vehicles.filter((v) => (v.homeBase || '').trim() === sede);
    const first = (candidates[0] ?? dataset.vehicles[0])?.id ?? '';
    setVehicleId(first);
    setOdometer(dataset.vehicles.find((v) => v.id === first)?.currentOdometerKm ?? 0);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    if (!vehicleId && vehiclesForSede[0]) {
      setVehicleId(vehiclesForSede[0].id);
      setOdometer(vehiclesForSede[0].currentOdometerKm);
    } else if (vehicleId && !vehiclesForSede.some((v) => v.id === vehicleId) && vehiclesForSede[0]) {
      setVehicleId(vehiclesForSede[0].id);
      setOdometer(vehiclesForSede[0].currentOdometerKm);
    }
  }, [open, vehicleId, vehiclesForSede]);

  const submit = async () => {
    const v = dataset.vehicles.find((x) => x.id === vehicleId);
    if (!v) {
      toast.error('Seleccione vehículo.');
      return;
    }
    const now = new Date().toISOString();
    const row: FleetFuelEntry = {
      id: newId('ff'),
      vehicleId,
      date: dateStr,
      odometerKm: odometer,
      liters,
      totalCost: cost,
      station: station.trim() || undefined,
      location: location.trim() || resolvedDefault,
      createdAt: now,
      fullTank: false,
    };
    const next: FleetDataset = {
      ...dataset,
      fuelEntries: [row, ...dataset.fuelEntries],
      vehicles: dataset.vehicles.map((x) =>
        x.id === v.id ? { ...x, currentOdometerKm: Math.max(x.currentOdometerKm, odometer), updatedAt: now } : x
      ),
    };
    const ok = await applyFleetDatasetChange(setDataset, onPersistDataset, next, 'Repostaje registrado.');
    if (ok) {
      setOpen(false);
      setLiters(0);
      setCost(0);
    }
  };

  const [chartVid, setChartVid] = useState('');
  useEffect(() => {
    if (!chartVid && dataset.vehicles[0]) setChartVid(dataset.vehicles[0].id);
  }, [chartVid, dataset.vehicles]);

  const consumptionPoints = useMemo(() => {
    if (!chartVid) return [];
    const list = [...dataset.fuelEntries].filter((e) => e.vehicleId === chartVid).sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
    const pts: { label: string; l100: number }[] = [];
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1]!;
      const cur = list[i]!;
      const km = cur.odometerKm - prev.odometerKm;
      if (km <= 5) continue;
      const l100 = (cur.liters / km) * 100;
      pts.push({
        label: format(parseISO(cur.date), 'MMM dd', { locale: es }),
        l100: Math.round(l100 * 100) / 100,
      });
    }
    return pts;
  }, [dataset.fuelEntries, chartVid]);

  const consVid = chartVid ? vehicleConsumptionLPer100(dataset, chartVid) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Label className="text-white">Consumo observado:</Label>
          <Select value={chartVid} onValueChange={setChartVid}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {dataset.vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-emerald-200 border-emerald-500/40">
            {consVid != null ? `${consVid.toFixed(1)} L / 100 km` : 'Necesita 2 repostajes consecutivos'}
          </Badge>
        </div>
        <Button onClick={openDialog} className="gap-2 bg-cyan-600 hover:bg-cyan-500">
          <Fuel className="h-4 w-4" />
          Registrar combustible
        </Button>
      </div>

      <div className="h-[260px] rounded-xl border border-white/10 bg-slate-950/80 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={consumptionPoints}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} stroke="#64748b" />
            <XAxis dataKey="label" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis stroke="#64748b" />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(34,211,238,0.25)' }} />
            <Legend />
            <Bar name="L/100km" dataKey="l100" fill="#22d3ee" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ScrollArea className="h-[260px] rounded-xl border border-white/10 bg-slate-950/60">
        <Table>
          <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Placa</TableHead><TableHead>Sede</TableHead><TableHead>L</TableHead><TableHead>Km</TableHead><TableHead className="text-right">S/</TableHead></TableRow></TableHeader>
          <TableBody>
            {[...dataset.fuelEntries].sort((a,b)=>parseISO(b.date).getTime()-parseISO(a.date).getTime()).map((r) => {
              const v = dataset.vehicles.find((x)=>x.id===r.vehicleId);
              const pl = v?.plate ?? '?';
              return (
                <TableRow key={r.id}>
                  <TableCell>{r.date}</TableCell>
                  <TableCell className="font-mono">{pl}</TableCell>
                  <TableCell className="text-slate-400">{r.location || v?.homeBase || '—'}</TableCell>
                  <TableCell>{r.liters}</TableCell>
                  <TableCell>{r.odometerKm.toLocaleString('es-PE')}</TableCell>
                  <TableCell className="text-right">{formatCurrencyEs(r.totalCost)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-slate-950 border-white/15">
          <DialogHeader>
            <DialogTitle>Registrar combustible</DialogTitle>
            <DialogDescription>Actualiza también el último kilometraje del vehículo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <FleetSedeField
              label="Sede / base"
              value={location || resolvedDefault}
              onChange={setLocation}
              visibleSedes={visibleSedes}
              defaultSede={defaultHomeBase}
            />
            <Select
              value={vehicleId}
              onValueChange={(id) => {
                setVehicleId(id);
                const v = dataset.vehicles.find((x) => x.id === id);
                if (v) setOdometer(v.currentOdometerKm);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Vehículo" /></SelectTrigger>
              <SelectContent>
                {vehiclesForSede.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={dateStr} onChange={(e)=>setDateStr(e.target.value)} />
            <Input type="number" placeholder="Odómetro" value={odometer||''} onChange={(e)=>setOdometer(Number(e.target.value))} />
            <Input type="number" placeholder="Litros" value={liters||''} onChange={(e)=>setLiters(Number(e.target.value))} />
            <Input type="number" placeholder="Costo total S/" value={cost||''} onChange={(e)=>setCost(Number(e.target.value))} />
            <Input placeholder="Estación / nota" value={station} onChange={(e)=>setStation(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button>
            <Button onClick={submit}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FleetAlertsSection({ alerts }: { alerts: ReturnType<typeof buildFleetAlerts> }) {
  return (
    <div className="space-y-3">
      {alerts.map((a) => (
        <Card key={a.id} className={`border-l-4 ${
          a.severity === 'critical' ? 'border-l-red-500 bg-red-950/20'
            : a.severity === 'warning' ? 'border-l-amber-500 bg-amber-950/20'
            : 'border-l-blue-400 bg-blue-950/15'
        } border-white/10`}>
          <CardHeader className="py-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-rose-400" />
              <CardTitle className="text-sm font-semibold">{a.title}</CardTitle>
            </div>
            <CardDescription className="text-slate-400 text-xs">{a.detail}</CardDescription>
          </CardHeader>
        </Card>
      ))}
      {alerts.length === 0 && <p className="text-muted-foreground text-sm">Sin alertas recientes 🎉</p>}
    </div>
  );
}

function FleetReportsSection({ dataset }: { dataset: FleetDataset }) {
  const rows = [...dataset.vehicles].sort((a, b) => a.plate.localeCompare(b.plate));
  const nextOil = [...dataset.vehicles].filter((v)=>v.nextOilChangeDate).sort((a,b)=>(a.nextOilChangeDate||'').localeCompare(b.nextOilChangeDate||''));

  return (
    <div className="space-y-8">
      <Card className="border-white/10 bg-slate-950/75">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet />Resumen de kilometraje</CardTitle></CardHeader>
        <CardContent><Table>
          <TableHeader><TableRow><TableHead>Placa</TableHead><TableHead>Últimos km declarados</TableHead><TableHead>Km siguiente servicio</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((v)=>(
              <TableRow key={v.id}>
                <TableCell className="font-mono">{v.plate}</TableCell>
                <TableCell>{v.currentOdometerKm.toLocaleString('es-PE')} km</TableCell>
                <TableCell>{v.nextServiceKm ? `${v.nextServiceKm.toLocaleString('es-PE')} km` : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></CardContent>
      </Card>

      <Card className="border-white/10 bg-slate-950/75">
        <CardHeader><CardTitle className="text-base">Próximos servicios rutina (fecha aceite declarada)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Placa</TableHead><TableHead>Fecha próxima</TableHead></TableRow></TableHeader>
            <TableBody>
              {nextOil.map((v)=>(
                <TableRow key={v.id}><TableCell>{v.plate}</TableCell><TableCell>{v.nextOilChangeDate}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
          {nextOil.length === 0 && <p className="text-muted-foreground text-sm">Sin fechas cargadas · edítelas en cada vehículo.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function FleetExportCsv({ dataset }: { dataset: FleetDataset }) {
  const run = () => {
    const lines: string[] = [];
    lines.push(['Tipo', 'Vehículo', 'Campo', 'Valor'].map(csvEsc).join(','));
    for (const v of dataset.vehicles) {
      lines.push(csvRow(['VEHICULO', v.plate, 'marca', v.brand]));
      lines.push(csvRow(['VEHICULO', v.plate, 'km', String(v.currentOdometerKm)]));
      lines.push(csvRow(['VEHICULO', v.plate, 'estado', v.status]));
    }
    for (const r of dataset.maintenance) {
      const pl = dataset.vehicles.find((x)=>x.id===r.vehicleId)?.plate ?? r.vehicleId;
      lines.push(csvRow(['MANT', pl, 'fecha', r.date]));
      lines.push(csvRow(['MANT', pl, 'tipo', r.kind]));
      lines.push(csvRow(['MANT', pl, 'total', String((r.laborCost||0)+(r.partsCost||0))]));
      lines.push(csvRow(['MANT', pl, 'desc', r.description]));
    }
    for (const r of dataset.fuelEntries) {
      const pl = dataset.vehicles.find((x)=>x.id===r.vehicleId)?.plate ?? r.vehicleId;
      lines.push(csvRow(['COMBUSTIBLE', pl, 'fecha', r.date]));
      lines.push(csvRow(['COMBUSTIBLE', pl, 'litros', String(r.liters)]));
      lines.push(csvRow(['COMBUSTIBLE', pl, 'costo', String(r.totalCost)]));
    }
    for (const ins of dataset.inspections ?? []) {
      const pl = dataset.vehicles.find((x)=>x.id===ins.vehicleId)?.plate ?? ins.vehicleId;
      lines.push(csvRow(['INSPECCION', pl, 'fecha', ins.dateTime]));
      lines.push(csvRow(['INSPECCION', pl, 'cumplimiento_pct', String(ins.compliancePercent)]));
      lines.push(csvRow(['INSPECCION', pl, 'chofer', ins.driverName]));
      lines.push(csvRow(['INSPECCION', pl, 'supervisor', ins.supervisorName || '']));
    }
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fleet_report_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV generado.');
  };
  return <Button variant="secondary" size="sm" className="gap-1" onClick={run}><FileSpreadsheet className="h-3.5 w-3.5" />Export CSV</Button>;
}

function csvEsc(cell: string) {
  const s = cell.replace(/"/g, '""');
  return `"${s}"`;
}
function csvRow(cells: string[]) {
  return cells.map(csvEsc).join(',');
}
