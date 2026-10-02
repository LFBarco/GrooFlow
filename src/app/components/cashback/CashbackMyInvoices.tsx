import { useMemo, useState } from 'react';
import { AlertTriangle, Camera, Clock, Eye, Gift, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';

import type { CashbackInvoice, CashbackMeResponse } from '../../types/cashback';
import { deleteCashbackInvoice } from '../../utils/cashbackApi';
import { categoryLabel, describeCashbackRule, formatPen, periodLabel } from '../../utils/cashbackRules';
import { appConfirm } from '../ui/app-dialog';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Progress } from '../ui/progress';
import { CashbackKpi, CashbackPhotoDialog, CashbackStateBadge } from './CashbackShared';

type Props = {
  data: CashbackMeResponse;
  onNew: () => void;
  onEdit: (invoice: CashbackInvoice) => void;
  onChanged: () => void;
};

export function CashbackMyInvoices({ data, onNew, onEdit, onChanged }: Props) {
  const { balance, settings, colaborador, capabilities } = data;
  const [photoOf, setPhotoOf] = useState<CashbackInvoice | null>(null);
  const progress = balance.umbral > 0 ? Math.min(100, (balance.acumulado / balance.umbral) * 100) : 100;

  const grouped = useMemo(() => {
    const map = new Map<string, CashbackInvoice[]>();
    for (const inv of data.invoices) {
      const list = map.get(inv.periodo) ?? [];
      list.push(inv);
      map.set(inv.periodo, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [data.invoices]);

  const remove = async (inv: CashbackInvoice) => {
    if (!(await appConfirm(`¿Eliminar la factura ${inv.serie}-${inv.numero}?`))) return;
    try {
      await deleteCashbackInvoice(inv.id);
      toast.success('Factura eliminada.');
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar.');
    }
  };

  return (
    <div className="space-y-5">
      {!colaborador.linked ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Tu usuario aún no está vinculado a tu ficha de colaborador. Puedes subir facturas, pero pide a RR.HH. que lo
          vincule para poder liquidarte el cashback.
        </div>
      ) : null}

      <Card className="overflow-hidden border-emerald-500/30">
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Tu cashback acumulado</p>
              <p className="text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatPen(balance.acumulado)}</p>
              <p className="text-xs text-muted-foreground">Regla vigente: {describeCashbackRule(settings)}</p>
            </div>
            {capabilities.submit ? (
              <Button size="lg" onClick={onNew} className="bg-emerald-600 text-white hover:bg-emerald-500">
                <Camera className="mr-2 h-5 w-5" /> Subir factura
              </Button>
            ) : null}
          </div>
          <Progress value={progress} className="h-3" />
          <p className="text-sm">
            {balance.liberable ? (
              <span className="font-medium text-emerald-700 dark:text-emerald-300">
                ¡Alcanzaste el monto para liberar ({formatPen(balance.umbral)})! Se pagará en la próxima liquidación.
              </span>
            ) : (
              <>
                Te faltan <strong>{formatPen(balance.faltante)}</strong> para liberar tu pago (meta {formatPen(balance.umbral)}). El
                saldo no se pierde: se acumula mes a mes.
              </>
            )}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CashbackKpi title="En revisión" value={String(balance.enRevision)} hint="Contabilidad las está validando" icon={Clock} tone="text-sky-600 bg-sky-500/10" />
        <CashbackKpi title="Observadas" value={String(balance.observadas)} hint="Corrígelas para no perderlas" icon={AlertTriangle} tone="text-amber-600 bg-amber-500/10" />
        <CashbackKpi title="Aprobadas por pagar" value={String(balance.aprobadas)} hint={formatPen(balance.acumulado)} icon={Wallet} />
        <CashbackKpi title="Ya recibido" value={formatPen(balance.liquidado)} hint="Total liquidado" icon={Gift} tone="text-violet-600 bg-violet-500/10" />
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">Se aceptan:</strong>{' '}
        {settings.categories.filter((c) => c.enabled).map((c) => c.label).join(', ')}. {settings.excludedNote} Solo facturas
        (no boletas) a nombre de la empresa, con antigüedad máxima de {settings.maxDaysOld} días.
      </div>

      {grouped.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center text-muted-foreground">
            <Camera className="h-10 w-10 text-emerald-500" />
            <p>Aún no subiste facturas. Pide factura con el RUC de la empresa en tus consumos y súbela aquí.</p>
            {capabilities.submit ? (
              <Button onClick={onNew}>
                <Plus className="mr-1 h-4 w-4" /> Subir mi primera factura
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        grouped.map(([periodo, list]) => (
          <div key={periodo} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <h3 className="font-semibold capitalize">{periodLabel(periodo)}</h3>
              <span className="text-muted-foreground">
                {list.length} factura{list.length === 1 ? '' : 's'} ·{' '}
                {formatPen(list.reduce((s, i) => s + (i.cashbackMonto ?? 0), 0))} reconocido
              </span>
            </div>
            <div className="grid gap-2">
              {list.map((inv) => (
                <Card key={inv.id} className="border-border dark:border-slate-700">
                  <CardContent className="flex flex-wrap items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{inv.emisorNombre || inv.emisorRuc}</span>
                        <CashbackStateBadge state={inv.estado} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {inv.serie}-{inv.numero} · {inv.fechaEmision} · {categoryLabel(settings, inv.categoria)} · Total{' '}
                        {formatPen(inv.total)} · IGV {formatPen(inv.igv)}
                      </p>
                      {inv.notaRevision && (inv.estado === 'observada' || inv.estado === 'rechazada') ? (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Motivo: {inv.notaRevision}</p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {inv.cashbackMonto !== null ? formatPen(inv.cashbackMonto) : '—'}
                      </p>
                      <p className="text-[11px] text-muted-foreground">cashback</p>
                    </div>
                    <div className="flex gap-1">
                      {inv.hasPhoto ? (
                        <Button variant="ghost" size="icon" title="Ver comprobante" onClick={() => setPhotoOf(inv)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      ) : null}
                      {inv.estado === 'observada' || inv.estado === 'en_revision' ? (
                        <Button variant="ghost" size="icon" title="Corregir" onClick={() => onEdit(inv)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      ) : null}
                      {inv.estado === 'observada' || inv.estado === 'en_revision' || inv.estado === 'rechazada' ? (
                        <Button variant="ghost" size="icon" title="Eliminar" onClick={() => void remove(inv)}>
                          <Trash2 className="h-4 w-4 text-rose-500" />
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      <CashbackPhotoDialog invoice={photoOf} onOpenChange={(v) => !v && setPhotoOf(null)} />
    </div>
  );
}
