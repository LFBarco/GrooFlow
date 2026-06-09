import { useState } from 'react';
import { Plus, Settings2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import type { InventoryCategoryDef, InventoryDataset, InventoryEquipmentKind } from '../../types/inventory';
import {
  newCategoryDraft,
  normalizeCategoryConfig,
} from '../../utils/inventoryCategoryConfig';
import { describeCodePattern } from '../../utils/inventoryCodeGenerator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Switch } from '../ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

type InventoryCategoryConfigDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataset: InventoryDataset;
  onSave: (next: InventoryDataset) => Promise<boolean>;
};

export function InventoryCategoryConfigDialog({
  open,
  onOpenChange,
  dataset,
  onSave,
}: InventoryCategoryConfigDialogProps) {
  const [rows, setRows] = useState<InventoryCategoryDef[]>(() =>
    normalizeCategoryConfig(dataset.categoryConfig)
  );

  const resetFromDataset = () => {
    setRows(normalizeCategoryConfig(dataset.categoryConfig));
  };

  const addRow = () => {
    setRows((prev) => [...prev, newCategoryDraft('medical')]);
  };

  const updateRow = (id: string, patch: Partial<InventoryCategoryDef>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    const inUse = dataset.equipment.some((e) => e.category === id);
    if (inUse) {
      toast.error('Hay equipos con esta categoría. Reasígnalos antes de eliminar.');
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSave = async () => {
    const clean = rows
      .map((r, i) => {
        const label = r.label.trim();
        if (!label) return null;
        const id = (r.id || label).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        const codePrefix =
          (r.codePrefix || label.slice(0, 3))
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 6) || 'EQP';
        return {
          ...r,
          id,
          label,
          codePrefix,
          sortOrder: i,
        };
      })
      .filter(Boolean) as InventoryCategoryDef[];

    if (clean.length === 0) {
      toast.error('Debe existir al menos una categoría.');
      return;
    }

    const ids = new Set(clean.map((c) => c.id));
    if (ids.size !== clean.length) {
      toast.error('Hay categorías con el mismo identificador.');
      return;
    }

    const prefixes = clean.map((c) => c.codePrefix);
    if (new Set(prefixes).size !== prefixes.length) {
      toast.warning('Algunos prefijos se repiten; los códigos podrían colisionar entre categorías.');
    }

    const next: InventoryDataset = {
      ...dataset,
      categoryConfig: clean,
    };
    const ok = await onSave(next);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetFromDataset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configuración de categorías
          </DialogTitle>
          <DialogDescription>
            Define categorías y prefijos para el generador automático de códigos. Ejemplo:{' '}
            {describeCodePattern('IMG')}
          </DialogDescription>
        </DialogHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Prefijo código</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Activa</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Input
                    value={row.label}
                    placeholder="Ej. Consultorio"
                    onChange={(e) => updateRow(row.id, { label: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={row.codePrefix}
                    placeholder="CONS"
                    className="font-mono uppercase"
                    maxLength={6}
                    onChange={(e) =>
                      updateRow(row.id, {
                        codePrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                      })
                    }
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={row.kind}
                    onValueChange={(v) =>
                      updateRow(row.id, { kind: v as InventoryEquipmentKind })
                    }
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medical">Médico</SelectItem>
                      <SelectItem value="operational">Operativo</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={row.active}
                    onCheckedChange={(v) => updateRow(row.id, { active: v })}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(row.id)}
                    aria-label="Eliminar categoría"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-4 w-4 mr-1" />
          Agregar categoría
        </Button>

        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Guía primer inventario</p>
          <p>1. Configura prefijos por tipo de equipo (IMG, ANE, CONS…).</p>
          <p>2. Al registrar, indica sede, piso y consultorio.</p>
          <p>3. Usa «Generar código» — el sistema asigna el siguiente número disponible.</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => void handleSave()}>Guardar categorías</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
