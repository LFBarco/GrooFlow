import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Download, QrCode } from 'lucide-react';

import type { InventoryEquipment } from '../../types/inventory';
import { buildInventoryQrPayload } from '../../utils/inventoryCodeGenerator';
import { Button } from '../ui/button';

type EquipmentQrPanelProps = {
  equipment: Pick<InventoryEquipment, 'id' | 'code' | 'name' | 'sede' | 'floor' | 'room'>;
  visible?: boolean;
  variant?: 'default' | 'compact';
};

export function EquipmentQrPanel({
  equipment,
  visible = true,
  variant = 'default',
}: EquipmentQrPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const code = (equipment.code || '').trim();
  const qrSize = variant === 'compact' ? 160 : 200;

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || !visible) return;
    if (!code) {
      el.getContext('2d')?.clearRect(0, 0, el.width, el.height);
      return;
    }
    const payload = buildInventoryQrPayload(equipment);
    void QRCode.toCanvas(el, payload, {
      width: qrSize,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    }).catch(() => {
      el.getContext('2d')?.clearRect(0, 0, el.width, el.height);
    });
  }, [code, equipment, visible, qrSize]);

  const downloadQr = () => {
    const el = canvasRef.current;
    if (!el || !code) return;
    const link = document.createElement('a');
    link.download = `QR-${code.replace(/[^a-zA-Z0-9-_]/g, '_')}.png`;
    link.href = el.toDataURL('image/png');
    link.click();
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
          Completa categoría y ubicación para generar el código y el QR.
        </p>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <QrCode className="h-3.5 w-3.5" />
          Etiqueta QR
        </p>
        <div className="rounded-lg border bg-background p-3 flex flex-col items-center gap-2">
          <canvas ref={canvasRef} className="rounded-md bg-white" />
          <p className="font-mono text-xs font-semibold text-center break-all">{code}</p>
          {equipment.name && (
            <p className="text-[11px] text-muted-foreground text-center line-clamp-2">
              {equipment.name}
            </p>
          )}
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={downloadQr}>
            <Download className="h-3.5 w-3.5 mr-1" />
            Descargar QR
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug">
          Muestra en pantalla o descarga para pegar en el equipo sin impresora de etiquetas.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-3 flex flex-col items-center gap-2">
      <p className="text-xs text-muted-foreground text-center">
        Muestra este QR en pantalla o descárgalo para pegar en el equipo (sin impresora de etiquetas).
      </p>
      <canvas ref={canvasRef} className="rounded-md bg-white p-1" />
      <p className="font-mono text-sm font-semibold">{code}</p>
      <p className="text-xs text-muted-foreground text-center line-clamp-2">{equipment.name}</p>
      <Button type="button" variant="outline" size="sm" onClick={downloadQr}>
        <Download className="h-3.5 w-3.5 mr-1" />
        Descargar imagen QR
      </Button>
    </div>
  );
}
