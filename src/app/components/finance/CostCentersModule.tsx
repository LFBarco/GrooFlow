import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  Building2,
  Layers,
  Network,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';

import type {
  BusinessUnit,
  CollaboratorAssignmentSummary,
  CollaboratorCostAssignmentLine,
  CostCenter,
  CostCentersDashboardStats,
  OrgArea,
  OrgPosition,
  OrgSubarea,
  TipoCentroCosto,
} from '../../types/costCenters';
import { costCentersApi } from '../../utils/costCentersApi';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

type Props = {
  canEdit?: boolean;
  sedeNames?: string[];
};

type TabKey = 'dashboard' | 'centers' | 'units' | 'areas' | 'subareas' | 'positions' | 'assignments';
type CatalogTab = Exclude<TabKey, 'dashboard' | 'assignments'>;

const TIPO_CC: TipoCentroCosto[] = ['DIRECTO', 'COMPARTIDO', 'SEDE', 'CORPORATIVO', 'SOPORTE'];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function EstadoBadge({ estado }: { estado: string }) {
  const active = estado === 'activo';
  return (
    <Badge variant={active ? 'default' : 'secondary'} className={active ? 'bg-teal-600' : ''}>
      {active ? 'Activo' : 'Inactivo'}
    </Badge>
  );
}

export function CostCentersModule({ canEdit = false, sedeNames = [] }: Props) {
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CostCentersDashboardStats | null>(null);
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [areas, setAreas] = useState<OrgArea[]>([]);
  const [subareas, setSubareas] = useState<OrgSubarea[]>([]);
  const [positions, setPositions] = useState<OrgPosition[]>([]);
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [filterSede, setFilterSede] = useState<string>('__all__');
  const [filterTipo, setFilterTipo] = useState<string>('__all__');
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKind, setDialogKind] = useState<CatalogTab>('centers');
  const [editingId, setEditingId] = useState<number | undefined>();
  const [form, setForm] = useState<Record<string, string>>({});

  // Asignaciones (fase 2)
  const [asigItems, setAsigItems] = useState<CollaboratorAssignmentSummary[]>([]);
  const [asigTotal, setAsigTotal] = useState(0);
  const [asigPage, setAsigPage] = useState(1);
  const [asigSearch, setAsigSearch] = useState('');
  const [asigSearchApplied, setAsigSearchApplied] = useState('');
  const [asigFilter, setAsigFilter] = useState<'all' | 'assigned' | 'pending'>('all');
  const [asigLoading, setAsigLoading] = useState(false);
  const [asigEditorOpen, setAsigEditorOpen] = useState(false);
  const [asigSelected, setAsigSelected] = useState<CollaboratorAssignmentSummary | null>(null);
  const [asigHistory, setAsigHistory] = useState<CollaboratorCostAssignmentLine[]>([]);
  const [asigFechaInicio, setAsigFechaInicio] = useState(todayIso());
  const [asigFechaFin, setAsigFechaFin] = useState('');
  const [asigMotivo, setAsigMotivo] = useState('');
  const [asigLines, setAsigLines] = useState<
    { centro_costo_id: string; porcentaje: string; es_principal: boolean }[]
  >([{ centro_costo_id: '', porcentaje: '100', es_principal: true }]);
  const [asigSaving, setAsigSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, u, a, sub, p, c] = await Promise.all([
        costCentersApi.stats(),
        costCentersApi.listBusinessUnits(true),
        costCentersApi.listAreas(true),
        costCentersApi.listSubareas(true),
        costCentersApi.listPositions(true),
        costCentersApi.listCenters(true),
      ]);
      setStats(s);
      setUnits(u);
      setAreas(a);
      setSubareas(sub);
      setPositions(p);
      setCenters(c);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cargar centros de costos');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAssignments = useCallback(
    async (opts?: { search?: string; page?: number; assignment?: 'all' | 'assigned' | 'pending' }) => {
      setAsigLoading(true);
      try {
        const page = await costCentersApi.listCollaborators({
          page: opts?.page ?? asigPage,
          pageSize: 25,
          search: (opts?.search ?? asigSearchApplied).trim() || undefined,
          assignment: opts?.assignment ?? asigFilter,
        });
        setAsigItems(page.items);
        setAsigTotal(page.total);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo cargar colaboradores');
      } finally {
        setAsigLoading(false);
      }
    },
    [asigPage, asigSearchApplied, asigFilter]
  );

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (tab === 'assignments') void loadAssignments();
  }, [tab, loadAssignments]);

  const filteredCenters = useMemo(() => {
    const q = search.trim().toLowerCase();
    return centers.filter((c) => {
      if (filterSede !== '__all__' && (c.sede_nombre || '') !== filterSede && c.tipo !== 'CORPORATIVO') {
        return false;
      }
      if (filterTipo !== '__all__' && c.tipo !== filterTipo) return false;
      if (!q) return true;
      return [c.codigo, c.nombre, c.sede_nombre, c.unidad_negocio_nombre, c.area_nombre]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q));
    });
  }, [centers, filterSede, filterTipo, search]);

  const activeCenters = useMemo(
    () => centers.filter((c) => c.estado === 'activo'),
    [centers]
  );

  const asigSum = useMemo(
    () =>
      Math.round(
        asigLines.reduce((acc, l) => acc + (Number(l.porcentaje) || 0), 0) * 100
      ) / 100,
    [asigLines]
  );

  const openCreate = (kind: CatalogTab) => {
    setDialogKind(kind);
    setEditingId(undefined);
    setForm({ estado: 'activo', tipo: 'DIRECTO', tipo_costo: 'DIRECTO', genera_ingreso: 'DIRECTO' });
    setDialogOpen(true);
  };

  const openEdit = (kind: CatalogTab, row: Record<string, unknown>) => {
    setDialogKind(kind);
    setEditingId(Number(row.id));
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v == null) continue;
      next[k] = String(v);
    }
    setForm(next);
    setDialogOpen(true);
  };

  const openAssignmentEditor = async (row: CollaboratorAssignmentSummary) => {
    setAsigSelected(row);
    setAsigFechaInicio(todayIso());
    setAsigFechaFin('');
    setAsigMotivo('');
    setAsigEditorOpen(true);
    try {
      const hist = await costCentersApi.listAssignments(row.colaborador_id, false);
      setAsigHistory(hist);
      const vigentes = hist.filter((h) => {
        if (h.estado !== 'activo') return false;
        const today = todayIso();
        if (h.fecha_inicio > today) return false;
        if (h.fecha_fin && h.fecha_fin < today) return false;
        return true;
      });
      if (vigentes.length > 0) {
        setAsigLines(
          vigentes.map((v) => ({
            centro_costo_id: String(v.centro_costo_id),
            porcentaje: String(v.porcentaje),
            es_principal: Boolean(v.es_principal),
          }))
        );
        const fi = vigentes[0]?.fecha_inicio;
        if (fi) setAsigFechaInicio(fi);
      } else {
        setAsigLines([{ centro_costo_id: '', porcentaje: '100', es_principal: true }]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cargar historial');
      setAsigHistory([]);
      setAsigLines([{ centro_costo_id: '', porcentaje: '100', es_principal: true }]);
    }
  };

  const saveAssignment = async () => {
    if (!canEdit || !asigSelected) return;
    if (Math.abs(asigSum - 100) > 0.02) {
      toast.error(`La suma debe ser 100% (actual: ${asigSum}%)`);
      return;
    }
    const lines = asigLines
      .filter((l) => l.centro_costo_id && Number(l.porcentaje) > 0)
      .map((l) => ({
        centro_costo_id: Number(l.centro_costo_id),
        porcentaje: Number(l.porcentaje),
        es_principal: l.es_principal,
      }));
    if (lines.length === 0) {
      toast.error('Agrega al menos una línea con centro y porcentaje');
      return;
    }
    setAsigSaving(true);
    try {
      await costCentersApi.replaceAssignments({
        colaborador_id: asigSelected.colaborador_id,
        fecha_inicio: asigFechaInicio,
        fecha_fin: asigFechaFin || null,
        motivo: asigMotivo || undefined,
        lines,
      });
      toast.success('Asignación guardada (suma 100%)');
      setAsigEditorOpen(false);
      await Promise.all([loadAssignments(), loadAll()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar asignación');
    } finally {
      setAsigSaving(false);
    }
  };

  const handleSave = async () => {
    if (!canEdit) {
      toast.error('Sin permiso de edición');
      return;
    }
    try {
      const payload: Record<string, unknown> = { ...form };
      for (const key of ['area_id', 'subarea_id', 'unidad_negocio_id', 'sort_order']) {
        if (payload[key] === '' || payload[key] === undefined) payload[key] = null;
        else if (payload[key] != null) payload[key] = Number(payload[key]);
      }
      if (dialogKind === 'units') await costCentersApi.saveBusinessUnit(payload, editingId);
      if (dialogKind === 'areas') await costCentersApi.saveArea(payload, editingId);
      if (dialogKind === 'subareas') await costCentersApi.saveSubarea(payload, editingId);
      if (dialogKind === 'positions') await costCentersApi.savePosition(payload, editingId);
      if (dialogKind === 'centers') await costCentersApi.saveCenter(payload, editingId);
      toast.success(editingId ? 'Actualizado' : 'Creado');
      setDialogOpen(false);
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    }
  };

  const handleDelete = async (kind: CatalogTab, id: number) => {
    if (!canEdit) return;
    if (!confirm('¿Desactivar este registro? (no se elimina físicamente)')) return;
    try {
      if (kind === 'units') await costCentersApi.deleteBusinessUnit(id);
      if (kind === 'areas') await costCentersApi.deleteArea(id);
      if (kind === 'subareas') await costCentersApi.deleteSubarea(id);
      if (kind === 'positions') await costCentersApi.deletePosition(id);
      if (kind === 'centers') await costCentersApi.deleteCenter(id);
      toast.success('Desactivado');
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo desactivar');
    }
  };

  const handleSeedSedes = async () => {
    if (!canEdit) return;
    try {
      const { created } = await costCentersApi.seedSedes(sedeNames);
      toast.success(
        created > 0
          ? `Se generaron ${created} centros por sede`
          : 'Los centros por sede ya estaban creados'
      );
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo sembrar centros');
    }
  };

  const dialogTitle = {
    units: 'Unidad de negocio',
    areas: 'Área',
    subareas: 'Subárea',
    positions: 'Cargo',
    centers: 'Centro de costo',
  }[dialogKind];

  const asigPages = Math.max(1, Math.ceil(asigTotal / 25));

  return (
    <div className="space-y-6" data-testid="cost-centers-module">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Centros de Costos</h1>
          <p className="text-sm text-muted-foreground">
            Organización, centros de costo y asignación de colaboradores (fase 2). Gastos y reglas
            de distribución llegan después.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void loadAll()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          {canEdit ? (
            <Button type="button" variant="secondary" onClick={() => void handleSeedSedes()}>
              <Sparkles className="mr-2 h-4 w-4" />
              Generar CC por sedes
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="assignments">Asignaciones</TabsTrigger>
          <TabsTrigger value="centers">Centros</TabsTrigger>
          <TabsTrigger value="units">Unidades</TabsTrigger>
          <TabsTrigger value="areas">Áreas</TabsTrigger>
          <TabsTrigger value="subareas">Subáreas</TabsTrigger>
          <TabsTrigger value="positions">Cargos</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi title="Centros activos" value={stats?.centros_activos ?? 0} icon={<Wallet className="h-4 w-4" />} />
            <Kpi
              title="Colaboradores asignados"
              value={stats?.colaboradores_asignados ?? 0}
              icon={<Users className="h-4 w-4" />}
            />
            <Kpi title="Unidades de negocio" value={stats?.unidades_negocio ?? 0} icon={<Building2 className="h-4 w-4" />} />
            <Kpi title="Áreas" value={stats?.areas ?? 0} icon={<Layers className="h-4 w-4" />} />
            <Kpi title="Cargos" value={stats?.cargos ?? 0} icon={<Network className="h-4 w-4" />} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribución por tipo de centro</CardTitle>
              <CardDescription>
                {stats?.nota || 'KPIs de gasto se habilitan con la fase de distribución.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {Object.entries(stats?.por_tipo ?? {}).map(([tipo, n]) => (
                <Badge key={tipo} variant="outline">
                  {tipo}: {n}
                </Badge>
              ))}
              {!stats || Object.keys(stats.por_tipo || {}).length === 0 ? (
                <span className="text-sm text-muted-foreground">Sin datos aún.</span>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="max-w-xs"
              placeholder="Buscar colaborador…"
              value={asigSearch}
              onChange={(e) => setAsigSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setAsigPage(1);
                  setAsigSearchApplied(asigSearch);
                }
              }}
            />
            <Select
              value={asigFilter}
              onValueChange={(v) => {
                setAsigPage(1);
                setAsigFilter(v as 'all' | 'assigned' | 'pending');
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="assigned">Asignación completa</SelectItem>
                <SelectItem value="pending">Pendientes (&lt;100%)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAsigPage(1);
                setAsigSearchApplied(asigSearch);
                void loadAssignments({ search: asigSearch, page: 1 });
              }}
              disabled={asigLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${asigLoading ? 'animate-spin' : ''}`} />
              Buscar
            </Button>
            <span className="text-sm text-muted-foreground ml-auto">
              {asigTotal} colaboradores · pág. {asigPage}/{asigPages}
            </span>
          </div>
          <DataTable
            columns={['Colaborador', 'Cargo / Área', 'Sede', '% asignado', 'Centro principal', '']}
            rows={asigItems.map((row) => [
              <div key="n">
                <div className="font-medium">{row.nombre}</div>
                <div className="text-xs text-muted-foreground">
                  {row.documento || row.colaborador_id}
                </div>
              </div>,
              <div key="c" className="text-sm">
                <div>{row.cargo || '—'}</div>
                <div className="text-xs text-muted-foreground">{row.area || ''}</div>
              </div>,
              row.sede || '—',
              <div key="p" className="flex items-center gap-2">
                <span className="tabular-nums font-medium">{row.asignado_pct}%</span>
                <Badge variant={row.completo ? 'default' : 'secondary'} className={row.completo ? 'bg-teal-600' : ''}>
                  {row.completo ? 'OK' : `Falta ${row.pendiente_pct}%`}
                </Badge>
              </div>,
              row.centro_principal
                ? `${row.centro_principal.codigo} · ${row.centro_principal.nombre}`
                : '—',
              canEdit ? (
                <Button
                  key="a"
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void openAssignmentEditor(row)}
                >
                  Asignar
                </Button>
              ) : (
                <Button
                  key="a"
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void openAssignmentEditor(row)}
                >
                  Ver
                </Button>
              ),
            ])}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={asigPage <= 1}
              onClick={() => setAsigPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={asigPage >= asigPages}
              onClick={() => setAsigPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="centers" className="space-y-3">
          <Toolbar
            canEdit={canEdit}
            onCreate={() => openCreate('centers')}
            search={search}
            onSearch={setSearch}
            extra={
              <>
                <Select value={filterSede} onValueChange={setFilterSede}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sede" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas las sedes</SelectItem>
                    {sedeNames.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterTipo} onValueChange={setFilterTipo}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos los tipos</SelectItem>
                    {TIPO_CC.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            }
          />
          <DataTable
            columns={['Código', 'Nombre', 'Tipo', 'Sede', 'Unidad', 'Área', 'Estado', '']}
            rows={filteredCenters.map((c) => [
              c.codigo,
              c.nombre,
              c.tipo,
              c.sede_nombre || '—',
              c.unidad_negocio_nombre || '—',
              c.area_nombre || '—',
              <EstadoBadge key="e" estado={c.estado} />,
              canEdit ? (
                <RowActions
                  key="a"
                  onEdit={() => openEdit('centers', c as unknown as Record<string, unknown>)}
                  onDelete={() => void handleDelete('centers', c.id)}
                />
              ) : (
                ''
              ),
            ])}
          />
        </TabsContent>

        <TabsContent value="units" className="space-y-3">
          <Toolbar canEdit={canEdit} onCreate={() => openCreate('units')} />
          <DataTable
            columns={['Código', 'Nombre', 'Genera ingreso', 'Estado', '']}
            rows={units.map((u) => [
              u.codigo,
              u.nombre,
              u.genera_ingreso,
              <EstadoBadge key="e" estado={u.estado} />,
              canEdit ? (
                <RowActions
                  key="a"
                  onEdit={() => openEdit('units', u as unknown as Record<string, unknown>)}
                  onDelete={() => void handleDelete('units', u.id)}
                />
              ) : (
                ''
              ),
            ])}
          />
        </TabsContent>

        <TabsContent value="areas" className="space-y-3">
          <Toolbar canEdit={canEdit} onCreate={() => openCreate('areas')} />
          <DataTable
            columns={['Código', 'Nombre', 'Estado', '']}
            rows={areas.map((a) => [
              a.codigo,
              a.nombre,
              <EstadoBadge key="e" estado={a.estado} />,
              canEdit ? (
                <RowActions
                  key="a"
                  onEdit={() => openEdit('areas', a as unknown as Record<string, unknown>)}
                  onDelete={() => void handleDelete('areas', a.id)}
                />
              ) : (
                ''
              ),
            ])}
          />
        </TabsContent>

        <TabsContent value="subareas" className="space-y-3">
          <Toolbar canEdit={canEdit} onCreate={() => openCreate('subareas')} />
          <DataTable
            columns={['Código', 'Nombre', 'Área', 'Estado', '']}
            rows={subareas.map((s) => [
              s.codigo,
              s.nombre,
              s.area_nombre || '—',
              <EstadoBadge key="e" estado={s.estado} />,
              canEdit ? (
                <RowActions
                  key="a"
                  onEdit={() => openEdit('subareas', s as unknown as Record<string, unknown>)}
                  onDelete={() => void handleDelete('subareas', s.id)}
                />
              ) : (
                ''
              ),
            ])}
          />
        </TabsContent>

        <TabsContent value="positions" className="space-y-3">
          <Toolbar canEdit={canEdit} onCreate={() => openCreate('positions')} />
          <DataTable
            columns={['Cargo', 'Área', 'Subárea', 'Tipo costo', 'Genera ingreso', 'Estado', '']}
            rows={positions.map((p) => [
              p.nombre,
              p.area_nombre || '—',
              p.subarea_nombre || '—',
              p.tipo_costo,
              p.genera_ingreso,
              <EstadoBadge key="e" estado={p.estado} />,
              canEdit ? (
                <RowActions
                  key="a"
                  onEdit={() => openEdit('positions', p as unknown as Record<string, unknown>)}
                  onDelete={() => void handleDelete('positions', p.id)}
                />
              ) : (
                ''
              ),
            ])}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar' : 'Nuevo'} {dialogTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {(dialogKind === 'units' ||
              dialogKind === 'areas' ||
              dialogKind === 'subareas' ||
              dialogKind === 'centers') && (
              <Field
                label="Código"
                value={form.codigo || ''}
                onChange={(v) => setForm((f) => ({ ...f, codigo: v.toUpperCase() }))}
              />
            )}
            <Field
              label="Nombre"
              value={form.nombre || ''}
              onChange={(v) => setForm((f) => ({ ...f, nombre: v }))}
            />
            {dialogKind === 'subareas' || dialogKind === 'positions' || dialogKind === 'centers' ? (
              <div className="space-y-1.5">
                <Label>Área</Label>
                <Select
                  value={form.area_id || ''}
                  onValueChange={(v) => setForm((f) => ({ ...f, area_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar área" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {dialogKind === 'positions' || dialogKind === 'centers' ? (
              <div className="space-y-1.5">
                <Label>Subárea</Label>
                <Select
                  value={form.subarea_id || '__none__'}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, subarea_id: v === '__none__' ? '' : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {subareas
                      .filter((s) => !form.area_id || String(s.area_id) === form.area_id)
                      .map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.nombre}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {dialogKind === 'units' || dialogKind === 'positions' ? (
              <div className="space-y-1.5">
                <Label>Genera ingreso</Label>
                <Select
                  value={form.genera_ingreso || 'NO'}
                  onValueChange={(v) => setForm((f) => ({ ...f, genera_ingreso: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['DIRECTO', 'INDIRECTO', 'NO'].map((x) => (
                      <SelectItem key={x} value={x}>
                        {x}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {dialogKind === 'positions' ? (
              <div className="space-y-1.5">
                <Label>Tipo de costo</Label>
                <Select
                  value={form.tipo_costo || 'DIRECTO'}
                  onValueChange={(v) => setForm((f) => ({ ...f, tipo_costo: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['DIRECTO', 'COMPARTIDO', 'CORPORATIVO', 'SOPORTE'].map((x) => (
                      <SelectItem key={x} value={x}>
                        {x}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {dialogKind === 'centers' ? (
              <>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select
                    value={form.tipo || 'DIRECTO'}
                    onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPO_CC.map((x) => (
                        <SelectItem key={x} value={x}>
                          {x}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Sede</Label>
                  <Select
                    value={form.sede_nombre || '__none__'}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        sede_nombre: v === '__none__' ? '' : v,
                        sede_key: v === '__none__' ? '' : v.toLowerCase(),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sede (opcional si corporativo)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Corporativo / sin sede</SelectItem>
                      {sedeNames.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Unidad de negocio</Label>
                  <Select
                    value={form.unidad_negocio_id || '__none__'}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        unidad_negocio_id: v === '__none__' ? '' : v,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {units.map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select
                value={form.estado || 'activo'}
                onValueChange={(v) => setForm((f) => ({ ...f, estado: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Field
              label="Descripción"
              value={form.descripcion || ''}
              onChange={(v) => setForm((f) => ({ ...f, descripcion: v }))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={!canEdit}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={asigEditorOpen} onOpenChange={setAsigEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Asignación de costos
              {asigSelected ? ` · ${asigSelected.nombre}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              La suma de porcentajes debe ser exactamente 100%. Al guardar se cierra el set vigente
              anterior (histórico soft) y se crea el nuevo con vigencia.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Fecha inicio</Label>
                <Input
                  type="date"
                  value={asigFechaInicio}
                  onChange={(e) => setAsigFechaInicio(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha fin (opcional)</Label>
                <Input
                  type="date"
                  value={asigFechaFin}
                  onChange={(e) => setAsigFechaFin(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
            </div>
            <Field
              label="Motivo / nota"
              value={asigMotivo}
              onChange={setAsigMotivo}
            />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Distribución</Label>
                <span
                  className={`text-sm tabular-nums font-medium ${
                    Math.abs(asigSum - 100) < 0.02 ? 'text-teal-700' : 'text-amber-700'
                  }`}
                >
                  Suma: {asigSum}%
                </span>
              </div>
              {asigLines.map((line, idx) => (
                <div key={idx} className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-2">
                  <div className="min-w-[200px] flex-1 space-y-1">
                    <Label className="text-xs">Centro de costo</Label>
                    <Select
                      value={line.centro_costo_id || '__none__'}
                      onValueChange={(v) =>
                        setAsigLines((rows) =>
                          rows.map((r, i) =>
                            i === idx ? { ...r, centro_costo_id: v === '__none__' ? '' : v } : r
                          )
                        )
                      }
                      disabled={!canEdit}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {activeCenters.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.codigo} · {c.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-xs">%</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={line.porcentaje}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setAsigLines((rows) =>
                          rows.map((r, i) => (i === idx ? { ...r, porcentaje: e.target.value } : r))
                        )
                      }
                    />
                  </div>
                  <label className="flex items-center gap-1.5 text-xs pb-2">
                    <input
                      type="checkbox"
                      checked={line.es_principal}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setAsigLines((rows) =>
                          rows.map((r, i) => ({
                            ...r,
                            es_principal: i === idx ? e.target.checked : e.target.checked ? false : r.es_principal,
                          }))
                        )
                      }
                    />
                    Principal
                  </label>
                  {canEdit && asigLines.length > 1 ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setAsigLines((rows) => rows.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4 text-rose-500" />
                    </Button>
                  ) : null}
                </div>
              ))}
              {canEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setAsigLines((rows) => [
                      ...rows,
                      { centro_costo_id: '', porcentaje: '0', es_principal: false },
                    ])
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Línea
                </Button>
              ) : null}
            </div>
            {asigHistory.length > 0 ? (
              <div className="space-y-2">
                <Label>Historial</Label>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border text-xs">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Centro</TableHead>
                        <TableHead>%</TableHead>
                        <TableHead>Vigencia</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {asigHistory.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell>
                            {h.centro_codigo || h.centro_costo_id} {h.centro_nombre || ''}
                          </TableCell>
                          <TableCell className="tabular-nums">{h.porcentaje}%</TableCell>
                          <TableCell>
                            {h.fecha_inicio}
                            {h.fecha_fin ? ` → ${h.fecha_fin}` : ' → abierto'}
                          </TableCell>
                          <TableCell>
                            <EstadoBadge estado={h.estado} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAsigEditorOpen(false)}>
              Cerrar
            </Button>
            {canEdit ? (
              <Button
                type="button"
                onClick={() => void saveAssignment()}
                disabled={asigSaving || Math.abs(asigSum - 100) > 0.02}
              >
                {asigSaving ? 'Guardando…' : 'Guardar set (100%)'}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function Toolbar({
  canEdit,
  onCreate,
  search,
  onSearch,
  extra,
}: {
  canEdit: boolean;
  onCreate: () => void;
  search?: string;
  onSearch?: (v: string) => void;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {onSearch ? (
        <Input
          className="max-w-xs"
          placeholder="Buscar…"
          value={search || ''}
          onChange={(e) => onSearch(e.target.value)}
        />
      ) : null}
      {extra}
      {canEdit ? (
        <Button type="button" className="ml-auto" onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo
        </Button>
      ) : null}
    </div>
  );
}

function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="rounded-xl border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c || 'actions'}>{c}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-muted-foreground">
                Sin registros.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, i) => (
              <TableRow key={i}>
                {row.map((cell, j) => (
                  <TableCell key={j}>{cell}</TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex gap-1 justify-end">
      <Button type="button" size="sm" variant="ghost" onClick={onEdit}>
        Editar
      </Button>
      <Button type="button" size="icon" variant="ghost" onClick={onDelete} title="Desactivar">
        <Trash2 className="h-4 w-4 text-rose-500" />
      </Button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
