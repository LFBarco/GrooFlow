import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import type { UniformItemType, UniformKit, UniformKitItem } from '../../types/uniformes';
import { UNIFORM_ITEM_LABELS, UNIFORM_SIZE_OPTIONS } from '../../types/uniformes';
import { VET_WORK_AREAS } from '../../types/accidentes';
import { newUniformKitId, removeUniformKit, upsertUniformKit } from '../../utils/uniformesKits';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kits: UniformKit[];
  canEdit: boolean;
  onSave: (kits: UniformKit[]) => void;
};

const defaultKitItem = (): UniformKitItem => ({
  itemType: 'polo',
  quantity: 1,
  defaultSize: 'M',
});

const emptyKit = (): UniformKit => ({
  id: newUniformKitId(),
  name: '',
  items: [defaultKitItem()],
});

export function UniformesKitsDialog({ open, onOpenChange, kits, canEdit, onSave }: Props) {
  const [localKits, setLocalKits] = useState<UniformKit[]>(kits);
  const [editing, setEditing] = useState<UniformKit | null>(null);

  useEffect(() => {
    if (open) {
      setLocalKits(kits);
      setEditing(null);
    }
  }, [open, kits]);

  const patchEditing = (patch: Partial<UniformKit>) => {
    setEditing((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const patchItem = (index: number, patch: Partial<UniformKitItem>) => {
    setEditing((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
      };
    });
  };

  const saveEditing = () => {
    if (!editing?.name.trim() || editing.items.length === 0) return;
    setLocalKits((prev) => upsertUniformKit(prev, editing));
    setEditing(null);
  };

  const handleConfirm = () => {
    onSave(localKits);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Kits de uniformes</DialogTitle>
          <DialogDescription>
            Defina conjuntos de prendas por cargo o área. Al registrar una entrega puede aplicar un
            kit y autocompletar tallas del perfil del colaborador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {localKits.map((kit) => (
            <div
              key={kit.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 dark:border-slate-700"
            >
              <div>
                <p className="font-medium">{kit.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[kit.jobTitle, kit.workArea].filter(Boolean).join(' · ') || 'Sin criterio'}
                  {' · '}
                  {kit.items.length} prenda(s)
                </p>
              </div>
              {canEdit ? (
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditing(kit)}>
                    Editar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-rose-600"
                    onClick={() => setLocalKits((prev) => removeUniformKit(prev, kit.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </div>
          ))}

          {canEdit ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(emptyKit())}>
              <Plus className="mr-1 h-3 w-3" />
              Nuevo kit
            </Button>
          ) : null}

          {editing ? (
            <div className="space-y-3 rounded-lg border border-dashed border-border p-3 dark:border-slate-700">
              <p className="text-sm font-medium">Editar kit</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label>Nombre *</Label>
                  <Input
                    value={editing.name}
                    onChange={(e) => patchEditing({ name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Cargo (opcional)</Label>
                  <Input
                    placeholder="Ej. Groomer"
                    value={editing.jobTitle ?? ''}
                    onChange={(e) => patchEditing({ jobTitle: e.target.value || undefined })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Área (opcional)</Label>
                  <Select
                    value={editing.workArea ?? ''}
                    onValueChange={(v) => patchEditing({ workArea: v || undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Área" />
                    </SelectTrigger>
                    <SelectContent>
                      {VET_WORK_AREAS.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                {editing.items.map((item, index) => (
                  <div
                    key={index}
                    className="grid gap-2 rounded-md border border-border/60 p-2 sm:grid-cols-12 dark:border-slate-700"
                  >
                    <div className="space-y-1 sm:col-span-5">
                      <Label className="text-xs">Prenda</Label>
                      <Select
                        value={item.itemType}
                        onValueChange={(v) => patchItem(index, { itemType: v as UniformItemType })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(UNIFORM_ITEM_LABELS).map(([k, label]) => (
                            <SelectItem key={k} value={k}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 sm:col-span-3">
                      <Label className="text-xs">Talla ref.</Label>
                      <Select
                        value={item.defaultSize ?? 'M'}
                        onValueChange={(v) => patchItem(index, { defaultSize: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNIFORM_SIZE_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Cant.</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          patchItem(index, { quantity: Math.max(1, Number(e.target.value) || 1) })
                        }
                      />
                    </div>
                    {editing.items.length > 1 ? (
                      <div className="flex items-end sm:col-span-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-rose-600"
                          onClick={() =>
                            patchEditing({
                              items: editing.items.filter((_, i) => i !== index),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    patchEditing({ items: [...editing.items, defaultKitItem()] })
                  }
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Agregar prenda
                </Button>
              </div>

              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={saveEditing} disabled={!editing.name.trim()}>
                  Guardar kit
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          {canEdit ? <Button onClick={handleConfirm}>Aplicar cambios</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
