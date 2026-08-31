import { useState } from 'react';
import { ChevronDown, Filter, Search, X } from 'lucide-react';

import type { AsistenciaFilters, AsistenciaShiftFilter } from '../../types/asistencia';
import { ASISTENCIA_WORK_SHIFT_LABELS } from '../../types/asistencia';
import {
  countAsistenciaActiveFilters,
  defaultAsistenciaFilters,
} from '../../utils/asistenciaFilters';
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
  filters: AsistenciaFilters;
  onChange: (filters: AsistenciaFilters) => void;
  areaOptions?: string[];
  specialtyOptions?: string[];
  showLiveFilters?: boolean;
  showBukFilters?: boolean;
};

const PRESETS: { label: string; patch: Partial<AsistenciaFilters> }[] = [
  { label: 'Ausentes', patch: { liveStatus: 'ausente', arrivalFilter: 'absent' } },
  { label: 'Tardanzas', patch: { liveStatus: 'tarde', arrivalFilter: 'late' } },
  { label: 'Críticos aus.', patch: { criticalOnly: true, liveStatus: 'ausente', arrivalFilter: 'absent' } },
  { label: 'Sin cruce Buk', patch: { noBukMatchOnly: true, liveStatus: 'ausente' } },
];

export function AsistenciaFiltersBar({
  filters,
  onChange,
  areaOptions = [],
  specialtyOptions = [],
  showLiveFilters = true,
  showBukFilters = true,
}: Props) {
  const set = (patch: Partial<AsistenciaFilters>) => onChange({ ...filters, ...patch });
  const activeCount = countAsistenciaActiveFilters(filters);
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
            placeholder="Buscar nombre, RUT o cargo…"
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
                onChange({ ...filters, ...p.patch });
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
              onClick={() => onChange(defaultAsistenciaFilters())}
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
            <Label className="text-xs">Turno</Label>
            <Select
              value={filters.shift}
              onValueChange={(v) => set({ shift: v as AsistenciaShiftFilter })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="day">{ASISTENCIA_WORK_SHIFT_LABELS.day}</SelectItem>
                <SelectItem value="night">{ASISTENCIA_WORK_SHIFT_LABELS.night}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showLiveFilters ? (
            <div className="space-y-1">
              <Label className="text-xs">Estado live</Label>
              <Select
                value={filters.liveStatus}
                onValueChange={(v) =>
                  set({ liveStatus: v as AsistenciaFilters['liveStatus'] })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="trabajando">Trabajando</SelectItem>
                  <SelectItem value="presente">Presente</SelectItem>
                  <SelectItem value="tarde">Tarde</SelectItem>
                  <SelectItem value="ausente">Ausente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {showBukFilters ? (
            <div className="space-y-1">
              <Label className="text-xs">Llegada Buk</Label>
              <Select
                value={filters.arrivalFilter}
                onValueChange={(v) =>
                  set({ arrivalFilter: v as AsistenciaFilters['arrivalFilter'] })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="arrived">Llegaron</SelectItem>
                  <SelectItem value="absent">Sin entrada</SelectItem>
                  <SelectItem value="on_time">A tiempo</SelectItem>
                  <SelectItem value="late">Tardanza</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {showBukFilters && areaOptions.length > 0 ? (
            <div className="space-y-1">
              <Label className="text-xs">Área Buk</Label>
              <Select value={filters.areaFilter} onValueChange={(v) => set({ areaFilter: v })}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {areaOptions.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {showBukFilters && specialtyOptions.length > 0 ? (
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Especialidad</Label>
              <Select
                value={filters.specialtyFilter}
                onValueChange={(v) => set({ specialtyFilter: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {specialtyOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox
              checked={filters.criticalOnly}
              onCheckedChange={(v) => set({ criticalOnly: Boolean(v) })}
            />
            Solo personal crítico
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox
              checked={filters.noBukMatchOnly}
              onCheckedChange={(v) => set({ noBukMatchOnly: Boolean(v) })}
            />
            Solo sin cruce Buk (con diagnóstico)
          </label>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
