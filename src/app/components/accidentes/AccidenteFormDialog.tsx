import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';

import type {
  AccidentImmediateCare,
  AccidentSeverity,
  AccidentWorkShift,
  WorkplaceAccidentRecord,
} from '../../types/accidentes';
import {
  ACCIDENT_CARE_LABELS,
  ACCIDENT_SEVERITY_LABELS,
  ACCIDENT_SHIFT_LABELS,
  BODY_PART_OPTIONS,
  CAUSING_AGENT_OPTIONS,
  INJURY_NATURE_OPTIONS,
  VET_WORK_AREAS,
} from '../../types/accidentes';
import type { StaffOption } from '../../utils/accidentesData';
import { computeSeniorityMonths, formatSeniorityLabel } from '../../utils/accidentesData';
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
  record?: WorkplaceAccidentRecord | null;
  staffOptions: StaffOption[];
  sedeOptions: string[];
  canEdit: boolean;
  reportedBy?: string;
  onSave: (record: Omit<WorkplaceAccidentRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
};

const emptyForm = (): Omit<WorkplaceAccidentRecord, 'id' | 'createdAt' | 'updatedAt'> => ({
  sede: 'Principal',
  affectedName: '',
  jobTitle: '',
  workArea: VET_WORK_AREAS[0],
  seniorityMonths: 0,
  contractType: 'No registrado',
  eventDate: format(new Date(), 'yyyy-MM-dd'),
  eventTime: format(new Date(), 'HH:mm'),
  exactLocation: '',
  workShift: 'day',
  severity: 'leve',
  injuryNature: INJURY_NATURE_OPTIONS[0],
  bodyPart: BODY_PART_OPTIONS[0],
  causingAgent: CAUSING_AGENT_OPTIONS[0],
  immediateCare: 'atencion_sitio',
  estimatedLostDays: 0,
  medicalCost: 0,
  indemnizationCost: 0,
  description: '',
  preventiveActions: '',
});

export function AccidenteFormDialog({
  open,
  onOpenChange,
  record,
  staffOptions,
  sedeOptions,
  canEdit,
  reportedBy,
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

  const selectedStaff = useMemo(
    () => staffOptions.find((s) => s.id === staffKey),
    [staffOptions, staffKey]
  );

  const applyStaff = (key: string) => {
    setStaffKey(key);
    const staff = staffOptions.find((s) => s.id === key);
    if (!staff) return;
    setForm((prev) => ({
      ...prev,
      userId: staff.userId,
      affectedName: staff.name,
      jobTitle: staff.jobTitle,
      workArea: staff.workArea,
      contractType: staff.contractType,
      seniorityMonths: computeSeniorityMonths(staff.hireDate, prev.eventDate),
      sede: staff.homeSede || prev.sede,
    }));
  };

  const patch = (p: Partial<typeof form>) => {
    setForm((prev) => {
      const next = { ...prev, ...p };
      if (p.eventDate && selectedStaff?.hireDate) {
        next.seniorityMonths = computeSeniorityMonths(selectedStaff.hireDate, p.eventDate);
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (!form.affectedName.trim() || !form.exactLocation.trim()) return;
    onSave({
      ...form,
      id: record?.id,
      reportedBy: form.reportedBy ?? reportedBy,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{record ? 'Editar accidente' : 'Registrar accidente de trabajo'}</DialogTitle>
          <DialogDescription>
            Complete los campos obligatorios para alimentar los KPI de seguridad y salud ocupacional.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="rounded-lg border border-border bg-muted/20 p-3 dark:border-slate-700">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Datos del afectado
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
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
                  value={form.affectedName}
                  onChange={(e) => patch({ affectedName: e.target.value })}
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
                <Label>Antigüedad</Label>
                <Input
                  value={formatSeniorityLabel(form.seniorityMonths)}
                  readOnly
                  className="bg-muted/40"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Tipo de contrato</Label>
                <Input
                  value={form.contractType}
                  onChange={(e) => patch({ contractType: e.target.value })}
                  disabled={!canEdit}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border p-3 dark:border-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Detalles del evento
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
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
              <div className="space-y-1">
                <Label>Turno</Label>
                <Select
                  value={form.workShift}
                  onValueChange={(v) => patch({ workShift: v as AccidentWorkShift })}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACCIDENT_SHIFT_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={form.eventDate}
                  onChange={(e) => patch({ eventDate: e.target.value })}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1">
                <Label>Hora</Label>
                <Input
                  type="time"
                  value={form.eventTime}
                  onChange={(e) => patch({ eventTime: e.target.value })}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Ubicación exacta *</Label>
                <Input
                  placeholder="Ej. Sala grooming 2, baño médico, estacionamiento"
                  value={form.exactLocation}
                  onChange={(e) => patch({ exactLocation: e.target.value })}
                  disabled={!canEdit}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border p-3 dark:border-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Clasificación SST
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Gravedad</Label>
                <Select
                  value={form.severity}
                  onValueChange={(v) => patch({ severity: v as AccidentSeverity })}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACCIDENT_SEVERITY_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Naturaleza de la lesión</Label>
                <Select
                  value={form.injuryNature}
                  onValueChange={(v) => patch({ injuryNature: v })}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INJURY_NATURE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Parte del cuerpo</Label>
                <Select
                  value={form.bodyPart}
                  onValueChange={(v) => patch({ bodyPart: v })}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BODY_PART_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Agente causante</Label>
                <Select
                  value={form.causingAgent}
                  onValueChange={(v) => patch({ causingAgent: v })}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAUSING_AGENT_OPTIONS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border p-3 dark:border-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Consecuencias y costos
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Atención inmediata</Label>
                <Select
                  value={form.immediateCare}
                  onValueChange={(v) => patch({ immediateCare: v as AccidentImmediateCare })}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACCIDENT_CARE_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Días de baja estimados</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.estimatedLostDays}
                  onChange={(e) => patch({ estimatedLostDays: Number(e.target.value) || 0 })}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1">
                <Label>Gasto médico (S/)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.medicalCost}
                  onChange={(e) => patch({ medicalCost: Number(e.target.value) || 0 })}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1">
                <Label>Indemnización (S/)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.indemnizationCost}
                  onChange={(e) => patch({ indemnizationCost: Number(e.target.value) || 0 })}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Descripción del hecho</Label>
                <Textarea
                  rows={2}
                  value={form.description ?? ''}
                  onChange={(e) => patch({ description: e.target.value })}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Acciones preventivas</Label>
                <Textarea
                  rows={2}
                  value={form.preventiveActions ?? ''}
                  onChange={(e) => patch({ preventiveActions: e.target.value })}
                  disabled={!canEdit}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {canEdit ? (
            <Button
              onClick={handleSubmit}
              disabled={!form.affectedName.trim() || !form.exactLocation.trim()}
            >
              {record ? 'Guardar cambios' : 'Registrar accidente'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
