import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Download } from 'lucide-react';

import type { InventoryEquipment } from '../../types/inventory';
import { buildInventoryQrPayload } from '../../utils/inventoryCodeGenerator';
import { Button } from '../ui/button';

type EquipmentQrPanelProps = {
  equipment: Pick<InventoryEquipment, 'id' | 'code' | 'name' | 'sede' | 'floor' | 'room'>;
  visible?: boolean;
};

export function EquipmentQrPanel({ equipment, visible = true }: EquipmentQrPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const code = (equipment.code || '').trim();

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || !visible) return;
    if (!code) {
      el.getContext('2d')?.clearRect(0, 0, el.width, el.height);
      return;
    }
    const payload = buildInventoryQrPayload(equipment);
    void QRCode.toCanvas(el, payload, {
      width: 200,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    }).catch(() => {
      el.getContext('2d')?.clearRect(0, 0, el.width, el.height);
    });
  }, [code, equipment, visible]);

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
      <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-3 text-center">
        Genera o escribe un código para ver el QR en pantalla.
      </p>
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
