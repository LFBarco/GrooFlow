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
  Wallet,
} from 'lucide-react';

import type {
  BusinessUnit,
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

type TabKey = 'dashboard' | 'centers' | 'units' | 'areas' | 'subareas' | 'positions';

const TIPO_CC: TipoCentroCosto[] = ['DIRECTO', 'COMPARTIDO', 'SEDE', 'CORPORATIVO', 'SOPORTE'];

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
  const [dialogKind, setDialogKind] = useState<TabKey>('centers');
  const [editingId, setEditingId] = useState<number | undefined>();
  const [form, setForm] = useState<Record<string, string>>({});

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

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

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

  const openCreate = (kind: TabKey) => {
    setDialogKind(kind);
    setEditingId(undefined);
    setForm({ estado: 'activo', tipo: 'DIRECTO', tipo_costo: 'DIRECTO', genera_ingreso: 'DIRECTO' });
    setDialogOpen(true);
  };

  const openEdit = (kind: TabKey, row: Record<string, unknown>) => {
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

  const handleDelete = async (kind: TabKey, id: number) => {
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
    dashboard: '',
  }[dialogKind];

  return (
    <div className="space-y-6" data-testid="cost-centers-module">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Centros de Costos</h1>
          <p className="text-sm text-muted-foreground">
            Organización + unidades de negocio + centros de costo (fase catálogos). Los gastos y
            reglas de distribución llegan en las siguientes fases.
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
          <TabsTrigger value="centers">Centros</TabsTrigger>
          <TabsTrigger value="units">Unidades</TabsTrigger>
          <TabsTrigger value="areas">Áreas</TabsTrigger>
          <TabsTrigger value="subareas">Subáreas</TabsTrigger>
          <TabsTrigger value="positions">Cargos</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi title="Centros activos" value={stats?.centros_activos ?? 0} icon={<Wallet className="h-4 w-4" />} />
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
