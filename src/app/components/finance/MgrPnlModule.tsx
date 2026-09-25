import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react';

import type { ChartOfAccountEntry } from '../../types';
import type {
  MgrCuentaMapping,
  MgrDashboardStats,
  MgrDriver,
  MgrNaturaleza,
  MgrPnlLinea,
  MgrPnlStatement,
  MgrQaReport,
  MgrSharedDist,
  MgrTipoCosto,
} from '../../types/mgrPnl';
import type { CostCenter, OrgArea } from '../../types/costCenters';
import { mgrPnlApi } from '../../utils/mgrPnlApi';
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
  chartOfAccounts?: ChartOfAccountEntry[];
};

type TabKey = 'dashboard' | 'structure' | 'mappings' | 'classify' | 'shared' | 'statement' | 'qa';

export function MgrPnlModule({ canEdit = false, chartOfAccounts = [] }: Props) {
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MgrDashboardStats | null>(null);
  const [nats, setNats] = useState<MgrNaturaleza[]>([]);
  const [structure, setStructure] = useState<MgrPnlLinea[]>([]);
  const [drivers, setDrivers] = useState<MgrDriver[]>([]);
  const [mappings, setMappings] = useState<MgrCuentaMapping[]>([]);
  const [areas, setAreas] = useState<OrgArea[]>([]);
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [shared, setShared] = useState<MgrSharedDist[]>([]);
  const [statement, setStatement] = useState<MgrPnlStatement | null>(null);
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
  const [qa, setQa] = useState<MgrQaReport | null>(null);

  const [mapOpen, setMapOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | undefined>();
  const [form, setForm] = useState<Record<string, string>>({
    cuenta_codigo: '',
    cuenta_nombre: '',
    naturaleza_codigo: '',
    pnl_codigo: '',
    area_id: '',
    centro_costo_id: '',
    tipo_costo: 'NA',
    driver_id: '',
    estado: 'activo',
  });

  const [classifyIn, setClassifyIn] = useState({
    cuenta_codigo: '',
    texto: '',
    colaborador_id: '',
  });
  const [proposal, setProposal] = useState<string>('');
  const [autoMapping, setAutoMapping] = useState(false);

  const [sharedOpen, setSharedOpen] = useState(false);
  const [sharedForm, setSharedForm] = useState({
    codigo: '',
    nombre: '',
    centro_origen_id: '',
    driver_id: '',
    lines: [{ centro_destino_id: '', porcentaje: '100' }],
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await mgrPnlApi.ensure();
      const [s, n, st, d, m, a, c, sh] = await Promise.all([
        mgrPnlApi.stats(),
        mgrPnlApi.naturalezas(),
        mgrPnlApi.structure(),
        mgrPnlApi.drivers(),
        mgrPnlApi.mappings(true),
        costCentersApi.listAreas(true),
        costCentersApi.listCenters(true),
        mgrPnlApi.shared(),
      ]);
      setStats(s);
      setNats(n);
      setStructure(st);
      setDrivers(d);
      setMappings(m);
      setAreas(a);
      setCenters(c);
      setShared(sh);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cargar P&L gerencial');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const loadStatement = useCallback(async () => {
    try {
      setStatement(await mgrPnlApi.statement(periodo));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cargar el estado');
    }
  }, [periodo]);

  useEffect(() => {
    if (tab === 'statement') void loadStatement();
  }, [tab, loadStatement]);

  const runAutoMap = async (apply = true) => {
    if (!canEdit && apply) return;
    if (chartOfAccounts.length === 0) {
      toast.error('No hay plan de cuentas cargado en Contabilidad');
      return;
    }
    setAutoMapping(true);
    try {
      const r = await mgrPnlApi.autoMapFromChart(chartOfAccounts, {
        apply,
        min_confianza: 'media',
      });
      toast.success(apply ? 'Mappings aplicados desde el plan' : 'Propuestas generadas', {
        description: `Útiles: ${r.usable} · Aplicados: ${r.applied} · Ya existían: ${r.skipped_existing}`,
      });
      if (apply) await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo auto-mapear');
    } finally {
      setAutoMapping(false);
    }
  };

  const runQa = async () => {
    try {
      setQa(await mgrPnlApi.qa(chartOfAccounts));
      toast.success('Control de calidad actualizado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'QA falló');
    }
  };

  const openMapCreate = () => {
    setEditingId(undefined);
    setForm({
      cuenta_codigo: '',
      cuenta_nombre: '',
      naturaleza_codigo: '',
      pnl_codigo: '',
      area_id: '',
      centro_costo_id: '',
      tipo_costo: 'NA',
      driver_id: '',
      estado: 'activo',
    });
    setMapOpen(true);
  };

  const openMapEdit = (m: MgrCuentaMapping) => {
    setEditingId(m.id);
    setForm({
      cuenta_codigo: m.cuenta_codigo || '',
      cuenta_nombre: m.cuenta_nombre || '',
      naturaleza_codigo: m.naturaleza_codigo || '',
      pnl_codigo: m.pnl_codigo || '',
      area_id: m.area_id ? String(m.area_id) : '',
      centro_costo_id: m.centro_costo_id ? String(m.centro_costo_id) : '',
      tipo_costo: m.tipo_costo || 'NA',
      driver_id: m.driver_id ? String(m.driver_id) : '',
      estado: m.estado || 'activo',
    });
    setMapOpen(true);
  };

  const saveMapping = async () => {
    if (!canEdit) return;
    try {
      await mgrPnlApi.saveMapping(
        {
          ...form,
          area_id: form.area_id || null,
          centro_costo_id: form.centro_costo_id || null,
          driver_id: form.driver_id || null,
          naturaleza_codigo: form.naturaleza_codigo || null,
          pnl_codigo: form.pnl_codigo || null,
        },
        editingId
      );
      toast.success('Mapping guardado');
      setMapOpen(false);
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    }
  };

  const deleteMapping = async (id: number) => {
    if (!canEdit || !confirm('¿Desactivar mapping?')) return;
    try {
      await mgrPnlApi.deleteMapping(id);
      toast.success('Desactivado');
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  const runClassify = async () => {
    try {
      const p = await mgrPnlApi.classify(classifyIn);
      setProposal(
        [
          `Confianza: ${p.confianza} · Fuente: ${p.fuente || '—'}`,
          `Naturaleza: ${p.naturaleza_codigo || '—'}`,
          `P&L: ${p.pnl_codigo || '—'}`,
          `Área: ${p.area_codigo || '—'}`,
          `Centro: ${p.centro_codigo || '—'}`,
          `Tipo: ${p.tipo_costo}`,
          p.es_remuneracion ? 'Cuenta 62 / remuneraciones' : '',
          p.requiere_driver ? 'Requiere driver (indirecto)' : '',
          ...(p.notas || []),
        ]
          .filter(Boolean)
          .join('\n')
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Clasificación falló');
    }
  };

  const acceptProposalAsMapping = async () => {
    if (!canEdit || !classifyIn.cuenta_codigo) {
      toast.error('Indica cuenta contable');
      return;
    }
    try {
      const p = await mgrPnlApi.classify(classifyIn);
      await mgrPnlApi.saveMapping({
        cuenta_codigo: classifyIn.cuenta_codigo,
        cuenta_nombre: classifyIn.texto || '',
        naturaleza_codigo: p.naturaleza_codigo,
        pnl_codigo: p.pnl_codigo,
        area_id: p.area_id,
        centro_costo_id: p.centro_costo_id,
        tipo_costo: p.tipo_costo,
        driver_id: p.driver_id,
        estado: 'activo',
      });
      toast.success('Propuesta guardada como mapping');
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar propuesta');
    }
  };

  const saveShared = async () => {
    if (!canEdit) return;
    try {
      await mgrPnlApi.saveShared({
        codigo: sharedForm.codigo,
        nombre: sharedForm.nombre,
        centro_origen_id: sharedForm.centro_origen_id || null,
        driver_id: sharedForm.driver_id || null,
        detalle: sharedForm.lines
          .filter((l) => l.centro_destino_id)
          .map((l, i) => ({
            centro_destino_id: Number(l.centro_destino_id),
            porcentaje: Number(l.porcentaje),
            sort_order: i,
          })),
      });
      toast.success('Distribución compartida guardada');
      setSharedOpen(false);
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    }
  };

  const activeCenters = useMemo(() => centers.filter((c) => c.estado === 'activo'), [centers]);
  const leafPnl = useMemo(
    () => structure.filter((l) => !l.es_calculo || Number(l.es_calculo) === 0),
    [structure]
  );

  return (
    <div className="space-y-6" data-testid="mgr-pnl-module">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">P&amp;L Gerencial</h1>
          <p className="text-sm text-muted-foreground">
            Contabilidad de gestión: naturaleza → P&amp;L → área → centro de costo. El plan
            contable se conserva; la clasificación es gerencial. El Estado de Resultados por
            categorías queda para flujo de caja.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadAll()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="structure">Estructura</TabsTrigger>
          <TabsTrigger value="mappings">Mapping cuentas</TabsTrigger>
          <TabsTrigger value="classify">Clasificar</TabsTrigger>
          <TabsTrigger value="shared">Compartidos</TabsTrigger>
          <TabsTrigger value="statement">Estado P&amp;L</TabsTrigger>
          <TabsTrigger value="qa">Control calidad</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Kpi title="Naturalezas" value={stats?.naturalezas ?? 0} />
            <Kpi title="Líneas P&L" value={stats?.pnl_lineas ?? 0} />
            <Kpi title="Mappings" value={stats?.mappings ?? 0} />
            <Kpi title="Drivers" value={stats?.drivers ?? 0} />
            <Kpi title="Compartidos" value={stats?.compartidos ?? 0} />
            <Kpi title="Reglas keyword" value={stats?.keyword_rules ?? 0} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cadena gerencial</CardTitle>
              <CardDescription>
                {stats?.nota ||
                  'Cuenta contable → Naturaleza → P&L → Área → Subárea → Centro de costo (+ sede/cargo/colaborador/proveedor/driver).'}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <p>Cuenta 62 se agrupa en N02 Personal; el CC sale de la asignación del colaborador.</p>
              <p>Comisiones de medios de pago → Gasto de Ventas (04.03), no financiero por defecto.</p>
              <p>Servicios de sede → CC-SERVICIOS-SEDE y luego distribución compartida con driver.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="structure" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Naturalezas N01–N15</CardTitle>
              </CardHeader>
              <CardContent className="max-h-80 overflow-y-auto">
                <SimpleTable
                  columns={['Código', 'Nombre']}
                  rows={nats.map((n) => [n.codigo, n.nombre])}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estructura P&amp;L 01–08</CardTitle>
              </CardHeader>
              <CardContent className="max-h-80 overflow-y-auto">
                <SimpleTable
                  columns={['Código', 'Nombre', 'Nivel']}
                  rows={structure.map((l) => [
                    l.codigo,
                    `${'  '.repeat(Math.max(0, Number(l.nivel) - 1))}${l.nombre}${
                      l.es_calculo ? ' (calc)' : ''
                    }`,
                    String(l.nivel),
                  ])}
                />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Drivers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {drivers.map((d) => (
                  <Badge key={d.id} variant="outline">
                    {d.codigo}: {d.nombre}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mappings" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Button type="button" onClick={openMapCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo mapping
              </Button>
            ) : null}
            {canEdit ? (
              <Button
                type="button"
                variant="secondary"
                disabled={autoMapping || chartOfAccounts.length === 0}
                onClick={() => void runAutoMap(true)}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {autoMapping ? 'Sincronizando…' : 'Auto-mapear desde plan'}
              </Button>
            ) : null}
            <span className="text-sm text-muted-foreground self-center ml-auto">
              {mappings.length} mappings
              {chartOfAccounts.length === 0 ? ' · sin plan en sesión' : ` · ${chartOfAccounts.length} ctas plan`}
            </span>
          </div>
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Naturaleza</TableHead>
                  <TableHead>P&amp;L</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Centro</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      Sin mappings. Usa Clasificar o crea uno manual.
                    </TableCell>
                  </TableRow>
                ) : (
                  mappings.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="font-medium">{m.cuenta_codigo}</div>
                        <div className="text-xs text-muted-foreground">{m.cuenta_nombre}</div>
                      </TableCell>
                      <TableCell>{m.naturaleza_codigo || '—'}</TableCell>
                      <TableCell>{m.pnl_codigo || '—'}</TableCell>
                      <TableCell>{m.area_codigo || m.area_nombre || '—'}</TableCell>
                      <TableCell>{m.centro_codigo || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{m.tipo_costo}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button type="button" size="sm" variant="ghost" onClick={() => openMapEdit(m)}>
                          {canEdit ? 'Editar' : 'Ver'}
                        </Button>
                        {canEdit ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => void deleteMapping(m.id)}
                          >
                            <Trash2 className="h-4 w-4 text-rose-500" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="classify" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Propuesta automática</CardTitle>
              <CardDescription>
                Identifica naturaleza, P&amp;L, área y CC a partir de cuenta y texto (keywords +
                mapping + 62/Buk).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Cuenta contable</Label>
                  <Input
                    value={classifyIn.cuenta_codigo}
                    onChange={(e) => setClassifyIn((f) => ({ ...f, cuenta_codigo: e.target.value }))}
                    placeholder="62111"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Texto / concepto</Label>
                  <Input
                    value={classifyIn.texto}
                    onChange={(e) => setClassifyIn((f) => ({ ...f, texto: e.target.value }))}
                    placeholder="Ecografía / Marketing / Alquiler…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Colaborador (opcional, 62)</Label>
                  <Input
                    value={classifyIn.colaborador_id}
                    onChange={(e) =>
                      setClassifyIn((f) => ({ ...f, colaborador_id: e.target.value }))
                    }
                    placeholder="buk:123"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={() => void runClassify()}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Clasificar
                </Button>
                {canEdit ? (
                  <Button type="button" variant="secondary" onClick={() => void acceptProposalAsMapping()}>
                    Guardar como mapping
                  </Button>
                ) : null}
              </div>
              {proposal ? (
                <pre className="text-xs whitespace-pre-wrap rounded-lg border bg-muted/30 p-3">
                  {proposal}
                </pre>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shared" className="space-y-3">
          <div className="flex gap-2">
            {canEdit ? (
              <Button
                type="button"
                onClick={() => {
                  setSharedForm({
                    codigo: 'SSE-DIST',
                    nombre: 'Servicios de sede → unidades',
                    centro_origen_id:
                      activeCenters.find((c) => c.codigo === 'CC-SERVICIOS-SEDE')?.id.toString() ||
                      '',
                    driver_id: drivers.find((d) => d.codigo === 'M2')?.id.toString() || '',
                    lines: [{ centro_destino_id: '', porcentaje: '100' }],
                  });
                  setSharedOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nueva distribución
              </Button>
            ) : null}
          </div>
          <SimpleTable
            columns={['Código', 'Nombre', 'Origen', 'Driver', 'Destinos']}
            rows={shared.map((s) => [
              s.codigo,
              s.nombre,
              s.centro_origen_codigo || '—',
              s.driver_codigo || '—',
              (s.detalle || [])
                .map((d) => `${d.centro_destino_codigo || d.centro_destino_id} ${d.porcentaje}%`)
                .join(' · ') || '—',
            ])}
          />
        </TabsContent>

        <TabsContent value="statement" className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1.5">
              <Label>Periodo</Label>
              <Input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
            </div>
            <Button type="button" variant="outline" onClick={() => void loadStatement()}>
              Calcular
            </Button>
          </div>
          {statement?.nota ? (
            <p className="text-sm text-muted-foreground">{statement.nota}</p>
          ) : null}
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Línea</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(statement?.lineas || []).map((l) => (
                  <TableRow key={l.codigo} className={l.nivel === 1 ? 'font-medium' : ''}>
                    <TableCell>{l.codigo}</TableCell>
                    <TableCell style={{ paddingLeft: `${(l.nivel - 1) * 12 + 8}px` }}>
                      {l.nombre}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      S/ {Number(l.monto).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="qa" className="space-y-3">
          <Button type="button" onClick={() => void runQa()}>
            Ejecutar control de calidad
          </Button>
          {qa ? (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <Kpi title="Mappings activos" value={qa.resumen.mappings_activos} />
                <Kpi title="Cuentas sin mapping" value={qa.resumen.pendientes_cuenta} />
                <Kpi title="62 sin área/CC" value={qa.resumen.pendientes_62} />
                <Kpi title="Sin driver" value={qa.resumen.pendientes_driver} />
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pendientes de parametrización</CardTitle>
                  <CardDescription>
                    Primeras cuentas del plan sin mapping ({qa.cuentas_sin_clasificacion_total}{' '}
                    total)
                  </CardDescription>
                </CardHeader>
                <CardContent className="max-h-64 overflow-y-auto">
                  <SimpleTable
                    columns={['Cuenta', 'Nombre']}
                    rows={qa.cuentas_sin_clasificacion
                      .slice(0, 80)
                      .map((c) => [c.cuenta_codigo, c.cuenta_nombre])}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Matriz de parametrización</CardTitle>
                </CardHeader>
                <CardContent className="max-h-80 overflow-y-auto">
                  <SimpleTable
                    columns={['Cuenta', 'Nat', 'P&L', 'Área', 'CC', 'Tipo', 'Estado']}
                    rows={qa.matriz.map((r) => [
                      r.cuenta_codigo,
                      r.naturaleza || '—',
                      r.pnl || '—',
                      r.area || '—',
                      r.centro_costo || '—',
                      r.tipo_costo || '—',
                      r.parametrizacion,
                    ])}
                  />
                </CardContent>
              </Card>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ejecuta el control para comparar el plan de cuentas con los mappings.
            </p>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar mapping' : 'Nuevo mapping'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Field label="Cuenta" value={form.cuenta_codigo} onChange={(v) => setForm((f) => ({ ...f, cuenta_codigo: v }))} />
            <Field label="Nombre" value={form.cuenta_nombre} onChange={(v) => setForm((f) => ({ ...f, cuenta_nombre: v }))} />
            <div className="space-y-1.5">
              <Label>Naturaleza</Label>
              <Select
                value={form.naturaleza_codigo || '__none__'}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, naturaleza_codigo: v === '__none__' ? '' : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {nats.map((n) => (
                    <SelectItem key={n.codigo} value={n.codigo}>
                      {n.codigo} · {n.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Línea P&amp;L</Label>
              <Select
                value={form.pnl_codigo || '__none__'}
                onValueChange={(v) => setForm((f) => ({ ...f, pnl_codigo: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {leafPnl.map((l) => (
                    <SelectItem key={l.codigo} value={l.codigo}>
                      {l.codigo} · {l.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Área</Label>
              <Select
                value={form.area_id || '__none__'}
                onValueChange={(v) => setForm((f) => ({ ...f, area_id: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.codigo} · {a.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Centro de costo</Label>
              <Select
                value={form.centro_costo_id || '__none__'}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, centro_costo_id: v === '__none__' ? '' : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
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
            <div className="space-y-1.5">
              <Label>Tipo de costo</Label>
              <Select
                value={form.tipo_costo}
                onValueChange={(v) => setForm((f) => ({ ...f, tipo_costo: v as MgrTipoCosto }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIRECTO">DIRECTO</SelectItem>
                  <SelectItem value="INDIRECTO">INDIRECTO</SelectItem>
                  <SelectItem value="NA">NA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Driver</Label>
              <Select
                value={form.driver_id || '__none__'}
                onValueChange={(v) => setForm((f) => ({ ...f, driver_id: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.codigo} · {d.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMapOpen(false)}>
              Cancelar
            </Button>
            {canEdit ? (
              <Button type="button" onClick={() => void saveMapping()}>
                Guardar
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sharedOpen} onOpenChange={setSharedOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Distribución de gasto compartido</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Field
              label="Código"
              value={sharedForm.codigo}
              onChange={(v) => setSharedForm((f) => ({ ...f, codigo: v }))}
            />
            <Field
              label="Nombre"
              value={sharedForm.nombre}
              onChange={(v) => setSharedForm((f) => ({ ...f, nombre: v }))}
            />
            <div className="space-y-1.5">
              <Label>Centro origen</Label>
              <Select
                value={sharedForm.centro_origen_id || '__none__'}
                onValueChange={(v) =>
                  setSharedForm((f) => ({ ...f, centro_origen_id: v === '__none__' ? '' : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {activeCenters.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.codigo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Driver</Label>
              <Select
                value={sharedForm.driver_id || '__none__'}
                onValueChange={(v) =>
                  setSharedForm((f) => ({ ...f, driver_id: v === '__none__' ? '' : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.codigo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {sharedForm.lines.map((line, idx) => (
              <div key={idx} className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Centro destino</Label>
                  <Select
                    value={line.centro_destino_id || '__none__'}
                    onValueChange={(v) =>
                      setSharedForm((f) => ({
                        ...f,
                        lines: f.lines.map((r, i) =>
                          i === idx ? { ...r, centro_destino_id: v === '__none__' ? '' : v } : r
                        ),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {activeCenters.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.codigo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-xs">%</Label>
                  <Input
                    value={line.porcentaje}
                    onChange={(e) =>
                      setSharedForm((f) => ({
                        ...f,
                        lines: f.lines.map((r, i) =>
                          i === idx ? { ...r, porcentaje: e.target.value } : r
                        ),
                      }))
                    }
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setSharedForm((f) => ({
                  ...f,
                  lines: [...f.lines, { centro_destino_id: '', porcentaje: '0' }],
                }))
              }
            >
              + Destino
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSharedOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void saveShared()}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function SimpleTable({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((c) => (
            <TableHead key={c}>{c}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="text-muted-foreground">
              Sin datos.
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
