import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react';

import type {
  UniformDeliveryItem,
  UniformDeliveryReason,
  UniformDeliveryRecord,
  UniformDeliveryStatus,
  UniformItemType,
} from '../../types/uniformes';
import {
  UNIFORM_ITEM_LABELS,
  UNIFORM_REASON_LABELS,
  UNIFORM_SIZE_OPTIONS,
  UNIFORM_STATUS_LABELS,
} from '../../types/uniformes';
import { VET_WORK_AREAS } from '../../types/accidentes';
import type { StaffOption } from '../../utils/accidentesData';
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
import { Textarea } from '../ui/textarea';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: UniformDeliveryRecord | null;
  staffOptions: StaffOption[];
  sedeOptions: string[];
  canEdit: boolean;
  deliveredBy?: string;
  onSave: (
    record: Omit<UniformDeliveryRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => void;
};

const defaultItem = (): UniformDeliveryItem => ({
  itemType: 'polo',
  size: 'M',
  quantity: 1,
  color: '',
});

const emptyForm = (): Omit<UniformDeliveryRecord, 'id' | 'createdAt' | 'updatedAt'> => ({
  sede: 'Principal',
  staffName: '',
  jobTitle: '',
  workArea: VET_WORK_AREAS[0],
  deliveryDate: format(new Date(), 'yyyy-MM-dd'),
  reason: 'ingreso',
  status: 'entregado',
  items: [defaultItem()],
  notes: '',
});

export function UniformeEntregaFormDialog({
  open,
  onOpenChange,
  record,
  staffOptions,
  sedeOptions,
  canEdit,
  deliveredBy,
  onSave,
}: Props) {
  const [form, setForm] = useState(emptyForm);
  const [staffKey, setStaffKey] = useState<string>('manual');

  useEffect(() => {
    if (!open) return;
    if (record) {
      setForm({ ...record });
      setStaffKey(record.userId ? `user-${record.userId}` : 'manual');
    } else {
      setForm(emptyForm());
      setStaffKey(staffOptions[0]?.id ?? 'manual');
    }
  }, [open, record, staffOptions]);

  const applyStaff = (key: string) => {
    setStaffKey(key);
    const staff = staffOptions.find((s) => s.id === key);
    if (!staff) return;
    setForm((prev) => ({
      ...prev,
      userId: staff.userId,
      staffName: staff.name,
      jobTitle: staff.jobTitle,
      workArea: staff.workArea,
      sede: staff.homeSede || prev.sede,
    }));
  };

  const patch = (p: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...p }));

  const patchItem = (index: number, p: Partial<UniformDeliveryItem>) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, ...p } : item)),
    }));
  };

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, defaultItem()] }));
  };

  const removeItem = (index: number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.length <= 1 ? prev.items : prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = () => {
    if (!form.staffName.trim() || form.items.length === 0) return;
    const validItems = form.items.filter((i) => i.quantity > 0);
    if (validItems.length === 0) return;
    onSave({
      ...form,
      items: validItems,
      id: record?.id,
      deliveredBy: form.deliveredBy ?? deliveredBy,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{record ? 'Editar entrega' : 'Registrar entrega de uniformes'}</DialogTitle>
          <DialogDescription>
            Registre las prendas entregadas al colaborador, talla, cantidad y motivo de la entrega.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="rounded-lg border border-border bg-muted/20 p-3 dark:border-slate-700">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Colaborador
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>Colaborador</Label>
                <Select value={staffKey} onValueChange={applyStaff} disabled={!canEdit}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar colaborador" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffOptions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} · {s.jobTitle} · {s.homeSede}
                      </SelectItem>
                    ))}
                    <SelectItem value="manual">Otro / manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Nombre *</Label>
                <Input
                  value={form.staffName}
                  onChange={(e) => patch({ staffName: e.target.value })}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1">
                <Label>Puesto</Label>
                <Input
                  value={form.jobTitle}
                  onChange={(e) => patch({ jobTitle: e.target.value })}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1">
                <Label>Área</Label>
                <Select
                  value={form.workArea}
                  onValueChange={(v) => patch({ workArea: v })}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
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
              <div className="space-y-1">
                <Label>Sede *</Label>
                <Select
                  value={form.sede}
                  onValueChange={(v) => patch({ sede: v })}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sedeOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border p-3 dark:border-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Datos de la entrega
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={form.deliveryDate}
                  onChange={(e) => patch({ deliveryDate: e.target.value })}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1">
                <Label>Motivo</Label>
                <Select
                  value={form.reason}
                  onValueChange={(v) => patch({ reason: v as UniformDeliveryReason })}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNIFORM_REASON_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Estado</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => patch({ status: v as UniformDeliveryStatus })}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNIFORM_STATUS_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border p-3 dark:border-slate-700">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Prendas entregadas
              </p>
              {canEdit ? (
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  <Plus className="mr-1 h-3 w-3" />
                  Agregar prenda
                </Button>
              ) : null}
            </div>
            <div className="space-y-3">
              {form.items.map((item, index) => (
                <div
                  key={index}
                  className="grid gap-2 rounded-md border border-border/60 bg-muted/10 p-2 sm:grid-cols-12 dark:border-slate-700"
                >
                  <div className="space-y-1 sm:col-span-4">
                    <Label className="text-xs">Prenda</Label>
                    <Select
                      value={item.itemType}
                      onValueChange={(v) => patchItem(index, { itemType: v as UniformItemType })}
                      disabled={!canEdit}
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
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Talla</Label>
                    <Select
                      value={item.size}
                      onValueChange={(v) => patchItem(index, { size: v })}
                      disabled={!canEdit}
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
                    <Label className="text-xs">Cantidad</Label>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        patchItem(index, { quantity: Math.max(1, Number(e.target.value) || 1) })
                      }
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-3">
                    <Label className="text-xs">Color (opcional)</Label>
                    <Input
                      placeholder="Ej. Azul marino"
                      value={item.color ?? ''}
                      onChange={(e) => patchItem(index, { color: e.target.value })}
                      disabled={!canEdit}
                    />
                  </div>
                  {canEdit && form.items.length > 1 ? (
                    <div className="flex items-end sm:col-span-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-rose-600"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Observaciones</Label>
            <Textarea
              rows={2}
              placeholder="Notas adicionales, número de acta, condición de las prendas…"
              value={form.notes ?? ''}
              onChange={(e) => patch({ notes: e.target.value })}
              disabled={!canEdit}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {canEdit ? (
            <Button onClick={handleSubmit} disabled={!form.staffName.trim()}>
              {record ? 'Guardar cambios' : 'Registrar entrega'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
