import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';

import type { CostCenter, DistributionRule, ReglaMetodo } from '../../types/costCenters';
import { costCentersApi } from '../../utils/costCentersApi';
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

const METODOS: ReglaMetodo[] = ['PORCENTAJE', 'IGUAL', 'POR_VENTAS', 'POR_M2', 'POR_HEADCOUNT'];

type Props = {
  canEdit: boolean;
  centers: CostCenter[];
};

export function CostCentersRulesTab({ canEdit, centers }: Props) {
  const [items, setItems] = useState<DistributionRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | undefined>();
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [metodo, setMetodo] = useState<ReglaMetodo>('PORCENTAJE');
  const [descripcion, setDescripcion] = useState('');
  const [lines, setLines] = useState<{ centro_costo_id: string; porcentaje: string }[]>([
    { centro_costo_id: '', porcentaje: '100' },
  ]);
  const [simMonto, setSimMonto] = useState('1000');
  const [simResult, setSimResult] = useState<string>('');

  const activeCenters = useMemo(() => centers.filter((c) => c.estado === 'activo'), [centers]);
  const sum = useMemo(
    () => Math.round(lines.reduce((a, l) => a + (Number(l.porcentaje) || 0), 0) * 100) / 100,
    [lines]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await costCentersApi.listRules(true));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron cargar reglas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(undefined);
    setCodigo('');
    setNombre('');
    setMetodo('PORCENTAJE');
    setDescripcion('');
    setLines([{ centro_costo_id: '', porcentaje: '100' }]);
    setSimResult('');
    setOpen(true);
  };

  const openEdit = (r: DistributionRule) => {
    setEditingId(r.id);
    setCodigo(r.codigo);
    setNombre(r.nombre);
    setMetodo(r.metodo);
    setDescripcion(r.descripcion || '');
    setLines(
      (r.detalle || []).map((d) => ({
        centro_costo_id: String(d.centro_costo_id),
        porcentaje: String(d.porcentaje ?? ''),
      }))
    );
    setSimResult('');
    setOpen(true);
  };

  const save = async () => {
    if (!canEdit) return;
    try {
      const detalle = lines
        .filter((l) => l.centro_costo_id)
        .map((l, i) => ({
          centro_costo_id: Number(l.centro_costo_id),
          porcentaje: l.porcentaje === '' ? null : Number(l.porcentaje),
          sort_order: i,
        }));
      await costCentersApi.saveRule(
        { codigo, nombre, metodo, descripcion, estado: 'activo', detalle },
        editingId
      );
      toast.success(editingId ? 'Regla actualizada' : 'Regla creada');
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    }
  };

  const remove = async (id: number) => {
    if (!canEdit || !confirm('¿Desactivar esta regla?')) return;
    try {
      await costCentersApi.deleteRule(id);
      toast.success('Regla desactivada');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo desactivar');
    }
  };

  const simulate = async () => {
    if (!editingId && !items.length) return;
    const id = editingId;
    if (!id) {
      toast.error('Guarda la regla antes de simular, o edita una existente');
      return;
    }
    try {
      const res = await costCentersApi.simulateRule(id, Number(simMonto) || 0);
      const text = res.lines
        .map(
          (l) =>
            `${l.centro_codigo || l.centro_costo_id}: ${l.porcentaje}% → S/ ${l.monto.toFixed(2)}`
        )
        .join('\n');
      setSimResult((res.nota ? res.nota + '\n' : '') + text);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Simulación falló');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
        {canEdit ? (
          <Button type="button" className="ml-auto" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva regla
          </Button>
        ) : null}
      </div>
      <div className="rounded-xl border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Detalle</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Sin reglas. Crea una con método PORCENTAJE (suma 100%).
                </TableCell>
              </TableRow>
            ) : (
              items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.codigo}</TableCell>
                  <TableCell>{r.nombre}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.metodo}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {(r.detalle || [])
                      .map((d) => `${d.centro_codigo || d.centro_costo_id} ${d.porcentaje ?? '—'}%`)
                      .join(' · ') || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.estado === 'activo' ? 'default' : 'secondary'} className={r.estado === 'activo' ? 'bg-teal-600' : ''}>
                      {r.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button type="button" size="sm" variant="ghost" onClick={() => openEdit(r)}>
                      {canEdit ? 'Editar' : 'Ver'}
                    </Button>
                    {canEdit ? (
                      <Button type="button" size="icon" variant="ghost" onClick={() => void remove(r.id)}>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar regla' : 'Nueva regla de distribución'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Código</Label>
                <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} disabled={!canEdit} />
              </div>
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={!canEdit} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Método</Label>
              <Select value={metodo} onValueChange={(v) => setMetodo(v as ReglaMetodo)} disabled={!canEdit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METODOS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} disabled={!canEdit} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Centros destino</Label>
              <span className={`text-sm tabular-nums ${Math.abs(sum - 100) < 0.02 || metodo !== 'PORCENTAJE' ? 'text-teal-700' : 'text-amber-700'}`}>
                Suma %: {sum}
              </span>
            </div>
            {lines.map((line, idx) => (
              <div key={idx} className="flex flex-wrap gap-2 items-end">
                <div className="min-w-[220px] flex-1 space-y-1">
                  <Label className="text-xs">Centro</Label>
                  <Select
                    value={line.centro_costo_id || '__none__'}
                    onValueChange={(v) =>
                      setLines((rows) =>
                        rows.map((r, i) =>
                          i === idx ? { ...r, centro_costo_id: v === '__none__' ? '' : v } : r
                        )
                      )
                    }
                    disabled={!canEdit}
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
                <div className="w-24 space-y-1">
                  <Label className="text-xs">%</Label>
                  <Input
                    type="number"
                    value={line.porcentaje}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setLines((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, porcentaje: e.target.value } : r))
                      )
                    }
                  />
                </div>
                {canEdit && lines.length > 1 ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setLines((rows) => rows.filter((_, i) => i !== idx))}
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
                onClick={() => setLines((rows) => [...rows, { centro_costo_id: '', porcentaje: '0' }])}
              >
                <Plus className="mr-1 h-4 w-4" />
                Línea
              </Button>
            ) : null}
            {editingId ? (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <Label>Simular (no aplica)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    className="w-32"
                    value={simMonto}
                    onChange={(e) => setSimMonto(e.target.value)}
                  />
                  <Button type="button" variant="secondary" onClick={() => void simulate()}>
                    Simular
                  </Button>
                </div>
                {simResult ? (
                  <pre className="text-xs whitespace-pre-wrap text-muted-foreground">{simResult}</pre>
                ) : null}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
            {canEdit ? (
              <Button type="button" onClick={() => void save()}>
                Guardar
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
