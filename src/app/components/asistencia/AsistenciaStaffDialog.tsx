import { useEffect, useState } from 'react';
import {
  Briefcase,
  Clock,
  Hexagon,
  Mail,
  MapPin,
  Phone,
  Save,
  User,
} from 'lucide-react';

import type { AsistenciaStaffArea, AsistenciaStaffMember } from '../../types/asistencia';
import {
  ASISTENCIA_CARGO_PRESETS,
  ASISTENCIA_STAFF_AREA_LABELS,
  ASISTENCIA_STAFF_AREAS,
} from '../../types/asistencia';
import { defaultMatchHints } from '../../utils/asistenciaStaff';
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
  initial?: AsistenciaStaffMember | null;
  onSave: (member: AsistenciaStaffMember) => void;
};

function newStaffId() {
  return `staff_${Math.random().toString(36).slice(2, 9)}`;
}

const emptyForm = (sedeName: string): AsistenciaStaffMember => ({
  id: newStaffId(),
  sedeName,
  fullName: '',
  cargoLabel: 'Recepcionista',
  area: 'administracion',
  expectedTime: '08:00',
  isCritical: false,
  isManager: false,
});

export function AsistenciaStaffDialog({
  open,
  onOpenChange,
  sedeName,
  initial,
  onSave,
}: Props) {
  const [form, setForm] = useState<AsistenciaStaffMember>(() => emptyForm(sedeName));

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...initial } : emptyForm(sedeName));
    }
  }, [open, initial, sedeName]);

  const patch = (partial: Partial<AsistenciaStaffMember>) => {
    setForm((f) => {
      const next = { ...f, ...partial };
      if (partial.cargoLabel || partial.area) {
        const hints = defaultMatchHints(next.cargoLabel, next.area);
        next.matchArea = hints.matchArea;
        next.matchSpecialty = hints.matchSpecialty;
      }
      if (partial.isManager) {
        next.isManager = true;
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (!form.fullName.trim()) return;
    if (!form.rut?.trim()) return;
    onSave({
      ...form,
      fullName: form.fullName.trim(),
      cargoLabel: form.cargoLabel.trim() || 'Personal',
      expectedTime: form.expectedTime.trim() || '08:00',
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
              value={form.fullName}
              onChange={(e) => patch({ fullName: e.target.value })}
              placeholder="Ej. Luis Barco"
              className="bg-white text-slate-900 border-0"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-slate-300 flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5" /> Cargo
              </Label>
              <Select value={form.cargoLabel} onValueChange={(v) => patch({ cargoLabel: v })}>
                <SelectTrigger className="bg-white text-slate-900 border-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASISTENCIA_CARGO_PRESETS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> Área
              </Label>
              <Select
                value={form.area}
                onValueChange={(v) => patch({ area: v as AsistenciaStaffArea })}
              >
                <SelectTrigger className="bg-white text-slate-900 border-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASISTENCIA_STAFF_AREAS.map((a) => (
                    <SelectItem key={a} value={a}>{ASISTENCIA_STAFF_AREA_LABELS[a]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            <div className="space-y-2">
              <Label className="text-slate-300 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Hora Esperada *
              </Label>
              <Input
                type="time"
                value={form.expectedTime}
                onChange={(e) => patch({ expectedTime: e.target.value })}
                className="bg-white text-slate-900 border-0"
              />
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
              <p className="text-sm font-medium text-white">Gerente de sede</p>
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
