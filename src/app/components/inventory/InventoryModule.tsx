/**
 * Gestión de inventario — equipos médicos y operativos, dashboard y mantenimientos.
 */
import React, { useMemo, useState } from 'react';
import {
  Package,
  CheckCircle2,
  Wrench,
  TrendingDown,
  AlertTriangle,
  Plus,
  Search,
  ChevronRight,
  Box,
  Clock,
  XCircle,
  Settings2,
  Wand2,
  QrCode,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

import type {
  InventoryDataset,
  InventoryEquipment,
  InventoryEquipmentKind,
  InventoryEquipmentStatus,
  InventoryMaintenanceKind,
  InventoryMaintenanceRecord,
  InventoryMaintenanceStatus,
} from '../../types/inventory';
import type { Provider } from '../../types';
import {
  buildInventoryAlerts,
  categoryDistribution,
  computeInventoryKpis,
  computeUsefulLifePercent,
  createDemoInventoryDataset,
  formatEquipmentLocation,
  findEquipmentFromScan,
  getEquipmentById,
  maintenanceTotalCost,
  monthlyMaintenanceSeries,
  sedeSummary,
  upcomingMaintenance,
} from '../../utils/inventoryData';
import { applyInventoryDatasetChange, type InventoryPersistFn } from '../../utils/inventoryPersist';
import {
  generateEquipmentCode,
  describeCodePattern,
  parseInventoryQrScan,
} from '../../utils/inventoryCodeGenerator';
import {
  getActiveCategories,
  getCategoryLabel,
  getCategoryById,
  getCategoryPrefix,
} from '../../utils/inventoryCategoryConfig';
import { formatCurrencyEs } from '../../utils/numberFormat';
import { EquipmentQrPanel } from './EquipmentQrPanel';
import { InventoryCategoryConfigDialog } from './InventoryCategoryConfigDialog';
import { InventoryQrScannerDialog } from './InventoryQrScannerDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import {
  CategoryBadge,
  EquipmentStatusBadge,
  MaintenanceStatusBadge,
  UsefulLifeBar,
} from './inventoryUiHelpers';

const PIE_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#94a3b8'];

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

function formatCompactCurrency(value: number): string {
  if (value >= 1000) return `S/ ${Math.round(value / 1000)}K`;
  return formatCurrencyEs(value, 0);
}

export interface InventoryModuleProps {
  dataset: InventoryDataset;
  setDataset: React.Dispatch<React.SetStateAction<InventoryDataset>>;
  onPersistDataset?: InventoryPersistFn;
  visibleSedes?: string[];
  defaultSede?: string;
  providers?: Provider[];
}

type InventoryTab = 'dashboard' | 'equipment' | 'maintenance';

export function InventoryModule({
  dataset,
  setDataset,
  onPersistDataset,
  visibleSedes = [],
  defaultSede = 'Principal',
  providers = [],
}: InventoryModuleProps) {
  const [tab, setTab] = useState<InventoryTab>('dashboard');
  const [sedeFilter, setSedeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [maintStatusFilter, setMaintStatusFilter] = useState<string>('all');
  const [maintTypeFilter, setMaintTypeFilter] = useState<string>('all');
  const [equipmentDialog, setEquipmentDialog] = useState<InventoryEquipment | null>(null);
  const [maintDialog, setMaintDialog] = useState<InventoryMaintenanceRecord | null>(null);
  const [isNewEquipment, setIsNewEquipment] = useState(false);
  const [isNewMaint, setIsNewMaint] = useState(false);
  const [categoryConfigOpen, setCategoryConfigOpen] = useState(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);

  const activeCategories = useMemo(() => getActiveCategories(dataset), [dataset]);
  const defaultCategoryId = activeCategories[0]?.id ?? 'otros';

  const kpis = useMemo(() => computeInventoryKpis(dataset), [dataset]);
  const alerts = useMemo(() => buildInventoryAlerts(dataset), [dataset]);
  const maintSeries = useMemo(() => monthlyMaintenanceSeries(dataset, 6), [dataset]);
  const categoryBars = useMemo(() => categoryDistribution(dataset), [dataset]);
  const sedeRows = useMemo(() => sedeSummary(dataset), [dataset]);
  const upcoming = useMemo(() => upcomingMaintenance(dataset, 6), [dataset]);

  const statusPie = useMemo(() => {
    const c = { active: 0, maintenance: 0, critical: 0, inactive: 0 };
    for (const e of dataset.equipment) c[e.status] += 1;
    return [
      { name: 'Activos', value: c.active },
      { name: 'Mantenimiento', value: c.maintenance },
      { name: 'Críticos', value: c.critical },
      { name: 'Inactivos', value: c.inactive },
    ].filter((x) => x.value > 0);
  }, [dataset.equipment]);

  const sedeOptions = visibleSedes.length > 0 ? visibleSedes : [...new Set(dataset.equipment.map((e) => e.sede))];

  const filteredEquipment = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dataset.equipment.filter((e) => {
      if (sedeFilter !== 'all' && e.sede !== sedeFilter) return false;
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        e.code.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        (e.brand || '').toLowerCase().includes(q) ||
        (e.model || '').toLowerCase().includes(q) ||
        (e.serialNumber || '').toLowerCase().includes(q) ||
        (e.floor || '').toLowerCase().includes(q) ||
        (e.room || '').toLowerCase().includes(q)
      );
    });
  }, [dataset.equipment, search, sedeFilter, statusFilter, categoryFilter]);

  const filteredMaintenance = useMemo(() => {
    return dataset.maintenance
      .filter((m) => {
        if (maintStatusFilter !== 'all' && m.status !== maintStatusFilter) return false;
        if (maintTypeFilter !== 'all' && m.kind !== maintTypeFilter) return false;
        if (sedeFilter !== 'all' && m.sede && m.sede !== sedeFilter) return false;
        return true;
      })
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
  }, [dataset.maintenance, maintStatusFilter, maintTypeFilter, sedeFilter]);

  const maintCounts = useMemo(() => {
    const c = { scheduled: 0, in_progress: 0, completed: 0, overdue: 0 };
    for (const m of dataset.maintenance) {
      if (m.status in c) c[m.status as keyof typeof c] += 1;
    }
    return c;
  }, [dataset.maintenance]);

  const persist = async (next: InventoryDataset, msg?: string) =>
    applyInventoryDatasetChange(setDataset, onPersistDataset, next, msg);

  const applyGeneratedCode = (draft: InventoryEquipment): InventoryEquipment => {
    const prefix = getCategoryPrefix(dataset, draft.category);
    const code = generateEquipmentCode({
      categoryPrefix: prefix,
      sede: draft.sede,
      floor: draft.floor,
      room: draft.room,
      existingEquipment: dataset.equipment,
      excludeId: draft.id,
    });
    return { ...draft, code };
  };

  const openNewEquipment = () => {
    const t = new Date().toISOString();
    const cat = getCategoryById(dataset, defaultCategoryId);
    const draft: InventoryEquipment = {
      id: newId('inv-eq'),
      code: '',
      name: '',
      kind: cat?.kind ?? 'medical',
      category: defaultCategoryId,
      status: 'active',
      sede: defaultSede,
      purchaseValue: 0,
      currentValue: 0,
      createdAt: t,
      updatedAt: t,
    };
    setIsNewEquipment(true);
    setEquipmentDialog(applyGeneratedCode(draft));
  };

  const regenerateEquipmentCode = () => {
    if (!equipmentDialog) return;
    setEquipmentDialog(applyGeneratedCode(equipmentDialog));
    toast.success('Código generado.');
  };

  const handleQrScan = (raw: string) => {
    const payload = parseInventoryQrScan(raw);
    if (!payload) {
      toast.error('Código o QR vacío.');
      return;
    }
    const eq = findEquipmentFromScan(dataset, payload);
    if (!eq) {
      const hint = payload.code || payload.id || raw.trim();
      toast.error(`No se encontró equipo: ${hint}`);
      return;
    }
    setQrScannerOpen(false);
    setTab('equipment');
    setIsNewEquipment(false);
    setSearch(eq.code);
    setEquipmentDialog(eq);
    toast.success(`Equipo encontrado: ${eq.name}`);
  };

  const saveEquipment = async () => {
    if (!equipmentDialog) return;
    const code = equipmentDialog.code.trim();
    const name = equipmentDialog.name.trim();
    if (!code || !name) {
      toast.error('Código y nombre son obligatorios.');
      return;
    }
    const t = new Date().toISOString();
    const row: InventoryEquipment = {
      ...equipmentDialog,
      code,
      name,
      updatedAt: t,
      createdAt: equipmentDialog.createdAt || t,
    };
    const next = isNewEquipment
      ? { ...dataset, equipment: [...dataset.equipment, row] }
      : {
          ...dataset,
          equipment: dataset.equipment.map((e) => (e.id === row.id ? row : e)),
        };
    const ok = await persist(next, isNewEquipment ? 'Equipo registrado.' : 'Equipo actualizado.');
    if (ok) {
      setEquipmentDialog(null);
      setIsNewEquipment(false);
    }
  };

  const openNewMaintenance = () => {
    const t = new Date().toISOString();
    setIsNewMaint(true);
    setMaintDialog({
      id: newId('inv-m'),
      equipmentId: dataset.equipment[0]?.id || '',
      kind: 'preventive',
      status: 'scheduled',
      scheduledDate: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      laborCost: 0,
      partsCost: 0,
      parts: [],
      sede: defaultSede,
      createdAt: t,
    });
  };

  const saveMaintenance = async () => {
    if (!maintDialog) return;
    if (!maintDialog.equipmentId || !maintDialog.description.trim()) {
      toast.error('Equipo y descripción son obligatorios.');
      return;
    }
    const eq = getEquipmentById(dataset, maintDialog.equipmentId);
    const row: InventoryMaintenanceRecord = {
      ...maintDialog,
      description: maintDialog.description.trim(),
      sede: maintDialog.sede || eq?.sede,
    };
    const next = isNewMaint
      ? { ...dataset, maintenance: [...dataset.maintenance, row] }
      : {
          ...dataset,
          maintenance: dataset.maintenance.map((m) => (m.id === row.id ? row : m)),
        };
    const ok = await persist(next, isNewMaint ? 'Mantenimiento programado.' : 'Mantenimiento actualizado.');
    if (ok) {
      setMaintDialog(null);
      setIsNewMaint(false);
    }
  };

  const loadDemo = async () => {
    if (!dataset.equipment.length && !confirm('¿Cargar datos de demostración?')) return;
    if (dataset.equipment.length && !confirm('¿Reemplazar con datos demo?')) return;
    await persist(createDemoInventoryDataset(), 'Datos de demostración cargados.');
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-500/25 bg-gradient-to-br from-slate-950/90 via-[#0f172a] to-slate-900/95 p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-sky-500/15 p-2.5 border border-sky-500/30">
            <Package className="h-8 w-8 text-sky-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">Gestión de Inventario</h2>
            <p className="text-sm text-slate-400 max-w-xl">
              Equipos médicos y operativos — dashboard, catálogo y planificación de mantenimientos.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={sedeFilter} onValueChange={setSedeFilter}>
            <SelectTrigger className="w-[200px] bg-slate-900/50 border-slate-700 text-white">
              <SelectValue placeholder="Sedes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las sedes</SelectItem>
              {sedeOptions.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setQrScannerOpen(true)}>
            <QrCode className="h-4 w-4 mr-1" />
            Escanear QR
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCategoryConfigOpen(true)}>
            <Settings2 className="h-4 w-4 mr-1" />
            Categorías
          </Button>
          {dataset.equipment.length === 0 && (
            <Button variant="outline" size="sm" onClick={() => void loadDemo()}>
              Cargar demo
            </Button>
          )}
        </div>
      </div>

      <InventoryCategoryConfigDialog
        open={categoryConfigOpen}
        onOpenChange={setCategoryConfigOpen}
        dataset={dataset}
        onSave={persist}
      />

      <InventoryQrScannerDialog
        open={qrScannerOpen}
        onOpenChange={setQrScannerOpen}
        onScan={handleQrScan}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as InventoryTab)}>
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="dashboard">Panel</TabsTrigger>
          <TabsTrigger value="equipment">Equipos</TabsTrigger>
          <TabsTrigger value="maintenance">Mantenimientos</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold">Panel de Control — Inventario</h3>
              <p className="text-sm text-muted-foreground">
                Resumen general de todos los equipos y activos ·{' '}
                {format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard icon={Box} label="Total Equipos" value={String(kpis.total)} sub={`En ${kpis.sedeCount} sedes activas`} trend="↗ 3% vs mes anterior" trendUp />
            <KpiCard icon={CheckCircle2} label="Operativos" value={String(kpis.active)} sub={`${kpis.operationalPct}% del inventario`} />
            <KpiCard icon={Wrench} label="En Mantenimiento" value={String(kpis.inMaintenance)} sub={`${kpis.overdueMaintenance} vencido · ${kpis.scheduledMaintenance} programados`} />
            <KpiCard icon={TrendingDown} label="Valor Actual" value={formatCompactCurrency(kpis.totalCurrentValue)} sub={`Depreciación: ${formatCompactCurrency(kpis.totalDepreciation)} acumulada`} trend="↘ 8% depreciación anual" trendDown />
          </div>

          {alerts.some((a) => a.severity === 'critical') && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900/50 p-4 flex gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800 dark:text-red-300">Requieren atención inmediata</p>
                <ul className="mt-1 text-sm text-red-700 dark:text-red-400 space-y-0.5">
                  {kpis.critical > 0 && <li>· {kpis.critical} equipo(s) en estado CRÍTICO</li>}
                  {kpis.overdueMaintenance > 0 && <li>· {kpis.overdueMaintenance} mantenimiento(s) VENCIDO(S)</li>}
                </ul>
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Actividad de Mantenimientos</CardTitle>
                <CardDescription>Número de mantenimientos y costos — últimos 6 meses</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={maintSeries}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="count" name="Mantenimientos" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                    <Line yAxisId="right" type="monotone" dataKey="cost" name="Costos (S/)" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estado del Inventario</CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {statusPie.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por Categoría</CardTitle>
                <CardDescription>Equipos por tipo</CardDescription>
              </CardHeader>
              <CardContent className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryBars} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Próximos Mantenimientos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin mantenimientos pendientes.</p>
                ) : (
                  upcoming.map((m) => {
                    const eq = getEquipmentById(dataset, m.equipmentId);
                    return (
                      <div key={m.id} className="flex items-start justify-between gap-2 border-b border-border/60 pb-2 last:border-0">
                        <div>
                          <p className="font-medium text-sm">{eq?.name ?? 'Equipo'}</p>
                          <p className="text-xs text-muted-foreground">{m.scheduledDate} · {m.description.slice(0, 50)}</p>
                        </div>
                        <MaintenanceStatusBadge status={m.status} />
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen por Sede</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sede</TableHead>
                    <TableHead>Equipos</TableHead>
                    <TableHead>Operativos</TableHead>
                    <TableHead className="text-right">Valor actual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sedeRows.map((r) => (
                    <TableRow key={r.sede}>
                      <TableCell className="font-medium">{r.sede}</TableCell>
                      <TableCell>{r.total}</TableCell>
                      <TableCell>{r.active}</TableCell>
                      <TableCell className="text-right">{formatCurrencyEs(r.value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipment" className="space-y-4 mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Equipos Médicos</h3>
              <p className="text-sm text-muted-foreground">{filteredEquipment.length} de {dataset.equipment.length} equipos</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setCategoryConfigOpen(true)}>
                <Settings2 className="h-4 w-4 mr-1" />
                Categorías
              </Button>
              <Button onClick={openNewEquipment}>
                <Plus className="h-4 w-4 mr-1" /> Nuevo Equipo
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por nombre, código, marca, serie…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button variant="outline" onClick={() => setQrScannerOpen(true)} title="Escanear QR">
              <QrCode className="h-4 w-4 mr-1" />
              Escanear
            </Button>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="maintenance">En Mantenimiento</SelectItem>
                <SelectItem value="critical">Crítico</SelectItem>
                <SelectItem value="inactive">Inactivo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {activeCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CÓDIGO</TableHead>
                  <TableHead>EQUIPO</TableHead>
                  <TableHead>SEDE</TableHead>
                  <TableHead>CATEGORÍA</TableHead>
                  <TableHead>ESTADO</TableHead>
                  <TableHead>PRÓX. MANT.</TableHead>
                  <TableHead className="text-right">VALOR ACTUAL</TableHead>
                  <TableHead>VIDA ÚTIL</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEquipment.map((e) => (
                  <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setIsNewEquipment(false); setEquipmentDialog(e); }}>
                    <TableCell className="font-mono text-xs">{e.code}</TableCell>
                    <TableCell>
                      <div className="font-medium">{e.name}</div>
                      <div className="text-xs text-muted-foreground">{e.brand} {e.model}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{e.sede}</div>
                      {(e.floor || e.room) && (
                        <div className="text-xs text-muted-foreground">
                          {e.floor ? `Piso ${e.floor}` : ''}
                          {e.floor && e.room ? ' · ' : ''}
                          {e.room ? `Cons. ${e.room}` : ''}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <CategoryBadge
                        category={e.category}
                        label={getCategoryLabel(dataset, e.category)}
                      />
                    </TableCell>
                    <TableCell><EquipmentStatusBadge status={e.status} /></TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        {e.nextMaintenanceDate || '—'}
                        {e.nextMaintenanceDate && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyEs(e.currentValue)}</TableCell>
                    <TableCell><UsefulLifeBar percent={computeUsefulLifePercent(e)} /></TableCell>
                    <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4 mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Gestión de Mantenimientos</h3>
              <p className="text-sm text-muted-foreground">Planificación, seguimiento e historial</p>
            </div>
            <Button onClick={openNewMaintenance}>
              <Plus className="h-4 w-4 mr-1" /> Programar Mantenimiento
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <MaintCountCard icon={Clock} label="Programados" count={maintCounts.scheduled} color="text-blue-600" />
            <MaintCountCard icon={Wrench} label="En Proceso" count={maintCounts.in_progress} color="text-amber-600" />
            <MaintCountCard icon={CheckCircle2} label="Completados" count={maintCounts.completed} color="text-emerald-600" />
            <MaintCountCard icon={XCircle} label="Vencidos" count={maintCounts.overdue} color="text-red-600" />
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={maintStatusFilter} onValueChange={setMaintStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="scheduled">Programado</SelectItem>
                <SelectItem value="in_progress">En Proceso</SelectItem>
                <SelectItem value="completed">Completado</SelectItem>
                <SelectItem value="overdue">Vencido</SelectItem>
              </SelectContent>
            </Select>
            <Select value={maintTypeFilter} onValueChange={setMaintTypeFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="preventive">Preventivo</SelectItem>
                <SelectItem value="corrective">Correctivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {filteredMaintenance.map((m) => {
              const eq = getEquipmentById(dataset, m.equipmentId);
              return (
                <Card key={m.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => { setIsNewMaint(false); setMaintDialog(m); }}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex gap-3">
                        <div className="rounded-lg bg-muted p-2"><Wrench className="h-5 w-5 text-muted-foreground" /></div>
                        <div>
                          <p className="font-semibold">{eq?.name ?? 'Equipo'}</p>
                          <p className="text-xs text-muted-foreground">{eq?.brand} {eq?.model} — {eq?.code}</p>
                          <p className="text-sm text-muted-foreground mt-1">{m.description}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <BadgeKind kind={m.kind} />
                        <MaintenanceStatusBadge status={m.status} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
                      <Meta label="Fecha" value={m.scheduledDate} />
                      <Meta label="Técnico" value={m.technicianName || '—'} />
                      <Meta label="Empresa" value={m.companyName || '—'} />
                      <Meta label="Costo" value={formatCurrencyEs(maintenanceTotalCost(m))} />
                      <Meta label="Sede" value={m.sede || eq?.sede || '—'} />
                    </div>
                    {m.resultNotes && (
                      <p className="text-xs bg-muted/60 rounded px-3 py-2 text-muted-foreground">{m.resultNotes}</p>
                    )}
                    {m.parts.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {m.parts.map((p, i) => (
                          <span key={i} className="text-xs rounded-full bg-muted px-2 py-0.5">{p.name}</span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={equipmentDialog != null} onOpenChange={(o) => !o && setEquipmentDialog(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNewEquipment ? 'Nuevo equipo' : 'Editar equipo'}</DialogTitle>
          </DialogHeader>
          {equipmentDialog && (
            <div className="grid gap-3 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Código inventario</Label>
                  <div className="flex gap-2">
                    <Input
                      className="font-mono"
                      value={equipmentDialog.code}
                      onChange={(e) =>
                        setEquipmentDialog({ ...equipmentDialog, code: e.target.value.toUpperCase() })
                      }
                    />
                    <Button type="button" variant="outline" size="icon" onClick={regenerateEquipmentCode} title="Generar código">
                      <Wand2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {describeCodePattern(getCategoryPrefix(dataset, equipmentDialog.category))}
                  </p>
                </div>
                <Field label="Nombre" value={equipmentDialog.name} onChange={(v) => setEquipmentDialog({ ...equipmentDialog, name: v })} />
              </div>

              <EquipmentQrPanel equipment={equipmentDialog} visible={equipmentDialog.code.trim().length > 0} />

              <div className="grid grid-cols-2 gap-3">
                <Field label="Marca" value={equipmentDialog.brand || ''} onChange={(v) => setEquipmentDialog({ ...equipmentDialog, brand: v })} />
                <Field label="Modelo" value={equipmentDialog.model || ''} onChange={(v) => setEquipmentDialog({ ...equipmentDialog, model: v })} />
              </div>
              <Select
                value={equipmentDialog.sede}
                onValueChange={(v) => {
                  const next = { ...equipmentDialog, sede: v };
                  setEquipmentDialog(isNewEquipment && !equipmentDialog.code ? applyGeneratedCode(next) : next);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Sede" /></SelectTrigger>
                <SelectContent>
                  {sedeOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Piso"
                  placeholder="Ej. 1, 2, PB"
                  value={equipmentDialog.floor || ''}
                  onChange={(v) => setEquipmentDialog({ ...equipmentDialog, floor: v })}
                />
                <Field
                  label="Consultorio / sala"
                  placeholder="Ej. 03, Cirugía A"
                  value={equipmentDialog.room || ''}
                  onChange={(v) => setEquipmentDialog({ ...equipmentDialog, room: v })}
                />
              </div>
              <p className="text-[10px] text-muted-foreground -mt-1">
                Ubicación: {formatEquipmentLocation(equipmentDialog)}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={equipmentDialog.category}
                  onValueChange={(v) => {
                    const cat = getCategoryById(dataset, v);
                    const next = {
                      ...equipmentDialog,
                      category: v,
                      kind: cat?.kind ?? equipmentDialog.kind,
                    };
                    setEquipmentDialog(isNewEquipment ? applyGeneratedCode(next) : next);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {activeCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label} ({c.codePrefix})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={equipmentDialog.status} onValueChange={(v) => setEquipmentDialog({ ...equipmentDialog, status: v as InventoryEquipmentStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="maintenance">En Mantenimiento</SelectItem>
                    <SelectItem value="critical">Crítico</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select value={equipmentDialog.kind} onValueChange={(v) => setEquipmentDialog({ ...equipmentDialog, kind: v as InventoryEquipmentKind })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medical">Médico</SelectItem>
                    <SelectItem value="operational">Operativo</SelectItem>
                  </SelectContent>
                </Select>
                <Field label="Serie" value={equipmentDialog.serialNumber || ''} onChange={(v) => setEquipmentDialog({ ...equipmentDialog, serialNumber: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Valor compra (S/)" type="number" value={String(equipmentDialog.purchaseValue)} onChange={(v) => setEquipmentDialog({ ...equipmentDialog, purchaseValue: Number(v) || 0 })} />
                <Field label="Valor actual (S/)" type="number" value={String(equipmentDialog.currentValue)} onChange={(v) => setEquipmentDialog({ ...equipmentDialog, currentValue: Number(v) || 0 })} />
              </div>
              <Field label="Próx. mantenimiento" type="date" value={equipmentDialog.nextMaintenanceDate || ''} onChange={(v) => setEquipmentDialog({ ...equipmentDialog, nextMaintenanceDate: v })} />
              {providers.length > 0 && (
                <Select value={equipmentDialog.providerId || 'none'} onValueChange={(v) => {
                  const p = providers.find((x) => x.id === v);
                  setEquipmentDialog({ ...equipmentDialog, providerId: v === 'none' ? undefined : v, providerName: p?.name });
                }}>
                  <SelectTrigger><SelectValue placeholder="Proveedor servicio" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin proveedor</SelectItem>
                    {providers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Textarea placeholder="Notas" value={equipmentDialog.notes || ''} onChange={(e) => setEquipmentDialog({ ...equipmentDialog, notes: e.target.value })} rows={2} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEquipmentDialog(null)}>Cancelar</Button>
            <Button onClick={() => void saveEquipment()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={maintDialog != null} onOpenChange={(o) => !o && setMaintDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isNewMaint ? 'Programar mantenimiento' : 'Editar mantenimiento'}</DialogTitle>
          </DialogHeader>
          {maintDialog && (
            <div className="grid gap-3 py-2">
              <Select value={maintDialog.equipmentId} onValueChange={(v) => setMaintDialog({ ...maintDialog, equipmentId: v })}>
                <SelectTrigger><SelectValue placeholder="Equipo" /></SelectTrigger>
                <SelectContent>
                  {dataset.equipment.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.code} — {e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea placeholder="Descripción del mantenimiento" value={maintDialog.description} onChange={(e) => setMaintDialog({ ...maintDialog, description: e.target.value })} rows={3} />
              <div className="grid grid-cols-2 gap-3">
                <Select value={maintDialog.kind} onValueChange={(v) => setMaintDialog({ ...maintDialog, kind: v as InventoryMaintenanceKind })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventive">Preventivo</SelectItem>
                    <SelectItem value="corrective">Correctivo</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={maintDialog.status} onValueChange={(v) => setMaintDialog({ ...maintDialog, status: v as InventoryMaintenanceStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Programado</SelectItem>
                    <SelectItem value="in_progress">En Proceso</SelectItem>
                    <SelectItem value="completed">Completado</SelectItem>
                    <SelectItem value="overdue">Vencido</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fecha programada" type="date" value={maintDialog.scheduledDate} onChange={(v) => setMaintDialog({ ...maintDialog, scheduledDate: v })} />
                <Field label="Fecha completado" type="date" value={maintDialog.completedDate || ''} onChange={(v) => setMaintDialog({ ...maintDialog, completedDate: v || undefined })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Técnico" value={maintDialog.technicianName || ''} onChange={(v) => setMaintDialog({ ...maintDialog, technicianName: v })} />
                <Field label="Empresa" value={maintDialog.companyName || ''} onChange={(v) => setMaintDialog({ ...maintDialog, companyName: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Costo labor (S/)" type="number" value={String(maintDialog.laborCost)} onChange={(v) => setMaintDialog({ ...maintDialog, laborCost: Number(v) || 0 })} />
                <Field label="Costo repuestos (S/)" type="number" value={String(maintDialog.partsCost)} onChange={(v) => setMaintDialog({ ...maintDialog, partsCost: Number(v) || 0 })} />
              </div>
              <Textarea placeholder="Notas de resultado" value={maintDialog.resultNotes || ''} onChange={(e) => setMaintDialog({ ...maintDialog, resultNotes: e.target.value })} rows={2} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaintDialog(null)}>Cancelar</Button>
            <Button onClick={() => void saveMaintenance()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  trendUp,
  trendDown,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  trend?: string;
  trendUp?: boolean;
  trendDown?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
            {trend && (
              <p className={`text-xs mt-1 ${trendUp ? 'text-emerald-600' : trendDown ? 'text-red-600' : 'text-muted-foreground'}`}>
                {trend}
              </p>
            )}
          </div>
          <div className="rounded-lg bg-muted p-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MaintCountCard({
  icon: Icon,
  label,
  count,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className={`h-8 w-8 ${color}`} />
        <div>
          <p className="text-2xl font-bold">{count}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="font-medium truncate">{value}</p>
    </div>
  );
}

function BadgeKind({ kind }: { kind: InventoryMaintenanceKind }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${kind === 'preventive' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
      {kind === 'preventive' ? 'Preventivo' : 'Correctivo'}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
