import type { UniformesFilters } from '../../types/uniformes';
import {
  UNIFORM_ITEM_LABELS,
  UNIFORM_REASON_LABELS,
  UNIFORM_STATUS_LABELS,
} from '../../types/uniformes';
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

type Props = {
  filters: UniformesFilters;
  sedeOptions: string[];
  onChange: (filters: UniformesFilters) => void;
};

export function UniformesFiltersBar({ filters, sedeOptions, onChange }: Props) {
  const set = (patch: Partial<UniformesFilters>) => onChange({ ...filters, ...patch });

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
        <Label className="text-xs">Prenda</Label>
        <Select value={filters.itemType} onValueChange={(v) => set({ itemType: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todas">Todas</SelectItem>
            {Object.entries(UNIFORM_ITEM_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Motivo</Label>
        <Select value={filters.reason} onValueChange={(v) => set({ reason: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todas">Todos</SelectItem>
            {Object.entries(UNIFORM_REASON_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Estado</Label>
        <Select value={filters.status} onValueChange={(v) => set({ status: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todas">Todos</SelectItem>
            {Object.entries(UNIFORM_STATUS_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
