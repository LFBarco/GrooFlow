import type { User } from '../../types';
import { VET_WORK_AREAS } from '../../types/accidentes';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

const CONTRACT_OPTIONS: Array<{ value: User['contractType']; label: string }> = [
  { value: 'planta', label: 'Planta / Indeterminado' },
  { value: 'temporal', label: 'Temporal' },
  { value: 'practicante', label: 'Practicante' },
  { value: 'honorarios', label: 'Honorarios' },
  { value: 'locacion', label: 'Locación de servicios' },
  { value: 'otro', label: 'Otro' },
];

type Props = {
  form: Partial<User>;
  sedesCatalog: string[];
  onChange: (patch: Partial<User>) => void;
};

/** Campos laborales usados por SST, turnos y asistencia. */
export function UserOccupationalFields({ form, sedesCatalog, onChange }: Props) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3 dark:border-slate-700">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Datos laborales (SST / turnos)
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Puesto laboral</Label>
          <Input
            placeholder="Ej. Asistente médico, Groomer"
            value={form.jobTitle ?? ''}
            onChange={(e) => onChange({ jobTitle: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Área operativa</Label>
          <Select
            value={form.workArea ?? ''}
            onValueChange={(v) => onChange({ workArea: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar área" />
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
          <Label className="text-xs">Sede principal</Label>
          <Select
            value={form.location ?? ''}
            onValueChange={(v) => onChange({ location: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sede habitual" />
            </SelectTrigger>
            <SelectContent>
              {sedesCatalog.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo de contrato</Label>
          <Select
            value={form.contractType ?? ''}
            onValueChange={(v) => onChange({ contractType: v as User['contractType'] })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Contrato" />
            </SelectTrigger>
            <SelectContent>
              {CONTRACT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value!}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fecha de ingreso</Label>
          <Input
            type="date"
            value={form.hireDate ?? ''}
            onChange={(e) => onChange({ hireDate: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Horas semanales</Label>
          <Input
            type="number"
            min={1}
            max={60}
            placeholder="48"
            value={form.weeklyHours ?? ''}
            onChange={(e) =>
              onChange({ weeklyHours: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </div>
      </div>
    </div>
  );
}
