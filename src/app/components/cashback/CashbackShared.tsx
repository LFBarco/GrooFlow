import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Download, Loader2 } from 'lucide-react';

import type { CashbackInvoice, CashbackInvoiceState } from '../../types/cashback';
import { fetchCashbackPhoto } from '../../utils/cashbackApi';
import { CASHBACK_STATE_LABEL, CASHBACK_STATE_TONE } from '../../utils/cashbackRules';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { cn } from '../ui/utils';

export function CashbackStateBadge({ state }: { state: CashbackInvoiceState }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium', CASHBACK_STATE_TONE[state])}>
      {CASHBACK_STATE_LABEL[state]}
    </span>
  );
}

export function CashbackKpi({
  title,
  value,
  hint,
  icon: Icon,
  tone = 'text-emerald-600 bg-emerald-500/10',
  valueClass,
}: {
  title: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: string;
  valueClass?: string;
}) {
  return (
    <Card className="border-border dark:border-slate-700">
      <CardContent className="flex items-start gap-3 p-4">
        <div className={cn('rounded-lg p-2', tone)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className={cn('truncate text-xl font-bold tabular-nums', valueClass)}>{value}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function CashbackPhotoDialog({
  invoice,
  onOpenChange,
}: {
  invoice: CashbackInvoice | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [dataUrl, setDataUrl] = useState('');
  const [error, setError] = useState('');
  const id = invoice?.id ?? null;

  useEffect(() => {
    setDataUrl('');
    setError('');
    if (!id) return;
    let cancelled = false;
    fetchCashbackPhoto(id)
      .then((p) => !cancelled && setDataUrl(p.dataUrl))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'No se pudo cargar el comprobante.'));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const isPdf = dataUrl.startsWith('data:application/pdf');

  return (
    <Dialog open={invoice !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {invoice ? `${invoice.serie}-${invoice.numero} · ${invoice.emisorNombre ?? invoice.emisorRuc}` : 'Comprobante'}
          </DialogTitle>
          <DialogDescription>{invoice ? `${invoice.usuarioNombre} · ${invoice.fechaEmision}` : ''}</DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {!dataUrl && !error ? (
          <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando comprobante…
          </div>
        ) : null}
        {dataUrl && !isPdf ? <img src={dataUrl} alt="Comprobante" className="mx-auto max-h-[75vh] rounded-lg object-contain" /> : null}
        {dataUrl && isPdf ? <iframe title="Comprobante PDF" src={dataUrl} className="h-[70vh] w-full rounded-lg border" /> : null}
        {dataUrl ? (
          <div className="flex justify-end">
            <Button asChild variant="outline" size="sm">
              <a href={dataUrl} download={`factura_${invoice?.serie}-${invoice?.numero}.${isPdf ? 'pdf' : 'jpg'}`}>
                <Download className="mr-1 h-4 w-4" /> Descargar
              </a>
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
