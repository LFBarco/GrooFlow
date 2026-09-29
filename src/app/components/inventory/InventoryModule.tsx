/**
 * Gestión de inventario — equipos médicos y operativos, dashboard y mantenimientos.
 */
import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
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
  QrCode,
  Trash2,
  FileSpreadsheet,
  Printer,
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
import { addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { ChartEmptyState, seriesHasValues } from '../ui/ChartEmptyState';

import type {
  InventoryDataset,
  InventoryEquipment,
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
  applyEquipmentMaintenanceSync,
  equipmentMaintenanceWasSynced,
  findEquipmentFromScan,
  getEquipmentById,
  maintenanceTotalCost,
  monthlyMaintenanceSeries,
  sedeSummary,
  upcomingMaintenance,
  clearConsignmentFields,
  isEquipmentConsignment,
} from '../../utils/inventoryData';
import { applyInventoryDatasetChange, type InventoryPersistFn } from '../../utils/inventoryPersist';
import { generateEquipmentCode, parseInventoryQrScan } from '../../utils/inventoryCodeGenerator';
import {
  getActiveCategories,
  getCategoryLabel,
  getCategoryById,
  getCategoryPrefix,
} from '../../utils/inventoryCategoryConfig';
import { EquipmentFormDialog } from './EquipmentFormDialog';
import { formatCurrencyEs } from '../../utils/numberFormat';
import { InventoryCategoryConfigDialog } from './InventoryCategoryConfigDialog';
import { InventoryQrScannerDialog } from './InventoryQrScannerDialog';
import { InventoryLabelPrintDialog } from './InventoryLabelPrintDialog';
import { Checkbox } from '../ui/checkbox';
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
import { appConfirm } from '../ui/app-dialog';
import {
  CategoryBadge,
  ConsignmentBadge,
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

import { TableSkeletonRows } from '../ui/table-skeleton';

export interface InventoryModuleProps {
  dataset: InventoryDataset;
  setDataset: React.Dispatch<React.SetStateAction<InventoryDataset>>;
  onPersistDataset?: InventoryPersistFn;
  visibleSedes?: string[];
  defaultSede?: string;
  providers?: Provider[];
  isLoading?: boolean;
  /** Sin permiso de escritura: consulta, escaneo e impresión de etiquetas. */
  canEdit?: boolean;
}

type InventoryTab = 'dashboard' | 'equipment' | 'maintenance';

export function InventoryModule({
  dataset,
  setDataset,
  onPersistDataset,
  visibleSedes = [],
  defaultSede = 'Principal',
  providers = [],
  isLoading = false,
  canEdit = true,
}: InventoryModuleProps) {
  const [tab, setTab] = useState<InventoryTab>('dashboard');
  const [sedeFilter, setSedeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [consignmentFilter, setConsignmentFilter] = useState<'all' | 'consignment' | 'owned'>('all');
  const [maintStatusFilter, setMaintStatusFilter] = useState<string>('all');
  const [maintTypeFilter, setMaintTypeFilter] = useState<string>('all');
  const [equipmentDialog, setEquipmentDialog] = useState<InventoryEquipment | null>(null);
  const [maintDialog, setMaintDialog] = useState<InventoryMaintenanceRecord | null>(null);
  const [isNewEquipment, setIsNewEquipment] = useState(false);
  const [isNewMaint, setIsNewMaint] = useState(false);
  const [categoryConfigOpen, setCategoryConfigOpen] = useState(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);

  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const activeCategories = useMemo(() => getActiveCategories(dataset), [dataset]);
  const defaultCategoryId = activeCategories[0]?.id ?? 'otros';

  const today = format(new Date(), 'yyyy-MM-dd');
  const in30Days = format(addDays(new Date(), 30), 'yyyy-MM-dd');
  /** Vista por sede; un mantenimiento programado con fecha pasada se muestra como vencido. */
  const viewDataset = useMemo<InventoryDataset>(() => {
    const maintenance = dataset.maintenance.map((m) =>
      m.status === 'scheduled' && m.scheduledDate && m.scheduledDate < today
        ? { ...m, status: 'overdue' as InventoryMaintenanceStatus }
        : m
    );
    if (sedeFilter === 'all') return { ...dataset, maintenance };
    const equipment = dataset.equipment.filter((e) => e.sede === sedeFilter);
    const ids = new Set(equipment.map((e) => e.id));
    return { ...dataset, equipment, maintenance: maintenance.filter((m) => ids.has(m.equipmentId)) };
  }, [dataset, sedeFilter, today]);

  const kpis = useMemo(() => computeInventoryKpis(viewDataset), [viewDataset]);
  const alerts = useMemo(() => buildInventoryAlerts(viewDataset), [viewDataset]);
  const maintSeries = useMemo(() => monthlyMaintenanceSeries(viewDataset, 6), [viewDataset]);
  const categoryBars = useMemo(() => categoryDistribution(viewDataset), [viewDataset]);
  const sedeRows = useMemo(() => sedeSummary(viewDataset), [viewDataset]);
  const upcoming = useMemo(() => upcomingMaintenance(viewDataset, 6), [viewDataset]);

  const statusPie = useMemo(() => {
    const c = { active: 0, maintenance: 0, critical: 0, inactive: 0 };
    for (const e of viewDataset.equipment) c[e.status] += 1;
    return [
      { name: 'Activos', value: c.active },
      { name: 'Mantenimiento', value: c.maintenance },
      { name: 'Críticos', value: c.critical },
      { name: 'Inactivos', value: c.inactive },
    ].filter((x) => x.value > 0);
  }, [viewDataset.equipment]);

  const sedeOptions = visibleSedes.length > 0 ? visibleSedes : [...new Set(dataset.equipment.map((e) => e.sede))];

  const filteredEquipment = useMemo(() => {
    const q = search.trim().toLowerCase();
    return viewDataset.equipment.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (consignmentFilter === 'consignment' && !isEquipmentConsignment(e)) return false;
      if (consignmentFilter === 'owned' && isEquipmentConsignment(e)) return false;
      if (!q) return true;
      return (
        e.code.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        (e.brand || '').toLowerCase().includes(q) ||
        (e.model || '').toLowerCase().includes(q) ||
        (e.serialNumber || '').toLowerCase().includes(q) ||
        (e.floor || '').toLowerCase().includes(q) ||
        (e.room || '').toLowerCase().includes(q) ||
        (e.consignorName || '').toLowerCase().includes(q) ||
        (e.consignmentAgreementRef || '').toLowerCase().includes(q)
      );
    });
  }, [viewDataset.equipment, search, statusFilter, categoryFilter, consignmentFilter]);

  const filteredMaintenance = useMemo(() => {
    return viewDataset.maintenance
      .filter((m) => {
        if (maintStatusFilter !== 'all' && m.status !== maintStatusFilter) return false;
        if (maintTypeFilter !== 'all' && m.kind !== maintTypeFilter) return false;
        return true;
      })
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
  }, [viewDataset.maintenance, maintStatusFilter, maintTypeFilter]);

  const maintCounts = useMemo(() => {
    const c = { scheduled: 0, in_progress: 0, completed: 0, overdue: 0 };
    for (const m of viewDataset.maintenance) {
      if (m.status in c) c[m.status as keyof typeof c] += 1;
    }
    return c;
  }, [viewDataset.maintenance]);

  const selectedEquipment = useMemo(
    () => dataset.equipment.filter((e) => selectedIds.has(e.id)),
    [dataset.equipment, selectedIds]
  );
  const allFilteredSelected =
    filteredEquipment.length > 0 && filteredEquipment.every((e) => selectedIds.has(e.id));
  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAllFiltered = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filteredEquipment.forEach((e) => next.delete(e.id));
      else filteredEquipment.forEach((e) => next.add(e.id));
      return next;
    });

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
      isConsignment: false,
      createdAt: t,
      updatedAt: t,
    };
    setIsNewEquipment(true);
    setEquipmentDialog(applyGeneratedCode(draft));
  };

  const exportEquipmentExcel = () => {
    if (filteredEquipment.length === 0) {
      toast.error('No hay equipos para exportar.');
      return;
    }
    const headers = [
      'Código',
      'Nombre equipo',
      'Categoría',
      'Estado',
      'Sede',
      'Piso',
      'Ambiente',
      'Marca',
      'Modelo',
      'N° Serie',
      'Valor Compra',
      'Valor Actual',
      'Consignación',
      'Proveedor',
    ];
    const rows = filteredEquipment.map((eq) => {
      const cat = getCategoryById(dataset, eq.category);
      return [
        eq.code,
        eq.name,
        cat?.label ?? eq.category,
        eq.status === 'active' ? 'Activo' : eq.status === 'maintenance' ? 'Mantenimiento' : eq.status === 'critical' ? 'Crítico' : 'Inactivo',
        eq.sede,
        eq.floor ?? '',
        eq.room ?? '',
        eq.brand ?? '',
        eq.model ?? '',
        eq.serialNumber ?? '',
        eq.purchaseValue ?? 0,
        eq.currentValue ?? 0,
        eq.isConsignment ? 'Sí' : 'No',
        eq.supplierName ?? '',
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipos');
    XLSX.writeFile(wb, `inventario_equipos_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Inventario exportado (${filteredEquipment.length} equipos)`);
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
    const duplicate = dataset.equipment.find(
      (e) => e.id !== equipmentDialog.id && e.code.trim().toUpperCase() === code.toUpperCase()
    );
    if (duplicate) {
      toast.error(`El código ${code} ya lo usa "${duplicate.name}". Regenera el código o usa otro.`);
      return;
    }
    if (equipmentDialog.isConsignment) {
      const hasConsignor =
        Boolean(equipmentDialog.consignorProviderId?.trim()) ||
        Boolean(equipmentDialog.consignorName?.trim());
      if (!hasConsignor) {
        toast.error('Indique el consignante (proveedor o nombre).');
        return;
      }
    }
    const t = new Date().toISOString();
    const baseRow: InventoryEquipment = equipmentDialog.isConsignment
      ? equipmentDialog
      : clearConsignmentFields(equipmentDialog);
    const row: InventoryEquipment = {
      ...baseRow,
      code,
      name,
      updatedAt: t,
      createdAt: equipmentDialog.createdAt || t,
    };
    const nextBase = isNewEquipment
      ? { ...dataset, equipment: [...dataset.equipment, row] }
      : {
          ...dataset,
          equipment: dataset.equipment.map((e) => (e.id === row.id ? row : e)),
        };
    const next = applyEquipmentMaintenanceSync(nextBase, row);
    const maintSynced = equipmentMaintenanceWasSynced(dataset, next, row.id);
    const ok = await persist(
      next,
      isNewEquipment
        ? maintSynced
          ? 'Equipo registrado. Mantenimiento programado en el calendario.'
          : 'Equipo registrado.'
        : maintSynced
          ? 'Equipo actualizado. Mantenimiento sincronizado en Mantenimientos.'
          : 'Equipo actualizado.'
    );
    if (ok) {
      setEquipmentDialog(null);
      setIsNewEquipment(false);
    }
  };

  const deleteEquipment = async (target: InventoryEquipment) => {
    const maintCount = dataset.maintenance.filter((m) => m.equipmentId === target.id).length;
    const msg =
      maintCount > 0
        ? `¿Eliminar "${target.name}" (${target.code})? También se quitarán ${maintCount} mantenimiento(s) vinculado(s). Esta acción no se puede deshacer.`
        : `¿Eliminar "${target.name}" (${target.code})? Esta acción no se puede deshacer.`;
    if (!await appConfirm(msg)) return;

    const next: InventoryDataset = {
      ...dataset,
      equipment: dataset.equipment.filter((e) => e.id !== target.id),
      maintenance: dataset.maintenance.filter((m) => m.equipmentId !== target.id),
    };
    const ok = await persist(next, 'Equipo eliminado.');
    if (ok) {
      if (equipmentDialog?.id === target.id) {
        setEquipmentDialog(null);
        setIsNewEquipment(false);
      }
    }
  };

  const openNewMaintenance = () => {
    const t = new Date().toISOString();
    setIsNewMaint(true);
    setMaintDialog({
      id: newId('inv-m'),
      equipmentId: viewDataset.equipment[0]?.id || '',
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

  return (
    <div className="space-y-4 animate-in fade-in duration-150 -mt-2" data-testid="inventory-module">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-500/30 bg-card p-3 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-sky-500/15 p-2.5 border border-sky-500/30">
            <Package className="h-8 w-8 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Gestión de Inventario</h2>
            <p className="text-sm text-muted-foreground max-w-xl">
              Equipos médicos y operativos — dashboard, catálogo y planificación de mantenimientos.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={sedeFilter} onValueChange={setSedeFilter}>
            <SelectTrigger className="w-[200px] bg-background border-border text-foreground">
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
            Escanear código
          </Button>
        </div>
      </div>

      {!canEdit && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Modo consulta: puedes ver, escanear e imprimir etiquetas. Para registrar o editar equipos se requiere permiso de edición en Gestión de Inventario.
        </p>
      )}

      <InventoryLabelPrintDialog
        open={labelDialogOpen}
        onOpenChange={setLabelDialogOpen}
        equipment={selectedEquipment.length > 0 ? selectedEquipment : filteredEquipment}
        scopeLabel={selectedEquipment.length > 0 ? 'seleccionados' : 'del filtro actual'}
      />

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
          <TabsTrigger value="equipment" data-testid="inventory-tab-equipment">Equipos</TabsTrigger>
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
            <KpiCard icon={Box} label="Total Equipos" value={String(kpis.total)} sub={`En ${kpis.sedeCount} sedes activas`} />
            <KpiCard icon={CheckCircle2} label="Operativos" value={String(kpis.active)} sub={`${kpis.operationalPct}% del inventario`} />
            <KpiCard icon={Wrench} label="En Mantenimiento" value={String(kpis.inMaintenance)} sub={`${kpis.overdueMaintenance} vencido · ${kpis.scheduledMaintenance} programados`} />
            <KpiCard
              icon={TrendingDown}
              label="Valor Actual"
              value={formatCompactCurrency(kpis.ownedCurrentValue)}
              sub={
                kpis.consignmentCount > 0
                  ? `${kpis.consignmentCount} en consignación · Deprec. ${formatCompactCurrency(kpis.totalDepreciation)}`
                  : `Depreciación: ${formatCompactCurrency(kpis.totalDepreciation)} acumulada`
              }
            />
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
                {!seriesHasValues(maintSeries as unknown as Array<Record<string, unknown>>, ['count', 'cost']) ? (
                  <ChartEmptyState message="Sin mantenimientos en los últimos 6 meses." />
                ) : (
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
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estado del Inventario</CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                {statusPie.length === 0 || !seriesHasValues(statusPie as unknown as Array<Record<string, unknown>>, ['value']) ? (
                  <ChartEmptyState message="Sin equipos registrados." />
                ) : (
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
                )}
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
                {categoryBars.length === 0 ? (
                  <ChartEmptyState message="Sin categorías con equipos." />
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryBars} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                )}
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
              <p className="text-sm text-muted-foreground">
                {filteredEquipment.length} de {viewDataset.equipment.length} equipos
                {selectedIds.size > 0 && (
                  <>
                    {' · '}
                    <span className="font-medium text-foreground">{selectedIds.size} seleccionado(s)</span>{' '}
                    <button type="button" className="underline underline-offset-2" onClick={() => setSelectedIds(new Set())}>
                      quitar selección
                    </button>
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setLabelDialogOpen(true)} disabled={filteredEquipment.length === 0 && selectedIds.size === 0}>
                <Printer className="h-4 w-4 mr-1" />
                {selectedIds.size > 0 ? `Imprimir etiquetas (${selectedIds.size})` : 'Imprimir etiquetas'}
              </Button>
              <Button variant="outline" onClick={exportEquipmentExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar Excel
              </Button>
              {canEdit && (
                <>
                  <Button variant="outline" onClick={() => setCategoryConfigOpen(true)}>
                    <Settings2 className="h-4 w-4 mr-1" />
                    Categorías
                  </Button>
                  <Button onClick={openNewEquipment} data-testid="inventory-add-equipment">
                    <Plus className="h-4 w-4 mr-1" /> Nuevo Equipo
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por nombre, código, marca, serie…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button variant="outline" onClick={() => setQrScannerOpen(true)} title="Escanear QR o código de barras">
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
            <Select value={consignmentFilter} onValueChange={(v) => setConsignmentFilter(v as typeof consignmentFilter)}>
              <SelectTrigger className="w-[170px]"><SelectValue placeholder="Titularidad" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="owned">Propios</SelectItem>
                <SelectItem value="consignment">Consignación</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleAllFiltered}
                      aria-label="Seleccionar todos para imprimir"
                    />
                  </TableHead>
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
                {isLoading ? (
                  <TableSkeletonRows columnsCount={10} rowsCount={5} />
                ) : filteredEquipment.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      No hay equipos registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEquipment.map((e) => (
                    <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setIsNewEquipment(false); setEquipmentDialog(e); }}>
                      <TableCell onClick={(ev) => ev.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(e.id)}
                          onCheckedChange={() => toggleSelected(e.id)}
                          aria-label={`Seleccionar ${e.code}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{e.code}</TableCell>
                      <TableCell>
                        <div className="font-medium">{e.name}</div>
                        <div className="text-xs text-muted-foreground">{e.brand} {e.model}</div>
                        {isEquipmentConsignment(e) ? (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <ConsignmentBadge status={e.consignmentStatus ?? 'active'} compact />
                            {e.consignorName ? (
                              <span className="text-xs text-muted-foreground">· {e.consignorName}</span>
                            ) : null}
                          </div>
                        ) : null}
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
                          {e.nextMaintenanceDate && e.nextMaintenanceDate < today && (
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500" aria-label="Vencido" />
                          )}
                          {e.nextMaintenanceDate && e.nextMaintenanceDate >= today && e.nextMaintenanceDate <= in30Days && (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-label="Próximo" />
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrencyEs(e.currentValue)}</TableCell>
                      <TableCell><UsefulLifeBar percent={computeUsefulLifePercent(e)} /></TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-600"
                            title="Eliminar equipo"
                            aria-label={`Eliminar ${e.name}`}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              void deleteEquipment(e);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
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
            {canEdit && (
              <Button onClick={openNewMaintenance} disabled={viewDataset.equipment.length === 0}>
                <Plus className="h-4 w-4 mr-1" /> Programar Mantenimiento
              </Button>
            )}
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
            {filteredMaintenance.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  No hay mantenimientos con los filtros actuales.
                </CardContent>
              </Card>
            )}
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

      <EquipmentFormDialog
        equipment={equipmentDialog}
        isNew={isNewEquipment}
        dataset={dataset}
        sedeOptions={sedeOptions}
        providers={providers}
        activeCategories={activeCategories}
        onOpenChange={(open) => !open && setEquipmentDialog(null)}
        onChange={setEquipmentDialog}
        onRegenerateCode={regenerateEquipmentCode}
        onSave={() => void saveEquipment()}
        onDelete={!isNewEquipment && equipmentDialog ? () => void deleteEquipment(equipmentDialog) : undefined}
        applyGeneratedCode={applyGeneratedCode}
        canEdit={canEdit}
      />

      <Dialog open={maintDialog != null} onOpenChange={(o) => !o && setMaintDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isNewMaint ? 'Programar mantenimiento' : canEdit ? 'Editar mantenimiento' : 'Detalle de mantenimiento'}</DialogTitle>
          </DialogHeader>
          {maintDialog && (
            <fieldset disabled={!canEdit} className="m-0 grid gap-3 border-0 p-0 py-2">
              <Select value={maintDialog.equipmentId} onValueChange={(v) => setMaintDialog({ ...maintDialog, equipmentId: v })}>
                <SelectTrigger><SelectValue placeholder="Equipo" /></SelectTrigger>
                <SelectContent>
                  {[...viewDataset.equipment].sort((a, b) => a.code.localeCompare(b.code)).map((e) => (
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
            </fieldset>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaintDialog(null)}>{canEdit ? 'Cancelar' : 'Cerrar'}</Button>
            {canEdit && <Button onClick={() => void saveMaintenance()}>Guardar</Button>}
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
