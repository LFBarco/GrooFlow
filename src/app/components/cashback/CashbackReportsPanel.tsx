import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Calculator, Download, Landmark, Loader2, PiggyBank, Receipt, TrendingUp, Wallet } from 'lucide-react';
import { toast } from 'sonner';

import type { CashbackReport, CashbackSettings } from '../../types/cashback';
import { fetchCashbackReport } from '../../utils/cashbackApi';
import { exportCashbackReportExcel } from '../../utils/cashbackExport';
import {
  cashbackNetEffect,
  categoryLabel,
  currentPeriod,
  describeCashbackRule,
  formatPen,
  periodLabel,
  shiftPeriod,
  simulateCashback,
} from '../../utils/cashbackRules';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { CashbackKpi } from './CashbackShared';

type Props = {
  settings: CashbackSettings;
  canExport: boolean;
};

export function CashbackReportsPanel({ settings, canExport }: Props) {
  const [desde, setDesde] = useState(shiftPeriod(currentPeriod(), -5));
  const [hasta, setHasta] = useState(currentPeriod());
  const [report, setReport] = useState<CashbackReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await fetchCashbackReport({ desde, hasta }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cargar el reporte.');
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    void load();
  }, [load]);

  const s = report?.settings ?? settings;
  const totals = useMemo(() => {
    const rows = report?.monthly ?? [];
    const igv = rows.reduce((a, r) => a + r.igv, 0);
    const cashback = rows.reduce((a, r) => a + r.cashback, 0);
    const compras = rows.reduce((a, r) => a + r.total, 0);
    const facturas = rows.reduce((a, r) => a + r.facturas, 0);
    return { igv, cashback, compras, facturas, ...cashbackNetEffect(s, igv, cashback) };
  }, [report, s]);

  const chartData = (report?.monthly ?? []).map((m) => {
    const eff = cashbackNetEffect(s, m.igv, m.cashback);
    return { periodo: periodLabel(m.periodo), IGV: m.igv, Cashback: m.cashback + eff.essalud, Neto: eff.neto };
  });

  const pendientes = (report?.byEstado ?? []).filter((e) => e.estado === 'en_revision' || e.estado === 'observada');
  const pendientesIgv = pendientes.reduce((a, r) => a + r.igv, 0);
  const rechazadas = report?.byEstado.find((e) => e.estado === 'rechazada');

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1">
            <Label>Desde</Label>
            <Input type="month" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Hasta</Label>
            <Input type="month" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <p className="flex-1 text-xs text-muted-foreground">
            Regla: {describeCashbackRule(s)}. Se consideran facturas aprobadas y liquidadas (periodo = mes de emisión).
          </p>
          {canExport && report ? (
            <Button variant="outline" onClick={() => exportCashbackReportExcel(report, `${desde}_${hasta}`)}>
              <Download className="mr-1 h-4 w-4" /> Excel
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {loading || !report ? (
        <div className="flex min-h-[160px] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Calculando…
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CashbackKpi title="IGV recuperado (crédito fiscal)" value={formatPen(totals.igv)} hint={`${totals.facturas} facturas · compras ${formatPen(totals.compras)}`} icon={Landmark} tone="text-sky-600 bg-sky-500/10" />
            <CashbackKpi
              title="Cashback reconocido"
              value={formatPen(totals.cashback)}
              hint={totals.essalud > 0 ? `+ EsSalud ${formatPen(totals.essalud)}` : 'Pago como reembolso'}
              icon={Wallet}
              tone="text-violet-600 bg-violet-500/10"
            />
            <CashbackKpi
              title="Beneficio neto empresa"
              value={formatPen(totals.neto)}
              hint={`Retiene ${totals.retencionPct}% del IGV`}
              icon={PiggyBank}
              valueClass={totals.neto >= 0 ? 'text-emerald-600' : 'text-rose-600'}
            />
            <CashbackKpi
              title="IGV en cola de revisión"
              value={formatPen(pendientesIgv)}
              hint={`${pendientes.reduce((a, r) => a + r.facturas, 0)} facturas · ${rechazadas?.facturas ?? 0} rechazadas`}
              icon={Receipt}
              tone="text-amber-600 bg-amber-500/10"
            />
          </div>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-emerald-500" /> IGV recuperado vs. costo del cashback por mes
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[280px]">
              {chartData.length === 0 ? (
                <p className="pt-16 text-center text-sm text-muted-foreground">Sin facturas aprobadas en el rango.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="periodo" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(v: number) => formatPen(v)} />
                    <Legend />
                    <Bar dataKey="IGV" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Cashback" name="Cashback (+EsSalud)" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Neto" name="Beneficio neto" fill="#34d399" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <AggTable
              title="Por categoría"
              rows={report.byCategoria.map((r) => ({ key: r.categoria, label: categoryLabel(s, r.categoria), ...r }))}
            />
            <AggTable title="Por sede" rows={report.bySede.map((r) => ({ key: r.sede, label: r.sede, ...r }))} />
            <AggTable
              title="Top emisores (dónde consumen)"
              rows={report.topEmisores.map((r) => ({ key: r.ruc, label: r.nombre || r.ruc, ...r }))}
            />
            <AggTable
              title="Colaboradores que más IGV sustentan"
              rows={report.topColaboradores.map((r) => ({ key: r.usuarioId, label: r.nombre, ...r }))}
            />
          </div>
        </>
      )}

      <CashbackSimulator settings={s} />
    </div>
  );
}

function AggTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ key: string; label: string; facturas: number; total: number; igv: number; cashback: number }>;
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-2" />
              <th className="p-2 text-right">Facturas</th>
              <th className="p-2 text-right">Compras</th>
              <th className="p-2 text-right">IGV</th>
              <th className="p-2 text-right">Cashback</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-xs text-muted-foreground">
                  Sin datos
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.key} className="border-t border-border">
                  <td className="max-w-[220px] truncate p-2" title={r.label}>
                    {r.label}
                  </td>
                  <td className="p-2 text-right">{r.facturas}</td>
                  <td className="p-2 text-right tabular-nums">{formatPen(r.total)}</td>
                  <td className="p-2 text-right tabular-nums">{formatPen(r.igv)}</td>
                  <td className="p-2 text-right tabular-nums">{formatPen(r.cashback)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function CashbackSimulator({ settings }: { settings: CashbackSettings }) {
  const [colaboradores, setColaboradores] = useState('100');
  const [facturas, setFacturas] = useState('8');
  const [ticket, setTicket] = useState('35');
  const sim = simulateCashback(settings, {
    colaboradores: Number(colaboradores) || 0,
    facturasPorColaboradorMes: Number(facturas) || 0,
    ticketPromedio: Number(ticket) || 0,
  });

  return (
    <Card className="border-emerald-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4 text-emerald-500" /> Simulador: ¿cuánto gana la empresa?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Colaboradores participantes</Label>
            <Input inputMode="numeric" value={colaboradores} onChange={(e) => setColaboradores(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Facturas por colaborador al mes</Label>
            <Input inputMode="numeric" value={facturas} onChange={(e) => setFacturas(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Ticket promedio con IGV (S/)</Label>
            <Input inputMode="decimal" value={ticket} onChange={(e) => setTicket(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-sky-500/10 p-3">
            <p className="text-xs text-muted-foreground">IGV recuperado / mes</p>
            <p className="text-lg font-bold tabular-nums">{formatPen(sim.igvMes)}</p>
            <p className="text-xs text-muted-foreground">{sim.facturasMes} facturas · compras {formatPen(sim.comprasMes)}</p>
          </div>
          <div className="rounded-lg bg-violet-500/10 p-3">
            <p className="text-xs text-muted-foreground">Cashback / mes</p>
            <p className="text-lg font-bold tabular-nums">{formatPen(sim.cashbackMes)}</p>
            <p className="text-xs text-muted-foreground">
              {sim.essaludMes > 0 ? `+ EsSalud ${formatPen(sim.essaludMes)}` : 'Sin EsSalud (reembolso)'}
            </p>
          </div>
          <div className="rounded-lg bg-emerald-500/10 p-3">
            <p className="text-xs text-muted-foreground">Beneficio neto</p>
            <p className={`text-lg font-bold tabular-nums ${sim.beneficioNetoMes >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatPen(sim.beneficioNetoMes)} / mes
            </p>
            <p className="text-xs text-muted-foreground">
              {formatPen(sim.beneficioNetoAnual)} al año · retiene {sim.retencionIgvPct}% del IGV
            </p>
          </div>
          <div className="rounded-lg bg-amber-500/10 p-3">
            <p className="text-xs text-muted-foreground">Para el colaborador</p>
            <p className="text-lg font-bold tabular-nums">{formatPen(sim.cashbackPorColaboradorMes)} / mes</p>
            <p className="text-xs text-muted-foreground">
              {sim.mesesParaLiberar !== null
                ? `Cobra cada ~${sim.mesesParaLiberar} mes(es) (meta ${formatPen(settings.releaseThreshold)})`
                : 'Sin cashback con esta regla'}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Referencia: el IGV es el 18% de la base, equivalente al 15.25% del precio final. El crédito fiscal solo procede si
          el gasto es causal para el negocio y la factura cumple los requisitos SUNAT; valida el tratamiento con tu contador.
        </p>
      </CardContent>
    </Card>
  );
}
