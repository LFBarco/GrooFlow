import { useEffect, useState } from 'react';

import type {
  MarketingEventKind,
  MarketingEventRecord,
  MarketingEventStatus,
} from '../../types/marketingEventos';
import {
  MARKETING_EVENT_KIND_LABELS,
  MARKETING_EVENT_STATUS_LABELS,
} from '../../types/marketingEventos';
import { courseTemplateLines } from '../../utils/marketingEventosData';
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
import { Checkbox } from '../ui/checkbox';
import { appAlert } from '../ui/app-dialog';

type SavePayload = Omit<MarketingEventRecord, 'createdAt' | 'updatedAt'> & {
  id?: string;
  createdAt?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: MarketingEventRecord | null;
  canEdit: boolean;
  onSave: (payload: SavePayload) => void;
};

export function MarketingEventoFormDialog({
  open,
  onOpenChange,
  record,
  canEdit,
  onSave,
}: Props) {
  const isEdit = Boolean(record?.id);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<MarketingEventKind>('curso');
  const [status, setStatus] = useState<MarketingEventStatus>('planificado');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');
  const [responsible, setResponsible] = useState('');
  const [expectedAttendees, setExpectedAttendees] = useState('');
  const [notes, setNotes] = useState('');
  const [useTemplate, setUseTemplate] = useState(true);

  useEffect(() => {
    if (!open) return;
    const today = new Date().toISOString().slice(0, 10);
    setName(record?.name ?? '');
    setKind(record?.kind ?? 'curso');
    setStatus(record?.status ?? 'planificado');
    setStartDate(record?.startDate ?? today);
    setEndDate(record?.endDate ?? '');
    setLocation(record?.location ?? '');
    setResponsible(record?.responsible ?? '');
    setExpectedAttendees(
      record?.expectedAttendees != null ? String(record.expectedAttendees) : ''
    );
    setNotes(record?.notes ?? '');
    setUseTemplate(!isEdit);
  }, [open, record, isEdit]);

  const handleSubmit = () => {
    if (!canEdit) return;
    const trimmed = name.trim();
    if (!trimmed) {
      void appAlert('Indica el nombre del evento o curso.');
      return;
    }
    if (!startDate) {
      void appAlert('Indica la fecha de inicio.');
      return;
    }

    const template = !isEdit && useTemplate ? courseTemplateLines() : null;

    onSave({
      id: record?.id,
      name: trimmed,
      kind,
      status,
      startDate,
      endDate: endDate || undefined,
      location: location.trim() || undefined,
      responsible: responsible.trim() || undefined,
      expectedAttendees: expectedAttendees.trim()
        ? Math.max(0, Math.round(Number(expectedAttendees) || 0))
        : undefined,
      notes: notes.trim() || undefined,
      incomeLines: record?.incomeLines ?? template?.incomeLines ?? [],
      expenseLines: record?.expenseLines ?? template?.expenseLines ?? [],
      createdAt: record?.createdAt,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar evento / curso' : 'Nuevo evento / curso'}</DialogTitle>
          <DialogDescription>
            Datos generales. Luego podrás cargar ingresos y egresos (presupuesto y real) en el
            detalle.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-1">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Curso de grooming básico — marzo"
              disabled={!canEdit}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={kind}
                onValueChange={(v) => setKind(v as MarketingEventKind)}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MARKETING_EVENT_KIND_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as MarketingEventStatus)}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MARKETING_EVENT_STATUS_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Fecha inicio *</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha fin</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Lugar / sede</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ej. Sede principal"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Responsable</Label>
              <Input
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                placeholder="Nombre del responsable"
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Participantes esperados</Label>
            <Input
              type="number"
              min={0}
              value={expectedAttendees}
              onChange={(e) => setExpectedAttendees(e.target.value)}
              disabled={!canEdit}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              disabled={!canEdit}
            />
          </div>

          {!isEdit && canEdit ? (
            <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm dark:border-slate-700">
              <Checkbox
                checked={useTemplate}
                onCheckedChange={(v) => setUseTemplate(v === true)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Incluir plantilla de ingresos y gastos típicos</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Inscripciones, publicidad, local, coffee break, etc. Podrás editar los montos
                  después.
                </span>
              </span>
            </label>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {canEdit ? (
            <Button type="button" onClick={handleSubmit}>
              {isEdit ? 'Guardar' : 'Crear y continuar'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
