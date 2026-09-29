import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';

import type { InventoryEquipment } from '../../types/inventory';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';

type InventoryLabelPrintDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: InventoryEquipment[];
  /** Texto de origen: "seleccionados" o "filtrados". */
  scopeLabel: string;
};

export function InventoryLabelPrintDialog({
  open,
  onOpenChange,
  equipment,
  scopeLabel,
}: InventoryLabelPrintDialogProps) {
  const [opts, setOpts] = useState<LabelPrintOptions>(() => loadLabelPrintOptions());
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (open) setOpts(loadLabelPrintOptions());
  }, [open]);

  const update = (partial: Partial<LabelPrintOptions>) => {
    setOpts((prev) => {
      const next = { ...prev, ...partial };
      saveLabelPrintOptions(next);
      return next;
    });
  };

  const preset = LABEL_SIZE_PRESETS.find((p) => p.id === opts.sizeId) ?? LABEL_SIZE_PRESETS[0];
  const printable = equipment.filter((e) => e.code.trim());
  const totalLabels = printable.length * opts.copies;
  const sheets = preset.sheet ? Math.ceil(totalLabels / (preset.sheet.cols * preset.sheet.rows)) : 0;

  const print = async () => {
    setPrinting(true);
    try {
      const n = await printInventoryLabels(printable, opts);
      if (n === 0) toast.error('No hay equipos con código para imprimir.');
      else onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo imprimir.');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-sky-500" />
            Imprimir etiquetas
          </DialogTitle>
          <DialogDescription>
            {printable.length} equipo(s) {scopeLabel}. En el diálogo del navegador elige la impresora de etiquetas,
            escala 100 % y márgenes "Ninguno".
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Tamaño de etiqueta</Label>
            <Select value={opts.sizeId} onValueChange={(v) => update({ sizeId: v as LabelSizeId })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LABEL_SIZE_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">{preset.hint}</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de código</Label>
            <Select value={opts.symbology} onValueChange={(v) => update({ symbology: v as LabelSymbology })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="qr">QR (cámara del celular o lector 2D)</SelectItem>
                <SelectItem value="barcode">Código de barras Code128 (cualquier lector)</SelectItem>
                <SelectItem value="both">QR + código de barras</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              Nombre
              <Switch checked={opts.showName} onCheckedChange={(v) => update({ showName: v })} />
            </label>
            <label className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              Sede/ubicación
              <Switch checked={opts.showSede} onCheckedChange={(v) => update({ showSede: v })} />
            </label>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Copias por equipo</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={opts.copies}
              onChange={(e) => update({ copies: Math.min(20, Math.max(1, Math.round(Number(e.target.value) || 1))) })}
              className="w-24"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Total: <span className="font-semibold text-foreground">{totalLabels}</span> etiqueta(s)
            {preset.sheet ? ` en ${sheets} hoja(s) A4` : ''}.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void print()} disabled={printing || printable.length === 0}>
            <Printer className="h-4 w-4 mr-1" />
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
