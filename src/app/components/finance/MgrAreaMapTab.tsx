import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Save } from 'lucide-react';

import {
  mgrPnlApi,
  type MgrAreaDestino,
  type MgrAreaMapCatalog,
  type MgrAreaMapItem,
} from '../../utils/mgrPnlApi';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
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

type Row = Pick<MgrAreaMapItem, 'area' | 'destino' | 'centro_base' | 'centro_codigo' | 'automatico'>;

const rowKey = (r: Pick<Row, 'destino' | 'centro_base' | 'centro_codigo'>) =>
  `${r.destino}|${r.destino === 'sede' ? r.centro_base ?? '' : ''}|${r.destino === 'fijo' ? r.centro_codigo ?? '' : ''}`;

export function MgrAreaMapTab({ canEdit }: { canEdit: boolean }) {
  const [catalog, setCatalog] = useState<MgrAreaMapCatalog | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await mgrPnlApi.getAreaMap();
      setCatalog(c);
      setRows(c.items.map((i) => ({ ...i })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cargar el mapeo de áreas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const corporate = useMemo(
    () => (catalog?.centros ?? []).filter((c) => !c.sede),
    [catalog]
  );

  const changed = useMemo(() => {
    const orig = new Map((catalog?.items ?? []).map((i) => [i.area, rowKey(i)]));
    return rows.filter((r) => orig.get(r.area) !== rowKey(r));
  }, [rows, catalog]);

  const patch = (area: string, p: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.area === area ? { ...r, ...p } : r)));

  const save = async () => {
    if (!canEdit || changed.length === 0) return;
    const incomplete = changed.find(
      (r) => (r.destino === 'sede' && !r.centro_base) || (r.destino === 'fijo' && !r.centro_codigo)
    );
    if (incomplete) {
      toast.error(`Elige el centro para "${incomplete.area}"`);
      return;
    }
    setSaving(true);
    try {
      const res = await mgrPnlApi.saveAreaMap(
        changed.map(({ area, destino, centro_base, centro_codigo }) => ({
          area,
          destino,
          centro_base,
          centro_codigo,
        }))
      );
      const moved = Object.values(res.sync).reduce((n, s) => n + (s.actualizados ?? 0) + (s.creados ?? 0), 0);
      toast.success('Mapeo de áreas guardado', {
        description: `${changed.length} área(s) actualizadas · ${moved} gasto(s) reasignados`,
      });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Área operativa → centro de costo</CardTitle>
        <CardDescription>
          Define a qué centro va cada área de caja chica, compras, honorarios y transacciones.
          «Por sede» usa el centro de esa área en la sede del gasto (ej. Mantenimiento + Benavides
          → MAN-BEN). «Centro fijo» envía todo a un centro corporativo. «Automático» usa la regla
          por defecto que ves en la columna de la derecha.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Recargar
          </Button>
          {canEdit ? (
            <Button type="button" onClick={() => void save()} disabled={saving || changed.length === 0}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Guardando…' : `Guardar${changed.length ? ` (${changed.length})` : ''}`}
            </Button>
          ) : null}
        </div>
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Área</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Centro</TableHead>
                <TableHead>Regla automática</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    {loading ? 'Cargando…' : 'No hay áreas configuradas.'}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.area}>
                    <TableCell className="font-medium">{r.area}</TableCell>
                    <TableCell className="min-w-[160px]">
                      <Select
                        value={r.destino}
                        disabled={!canEdit}
                        onValueChange={(v) => patch(r.area, { destino: v as MgrAreaDestino })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Automático</SelectItem>
                          <SelectItem value="sede">Por sede</SelectItem>
                          <SelectItem value="fijo">Centro fijo</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="min-w-[240px]">
                      {r.destino === 'sede' ? (
                        <Select
                          value={r.centro_base || '__none__'}
                          disabled={!canEdit}
                          onValueChange={(v) => patch(r.area, { centro_base: v === '__none__' ? null : v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Elegir —</SelectItem>
                            {(catalog?.bases ?? []).map((b) => (
                              <SelectItem key={b} value={b}>
                                {b}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : r.destino === 'fijo' ? (
                        <Select
                          value={r.centro_codigo || '__none__'}
                          disabled={!canEdit}
                          onValueChange={(v) => patch(r.area, { centro_codigo: v === '__none__' ? null : v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Elegir —</SelectItem>
                            {corporate.map((c) => (
                              <SelectItem key={c.codigo} value={c.codigo}>
                                {c.codigo} · {c.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={r.automatico.startsWith('Gastos generales') ? 'border-amber-400 text-amber-700' : ''}
                      >
                        {r.automatico}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          Las áreas marcadas en ámbar hoy caen en «Gastos generales de sede». Al guardar, los gastos
          ya sincronizados de esas áreas se reasignan al nuevo centro.
        </p>
      </CardContent>
    </Card>
  );
}
