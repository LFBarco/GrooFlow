import { useState } from 'react';
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { ChevronDown, Filter, Search, X } from 'lucide-react';

import type { AccidentesFilters } from '../../types/accidentes';
import {
  ACCIDENT_EVENT_TYPE_LABELS,
  ACCIDENT_SEVERITY_LABELS,
  ACCIDENT_SHIFT_LABELS,
  ACCIDENT_WORKFLOW_LABELS,
  BODY_PART_OPTIONS,
  INJURY_NATURE_OPTIONS,
  VET_WORK_AREAS,
} from '../../types/accidentes';
import { countAccidentesActiveFilters } from '../../utils/accidentesData';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { cn } from '../ui/utils';

type Props = {
  filters: AccidentesFilters;
  sedeOptions: string[];
  onChange: (filters: AccidentesFilters) => void;
};

export function defaultAccidentesFilters(): AccidentesFilters {
  const now = new Date();
  const from = startOfMonth(subMonths(now, 11));
  return {
    dateFrom: format(from, 'yyyy-MM-dd'),
    dateTo: format(endOfMonth(now), 'yyyy-MM-dd'),
    sede: 'Todas',
    workArea: 'Todas',
    workShift: 'Todas',
    bodyPart: 'Todas',
    injuryNature: 'Todas',
    search: '',
    severity: 'Todas',
    withLostTimeOnly: false,
    eventType: 'Todas',
    workflowStatus: 'Todas',
  };
}

const PRESETS: { label: string; apply: (base: AccidentesFilters) => AccidentesFilters }[] = [
  {
    label: 'Este mes',
    apply: (base) => {
      const now = new Date();
      return {
        ...base,
        dateFrom: format(startOfMonth(now), 'yyyy-MM-dd'),
        dateTo: format(endOfMonth(now), 'yyyy-MM-dd'),
      };
    },
  },
  {
    label: 'Con baja',
    apply: (base) => ({ ...base, withLostTimeOnly: true }),
  },
  {
    label: 'Abiertos',
    apply: (base) => ({ ...base, workflowStatus: '__open__' }),
  },
  {
    label: 'Graves+',
    apply: (base) => ({ ...base, severity: 'grave' }),
  },
];

export function AccidentesFiltersBar({ filters, sedeOptions, onChange }: Props) {
  const set = (patch: Partial<AccidentesFilters>) => onChange({ ...filters, ...patch });
  const activeCount = countAccidentesActiveFilters(filters);
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
              className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')}
            />
          </Button>
        </CollapsibleTrigger>

        <div className="relative min-w-[160px] flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="h-9 pl-8 text-sm"
            placeholder="Buscar colaborador o lugar…"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => {
                onChange(p.apply(filters));
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
              onClick={() => onChange(defaultAccidentesFilters())}
            >
              <X className="mr-1 h-3 w-3" />
              Limpiar
            </Button>
          ) : null}
        </div>
      </div>

      <CollapsibleContent>
        <div className="grid gap-3 border-t border-border px-3 pb-3 pt-3 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-700">
          <div className="space-y-1">
            <Label className="text-xs">Desde</Label>
            <Input
              type="date"
              className="h-9"
              value={filters.dateFrom}
              onChange={(e) => set({ dateFrom: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta</Label>
            <Input
              type="date"
              className="h-9"
              value={filters.dateTo}
              onChange={(e) => set({ dateTo: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sede</Label>
            <Select value={filters.sede} onValueChange={(v) => set({ sede: v })}>
              <SelectTrigger className="h-9">
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
              <SelectTrigger className="h-9">
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
            <Label className="text-xs">Tipo evento</Label>
            <Select value={filters.eventType} onValueChange={(v) => set({ eventType: v })}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas">Todos</SelectItem>
                {Object.entries(ACCIDENT_EVENT_TYPE_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Estado flujo</Label>
            <Select value={filters.workflowStatus} onValueChange={(v) => set({ workflowStatus: v })}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas">Todos</SelectItem>
                <SelectItem value="__open__">Abiertos (≠ cerrado)</SelectItem>
                {Object.entries(ACCIDENT_WORKFLOW_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Gravedad</Label>
            <Select value={filters.severity} onValueChange={(v) => set({ severity: v })}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas">Todas</SelectItem>
                {Object.entries(ACCIDENT_SEVERITY_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Turno</Label>
            <Select value={filters.workShift} onValueChange={(v) => set({ workShift: v })}>
              <SelectTrigger className="h-9">
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
              <SelectTrigger className="h-9">
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
              <SelectTrigger className="h-9">
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
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox
              checked={filters.withLostTimeOnly}
              onCheckedChange={(v) => set({ withLostTimeOnly: Boolean(v) })}
            />
            Solo accidentes con días de baja
          </label>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
