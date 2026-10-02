import { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Download, HandCoins, Loader2, RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';

import type { CashbackLiquidation, CashbackSettings, CashbackUserBalanceRow } from '../../types/cashback';
import {
  createCashbackLiquidation,
  fetchCashbackBalances,
  fetchCashbackLiquidations,
  markCashbackLiquidationPaid,
} from '../../utils/cashbackApi';
import { exportCashbackLiquidationExcel } from '../../utils/cashbackExport';
import { currentPeriod, formatPen, periodLabel } from '../../utils/cashbackRules';
import { appConfirm } from '../ui/app-dialog';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { CashbackKpi } from './CashbackShared';

type Props = {
  settings: CashbackSettings;
  canConfigure: boolean;
  onChanged: () => void;
};

export function CashbackLiquidationPanel({ settings, canConfigure, onChanged }: Props) {
  const [balances, setBalances] = useState<CashbackUserBalanceRow[]>([]);
  const [liquidations, setLiquidations] = useState<CashbackLiquidation[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState(currentPeriod());
  const [nota, setNota] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, l] = await Promise.all([fetchCashbackBalances(), fetchCashbackLiquidations()]);
      setBalances(b);
      setLiquidations(l);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron cargar los saldos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const releasable = useMemo(() => balances.filter((b) => b.liberable), [balances]);
  const pendingTotal = balances.reduce((s, b) => s + b.acumulado, 0);
  const releasableTotal = releasable.reduce((s, b) => s + b.acumulado, 0);
  const essaludRate = settings.payoutTreatment === 'remuneracion' ? settings.essaludRate / 100 : 0;
  const unlinked = releasable.filter((b) => !b.vinculado).length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const generate = async (forceSelected: boolean) => {
    const ids = [...selected];
    const msg = forceSelected
      ? `¿Liquidar a ${ids.length} colaborador(es) seleccionados aunque no alcancen la meta (p. ej. por cese)?`
      : `¿Generar la liquidación de ${periodLabel(periodo)} para ${releasable.length} colaborador(es) por ${formatPen(releasableTotal)}?`;
    if (!(await appConfirm(msg))) return;
    setCreating(true);
    try {
      const liq = await createCashbackLiquidation({
        periodo,
        nota: nota.trim() || undefined,
        ...(forceSelected ? { usuarioIds: ids, ignorarUmbral: true } : {}),
      });
      toast.success(`Liquidación #${liq.id} generada: ${formatPen(liq.montoTotal)}.`);
      exportCashbackLiquidationExcel(liq);
      setSelected(new Set());
      setNota('');
      await load();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo generar la liquidación.');
    } finally {
      setCreating(false);
    }
  };

  const markPaid = async (liq: CashbackLiquidation) => {
    if (!(await appConfirm(`¿Confirmas que la liquidación #${liq.id} (${formatPen(liq.montoTotal)}) ya fue pagada?`))) return;
    try {
      const updated = await markCashbackLiquidationPaid(liq.id);
      setLiquidations((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      toast.success('Liquidación marcada como pagada.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[160px] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando saldos…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CashbackKpi title="Saldo aprobado sin pagar" value={formatPen(pendingTotal)} hint={`${balances.filter((b) => b.acumulado > 0).length} colaboradores`} icon={HandCoins} />
        <CashbackKpi title="Listo para liberar" value={formatPen(releasableTotal)} hint={`${releasable.length} alcanzaron ${formatPen(settings.releaseThreshold)}`} icon={BadgeCheck} tone="text-violet-600 bg-violet-500/10" />
        <CashbackKpi
          title="EsSalud estimado"
          value={formatPen(releasableTotal * essaludRate)}
          hint={settings.payoutTreatment === 'remuneracion' ? `${settings.essaludRate}% (pago por planilla)` : 'No aplica (reembolso)'}
          icon={Users}
          tone="text-amber-600 bg-amber-500/10"
        />
        <CashbackKpi title="Liquidaciones" value={String(liquidations.length)} hint={`${liquidations.filter((l) => l.estado === 'generada').length} por pagar`} icon={Download} tone="text-sky-600 bg-sky-500/10" />
      </div>

      {canConfigure ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Generar liquidación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end">
              <div className="space-y-1">
                <Label>Periodo de pago</Label>
                <Input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Nota (opcional)</Label>
                <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. Pago con planilla de octubre" />
              </div>
              <Button onClick={() => void generate(false)} disabled={creating || releasable.length === 0} className="bg-emerald-600 text-white hover:bg-emerald-500">
                {creating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <HandCoins className="mr-1 h-4 w-4" />}
                Liquidar {releasable.length} colaborador(es)
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Incluye a quienes alcanzaron la meta de {formatPen(settings.releaseThreshold)}. Las facturas pasan a «liquidada» y se
              descarga el Excel para Contabilidad/Tesorería. Tratamiento configurado:{' '}
              <strong>{settings.payoutTreatment === 'remuneracion' ? 'remuneración (planilla)' : 'reembolso'}</strong>.
              {unlinked > 0 ? ` Atención: ${unlinked} colaborador(es) sin ficha Buk vinculada.` : ''}
            </p>
            {selected.size > 0 ? (
              <Button variant="outline" size="sm" onClick={() => void generate(true)} disabled={creating}>
                Liquidar seleccionados sin meta ({selected.size}) — cese u otros casos
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Saldos por colaborador</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-1 h-4 w-4" /> Actualizar
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                {canConfigure ? <th className="w-8 p-2" /> : null}
                <th className="p-2">Colaborador</th>
                <th className="p-2">Sede</th>
                <th className="p-2 text-right">Aprobadas</th>
                <th className="p-2 text-right">Pendientes</th>
                <th className="p-2 text-right">Acumulado</th>
                <th className="p-2 text-right">Falta</th>
                <th className="p-2 text-right">Ya pagado</th>
              </tr>
            </thead>
            <tbody>
              {balances.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">
                    Aún no hay facturas registradas.
                  </td>
                </tr>
              ) : (
                balances.map((b) => (
                  <tr key={b.usuarioId} className="border-t border-border">
                    {canConfigure ? (
                      <td className="p-2">
                        <Checkbox checked={selected.has(b.usuarioId)} onCheckedChange={() => toggle(b.usuarioId)} disabled={b.acumulado <= 0} />
                      </td>
                    ) : null}
                    <td className="p-2">
                      <p className="font-medium">{b.usuarioNombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.colaboradorDoc ?? ''} {!b.vinculado ? <span className="text-amber-600">· sin ficha Buk</span> : null}
                      </p>
                    </td>
                    <td className="p-2">{b.sede ?? '—'}</td>
                    <td className="p-2 text-right">{b.aprobadas}</td>
                    <td className="p-2 text-right">{b.pendientes}</td>
                    <td className={`p-2 text-right font-semibold tabular-nums ${b.liberable ? 'text-emerald-600' : ''}`}>{formatPen(b.acumulado)}</td>
                    <td className="p-2 text-right tabular-nums">{b.liberable ? 'Listo' : formatPen(b.faltante)}</td>
                    <td className="p-2 text-right tabular-nums">{formatPen(b.liquidado)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Historial de liquidaciones</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-2">#</th>
                <th className="p-2">Periodo</th>
                <th className="p-2 text-right">Colaboradores</th>
                <th className="p-2 text-right">Facturas</th>
                <th className="p-2 text-right">IGV sustentado</th>
                <th className="p-2 text-right">Monto</th>
                <th className="p-2">Estado</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {liquidations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">
                    Sin liquidaciones todavía.
                  </td>
                </tr>
              ) : (
                liquidations.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="p-2">{l.id}</td>
                    <td className="p-2 capitalize">
                      {periodLabel(l.periodo)}
                      <p className="text-xs text-muted-foreground">{l.creadoPorNombre ?? ''}</p>
                    </td>
                    <td className="p-2 text-right">{l.colaboradores}</td>
                    <td className="p-2 text-right">{l.facturas}</td>
                    <td className="p-2 text-right tabular-nums">{formatPen(l.igvTotal)}</td>
                    <td className="p-2 text-right font-semibold tabular-nums">{formatPen(l.montoTotal)}</td>
                    <td className="p-2">
                      {l.estado === 'pagada' ? (
                        <span className="text-emerald-600">Pagada {l.pagadoAt?.slice(0, 10)}</span>
                      ) : (
                        <span className="text-amber-600">Por pagar</span>
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => exportCashbackLiquidationExcel(l)}>
                          <Download className="mr-1 h-4 w-4" /> Excel
                        </Button>
                        {canConfigure && l.estado === 'generada' ? (
                          <Button variant="outline" size="sm" onClick={() => void markPaid(l)}>
                            Marcar pagada
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
