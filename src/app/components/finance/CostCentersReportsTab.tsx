import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

import type { CostCentersPnlFeed, CostCentersReport } from '../../types/costCenters';
import { costCentersApi } from '../../utils/costCentersApi';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

type Props = {
  initialPeriodo?: string;
};

export function CostCentersReportsTab({ initialPeriodo }: Props) {
  const [periodo, setPeriodo] = useState(initialPeriodo || new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState<CostCentersReport | null>(null);
  const [pnl, setPnl] = useState<CostCentersPnlFeed | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([
        costCentersApi.reports(periodo),
        costCentersApi.pnlFeed(periodo),
      ]);
      setReport(r);
      setPnl(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron cargar reportes');
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label>Periodo</Label>
          <Input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
        </div>
        <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
        {report ? (
          <span className="text-sm text-muted-foreground ml-auto">
            Pendientes: {report.pendientes.n} (S/ {Number(report.pendientes.total).toFixed(2)})
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ReportTable
          title="Por centro de costo"
          description="Gasto distribuido del periodo"
          columns={['Código', 'Nombre', 'Tipo', 'Total']}
          rows={(report?.por_centro || []).map((r) => [
            r.codigo,
            r.nombre,
            r.tipo,
            `S/ ${Number(r.total).toFixed(2)}`,
          ])}
        />
        <ReportTable
          title="Por sede"
          columns={['Sede', 'Total']}
          rows={(report?.por_sede || []).map((r) => [r.sede, `S/ ${Number(r.total).toFixed(2)}`])}
        />
        <ReportTable
          title="Por unidad de negocio"
          columns={['BU', 'Total']}
          rows={(report?.por_unidad_negocio || []).map((r) => [
            r.unidad_negocio,
            `S/ ${Number(r.total).toFixed(2)}`,
          ])}
        />
        <ReportTable
          title="Por área"
          columns={['Área', 'Total']}
          rows={(report?.por_area || []).map((r) => [r.area, `S/ ${Number(r.total).toFixed(2)}`])}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feed P&amp;L (dimensional CC)</CardTitle>
          <CardDescription>
            {pnl?.nota ||
              'Datos clasificados para Estado de Resultados. Coexiste con el P&L por categorías.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-2 text-sm font-medium tabular-nums">
            Total periodo: S/ {Number(pnl?.total ?? 0).toFixed(2)}
          </div>
          <div className="rounded-lg border border-border overflow-x-auto max-h-64">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Centro</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pnl?.items || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      Sin datos distribuidos en el periodo.
                    </TableCell>
                  </TableRow>
                ) : (
                  (pnl?.items || []).map((it) => (
                    <TableRow key={it.centro_costo_id}>
                      <TableCell>{it.codigo}</TableCell>
                      <TableCell>{it.nombre}</TableCell>
                      <TableCell>{it.tipo}</TableCell>
                      <TableCell>{it.sede_nombre || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        S/ {Number(it.monto).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportTable({
  title,
  description,
  columns,
  rows,
}: {
  title: string;
  description?: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="max-h-56 overflow-y-auto">
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
                    <TableCell key={j} className={j === row.length - 1 ? 'tabular-nums' : ''}>
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
