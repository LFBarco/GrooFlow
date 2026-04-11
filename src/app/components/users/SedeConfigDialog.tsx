import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Building2, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import type { SedesCatalogSaveResult } from '../../utils/sedesCatalog';
import type { SedeCatalogEntry } from '../../types';

type SedeRow = {
  id: string;
  originalName: string | null;
  name: string;
  enabled: boolean;
};

interface SedeConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: SedeCatalogEntry[];
  onSave: (result: SedesCatalogSaveResult) => void;
}

export function SedeConfigDialog({
  open,
  onOpenChange,
  entries,
  onSave,
}: SedeConfigDialogProps) {
  const [rows, setRows] = useState<SedeRow[]>([]);

  useEffect(() => {
    if (open) {
      setRows(
        entries.map((e, i) => ({
          id: `row-${i}-${encodeURIComponent(e.name)}`,
          originalName: e.name,
          name: e.name,
          enabled: e.enabled,
        }))
      );
    }
  }, [open, entries]);

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, originalName: null, name: '', enabled: true },
    ]);
  };

  const updateRowName = (id: string, name: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, name } : r)));
  };

  const updateRowEnabled = (id: string, enabled: boolean) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
  };

  const handleSave = () => {
    const trimmedRows = rows.map((r) => ({
      ...r,
      name: r.name.trim(),
    }));
    const catalogEntries: SedeCatalogEntry[] = trimmedRows
      .filter((r) => r.name.length > 0)
      .map((r) => ({ name: r.name, enabled: r.enabled }));

    if (catalogEntries.length === 0) {
      toast.error('Debe existir al menos una sede con nombre');
      return;
    }
    if (new Set(catalogEntries.map((e) => e.name)).size !== catalogEntries.length) {
      toast.error('No puede haber nombres de sede duplicados');
      return;
    }
    if (!catalogEntries.some((e) => e.enabled)) {
      toast.error('Debe haber al menos una sede habilitada');
      return;
    }

    const renames: Record<string, string> = {};
    for (const r of trimmedRows) {
      if (!r.name) continue;
      if (r.originalName && r.originalName !== r.name) {
        renames[r.originalName] = r.name;
      }
    }

    onSave({ entries: catalogEntries, renames });
    toast.success('Catálogo de sedes guardado');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden bg-background">
        <div className="p-6 pb-4 border-b border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-cyan-500" />
              Configuración de sedes
            </DialogTitle>
            <DialogDescription>
              Las sedes <strong>no se eliminan</strong>: puede deshabilitarlas para que no aparezcan en
              nuevas asignaciones. Los datos históricos y usuarios ya asignados conservan el nombre.
              Puede añadir sedes nuevas o renombrar las existentes.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-muted-foreground">Lista de sedes</Label>
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addRow}>
              <Plus className="w-4 h-4" />
              Añadir sede
            </Button>
          </div>

          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-border bg-muted/20 p-2"
              >
                <Input
                  value={row.name}
                  onChange={(e) => updateRowName(row.id, e.target.value)}
                  placeholder="Nombre de la sede"
                  className="flex-1 bg-background min-w-0"
                />
                <div className="flex items-center gap-2 shrink-0 justify-end sm:justify-start">
                  <Label
                    htmlFor={`sede-en-${row.id}`}
                    className="text-xs text-muted-foreground whitespace-nowrap cursor-pointer"
                  >
                    Habilitada
                  </Label>
                  <Switch
                    id={`sede-en-${row.id}`}
                    checked={row.enabled}
                    onCheckedChange={(v) => updateRowEnabled(row.id, v)}
                  />
                </div>
              </li>
            ))}
          </ul>

          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No hay sedes. Pulse &quot;Añadir sede&quot; para comenzar.
            </p>
          )}
        </div>

        <DialogFooter className="p-6 pt-4 border-t border-border bg-muted/10">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} className="gap-2 bg-cyan-600 hover:bg-cyan-700">
            <Save className="w-4 h-4" />
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
