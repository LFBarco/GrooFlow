import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Paperclip, Plus, Trash2, X } from 'lucide-react';

import type {
  AccidentCorrectiveAction,
  AccidentEventType,
  AccidentImmediateCare,
  AccidentSeverity,
  AccidentWorkShift,
  AccidentWorkflowStatus,
  WorkplaceAccidentRecord,
} from '../../types/accidentes';
import {
  ACCIDENT_CARE_LABELS,
  ACCIDENT_EVENT_TYPE_LABELS,
  ACCIDENT_SEVERITY_LABELS,
  ACCIDENT_SHIFT_LABELS,
  ACCIDENT_WORKFLOW_LABELS,
  BODY_PART_OPTIONS,
  CAUSING_AGENT_OPTIONS,
  INJURY_NATURE_OPTIONS,
} from '../../types/accidentes';
import {
  ACCIDENT_INSURANCE_LABELS,
  type AccidentInsuranceCoverage,
} from '../../types/accidentes';
import type { StaffOption } from '../../utils/accidentesData';
import {
  formatSeniorityLabel,
  medicalLeaveDays,
  newAccidentAttachmentId,
  newCorrectiveActionId,
  previousAccidentsFor,
  requiresMtpeNotification,
  resolveStaffOptionKey,
  seniorityMonthsAt,
  shiftFromHours,
} from '../../utils/accidentesData';
import { MANUAL_STAFF_KEY, StaffCombobox } from '../hr/StaffCombobox';
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
import { appAlert, appConfirm } from '../ui/app-dialog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: WorkplaceAccidentRecord | null;
  staffOptions: StaffOption[];
  sedeOptions: string[];
  canEdit: boolean;
  reportedBy?: string;
  /** Para mostrar reincidencia del colaborador. */
  allRecords?: WorkplaceAccidentRecord[];
  collaboratorsLoading?: boolean;
  onSave: (record: Omit<WorkplaceAccidentRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
};

const NO_STAFF = '';

const emptyForm = (sede = ''): Omit<WorkplaceAccidentRecord, 'id' | 'createdAt' | 'updatedAt'> => ({
  sede,
  affectedName: '',
  jobTitle: '',
  workArea: '',
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
  eventType: 'accidente',
  workflowStatus: 'reportado',
  attachments: [],
  correctiveActions: [],
});

const MAX_ATTACHMENT_BYTES = 512_000;
const MAX_IMAGE_SIDE = 1600;

/** Fotos del celular pesan 3–8 MB; se reducen a JPEG ~200–400 KB para no inflar el KV. */
async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.8);
}

export function AccidenteFormDialog({
  open,
  onOpenChange,
  record,
  staffOptions,
  sedeOptions,
  canEdit,
  reportedBy,
  allRecords = [],
  collaboratorsLoading = false,
  onSave,
}: Props) {
  const [form, setForm] = useState(() => emptyForm());
  const [staffKey, setStaffKey] = useState<string>(NO_STAFF);
  const [touched, setTouched] = useState(false);

  // Solo al abrir / cambiar de registro: si dependiera de staffOptions, una recarga de
  // Colaboradores borraría lo que el usuario ya escribió.
  const recordId = record?.id ?? null;
  useEffect(() => {
    if (!open) return;
    setTouched(false);
    if (record) {
      setForm({ ...record });
      setStaffKey(resolveStaffOptionKey(record, staffOptions));
      return;
    }
    setForm(emptyForm(sedeOptions.length === 1 ? sedeOptions[0] : ''));
    setStaffKey(NO_STAFF);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recordId]);

  // Al editar, si Colaboradores terminó de cargar después de abrir, vincular la opción.
  useEffect(() => {
    if (!open || !record || staffKey !== MANUAL_STAFF_KEY) return;
    const key = resolveStaffOptionKey(record, staffOptions);
    if (key !== MANUAL_STAFF_KEY) setStaffKey(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffOptions]);

  const isLinked = staffKey !== NO_STAFF && staffKey !== MANUAL_STAFF_KEY;

  const applyStaff = (key: string) => {
    setStaffKey(key);
    if (key === MANUAL_STAFF_KEY) {
      setForm((prev) => ({
        ...prev,
        userId: undefined,
        asistenciaStaffId: undefined,
        bukEmployeeId: undefined,
        documentNumber: undefined,
        supervisorName: undefined,
        hireDate: undefined,
        affectedName: '',
        jobTitle: '',
        workArea: '',
        contractType: 'No registrado',
        seniorityMonths: 0,
      }));
      return;
    }
    const staff = staffOptions.find((s) => s.id === key);
    if (!staff) return;
    const shift = shiftFromHours(staff.shiftHours);
    setForm((prev) => ({
      ...prev,
      userId: staff.userId,
      asistenciaStaffId: staff.asistenciaStaffId,
      bukEmployeeId: staff.bukEmployeeId,
      documentNumber: staff.documentNumber,
      affectedName: staff.name,
      jobTitle: staff.jobTitle,
      workArea: staff.workArea,
      contractType: staff.contractType,
      hireDate: staff.hireDate,
      supervisorName: staff.supervisorName,
      seniorityMonths: seniorityMonthsAt(staff.hireDate, prev.eventDate),
      workShift: shift ?? prev.workShift,
      sede: sedeOptions.includes(staff.homeSede) ? staff.homeSede : prev.sede,
    }));
  };

  const patch = (p: Partial<typeof form>) => {
    setForm((prev) => {
      const next = { ...prev, ...p };
      if ('eventDate' in p && next.hireDate) {
        next.seniorityMonths = seniorityMonthsAt(next.hireDate, next.eventDate);
      }
      if ('medicalLeaveFrom' in p || 'medicalLeaveTo' in p) {
        const days = medicalLeaveDays(next.medicalLeaveFrom, next.medicalLeaveTo);
        if (days > 0) next.estimatedLostDays = days;
      }
      return next;
    });
  };

  const today = format(new Date(), 'yyyy-MM-dd');
  const errors: string[] = [];
  if (staffKey === NO_STAFF) errors.push('Seleccione el colaborador afectado.');
  else if (!form.affectedName.trim()) errors.push('Ingrese el nombre del afectado.');
  if (!form.sede) errors.push('Seleccione la sede donde ocurrió el evento.');
  if (!form.eventDate) errors.push('Ingrese la fecha del evento.');
  else if (form.eventDate > today) errors.push('La fecha del evento no puede ser futura.');
  if (!form.exactLocation.trim()) errors.push('Ingrese la ubicación exacta.');
  if (form.medicalLeaveFrom && form.medicalLeaveTo && form.medicalLeaveTo < form.medicalLeaveFrom) {
    errors.push('El fin del descanso médico es anterior al inicio.');
  }
  if (form.hireDate && form.eventDate && form.eventDate < form.hireDate) {
    errors.push('La fecha del evento es anterior al ingreso del colaborador.');
  }

  const previous = useMemo(
    () =>
      isLinked || form.affectedName.trim()
        ? previousAccidentsFor(allRecords, form, record?.id)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allRecords, isLinked, form.bukEmployeeId, form.documentNumber, form.userId, form.affectedName, record?.id]
  );

  const handleSubmit = () => {
    setTouched(true);
    if (errors.length > 0) return;
    onSave({
      ...form,
      affectedName: form.affectedName.trim(),
      exactLocation: form.exactLocation.trim(),
      id: record?.id,
      reportedBy: form.reportedBy ?? reportedBy,
      attachments: form.attachments ?? [],
      correctiveActions: (form.correctiveActions ?? []).filter((a) => a.description.trim()),
    });
    onOpenChange(false);
  };

  const addAttachment = async (file: File) => {
    const isImage = file.type.startsWith('image/');
    if (isImage) {
      try {
        const dataUrl = await compressImage(file);
        appendAttachment(file.name, dataUrl);
        return;
      } catch {
        // Si el navegador no puede decodificarla, se intenta subir tal cual.
      }
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      await appAlert('El archivo supera 500 KB. Use un PDF comprimido o una foto.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => appendAttachment(file.name, reader.result as string);
    reader.readAsDataURL(file);
  };

  const appendAttachment = (name: string, dataUrl: string) => {
    setForm((prev) => ({
      ...prev,
      attachments: [
        ...(prev.attachments ?? []),
        {
          id: newAccidentAttachmentId(),
          name,
          dataUrl,
          uploadedAt: new Date().toISOString(),
        },
      ],
    }));
  };

  const removeAttachment = (id: string) => {
    setForm((prev) => ({
      ...prev,
      attachments: (prev.attachments ?? []).filter((a) => a.id !== id),
    }));
  };

  const addCorrectiveAction = () => {
    const action: AccidentCorrectiveAction = {
      id: newCorrectiveActionId(),
      description: '',
      status: 'pendiente',
    };
    setForm((prev) => ({
      ...prev,
      correctiveActions: [...(prev.correctiveActions ?? []), action],
    }));
  };

  const patchAction = (id: string, p: Partial<AccidentCorrectiveAction>) => {
    setForm((prev) => ({
      ...prev,
      correctiveActions: (prev.correctiveActions ?? []).map((a) =>
        a.id === id ? { ...a, ...p } : a
      ),
    }));
  };

  const removeAction = (id: string) => {
    setForm((prev) => ({
      ...prev,
      correctiveActions: (prev.correctiveActions ?? []).filter((a) => a.id !== id),
    }));
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
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Datos del afectado
              </p>
              <span className="text-[11px] text-muted-foreground">
                {collaboratorsLoading
                  ? 'Cargando Colaboradores…'
                  : `Sincronizado con Colaboradores (Buk.pe) · ${staffOptions.length} activos`}
              </span>
            </div>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>Colaborador *</Label>
                <StaffCombobox
                  options={staffOptions}
                  value={staffKey}
                  onChange={applyStaff}
                  disabled={!canEdit}
                />
                {staffKey === MANUAL_STAFF_KEY ? (
                  <div className="mt-2 space-y-1">
                    <Label>Nombre completo *</Label>
                    <Input
                      value={form.affectedName}
                      onChange={(e) => patch({ affectedName: e.target.value })}
                      disabled={!canEdit}
                      placeholder="Solo si no está en Colaboradores (practicante, tercero, visitante)"
                    />
                  </div>
                ) : null}
                {previous.length > 0 ? (
                  <p className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                    Reincidencia: {previous.length} evento{previous.length === 1 ? '' : 's'} previo
                    {previous.length === 1 ? '' : 's'} registrado{previous.length === 1 ? '' : 's'}
                    {' '}(último {previous[0]!.eventDate} · {previous[0]!.injuryNature}).
                  </p>
                ) : null}
              </div>
              {(
                [
                  ['Puesto', 'jobTitle', 'Cargo en Buk.pe'],
                  ['Área', 'workArea', 'Área padre del organigrama'],
                  ['Tipo de contrato', 'contractType', ''],
                  ['Jefe inmediato', 'supervisorName', ''],
                ] as const
              ).map(([label, key, placeholder]) => (
                <div key={key} className="space-y-1">
                  <Label>{label}</Label>
                  <Input
                    value={String(form[key] ?? '')}
                    readOnly={isLinked}
                    onChange={(e) => patch({ [key]: e.target.value } as Partial<typeof form>)}
                    disabled={!canEdit || staffKey === NO_STAFF}
                    className={isLinked ? 'bg-muted/40' : undefined}
                    placeholder={staffKey === NO_STAFF ? 'Se completa al elegir colaborador' : placeholder}
                  />
                </div>
              ))}
              <div className="space-y-1">
                <Label>Fecha de ingreso</Label>
                <Input
                  type="date"
                  value={form.hireDate ?? ''}
                  readOnly={isLinked}
                  onChange={(e) =>
                    patch({
                      hireDate: e.target.value || undefined,
                      seniorityMonths: seniorityMonthsAt(e.target.value || undefined, form.eventDate),
                    })
                  }
                  disabled={!canEdit || staffKey === NO_STAFF}
                  className={isLinked ? 'bg-muted/40' : undefined}
                />
              </div>
              <div className="space-y-1">
                <Label>Antigüedad al evento</Label>
                <Input
                  value={staffKey === NO_STAFF ? '' : formatSeniorityLabel(form.seniorityMonths)}
                  readOnly
                  className="bg-muted/40"
                  placeholder="Se calcula con la fecha de ingreso"
                />
              </div>
              {isLinked && form.documentNumber ? (
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  Documento: <span className="tabular-nums">{form.documentNumber}</span>
                  {' · '}Los datos se toman de Colaboradores y quedan guardados tal como estaban el día
                  del registro.
                </p>
              ) : null}
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
                    <SelectValue placeholder="Seleccionar sede" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...new Set([...sedeOptions, ...(form.sede ? [form.sede] : [])])].map((s) => (
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
                  max={today}
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
              <div className="space-y-1 sm:col-span-2">
                <Label>Testigos</Label>
                <Input
                  placeholder="Nombres de quienes presenciaron el evento"
                  value={form.witnesses ?? ''}
                  onChange={(e) => patch({ witnesses: e.target.value })}
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
                <Label>Tipo de evento</Label>
                <Select
                  value={form.eventType ?? 'accidente'}
                  onValueChange={(v) => patch({ eventType: v as AccidentEventType })}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACCIDENT_EVENT_TYPE_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Estado del flujo</Label>
                <Select
                  value={form.workflowStatus ?? 'reportado'}
                  onValueChange={(v) => patch({ workflowStatus: v as AccidentWorkflowStatus })}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACCIDENT_WORKFLOW_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                <Label>Cobertura de la atención</Label>
                <Select
                  value={form.insuranceCoverage ?? ''}
                  onValueChange={(v) => patch({ insuranceCoverage: v as AccidentInsuranceCoverage })}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="SCTR, EsSalud, EPS…" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACCIDENT_INSURANCE_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Descanso médico desde</Label>
                <Input
                  type="date"
                  value={form.medicalLeaveFrom ?? ''}
                  min={form.eventDate || undefined}
                  onChange={(e) => patch({ medicalLeaveFrom: e.target.value || undefined })}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1">
                <Label>Descanso médico hasta</Label>
                <Input
                  type="date"
                  value={form.medicalLeaveTo ?? ''}
                  min={form.medicalLeaveFrom || form.eventDate || undefined}
                  onChange={(e) => patch({ medicalLeaveTo: e.target.value || undefined })}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1">
                <Label>N.º CITT / certificado médico</Label>
                <Input
                  value={form.cittNumber ?? ''}
                  onChange={(e) => patch({ cittNumber: e.target.value })}
                  disabled={!canEdit}
                  placeholder="Certificado de incapacidad temporal"
                />
              </div>
              <div className="space-y-1">
                <Label>Días de baja</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.estimatedLostDays}
                  onChange={(e) => patch({ estimatedLostDays: Math.max(0, Number(e.target.value) || 0) })}
                  disabled={!canEdit}
                />
                {form.medicalLeaveFrom && form.medicalLeaveTo ? (
                  <p className="text-[11px] text-muted-foreground">
                    Calculado del descanso médico (días calendario).
                  </p>
                ) : null}
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

          <div
            className={
              requiresMtpeNotification(form) && !form.mtpeNotifiedAt
                ? 'rounded-lg border border-rose-400 bg-rose-50/60 p-3 dark:border-rose-800 dark:bg-rose-950/30'
                : 'rounded-lg border border-border p-3 dark:border-slate-700'
            }
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notificación al MTPE
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {requiresMtpeNotification(form)
                ? 'Obligatoria dentro de las 24 horas para accidentes mortales (DS 005-2012-TR, art. 110).'
                : 'Opcional: registre si el caso fue notificado al Ministerio de Trabajo.'}
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Fecha de notificación</Label>
                <Input
                  type="date"
                  value={form.mtpeNotifiedAt ?? ''}
                  onChange={(e) => patch({ mtpeNotifiedAt: e.target.value || undefined })}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1">
                <Label>N.º de registro</Label>
                <Input
                  value={form.mtpeNotificationNumber ?? ''}
                  onChange={(e) => patch({ mtpeNotificationNumber: e.target.value })}
                  disabled={!canEdit}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border p-3 dark:border-slate-700">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Acciones correctivas
              </p>
              {canEdit ? (
                <Button type="button" size="sm" variant="outline" onClick={addCorrectiveAction}>
                  <Plus className="mr-1 h-3 w-3" />
                  Agregar
                </Button>
              ) : null}
            </div>
            {(form.correctiveActions ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin acciones registradas.</p>
            ) : (
              <div className="space-y-2">
                {(form.correctiveActions ?? []).map((action) => (
                  <div
                    key={action.id}
                    className="grid gap-2 rounded-md border border-border/60 p-2 sm:grid-cols-12 dark:border-slate-700"
                  >
                    <div className="space-y-1 sm:col-span-5">
                      <Label className="text-xs">Descripción</Label>
                      <Input
                        value={action.description}
                        onChange={(e) => patchAction(action.id, { description: e.target.value })}
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-3">
                      <Label className="text-xs">Responsable</Label>
                      <Input
                        value={action.responsible ?? ''}
                        onChange={(e) => patchAction(action.id, { responsible: e.target.value })}
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Fecha límite</Label>
                      <Input
                        type="date"
                        value={action.dueDate ?? ''}
                        onChange={(e) => patchAction(action.id, { dueDate: e.target.value })}
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-1">
                      <Label className="text-xs">Estado</Label>
                      <Select
                        value={action.status}
                        onValueChange={(v) =>
                          patchAction(action.id, { status: v as AccidentCorrectiveAction['status'] })
                        }
                        disabled={!canEdit}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendiente">Pend.</SelectItem>
                          <SelectItem value="completada">OK</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {canEdit ? (
                      <div className="flex items-end sm:col-span-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-rose-600"
                          onClick={() => removeAction(action.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border p-3 dark:border-slate-700">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Adjuntos (fotos / actas)
              </p>
              {canEdit ? (
                <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-primary hover:underline">
                  <Paperclip className="h-3 w-3" />
                  Subir archivo
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) addAttachment(file);
                      e.target.value = '';
                    }}
                  />
                </label>
              ) : null}
            </div>
            {(form.attachments ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin archivos adjuntos.</p>
            ) : (
              <ul className="space-y-1">
                {(form.attachments ?? []).map((att) => (
                  <li
                    key={att.id}
                    className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1.5 text-xs dark:border-slate-700"
                  >
                    <a
                      href={att.dataUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-primary hover:underline"
                    >
                      {att.name}
                    </a>
                    {canEdit ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0"
                        onClick={() => removeAttachment(att.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {touched && errors.length > 0 ? (
          <ul className="list-disc space-y-0.5 rounded-md border border-rose-300 bg-rose-50 py-2 pl-6 pr-3 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {canEdit ? (
            <Button onClick={handleSubmit}>
              {record ? 'Guardar cambios' : 'Registrar accidente'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
