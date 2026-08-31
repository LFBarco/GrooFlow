import { useState } from 'react';
import { ChevronDown, Filter, Search, X } from 'lucide-react';

import type { TurnosFilters } from '../../types/turnos';
import { TURNO_SHIFT_LABELS } from '../../types/turnos';
import { countActiveFilters, defaultTurnosFilters } from '../../utils/turnosData';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { cn } from '../ui/utils';

type Props = {
  filters: TurnosFilters;
  workAreas: string[];
  roleOptions: string[];
  sedeOptions: string[];
  weekDateOptions?: { value: string; label: string }[];
  onChange: (filters: TurnosFilters) => void;
};

const PLAN_VS_REAL_OPTIONS = [
  { value: 'Todos', label: 'Todos (plan vs real)' },
  { value: 'ok', label: 'Coincide' },
  { value: 'absent', label: 'Ausente' },
  { value: 'mismatch', label: 'Discrepancia' },
  { value: 'unplanned', label: 'Sin planificar' },
  { value: 'pending', label: 'Pendiente' },
];

const FILTER_PRESETS: { label: string; patch: Partial<TurnosFilters> }[] = [
  { label: 'Sin asignar', patch: { unassignedOnly: true, coverOnly: false, externalOnly: false } },
  { label: 'COV', patch: { coverOnly: true, externalOnly: false, unassignedOnly: false } },
  { label: 'EXT', patch: { externalOnly: true, coverOnly: false, unassignedOnly: false } },
];

export function TurnosFiltersBar({
  filters,
  workAreas,
  roleOptions,
  sedeOptions,
  weekDateOptions,
  onChange,
}: Props) {
  const set = (patch: Partial<TurnosFilters>) => onChange({ ...filters, ...patch });
  const activeCount = countActiveFilters(filters);
  const [open, setOpen] = useState(false);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-xl border border-border bg-card dark:border-slate-700"
    >
      <div className="flex flex-wrap items-center gap-2 p-3">
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtros</span>
            {activeCount > 0 ? (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {activeCount}
              </Badge>
            ) : null}
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                open && 'rotate-180'
              )}
            />
          </Button>
        </CollapsibleTrigger>

        <div className="relative min-w-[160px] flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="h-9 pl-8 text-sm"
            placeholder="Buscar personal…"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {FILTER_PRESETS.map((p) => (
            <Button
              key={p.label}
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => {
                onChange({ ...defaultTurnosFilters(), ...p.patch });
                setOpen(true);
              }}
            >
              {p.label}
            </Button>
          ))}
          {activeCount > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => onChange(defaultTurnosFilters())}
            >
              <X className="mr-1 h-3 w-3" />
              Limpiar
            </Button>
          ) : null}
        </div>
      </div>

      <CollapsibleContent>
        <div className="grid gap-3 border-t border-border px-3 pb-3 pt-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 dark:border-slate-700">
          <div className="space-y-1">
            <Label className="text-xs">Área</Label>
            <Select value={filters.workArea} onValueChange={(v) => set({ workArea: v })}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas">Todas las áreas</SelectItem>
                {workAreas.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cargo / rol</Label>
            <Select value={filters.roleLabel} onValueChange={(v) => set({ roleLabel: v })}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                {roleOptions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sede habitual</Label>
            <Select value={filters.homeSede} onValueChange={(v) => set({ homeSede: v })}>
              <SelectTrigger className="h-9">
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
            <Label className="text-xs">Turno asignado</Label>
            <Select value={filters.shift} onValueChange={(v) => set({ shift: v })}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                {(['day', 'night', 'off', 'training'] as const).map((code) => (
                  <SelectItem key={code} value={code}>
                    {TURNO_SHIFT_LABELS[code]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {weekDateOptions && weekDateOptions.length > 0 ? (
            <div className="space-y-1">
              <Label className="text-xs">Día del turno</Label>
              <Select
                value={filters.filterDate || '__all__'}
                onValueChange={(v) => set({ filterDate: v === '__all__' ? '' : v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Toda la semana" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Toda la semana</SelectItem>
                  {weekDateOptions.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-1">
            <Label className="text-xs">Plan vs real</Label>
            <Select
              value={filters.planVsRealStatus}
              onValueChange={(v) => set({ planVsRealStatus: v })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAN_VS_REAL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col justify-end gap-2 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={filters.unassignedOnly}
                onCheckedChange={(v) => set({ unassignedOnly: Boolean(v) })}
              />
              Sin asignar
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={filters.coverOnly}
                onCheckedChange={(v) =>
                  set({ coverOnly: Boolean(v), externalOnly: v ? false : filters.externalOnly })
                }
              />
              Solo COV (inter-sede)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={filters.externalOnly}
                onCheckedChange={(v) =>
                  set({ externalOnly: Boolean(v), coverOnly: v ? false : filters.coverOnly })
                }
              />
              Solo EXT (externos)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={filters.alertsOnly}
                onCheckedChange={(v) => set({ alertsOnly: Boolean(v) })}
              />
              Con alertas laborales
            </label>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
