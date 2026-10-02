import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Eye, Loader2, MessageSquareWarning, RefreshCw, RotateCcw, Search, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import type { CashbackInvoice, CashbackReviewAction, CashbackSettings } from '../../types/cashback';
import { fetchCashbackPhoto, listCashbackInvoices, reviewCashbackInvoice } from '../../utils/cashbackApi';
import { exportCashbackInvoicesExcel } from '../../utils/cashbackExport';
import { categoryLabel, computeCashback, currentPeriod, formatPen, parseMoney, shiftPeriod } from '../../utils/cashbackRules';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { CashbackPhotoDialog, CashbackStateBadge } from './CashbackShared';

type Props = {
  settings: CashbackSettings;
  canReview: boolean;
  canExport: boolean;
  onChanged: () => void;
};

const ESTADOS = [
  { id: 'pendientes', label: 'Pendientes (revisión + observadas)' },
  { id: 'en_revision', label: 'En revisión' },
  { id: 'observada', label: 'Observadas' },
  { id: 'aprobada', label: 'Aprobadas' },
  { id: 'rechazada', label: 'Rechazadas' },
  { id: 'liquidada', label: 'Liquidadas' },
  { id: 'todas', label: 'Todas' },
];

export function CashbackReviewPanel({ settings, canReview, canExport, onChanged }: Props) {
  const [estado, setEstado] = useState('pendientes');
  const [desde, setDesde] = useState(shiftPeriod(currentPeriod(), -2));
  const [hasta, setHasta] = useState(currentPeriod());
  const [q, setQ] = useState('');
  const [items, setItems] = useState<CashbackInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<CashbackInvoice | null>(null);
  const [photoOf, setPhotoOf] = useState<CashbackInvoice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(
        await listCashbackInvoices({
          estado: estado === 'todas' ? '' : estado,
          desde,
          hasta,
          q: q.trim(),
        })
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cargar la bandeja.');
    } finally {
      setLoading(false);
    }
  }, [estado, desde, hasta, q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const totals = items.reduce(
    (acc, i) => ({ total: acc.total + i.total, igv: acc.igv + i.igv, cb: acc.cb + (i.cashbackMonto ?? 0) }),
    { total: 0, igv: 0, cb: 0 }
  );

  const handleReviewed = (updated: CashbackInvoice) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setReviewing(null);
    onChanged();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1 lg:col-span-2">
            <Label>Estado</Label>
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Desde</Label>
            <Input type="month" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Hasta</Label>
            <Input type="month" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Colaborador, RUC, F001-…" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {items.length} facturas · Compras {formatPen(totals.total)} · IGV {formatPen(totals.igv)} · Cashback {formatPen(totals.cb)}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-1 h-4 w-4" /> Actualizar
          </Button>
          {canExport ? (
            <Button
              variant="outline"
              size="sm"
              disabled={items.length === 0}
              onClick={() => exportCashbackInvoicesExcel(items, settings, `${desde}_${hasta}`)}
            >
              <Download className="mr-1 h-4 w-4" /> Excel (registro de compras)
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[160px] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando facturas…
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">No hay facturas con estos filtros.</CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-2">Colaborador</th>
                <th className="p-2">Comprobante</th>
                <th className="p-2">Emisor</th>
                <th className="p-2">Categoría</th>
                <th className="p-2 text-right">Total</th>
                <th className="p-2 text-right">IGV</th>
                <th className="p-2 text-right">Cashback</th>
                <th className="p-2">Estado</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((inv) => (
                <tr key={inv.id} className="border-t border-border align-top">
                  <td className="p-2">
                    <p className="font-medium">{inv.usuarioNombre}</p>
                    <p className="text-xs text-muted-foreground">{inv.sede ?? 'Sin sede'}</p>
                  </td>
                  <td className="p-2">
                    <p>
                      {inv.serie}-{inv.numero}
                    </p>
                    <p className="text-xs text-muted-foreground">{inv.fechaEmision}</p>
                  </td>
                  <td className="p-2">
                    <p className="max-w-[220px] truncate">{inv.emisorNombre || '—'}</p>
                    <p className="text-xs text-muted-foreground">{inv.emisorRuc}</p>
                  </td>
                  <td className="p-2">
                    <p>{categoryLabel(settings, inv.categoria)}</p>
                    <p className="max-w-[220px] truncate text-xs text-muted-foreground" title={inv.motivo}>
                      {inv.motivo}
                    </p>
                  </td>
                  <td className="p-2 text-right tabular-nums">{formatPen(inv.total)}</td>
                  <td className="p-2 text-right tabular-nums">{formatPen(inv.igv)}</td>
                  <td className="p-2 text-right tabular-nums">{inv.cashbackMonto !== null ? formatPen(inv.cashbackMonto) : '—'}</td>
                  <td className="p-2">
                    <CashbackStateBadge state={inv.estado} />
                    {inv.alertas.length > 0 ? (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600" title={inv.alertas.join('\n')}>
                        <AlertTriangle className="h-3 w-3" /> {inv.alertas.length} alerta{inv.alertas.length === 1 ? '' : 's'}
                      </p>
                    ) : null}
                  </td>
                  <td className="p-2">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Ver comprobante" onClick={() => setPhotoOf(inv)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canReview ? (
                        <Button variant="outline" size="sm" onClick={() => setReviewing(inv)}>
                          Revisar
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CashbackReviewDialog invoice={reviewing} settings={settings} onClose={() => setReviewing(null)} onReviewed={handleReviewed} />
      <CashbackPhotoDialog invoice={photoOf} onOpenChange={(v) => !v && setPhotoOf(null)} />
    </div>
  );
}

function CashbackReviewDialog({
  invoice,
  settings,
  onClose,
  onReviewed,
}: {
  invoice: CashbackInvoice | null;
  settings: CashbackSettings;
  onClose: () => void;
  onReviewed: (inv: CashbackInvoice) => void;
}) {
  const [photo, setPhoto] = useState('');
  const [note, setNote] = useState('');
  const [igv, setIgv] = useState('');
  const [total, setTotal] = useState('');
  const [busy, setBusy] = useState<CashbackReviewAction | null>(null);
  const id = invoice?.id ?? null;

  useEffect(() => {
    setPhoto('');
    setNote('');
    if (!invoice) return;
    setIgv(invoice.igv.toFixed(2));
    setTotal(invoice.total.toFixed(2));
    let cancelled = false;
    if (invoice.hasPhoto) {
      fetchCashbackPhoto(invoice.id)
        .then((p) => !cancelled && setPhoto(p.dataUrl))
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!invoice) return null;
  const igvNum = parseMoney(igv) ?? invoice.igv;
  const totalNum = parseMoney(total) ?? invoice.total;
  const preview = computeCashback(settings, igvNum, totalNum);
  const isPdf = photo.startsWith('data:application/pdf');
  const reviewable = invoice.estado === 'en_revision' || invoice.estado === 'observada';
  const reopenable = invoice.estado === 'aprobada' || invoice.estado === 'rechazada' || invoice.estado === 'observada';

  const act = async (action: CashbackReviewAction) => {
    if ((action === 'observe' || action === 'reject') && note.trim().length < 4) {
      toast.error('Escribe el motivo para el colaborador.');
      return;
    }
    setBusy(action);
    try {
      const corrected =
        action === 'approve'
          ? {
              igv: igvNum !== invoice.igv ? igvNum : null,
              total: totalNum !== invoice.total ? totalNum : null,
            }
          : {};
      const updated = await reviewCashbackInvoice(invoice.id, action, { note: note.trim(), ...corrected });
      toast.success(
        action === 'approve'
          ? `Aprobada: ${formatPen(updated.cashbackMonto ?? 0)} de cashback.`
          : action === 'observe'
            ? 'Factura observada: el colaborador podrá corregirla.'
            : action === 'reject'
              ? 'Factura rechazada.'
              : 'Factura devuelta a revisión.'
      );
      onReviewed(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo registrar la revisión.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Revisar {invoice.serie}-{invoice.numero}
          </DialogTitle>
          <DialogDescription>
            {invoice.usuarioNombre} · {invoice.sede ?? 'Sin sede'} · enviada {invoice.createdAt.slice(0, 16)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex min-h-[300px] items-center justify-center rounded-lg border bg-muted/30 p-2">
            {!photo ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : isPdf ? (
              <iframe title="Comprobante" src={photo} className="h-[60vh] w-full rounded" />
            ) : (
              <img src={photo} alt="Comprobante" className="max-h-[60vh] rounded object-contain" />
            )}
          </div>
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-[130px_1fr] gap-x-2 gap-y-1">
              <dt className="text-muted-foreground">Emisor</dt>
              <dd>
                {invoice.emisorNombre || '—'} <span className="text-muted-foreground">({invoice.emisorRuc})</span>
              </dd>
              <dt className="text-muted-foreground">SUNAT</dt>
              <dd>
                {invoice.emisorEstado || '—'} / {invoice.emisorCondicion || '—'}
              </dd>
              <dt className="text-muted-foreground">Adquirente</dt>
              <dd>{invoice.compradorRuc || '—'}</dd>
              <dt className="text-muted-foreground">Fecha</dt>
              <dd>{invoice.fechaEmision}</dd>
              <dt className="text-muted-foreground">Categoría</dt>
              <dd>{categoryLabel(settings, invoice.categoria)}</dd>
              <dt className="text-muted-foreground">Motivo</dt>
              <dd>{invoice.motivo}</dd>
              {invoice.centroCosto ? (
                <>
                  <dt className="text-muted-foreground">Centro de costo</dt>
                  <dd>{invoice.centroCosto}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Estado</dt>
              <dd>
                <CashbackStateBadge state={invoice.estado} />
              </dd>
            </dl>

            {invoice.alertas.length > 0 ? (
              <div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200">
                {invoice.alertas.map((a) => (
                  <p key={a} className="flex items-start gap-1">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {a}
                  </p>
                ))}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Total (corrige si no coincide)</Label>
                <Input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} disabled={!reviewable} />
              </div>
              <div className="space-y-1">
                <Label>IGV</Label>
                <Input inputMode="decimal" value={igv} onChange={(e) => setIgv(e.target.value)} disabled={!reviewable} />
              </div>
            </div>
            {reviewable ? (
              <p className="rounded-lg bg-emerald-500/10 p-2 text-emerald-800 dark:text-emerald-200">
                Al aprobar se reconocen <strong>{formatPen(preview)}</strong> de cashback.
              </p>
            ) : null}

            <div className="space-y-1">
              <Label>Nota para el colaborador (obligatoria al observar o rechazar)</Label>
              <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. La factura incluye cerveza; no está a nombre de la empresa…" />
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {['Incluye bebidas alcohólicas', 'Bien de uso personal', 'Foto ilegible', 'No está a nombre de la empresa', 'Montos no coinciden con la foto'].map((t) => (
                <button key={t} type="button" className="rounded-full border px-2 py-0.5 hover:bg-muted" onClick={() => setNote(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          {reopenable && !reviewable ? (
            <Button variant="outline" onClick={() => void act('reopen')} disabled={busy !== null}>
              <RotateCcw className="mr-1 h-4 w-4" /> Devolver a revisión
            </Button>
          ) : null}
          {reviewable ? (
            <>
              <Button variant="outline" className="border-rose-500/50 text-rose-600" onClick={() => void act('reject')} disabled={busy !== null}>
                {busy === 'reject' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <XCircle className="mr-1 h-4 w-4" />} Rechazar
              </Button>
              <Button variant="outline" className="border-amber-500/50 text-amber-700" onClick={() => void act('observe')} disabled={busy !== null}>
                {busy === 'observe' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <MessageSquareWarning className="mr-1 h-4 w-4" />} Observar
              </Button>
              <Button className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => void act('approve')} disabled={busy !== null}>
                {busy === 'approve' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />} Aprobar
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
