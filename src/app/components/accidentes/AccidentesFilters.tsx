import type { AccidentesFilters } from '../../types/accidentes';
import {
  ACCIDENT_SHIFT_LABELS,
  BODY_PART_OPTIONS,
  INJURY_NATURE_OPTIONS,
  VET_WORK_AREAS,
} from '../../types/accidentes';
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
  filters: AccidentesFilters;
  sedeOptions: string[];
  onChange: (filters: AccidentesFilters) => void;
};

export function AccidentesFiltersBar({ filters, sedeOptions, onChange }: Props) {
  const set = (patch: Partial<AccidentesFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-700">
      <div className="space-y-1">
        <Label className="text-xs">Desde</Label>
        <Input type="date" value={filters.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Hasta</Label>
        <Input type="date" value={filters.dateTo} onChange={(e) => set({ dateTo: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Sede</Label>
        <Select value={filters.sede} onValueChange={(v) => set({ sede: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todas">Todas las sedes</SelectItem>
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
        <Select value={filters.workArea} onValueChange={(v) => set({ workArea: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todas">Todas las áreas</SelectItem>
            {VET_WORK_AREAS.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Turno</Label>
        <Select value={filters.workShift} onValueChange={(v) => set({ workShift: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todas">Todos</SelectItem>
            {Object.entries(ACCIDENT_SHIFT_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Parte del cuerpo</Label>
        <Select value={filters.bodyPart} onValueChange={(v) => set({ bodyPart: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todas">Todas</SelectItem>
            {BODY_PART_OPTIONS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-xs">Naturaleza de la lesión</Label>
        <Select value={filters.injuryNature} onValueChange={(v) => set({ injuryNature: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todas">Todas</SelectItem>
            {INJURY_NATURE_OPTIONS.map((n) => (
              <SelectItem key={n} value={n}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
