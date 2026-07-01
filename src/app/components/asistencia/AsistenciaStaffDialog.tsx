import { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Clock,
  Hexagon,
  Mail,
  MapPin,
  Moon,
  Phone,
  Save,
  Sun,
  User,
} from 'lucide-react';

import type {
  AsistenciaSedeProfile,
  AsistenciaShiftMode,
  AsistenciaStaffMember,
  AsistenciaWeekday,
  AsistenciaWeekdayShift,
  AsistenciaWorkShift,
} from '../../types/asistencia';
import {
  ASISTENCIA_DEFAULT_DAY_EXPECTED_TIME,
  ASISTENCIA_DEFAULT_NIGHT_EXPECTED_TIME,
  ASISTENCIA_WEEKDAY_LABELS,
  ASISTENCIA_WEEKDAYS,
  ASISTENCIA_WORK_SHIFT_LABELS,
} from '../../types/asistencia';
import {
  createDefaultWeeklyShifts,
  defaultExpectedTimeForShift,
  formatWeeklyShiftSummary,
} from '../../utils/asistenciaShift';
import { defaultMatchHints } from '../../utils/asistenciaStaff';
import { cargosForOrgColumn, type AsistenciaOrgColumn } from '../../utils/asistenciaOrgColumns';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
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
  sedeName: string;
  sedeProfile: AsistenciaSedeProfile;
  orgColumns: AsistenciaOrgColumn[];
  initial?: AsistenciaStaffMember | null;
  onSave: (member: AsistenciaStaffMember) => void;
};

function newStaffId() {
  return `staff_${Math.random().toString(36).slice(2, 9)}`;
}

const emptyForm = (sedeName: string, defaultArea: string): AsistenciaStaffMember => ({
  id: newStaffId(),
  sedeName,
  fullName: '',
  cargoLabel: 'Recepcionista',
  area: defaultArea,
  expectedTime: ASISTENCIA_DEFAULT_DAY_EXPECTED_TIME,
  shift: 'day',
  isCritical: false,
  isManager: false,
});

export function AsistenciaStaffDialog({
  open,
  onOpenChange,
  sedeName,
  sedeProfile,
  orgColumns,
  initial,
  onSave,
}: Props) {
  const defaultArea = orgColumns[0]?.id ?? 'administracion';
  const [form, setForm] = useState<AsistenciaStaffMember>(() => emptyForm(sedeName, defaultArea));

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...initial } : emptyForm(sedeName, defaultArea));
    }
  }, [open, initial, sedeName, defaultArea]);

  const cargoOptions = useMemo(
    () => cargosForOrgColumn(sedeProfile, form.area),
    [sedeProfile, form.area]
  );

  const isWeekly = form.shiftMode === 'weekly';
  const weeklySummary = useMemo(
    () => (isWeekly ? formatWeeklyShiftSummary(form) : undefined),
    [form, isWeekly]
  );

  const setShiftMode = (mode: AsistenciaShiftMode) => {
    if (mode === 'weekly') {
      patch({
        shiftMode: 'weekly',
        weeklyShifts: form.weeklyShifts ?? createDefaultWeeklyShifts(form.shift ?? 'day'),
        expectedTimeNight:
          form.expectedTimeNight?.trim() || ASISTENCIA_DEFAULT_NIGHT_EXPECTED_TIME,
      });
    } else {
      patch({ shiftMode: 'fixed', weeklyShifts: undefined });
    }
  };

  const setWeekdayShift = (day: AsistenciaWeekday, value: AsistenciaWeekdayShift) => {
    const base = form.weeklyShifts ?? createDefaultWeeklyShifts(form.shift ?? 'day');
    patch({
      shiftMode: 'weekly',
      weeklyShifts: { ...base, [day]: value },
    });
  };

  const patch = (partial: Partial<AsistenciaStaffMember>) => {
    setForm((f) => {
      const next = { ...f, ...partial };
      if (partial.area && !partial.cargoLabel) {
        const cargos = cargosForOrgColumn(sedeProfile, next.area);
        if (!cargos.includes(next.cargoLabel)) {
          next.cargoLabel = cargos[0] ?? 'Personal';
        }
      }
      if (partial.cargoLabel || partial.area) {
        const hints = defaultMatchHints(next.cargoLabel, next.area);
        next.matchArea = hints.matchArea;
        next.matchSpecialty = hints.matchSpecialty;
      }
      if (partial.isManager !== undefined) {
        next.isManager = partial.isManager;
      }
      if (partial.shift) {
        const oldShift = f.shift ?? 'day';
        const oldDefault = defaultExpectedTimeForShift(oldShift);
        if (
          !partial.expectedTime &&
          (f.expectedTime === oldDefault ||
            f.expectedTime === ASISTENCIA_DEFAULT_DAY_EXPECTED_TIME ||
            f.expectedTime === ASISTENCIA_DEFAULT_NIGHT_EXPECTED_TIME)
        ) {
          next.expectedTime = defaultExpectedTimeForShift(partial.shift);
        }
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (!form.fullName.trim()) return;
    if (!form.rut?.trim()) return;
    const shiftMode = form.shiftMode === 'weekly' ? 'weekly' : 'fixed';
    onSave({
      ...form,
      fullName: form.fullName.trim(),
      cargoLabel: form.cargoLabel.trim() || 'Personal',
      expectedTime: form.expectedTime.trim() || defaultExpectedTimeForShift(form.shift ?? 'day'),
      expectedTimeNight:
        form.expectedTimeNight?.trim() || ASISTENCIA_DEFAULT_NIGHT_EXPECTED_TIME,
      shift: form.shift ?? 'day',
      shiftMode,
      weeklyShifts: shiftMode === 'weekly' ? form.weeklyShifts : undefined,
      email: form.email?.trim() || undefined,
      phone: form.phone?.trim() || undefined,
      avatarUrl: form.avatarUrl?.trim() || undefined,
      rut: form.rut?.trim() || undefined,
    });
    onOpenChange(false);
  };

  const isEdit = Boolean(initial);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-slate-950 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <User className="h-5 w-5 text-indigo-400" />
            {isEdit ? 'Editar personal' : 'Nuevo Personal'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Nombre Completo *</Label>
            <Input
              data-testid="asistencia-staff-name"
              value={form.fullName}
              onChange={(e) => patch({ fullName: e.target.value })}
              placeholder="Ej. Luis Barco"
              className="bg-white text-slate-900 border-0"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-slate-300 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> Área
              </Label>
              <Select value={form.area} onValueChange={(v) => patch({ area: v })}>
                <SelectTrigger className="bg-white text-slate-900 border-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {orgColumns.map((col) => (
                    <SelectItem key={col.id} value={col.id}>{col.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5" /> Cargo
              </Label>
              <Select value={form.cargoLabel} onValueChange={(v) => patch({ cargoLabel: v })}>
                <SelectTrigger className="bg-white text-slate-900 border-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cargoOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white">Turno mixto</p>
                <p className="text-xs text-slate-400">
                  Día y noche distintos según el día de la semana (ej. lun–mié día, jue–vie noche).
                </p>
              </div>
              <Switch
                data-testid="asistencia-staff-weekly-toggle"
                checked={isWeekly}
                onCheckedChange={(v) => setShiftMode(v ? 'weekly' : 'fixed')}
              />
            </div>

            {!isWeekly ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-slate-300 flex items-center gap-1">
                    {form.shift === 'night' ? (
                      <Moon className="h-3.5 w-3.5" />
                    ) : (
                      <Sun className="h-3.5 w-3.5" />
                    )}{' '}
                    Turno
                  </Label>
                  <Select
                    value={form.shift ?? 'day'}
                    onValueChange={(v) => patch({ shift: v as AsistenciaWorkShift })}
                  >
                    <SelectTrigger
                      data-testid="asistencia-staff-shift"
                      className="bg-white text-slate-900 border-0"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">{ASISTENCIA_WORK_SHIFT_LABELS.day}</SelectItem>
                      <SelectItem value="night">{ASISTENCIA_WORK_SHIFT_LABELS.night}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Hora esperada *
                  </Label>
                  <Input
                    type="time"
                    value={form.expectedTime}
                    onChange={(e) => patch({ expectedTime: e.target.value })}
                    className="bg-white text-slate-900 border-0"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1.5">
                  {ASISTENCIA_WEEKDAYS.map((day) => {
                    const value =
                      form.weeklyShifts?.[day] ??
                      createDefaultWeeklyShifts(form.shift ?? 'day')[day] ??
                      'off';
                    return (
                      <div key={day} className="space-y-1">
                        <p className="text-[10px] text-center text-slate-400 font-medium">
                          {ASISTENCIA_WEEKDAY_LABELS[day]}
                        </p>
                        <Select
                          value={value}
                          onValueChange={(v) => setWeekdayShift(day, v as AsistenciaWeekdayShift)}
                        >
                          <SelectTrigger className="h-8 px-1 text-[10px] bg-white text-slate-900 border-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="day">Día</SelectItem>
                            <SelectItem value="night">Noche</SelectItem>
                            <SelectItem value="off">Libre</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
                {weeklySummary ? (
                  <p className="text-[11px] text-indigo-300/90">{weeklySummary}</p>
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-slate-300 flex items-center gap-1">
                      <Sun className="h-3.5 w-3.5" /> Hora turno día
                    </Label>
                    <Input
                      type="time"
                      value={form.expectedTime}
                      onChange={(e) => patch({ expectedTime: e.target.value })}
                      className="bg-white text-slate-900 border-0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300 flex items-center gap-1">
                      <Moon className="h-3.5 w-3.5" /> Hora turno noche
                    </Label>
                    <Input
                      type="time"
                      value={form.expectedTimeNight ?? ASISTENCIA_DEFAULT_NIGHT_EXPECTED_TIME}
                      onChange={(e) => patch({ expectedTimeNight: e.target.value })}
                      className="bg-white text-slate-900 border-0"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-slate-300">Estado inicial</Label>
              <Select value="ausente" disabled>
                <SelectTrigger className="bg-slate-800 text-slate-400 border-slate-700">
                  <SelectValue placeholder="Ausente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ausente">Ausente</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-slate-500">Se actualiza en vivo con Buk</p>
            </div>
            <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-2">
              <p className="text-[11px] text-slate-400 leading-snug">
                {isWeekly ? (
                  <>
                    Turno mixto: se cruza con <code className="text-cyan-300">turno_noche</code> en Buk
                    según el día seleccionado.
                  </>
                ) : (
                  <>
                    Turno{' '}
                    <strong className="text-slate-200">
                      {ASISTENCIA_WORK_SHIFT_LABELS[form.shift ?? 'day']}
                    </strong>
                    : se cruza con <code className="text-cyan-300">turno_noche</code> en Buk.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-slate-300 flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> Email (opcional)
              </Label>
              <Input
                type="email"
                value={form.email ?? ''}
                onChange={(e) => patch({ email: e.target.value })}
                className="bg-white text-slate-900 border-0"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> Teléfono (opcional)
              </Label>
              <Input
                value={form.phone ?? ''}
                onChange={(e) => patch({ phone: e.target.value })}
                className="bg-white text-slate-900 border-0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">RUT Buk * (rut_trabajador)</Label>
            <Input
              data-testid="asistencia-staff-rut"
              value={form.rut ?? ''}
              onChange={(e) => patch({ rut: e.target.value })}
              placeholder="12345678-9"
              className="bg-white text-slate-900 border-0"
              required
            />
            <p className="text-[11px] text-slate-500">
              Debe coincidir con rut_trabajador en Buk. Presencia por entrada_format; si marca salida el mismo día (salida_format), aparece como ausente.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">URL del Avatar (opcional)</Label>
            <Input
              value={form.avatarUrl ?? ''}
              onChange={(e) => patch({ avatarUrl: e.target.value })}
              placeholder="https://..."
              className="bg-white text-slate-900 border-0"
            />
            <p className="text-xs text-slate-500">
              Puedes usar una URL de imagen o dejar en blanco para usar el icono del cargo.
            </p>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
            <div className="flex gap-2">
              <Hexagon className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-white">Puesto Crítico</p>
                <p className="text-xs text-slate-400">
                  Si este puesto es crítico, la sede no estará operativa sin esta persona.
                </p>
              </div>
            </div>
            <Switch
              checked={form.isCritical}
              onCheckedChange={(v) => patch({ isCritical: v })}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
            <div>
              <p className="text-sm font-medium text-white">Encargado de sede</p>
              <p className="text-xs text-slate-400">Aparece en la cima del organigrama en vivo.</p>
            </div>
            <Switch
              checked={form.isManager === true}
              onCheckedChange={(v) => patch({ isManager: v })}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              className="flex-1 bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white border-0"
              data-testid="asistencia-staff-save"
              onClick={handleSubmit}
              disabled={!form.fullName.trim()}
            >
              <Save className="h-4 w-4 mr-1" />
              {isEdit ? 'Guardar cambios' : 'Agregar Personal'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
