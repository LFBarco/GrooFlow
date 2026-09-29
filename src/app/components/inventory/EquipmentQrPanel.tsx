import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { Barcode, Download, Printer, QrCode } from 'lucide-react';
import { toast } from 'sonner';

import type { InventoryEquipment } from '../../types/inventory';
import { buildInventoryQrPayload } from '../../utils/inventoryCodeGenerator';
import {
  LABEL_SIZE_PRESETS,
  loadLabelPrintOptions,
  printInventoryLabels,
  saveLabelPrintOptions,
  type LabelPrintOptions,
  type LabelSizeId,
  type LabelSymbology,
} from '../../utils/inventoryLabelPrint';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

type EquipmentQrPanelProps = {
  equipment: Pick<InventoryEquipment, 'id' | 'code' | 'name' | 'sede' | 'floor' | 'room'>;
  visible?: boolean;
  variant?: 'default' | 'compact';
  /** Equipo aún no guardado: la etiqueta impresa podría cambiar de código. */
  isUnsaved?: boolean;
};

const SYMBOLOGY_OPTIONS: { id: LabelSymbology; label: string }[] = [
  { id: 'qr', label: 'QR' },
  { id: 'barcode', label: 'Barras' },
  { id: 'both', label: 'Ambos' },
];

export function EquipmentQrPanel({
  equipment,
  visible = true,
  variant = 'default',
  isUnsaved = false,
}: EquipmentQrPanelProps) {
  const qrRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLCanvasElement>(null);
  const [opts, setOpts] = useState<LabelPrintOptions>(() => loadLabelPrintOptions());
  const [printing, setPrinting] = useState(false);
  const code = (equipment.code || '').trim();
  const qrSize = variant === 'compact' ? 150 : 190;
  const showQr = opts.symbology !== 'barcode';
  const showBar = opts.symbology !== 'qr';

  const updateOpts = (partial: Partial<LabelPrintOptions>) => {
    setOpts((prev) => {
      const next = { ...prev, ...partial };
      saveLabelPrintOptions(next);
      return next;
    });
  };

  useEffect(() => {
    const el = qrRef.current;
    if (!el || !visible || !showQr) return;
    if (!code) {
      el.getContext('2d')?.clearRect(0, 0, el.width, el.height);
      return;
    }
    void QRCode.toCanvas(el, buildInventoryQrPayload(equipment), {
      width: qrSize,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    }).catch(() => {
      el.getContext('2d')?.clearRect(0, 0, el.width, el.height);
    });
  }, [code, equipment, visible, qrSize, showQr]);

  useEffect(() => {
    const el = barRef.current;
    if (!el || !visible || !showBar || !code) return;
    try {
      JsBarcode(el, code, {
        format: 'CODE128',
        width: 1.6,
        height: 56,
        displayValue: false,
        margin: 8,
        background: '#ffffff',
        lineColor: '#0f172a',
      });
    } catch {
      el.getContext('2d')?.clearRect(0, 0, el.width, el.height);
    }
  }, [code, visible, showBar]);

  const download = (kind: 'qr' | 'barcode') => {
    const el = kind === 'qr' ? qrRef.current : barRef.current;
    if (!el || !code) return;
    const link = document.createElement('a');
    link.download = `${kind === 'qr' ? 'QR' : 'BARRAS'}-${code.replace(/[^a-zA-Z0-9-_]/g, '_')}.png`;
    link.href = el.toDataURL('image/png');
    link.click();
  };

  const printLabel = async () => {
    if (!code) return;
    setPrinting(true);
    try {
      await printInventoryLabels([equipment], opts);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo imprimir la etiqueta.');
    } finally {
      setPrinting(false);
    }
  };

  if (!code) {
    return (
      <div
        className={
          variant === 'compact'
            ? 'rounded-lg border border-dashed p-4 text-center space-y-2'
            : 'text-xs text-muted-foreground rounded-lg border border-dashed p-3 text-center'
        }
      >
        {variant === 'compact' && (
          <QrCode className="h-8 w-8 mx-auto text-muted-foreground/50" />
        )}
        <p className="text-xs text-muted-foreground">
          Completa categoría y ubicación para generar el código y la etiqueta.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {variant === 'compact' && (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <QrCode className="h-3.5 w-3.5" />
          Etiqueta del equipo
        </p>
      )}
      <div className="rounded-lg border bg-background p-3 flex flex-col items-center gap-2">
        <div className="grid w-full grid-cols-3 gap-1 rounded-md bg-muted p-0.5">
          {SYMBOLOGY_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => updateOpts({ symbology: o.id })}
              className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                opts.symbology === o.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {showQr && <canvas ref={qrRef} className="rounded-md bg-white" />}
        {showBar && <canvas ref={barRef} className="max-w-full rounded-md bg-white" />}
        <p className="font-mono text-xs font-semibold text-center break-all">{code}</p>
        {equipment.name && (
          <p className="text-[11px] text-muted-foreground text-center line-clamp-2">{equipment.name}</p>
        )}
        <Select value={opts.sizeId} onValueChange={(v) => updateOpts({ sizeId: v as LabelSizeId })}>
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LABEL_SIZE_PRESETS.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-xs">
                {p.label} — {p.hint}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" className="w-full" onClick={() => void printLabel()} disabled={printing}>
          <Printer className="h-3.5 w-3.5 mr-1" />
          Imprimir etiqueta
        </Button>
        <div className="grid w-full grid-cols-2 gap-1">
          {showQr && (
            <Button type="button" variant="outline" size="sm" className={showBar ? '' : 'col-span-2'} onClick={() => download('qr')}>
              <Download className="h-3.5 w-3.5 mr-1" />
              QR
            </Button>
          )}
          {showBar && (
            <Button type="button" variant="outline" size="sm" className={showQr ? '' : 'col-span-2'} onClick={() => download('barcode')}>
              <Barcode className="h-3.5 w-3.5 mr-1" />
              Barras
            </Button>
          )}
        </div>
      </div>
      {isUnsaved && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-snug">
          Guarda el equipo antes de imprimir: el código cambia si modificas categoría o ubicación.
        </p>
      )}
    </div>
  );
}
