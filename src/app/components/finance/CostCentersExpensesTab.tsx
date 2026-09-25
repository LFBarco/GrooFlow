import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, RefreshCw, Split, Undo2, Sparkles } from 'lucide-react';

import type {
  CostCenter,
  CostExpense,
  DistributionRule,
  TipoAsignacionGasto,
} from '../../types/costCenters';
import { costCentersApi } from '../../utils/costCentersApi';
import { mgrPnlApi } from '../../utils/mgrPnlApi';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
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
  canEdit: boolean;
  centers: CostCenter[];
  rules: DistributionRule[];
  onChanged?: () => void;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CostCentersExpensesTab({ canEdit, centers, rules, onChanged }: Props) {
  const [items, setItems] = useState<CostExpense[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [estado, setEstado] = useState<string>('__all__');
  const [periodo, setPeriodo] = useState(todayIso().slice(0, 7));
  const [search, setSearch] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'gasto' | 'personal'>('gasto');
  const [form, setForm] = useState({
    fecha: todayIso(),
    monto: '',
    concepto: '',
    sede_nombre: '',
    cuenta_codigo: '',
    tipo_asignacion: 'DIRECTO' as TipoAsignacionGasto,
    centro_costo_origen_id: '',
    regla_id: '',
    colaborador_id: '',
    notas: '',
  });
  const [classifyHint, setClassifyHint] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await costCentersApi.listExpenses({
        page,
        pageSize: 25,
        estado: estado === '__all__' ? undefined : estado,
        periodo: periodo || undefined,
        search: searchApplied.trim() || undefined,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron cargar gastos');
    } finally {
      setLoading(false);
    }
  }, [page, estado, periodo, searchApplied]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = (m: 'gasto' | 'personal') => {
    setMode(m);
    setForm({
      fecha: todayIso(),
      monto: '',
      concepto: m === 'personal' ? 'Gasto de personal' : '',
      sede_nombre: '',
      cuenta_codigo: '',
      tipo_asignacion: m === 'personal' ? 'PERSONAL' : 'DIRECTO',
      centro_costo_origen_id: '',
      regla_id: '',
      colaborador_id: '',
      notas: '',
    });
    setClassifyHint('');
    setOpen(true);
  };

  const suggestFromAccount = async () => {
    if (!form.cuenta_codigo.trim() && !form.concepto.trim()) {
      toast.message('Indica cuenta o concepto para clasificar');
      return;
    }
    try {
      const p = await mgrPnlApi.classify({
        cuenta_codigo: form.cuenta_codigo,
        texto: form.concepto,
        colaborador_id: form.colaborador_id || undefined,
        fecha: form.fecha,
      });
      setClassifyHint(
        [
          p.naturaleza_codigo && `Nat ${p.naturaleza_codigo}`,
          p.pnl_codigo && `P&L ${p.pnl_codigo}`,
          p.centro_codigo && `CC ${p.centro_codigo}`,
          p.confianza && `conf=${p.confianza}`,
        ]
          .filter(Boolean)
          .join(' · ') || 'Sin propuesta'
      );
      if (mode !== 'personal' && p.centro_costo_id) {
        setForm((f) => ({
          ...f,
          tipo_asignacion: 'DIRECTO',
          centro_costo_origen_id: String(p.centro_costo_id),
        }));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo clasificar');
    }
  };

  const save = async () => {
    if (!canEdit) return;
    try {
      const payload: Record<string, unknown> = {
        fecha: form.fecha,
        monto: Number(form.monto),
        concepto: form.concepto,
        sede_nombre: form.sede_nombre || null,
        cuenta_codigo: form.cuenta_codigo || null,
        tipo_asignacion: form.tipo_asignacion,
        centro_costo_origen_id: form.centro_costo_origen_id || null,
        regla_id: form.regla_id || null,
        colaborador_id: form.colaborador_id || null,
        notas: form.notas || null,
        origen_tipo: mode === 'personal' ? 'personal' : 'manual',
      };
      if (mode === 'personal') {
        await costCentersApi.createPersonalExpense(payload);
        toast.success('Gasto de personal creado y distribuido');
      } else {
        await costCentersApi.saveExpense(payload);
        toast.success('Gasto registrado (pendiente de distribuir)');
      }
      setOpen(false);
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    }
  };

  const distribute = async (id: number) => {
    if (!canEdit) return;
    try {
      await costCentersApi.distributeExpense(id);
      toast.success('Distribuido (snapshot guardado)');
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo distribuir');
    }
  };

  const reverse = async (id: number) => {
    if (!canEdit) return;
    if (!confirm('¿Anular la distribución? El gasto volverá a pendiente.')) return;
    try {
      await costCentersApi.reverseExpense(id);
      toast.success('Distribución anulada');
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo anular');
    }
  };

  const pages = Math.max(1, Math.ceil(total / 25));
  const activeCenters = centers.filter((c) => c.estado === 'activo');
  const activeRules = rules.filter((r) => r.estado === 'activo');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          className="max-w-[140px]"
          type="month"
          value={periodo}
          onChange={(e) => {
            setPage(1);
            setPeriodo(e.target.value);
          }}
        />
        <Select
          value={estado}
          onValueChange={(v) => {
            setPage(1);
            setEstado(v);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            <SelectItem value="pendiente">Pendientes</SelectItem>
            <SelectItem value="distribuido">Distribuidos</SelectItem>
            <SelectItem value="anulado">Anulados</SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="max-w-xs"
          placeholder="Buscar…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setPage(1);
              setSearchApplied(search);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setPage(1);
            setSearchApplied(search);
            void load();
          }}
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Buscar
        </Button>
        {canEdit ? (
          <>
            <Button type="button" className="ml-auto" onClick={() => openCreate('gasto')}>
              <Plus className="mr-2 h-4 w-4" />
              Gasto
            </Button>
            <Button type="button" variant="secondary" onClick={() => openCreate('personal')}>
              Personal (auto)
            </Button>
          </>
        ) : null}
      </div>

      <div className="rounded-xl border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Asignación</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Sin gastos en este filtro.
                </TableCell>
              </TableRow>
            ) : (
              items.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="whitespace-nowrap">{g.fecha}</TableCell>
                  <TableCell>
                    <div className="font-medium">{g.concepto}</div>
                    <div className="text-xs text-muted-foreground">
                      {g.cuenta_codigo ? `cta ${g.cuenta_codigo} · ` : ''}
                      {g.sede_nombre || g.origen_tipo}
                      {g.colaborador_id ? ` · ${g.colaborador_id}` : ''}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">S/ {Number(g.monto).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{g.tipo_asignacion}</Badge>
                    {g.regla_codigo ? (
                      <span className="ml-1 text-xs text-muted-foreground">{g.regla_codigo}</span>
                    ) : null}
                    {g.centro_origen_codigo ? (
                      <span className="ml-1 text-xs text-muted-foreground">{g.centro_origen_codigo}</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={g.estado === 'distribuido' ? 'default' : 'secondary'}
                      className={g.estado === 'distribuido' ? 'bg-teal-600' : ''}
                    >
                      {g.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {canEdit && g.estado === 'pendiente' ? (
                      <Button type="button" size="sm" variant="ghost" onClick={() => void distribute(g.id)}>
                        <Split className="mr-1 h-3.5 w-3.5" />
                        Distribuir
                      </Button>
                    ) : null}
                    {canEdit && g.estado === 'distribuido' ? (
                      <Button type="button" size="sm" variant="ghost" onClick={() => void reverse(g.id)}>
                        <Undo2 className="mr-1 h-3.5 w-3.5" />
                        Anular
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end gap-2 text-sm text-muted-foreground">
        {total} gastos · pág. {page}/{pages}
        <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Anterior
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={page >= pages}
          onClick={() => setPage((p) => p + 1)}
        >
          Siguiente
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {mode === 'personal' ? 'Gasto de personal (distribuye al guardar)' : 'Registrar gasto'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Monto</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.monto}
                  onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Concepto</Label>
              <Input
                value={form.concepto}
                onChange={(e) => setForm((f) => ({ ...f, concepto: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cuenta contable (opcional)</Label>
              <div className="flex gap-2">
                <Input
                  className="font-mono"
                  placeholder="ej. 659121"
                  value={form.cuenta_codigo}
                  onChange={(e) => setForm((f) => ({ ...f, cuenta_codigo: e.target.value }))}
                />
                <Button type="button" variant="secondary" size="icon" title="Clasificar" onClick={() => void suggestFromAccount()}>
                  <Sparkles className="h-4 w-4" />
                </Button>
              </div>
              {classifyHint ? (
                <p className="text-xs text-muted-foreground">{classifyHint}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Usa el mapping gerencial / keywords para sugerir centro y P&amp;L.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Sede (opcional)</Label>
              <Input
                value={form.sede_nombre}
                onChange={(e) => setForm((f) => ({ ...f, sede_nombre: e.target.value }))}
              />
            </div>
            {mode === 'personal' ? (
              <div className="space-y-1.5">
                <Label>Colaborador (buk:id o id)</Label>
                <Input
                  placeholder="buk:123"
                  value={form.colaborador_id}
                  onChange={(e) => setForm((f) => ({ ...f, colaborador_id: e.target.value }))}
                />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Tipo de asignación</Label>
                  <Select
                    value={form.tipo_asignacion}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, tipo_asignacion: v as TipoAsignacionGasto }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DIRECTO">DIRECTO</SelectItem>
                      <SelectItem value="REGLA">REGLA</SelectItem>
                      <SelectItem value="PERSONAL">PERSONAL</SelectItem>
                      <SelectItem value="SIN_ASIGNAR">SIN_ASIGNAR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.tipo_asignacion === 'DIRECTO' ? (
                  <div className="space-y-1.5">
                    <Label>Centro destino</Label>
                    <Select
                      value={form.centro_costo_origen_id || '__none__'}
                      onValueChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          centro_costo_origen_id: v === '__none__' ? '' : v,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Centro" />
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
                ) : null}
                {form.tipo_asignacion === 'REGLA' ? (
                  <div className="space-y-1.5">
                    <Label>Regla</Label>
                    <Select
                      value={form.regla_id || '__none__'}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, regla_id: v === '__none__' ? '' : v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Regla" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {activeRules.map((r) => (
                          <SelectItem key={r.id} value={String(r.id)}>
                            {r.codigo} · {r.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                {form.tipo_asignacion === 'PERSONAL' ? (
                  <div className="space-y-1.5">
                    <Label>Colaborador</Label>
                    <Input
                      placeholder="buk:123"
                      value={form.colaborador_id}
                      onChange={(e) => setForm((f) => ({ ...f, colaborador_id: e.target.value }))}
                    />
                  </div>
                ) : null}
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void save()}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
