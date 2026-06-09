import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Keyboard } from 'lucide-react';

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
};

export function InventoryQrScannerDialog({
  open,
  onOpenChange,
  onScan,
}: InventoryQrScannerDialogProps) {
  const regionId = useId().replace(/:/g, '');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [starting, setStarting] = useState(false);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
      scanner.clear();
    } catch {
      /* ignorar al cerrar */
    }
    scannerRef.current = null;
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

    const scanner = new Html5Qrcode(regionId);
    scannerRef.current = scanner;

    const start = async () => {
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras.length) {
          setCameraError('No se detectó cámara. Usa el código manual abajo.');
          setStarting(false);
          return;
        }
        const rear = cameras.find((c) => /back|rear|environment/i.test(c.label));
        const cameraId = rear?.id ?? cameras[cameras.length - 1].id;
        await scanner.start(
          cameraId,
          { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1 },
          (text) => handleDecoded(text),
          () => undefined
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo abrir la cámara';
        setCameraError(msg);
      } finally {
        setStarting(false);
      }
    };

    void start();

    return () => {
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
            <Camera className="h-5 w-5" />
            Escanear QR de equipo
          </DialogTitle>
          <DialogDescription>
            Apunta al QR del equipo para abrir su ficha al instante. También puedes escribir el código manualmente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            id={regionId}
            className="overflow-hidden rounded-lg border bg-muted/30 min-h-[280px] [&_video]:rounded-lg"
          />

          {starting && (
            <p className="text-sm text-muted-foreground text-center">Iniciando cámara…</p>
          )}
          {cameraError && (
            <p className="text-sm text-amber-700 dark:text-amber-400 rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-3">
              {cameraError}
            </p>
          )}

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm">
              <Keyboard className="h-3.5 w-3.5" />
              Código manual
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Ej. IMG-MIR-P2C03-001"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && submitManual()}
                className="font-mono"
              />
              <Button type="button" variant="secondary" onClick={submitManual}>
                Buscar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
