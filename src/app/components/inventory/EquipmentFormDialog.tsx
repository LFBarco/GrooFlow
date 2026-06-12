import type { ReactNode } from 'react';
import {
  Box,
  Calendar,
  MapPin,
  Package,
  Wand2,
  Wrench,
} from 'lucide-react';

import type {
  InventoryCategoryDef,
  InventoryDataset,
  InventoryEquipment,
} from '../../types/inventory';
import type { Provider } from '../../types';
import { describeCodePattern } from '../../utils/inventoryCodeGenerator';
import {
  getCategoryById,
  getCategoryLabel,
  getCategoryPrefix,
} from '../../utils/inventoryCategoryConfig';
import { formatEquipmentLocation } from '../../utils/inventoryData';
import { EquipmentQrPanel } from './EquipmentQrPanel';
import {
  CategoryBadge,
  EquipmentStatusBadge,
} from './inventoryUiHelpers';
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
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Separator } from '../ui/separator';

type EquipmentFormDialogProps = {
  equipment: InventoryEquipment | null;
  isNew: boolean;
  dataset: InventoryDataset;
  sedeOptions: string[];
  providers: Provider[];
  activeCategories: InventoryCategoryDef[];
  onOpenChange: (open: boolean) => void;
  onChange: (equipment: InventoryEquipment) => void;
  onRegenerateCode: () => void;
  onSave: () => void;
  onDelete?: () => void;
  applyGeneratedCode: (draft: InventoryEquipment) => InventoryEquipment;
};

export function EquipmentFormDialog({
  equipment,
  isNew,
  dataset,
  sedeOptions,
  providers,
  activeCategories,
  onOpenChange,
  onChange,
  onRegenerateCode,
  onSave,
  onDelete,
  applyGeneratedCode,
}: EquipmentFormDialogProps) {
  if (!equipment) return null;

  const patch = (partial: Partial<InventoryEquipment>, regenCode = false) => {
    const next = { ...equipment, ...partial };
    onChange(isNew && regenCode ? applyGeneratedCode(next) : next);
  };

  const categoryPrefix = getCategoryPrefix(dataset, equipment.category);
  const locationLabel = formatEquipmentLocation(equipment);

  return (
    <Dialog open={equipment != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/20">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <DialogTitle className="text-xl flex items-center gap-2">
                <Package className="h-5 w-5 text-sky-500" />
                {isNew ? 'Registrar nuevo equipo' : 'Editar equipo'}
              </DialogTitle>
              <DialogDescription className="max-w-xl">
                {isNew
                  ? 'Completa categoría y ubicación primero; el código se genera automáticamente según sede, piso y consultorio.'
                  : 'Actualiza los datos del activo. El código y QR permanecen vinculados al equipo.'}
              </DialogDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge
                category={equipment.category}
                label={getCategoryLabel(dataset, equipment.category)}
              />
              <EquipmentStatusBadge status={equipment.status} />
            </div>
          </div>
        </DialogHeader>

        <div className="grid lg:grid-cols-[1fr_240px] gap-0">
          <div className="px-6 py-5 space-y-6 min-w-0">
            <FormSection
              icon={Box}
              title="1. Identificación"
              description="Nombre y clasificación del activo"
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField label="Nombre del equipo" required>
                  <Input
                    placeholder="Ej. Ecógrafo portátil, Bomba de infusión"
                    value={equipment.name}
                    onChange={(e) => patch({ name: e.target.value })}
                  />
                </FormField>
                <FormField label="Categoría" required>
                  <Select
                    value={equipment.category}
                    onValueChange={(v) => {
                      const cat = getCategoryById(dataset, v);
                      patch(
                        {
                          category: v,
                          kind: cat?.kind ?? equipment.kind,
                        },
                        true
                      );
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCategories
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.label} · {c.codePrefix}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Tipo">
                  <Select
                    value={equipment.kind}
                    onValueChange={(v) =>
                      patch({ kind: v as InventoryEquipment['kind'] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medical">Médico</SelectItem>
                      <SelectItem value="operational">Operativo</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Estado operativo">
                  <Select
                    value={equipment.status}
                    onValueChange={(v) =>
                      patch({ status: v as InventoryEquipment['status'] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Activo / operativo</SelectItem>
                      <SelectItem value="maintenance">En mantenimiento</SelectItem>
                      <SelectItem value="critical">Crítico</SelectItem>
                      <SelectItem value="inactive">Inactivo / baja</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </FormSection>

            <FormSection
              icon={MapPin}
              title="2. Ubicación"
              description="Sede, piso y consultorio para el inventario físico"
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField label="Sede" required>
                  <Select
                    value={equipment.sede}
                    onValueChange={(v) => patch({ sede: v }, true)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar sede" />
                    </SelectTrigger>
                    <SelectContent>
                      {sedeOptions.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Detalle de ubicación" hint="Opcional: pasillo, módulo, etc.">
                  <Input
                    placeholder="Ej. Módulo norte, pasillo B"
                    value={equipment.locationDetail || ''}
                    onChange={(e) => patch({ locationDetail: e.target.value })}
                  />
                </FormField>
                <FormField label="Piso" hint="Ej. 1, 2, PB">
                  <Input
                    placeholder="2"
                    value={equipment.floor || ''}
                    onChange={(e) => patch({ floor: e.target.value }, true)}
                  />
                </FormField>
                <FormField label="Consultorio / sala" hint="Ej. 03, Cirugía A">
                  <Input
                    placeholder="03"
                    value={equipment.room || ''}
                    onChange={(e) => patch({ room: e.target.value }, true)}
                  />
                </FormField>
              </div>
              <div className="rounded-lg border bg-sky-500/5 border-sky-500/20 px-3 py-2 text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-sky-600 shrink-0" />
                <span className="text-muted-foreground">Ubicación resumida:</span>
                <span className="font-medium">{locationLabel}</span>
              </div>
            </FormSection>

            <FormSection
              icon={Package}
              title="3. Datos técnicos"
              description="Marca, modelo y número de serie"
            >
              <div className="grid sm:grid-cols-3 gap-4">
                <FormField label="Marca">
                  <Input
                    placeholder="Philips, GE, Mindray…"
                    value={equipment.brand || ''}
                    onChange={(e) => patch({ brand: e.target.value })}
                  />
                </FormField>
                <FormField label="Modelo">
                  <Input
                    value={equipment.model || ''}
                    onChange={(e) => patch({ model: e.target.value })}
                  />
                </FormField>
                <FormField label="Número de serie">
                  <Input
                    className="font-mono text-sm"
                    value={equipment.serialNumber || ''}
                    onChange={(e) => patch({ serialNumber: e.target.value })}
                  />
                </FormField>
              </div>
            </FormSection>

            <FormSection
              icon={Calendar}
              title="4. Valor y vida útil"
              description="Compra, depreciación y garantía"
            >
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField label="Fecha de compra">
                  <Input
                    type="date"
                    value={equipment.purchaseDate || ''}
                    onChange={(e) => patch({ purchaseDate: e.target.value })}
                  />
                </FormField>
                <FormField label="Valor de compra (S/)">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={equipment.purchaseValue}
                    onChange={(e) =>
                      patch({ purchaseValue: Number(e.target.value) || 0 })
                    }
                  />
                </FormField>
                <FormField label="Valor actual (S/)">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={equipment.currentValue}
                    onChange={(e) =>
                      patch({ currentValue: Number(e.target.value) || 0 })
                    }
                  />
                </FormField>
                <FormField label="Vida útil (años)">
                  <Input
                    type="number"
                    min={0}
                    placeholder="5"
                    value={equipment.usefulLifeYears ?? ''}
                    onChange={(e) =>
                      patch({
                        usefulLifeYears: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                  />
                </FormField>
                <FormField label="Depreciación anual (%)" hint="Opcional">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={equipment.depreciationAnnualPct ?? ''}
                    onChange={(e) =>
                      patch({
                        depreciationAnnualPct: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                  />
                </FormField>
                <FormField label="Garantía hasta">
                  <Input
                    type="date"
                    value={equipment.warrantyUntil || ''}
                    onChange={(e) => patch({ warrantyUntil: e.target.value })}
                  />
                </FormField>
              </div>
            </FormSection>

            <FormSection
              icon={Wrench}
              title="5. Mantenimiento y notas"
              description="Programación y proveedor de servicio"
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField label="Próximo mantenimiento" hint="Al guardar, se crea o actualiza un registro en Mantenimientos.">
                  <Input
                    type="date"
                    value={equipment.nextMaintenanceDate || ''}
                    onChange={(e) => patch({ nextMaintenanceDate: e.target.value })}
                  />
                </FormField>
                {providers.length > 0 && (
                  <FormField label="Proveedor de servicio">
                    <Select
                      value={equipment.providerId || 'none'}
                      onValueChange={(v) => {
                        const p = providers.find((x) => x.id === v);
                        patch({
                          providerId: v === 'none' ? undefined : v,
                          providerName: p?.name,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sin proveedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin proveedor</SelectItem>
                        {providers.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                )}
              </div>
              <FormField label="Notas internas">
                <Textarea
                  placeholder="Observaciones, accesorios incluidos, restricciones…"
                  value={equipment.notes || ''}
                  onChange={(e) => patch({ notes: e.target.value })}
                  rows={3}
                  className="resize-none"
                />
              </FormField>
            </FormSection>
          </div>

          <aside className="border-t lg:border-t-0 lg:border-l bg-muted/15 px-4 py-5 space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Código de inventario
              </p>
              <div className="flex gap-2">
                <Input
                  className="font-mono text-sm bg-background"
                  value={equipment.code}
                  onChange={(e) =>
                    patch({ code: e.target.value.toUpperCase() })
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={onRegenerateCode}
                  title="Regenerar código"
                >
                  <Wand2 className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {describeCodePattern(categoryPrefix)}
              </p>
              {isNew && (
                <p className="text-[11px] text-sky-700 dark:text-sky-400">
                  Al cambiar categoría o ubicación se actualiza el código automáticamente.
                </p>
              )}
            </div>

            <Separator />

            <EquipmentQrPanel
              equipment={equipment}
              visible={equipment.code.trim().length > 0}
              variant="compact"
            />
          </aside>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/10 gap-2 sm:justify-between">
          <div>
            {onDelete && (
              <Button type="button" variant="destructive" onClick={onDelete}>
                Eliminar equipo
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={onSave}>
              {isNew ? 'Registrar equipo' : 'Guardar cambios'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Box;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-muted p-2 shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-sm font-semibold leading-none">{title}</h3>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
      <div className="space-y-4 pl-0 sm:pl-11">{children}</div>
    </section>
  );
}

function FormField({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {hint && (
        <p className="text-[10px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
