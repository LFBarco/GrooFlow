import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { TurnosMinStaffRule, TurnosSettings } from '../../types/turnos';
import { TURNO_SHIFT_LABELS } from '../../types/turnos';
import { newStaffingRuleId } from '../../utils/turnosData';
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
  settings: TurnosSettings;
  sedeOptions: string[];
  workAreas: string[];
  canEdit: boolean;
  onUpdate: (updater: (prev: TurnosSettings) => TurnosSettings, message?: string) => void;
};

function emptyRule(sedeOptions: string[], workAreas: string[]): TurnosMinStaffRule {
  return {
    id: newStaffingRuleId(),
    sede: sedeOptions[0] ?? 'Todas',
    workArea: workAreas[0] ?? 'Todas',
    shift: 'day',
    minimum: 1,
  };
}

export function TurnosStaffingConfigDialog({
  open,
  onOpenChange,
  settings,
  sedeOptions,
  workAreas,
  canEdit,
  onUpdate,
}: Props) {
  const [minGlobal, setMinGlobal] = useState(String(settings.staffing?.minDayNightTotal ?? 2));
  const [rules, setRules] = useState<TurnosMinStaffRule[]>(settings.staffing?.rules ?? []);

  useEffect(() => {
    if (!open) return;
    setMinGlobal(String(settings.staffing?.minDayNightTotal ?? 2));
    setRules(settings.staffing?.rules ?? []);
  }, [open, settings.staffing]);

  const save = () => {
    const parsed = Math.max(0, parseInt(minGlobal, 10) || 0);
    onUpdate(
      (prev) => ({
        ...prev,
        staffing: {
          ...prev.staffing,
          minDayNightTotal: parsed,
          rules: rules.filter((r) => r.minimum > 0),
        },
      }),
      'Configuración de dotación guardada.'
    );
    onOpenChange(false);
  };

  const updateRule = (id: string, patch: Partial<TurnosMinStaffRule>) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Dotación mínima</DialogTitle>
          <DialogDescription>
            Define mínimos por sede y área. Si no hay reglas, se usa el umbral global día + noche.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="turnos-min-global">Umbral global (día + noche, sin reglas)</Label>
          <Input
            id="turnos-min-global"
            type="number"
            min={0}
            value={minGlobal}
            disabled={!canEdit}
            onChange={(e) => setMinGlobal(e.target.value)}
            className="w-24"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Reglas específicas</p>
            {canEdit ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setRules((prev) => [...prev, emptyRule(sedeOptions, workAreas)])}
              >
                <Plus className="mr-1 h-4 w-4" />
                Agregar regla
              </Button>
            ) : null}
          </div>

          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin reglas: la alerta usa solo el umbral global combinado.
            </p>
          ) : (
            <ul className="space-y-3">
              {rules.map((rule) => (
                <li
                  key={rule.id}
                  className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2 dark:border-slate-700"
                >
                  <div className="space-y-1">
                    <Label className="text-xs">Sede</Label>
                    <Select
                      value={rule.sede}
                      disabled={!canEdit}
                      onValueChange={(v) => updateRule(rule.id, { sede: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Todas">Todas</SelectItem>
                        {sedeOptions.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Área</Label>
                    <Select
                      value={rule.workArea}
                      disabled={!canEdit}
                      onValueChange={(v) => updateRule(rule.id, { workArea: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Todas">Todas</SelectItem>
                        {workAreas.map((a) => (
                          <SelectItem key={a} value={a}>
                            {a}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Turno</Label>
                    <Select
                      value={rule.shift}
                      disabled={!canEdit}
                      onValueChange={(v) => updateRule(rule.id, { shift: v as 'day' | 'night' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">{TURNO_SHIFT_LABELS.day}</SelectItem>
                        <SelectItem value="night">{TURNO_SHIFT_LABELS.night}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Mínimo</Label>
                      <Input
                        type="number"
                        min={1}
                        disabled={!canEdit}
                        value={rule.minimum}
                        onChange={(e) =>
                          updateRule(rule.id, { minimum: Math.max(1, parseInt(e.target.value, 10) || 1) })
                        }
                      />
                    </div>
                    {canEdit ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-rose-600"
                        onClick={() => setRules((prev) => prev.filter((r) => r.id !== rule.id))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          {canEdit ? (
            <Button type="button" onClick={save}>
              Guardar
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
