import { useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, FileText, Loader2, QrCode, X } from 'lucide-react';
import { toast } from 'sonner';

import { InventoryQrScannerDialog } from '../inventory/InventoryQrScannerDialog';
import { cn } from '../ui/utils';

const MAX_IMAGE_SIDE = 1800;
export const RECEIPT_MAX_FILE_BYTES = 2_500_000;

export async function compressReceiptImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.82);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

type Props = {
  /** Data URL de la foto/PDF actual ('' si no hay). */
  photo: string;
  onPhotoChange: (dataUrl: string) => void;
  /** Recibe el texto leído (cámara o foto); devuelve true si era un QR de comprobante válido. */
  onQr: (raw: string) => boolean;
  error?: string;
  compact?: boolean;
  /** Permite quitar la foto (cuando es opcional). */
  removable?: boolean;
  photoHint?: string;
  documentLabel?: string;
  onProcessingChange?: (processing: boolean) => void;
};

/** Botones «Tomar foto / subir PDF» y «Escanear QR» con lectura automática del QR desde la foto. */
export function ReceiptCapture({
  photo,
  onPhotoChange,
  onQr,
  error,
  compact = false,
  removable = false,
  photoHint,
  documentLabel = 'boleta o factura',
  onProcessingChange,
}: Props) {
  const rawId = useId();
  const regionId = `receipt-qr-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [processing, setProcessingState] = useState(false);
  const setProcessing = (v: boolean) => {
    setProcessingState(v);
    onProcessingChange?.(v);
  };
  const [scannerOpen, setScannerOpen] = useState(false);
  const isPdf = photo.startsWith('data:application/pdf');

  const tryReadQrFromFile = async (file: File) => {
    let reader: Html5Qrcode | null = null;
    try {
      reader = new Html5Qrcode(regionId, { verbose: false });
      const text = await reader.scanFile(file, false);
      if (onQr(text)) toast.success('QR detectado en la foto: datos completados.');
    } catch {
      /* sin QR legible en la foto: se completa a mano */
    } finally {
      try {
        reader?.clear();
      } catch {
        /* noop */
      }
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setProcessing(true);
    try {
      if (file.type === 'application/pdf') {
        if (file.size > RECEIPT_MAX_FILE_BYTES) {
          toast.error('El PDF supera 2.5 MB.');
          return;
        }
        onPhotoChange(await readAsDataUrl(file));
      } else if (file.type.startsWith('image/')) {
        onPhotoChange(await compressReceiptImage(file));
        void tryReadQrFromFile(file);
      } else {
        toast.error('Formato no admitido. Usa una foto o un PDF.');
      }
    } catch {
      toast.error('No se pudo procesar el archivo. Intenta con otra foto.');
    } finally {
      setProcessing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleScan = (raw: string) => {
    setScannerOpen(false);
    if (onQr(raw)) toast.success('Datos del comprobante leídos del QR.');
    else toast.error(`El código no corresponde a un QR de ${documentLabel} electrónica SUNAT.`);
  };

  const box = compact ? 'min-h-[84px]' : 'min-h-[120px]';
  const icon = compact ? 'h-6 w-6' : 'h-8 w-8';

  return (
    <div className="space-y-1">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-3 text-sm transition',
              box,
              error ? 'border-rose-500/60 bg-rose-500/5' : 'border-emerald-500/40 hover:bg-emerald-500/5'
            )}
          >
            {processing ? (
              <Loader2 className={cn(icon, 'animate-spin text-emerald-500')} />
            ) : photo && !isPdf ? (
              <img src={photo} alt="Comprobante" className={cn('rounded-md object-contain', compact ? 'max-h-24' : 'max-h-40')} />
            ) : photo && isPdf ? (
              <>
                <FileText className={cn(icon, 'text-emerald-500')} />
                <span className="font-medium">PDF adjunto</span>
              </>
            ) : (
              <>
                <Camera className={cn(icon, 'text-emerald-500')} />
                <span className="font-medium">Tomar foto o subir PDF</span>
                {photoHint ? <span className="text-xs text-muted-foreground">{photoHint}</span> : null}
              </>
            )}
            {photo ? <span className="text-xs text-muted-foreground">Toca para cambiar</span> : null}
          </button>
          {removable && photo ? (
            <button
              type="button"
              title="Quitar archivo"
              onClick={() => onPhotoChange('')}
              className="absolute right-2 top-2 rounded-full bg-background/90 p-1 text-muted-foreground shadow hover:text-rose-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className={cn(
            'flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-sky-500/40 p-3 text-sm transition hover:bg-sky-500/5',
            box
          )}
        >
          <QrCode className={cn(icon, 'text-sky-500')} />
          <span className="font-medium">Escanear QR de la {documentLabel}</span>
          <span className="text-xs text-muted-foreground">Completa RUC, serie, montos y fecha</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <div id={regionId} className="hidden" />
      <InventoryQrScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleScan}
        title={`Escanear QR de la ${documentLabel}`}
        description={
          documentLabel === 'factura'
            ? 'Apunta la cámara al código QR impreso en la factura electrónica.'
            : 'Apunta la cámara al código QR impreso en la factura o boleta electrónica.'
        }
        placeholder="Pega aquí el texto del QR"
      />
    </div>
  );
}
