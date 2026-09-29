import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, Keyboard, AlertTriangle } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

type InventoryQrScannerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (raw: string) => void;
  title?: string;
  description?: string;
  placeholder?: string;
};

export function InventoryQrScannerDialog({
  open,
  onOpenChange,
  onScan,
  title = 'Escanear código de equipo',
  description = 'Apunta la cámara al QR o código de barras. Con un lector USB, escanea directamente sobre el campo de abajo.',
  placeholder = 'Ej. ANE-SJL-002',
}: InventoryQrScannerDialogProps) {
  const rawId = useId();
  const regionId = `qr-region-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [starting, setStarting] = useState(false);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      /* ignorar errores al cerrar la cámara */
    }
  }, []);

  const handleDecoded = useCallback(
    (raw: string) => {
      if (handledRef.current) return;
      handledRef.current = true;
      void stopScanner();
      onScan(raw);
    },
    [onScan, stopScanner]
  );

  useEffect(() => {
    let cancelled = false;

    if (!open) {
      handledRef.current = false;
      setCameraError(null);
      setManualCode('');
      void stopScanner();
      return;
    }

    handledRef.current = false;
    setCameraError(null);
    setStarting(true);

    const startScanner = async () => {
      // Esperar a que el elemento contenedor exista en el DOM (hasta 15 reintentos x 40ms)
      let el: HTMLElement | null = null;
      for (let i = 0; i < 15; i++) {
        el = document.getElementById(regionId);
        if (el) break;
        await new Promise((r) => setTimeout(r, 40));
      }

      if (cancelled) return;

      if (!el) {
        setCameraError('No se pudo inicializar el visor de la cámara. Puedes escribir el código manual abajo.');
        setStarting(false);
        return;
      }

      try {
        const scanner = new Html5Qrcode(regionId, {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
          ],
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        });
        scannerRef.current = scanner;

        const cameras = await Html5Qrcode.getCameras().catch(() => []);
        if (cancelled) return;

        if (!cameras || cameras.length === 0) {
          setCameraError('No se detectó cámara activa o falta permiso en el navegador. Puedes ingresar el código manual abajo.');
          setStarting(false);
          return;
        }

        const rear = cameras.find((c) => /back|rear|environment/i.test(c.label));
        const cameraId = rear?.id ?? cameras[cameras.length - 1].id;

        await scanner.start(
          cameraId,
          {
            fps: 10,
            qrbox: (w, h) => ({
              width: Math.max(160, Math.floor(Math.min(w * 0.9, 340))),
              height: Math.max(120, Math.floor(Math.min(h * 0.7, 220))),
            }),
          },
          (text) => handleDecoded(text),
          () => undefined
        );
      } catch (err: unknown) {
        if (!cancelled) {
          const msg =
            typeof err === 'string'
              ? err
              : err instanceof Error
                ? err.message
                : 'No se pudo acceder a la cámara. Usa el código manual abajo.';
          setCameraError(msg);
        }
      } finally {
        if (!cancelled) {
          setStarting(false);
        }
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [open, regionId, handleDecoded, stopScanner]);

  const submitManual = () => {
    const code = manualCode.trim();
    if (!code) return;
    handledRef.current = true;
    void stopScanner();
    onScan(code);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-sky-500" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div
            id={regionId}
            className="overflow-hidden rounded-xl border border-sky-500/20 bg-muted/30 min-h-[260px] flex items-center justify-center [&_video]:rounded-lg [&_video]:w-full"
          />

          {starting && (
            <p className="text-sm text-sky-400 text-center animate-pulse">Iniciando cámara…</p>
          )}

          {cameraError && (
            <div className="text-xs text-amber-600 dark:text-amber-300 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
              <span>{cameraError}</span>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <Label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Keyboard className="h-3.5 w-3.5" />
              Ingreso Manual de Código
            </Label>
            <div className="flex gap-2">
              <Input
                autoFocus
                placeholder={placeholder}
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && submitManual()}
                className="font-mono text-sm bg-background border-border"
              />
              <Button type="button" variant="default" className="bg-sky-600 hover:bg-sky-500 text-white" onClick={submitManual}>
                Buscar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
