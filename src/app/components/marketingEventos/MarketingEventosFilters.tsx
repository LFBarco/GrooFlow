import { useMemo, useState } from 'react';
import { ChevronDown, Filter, Search, X } from 'lucide-react';

import type { MarketingEventosFilters } from '../../types/marketingEventos';
import {
  MARKETING_EVENT_KIND_LABELS,
  MARKETING_EVENT_STATUS_LABELS,
} from '../../types/marketingEventos';
import { defaultMarketingEventosFilters } from '../../utils/marketingEventosData';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { cn } from '../ui/utils';

type Props = {
  filters: MarketingEventosFilters;
  yearOptions: string[];
  onChange: (filters: MarketingEventosFilters) => void;
};

function countActive(filters: MarketingEventosFilters): number {
  let n = 0;
  if (filters.search.trim()) n += 1;
  if (filters.status !== 'all') n += 1;
  if (filters.kind !== 'all') n += 1;
  if (filters.year !== 'all') n += 1;
  return n;
}

export function MarketingEventosFiltersBar({ filters, yearOptions, onChange }: Props) {
  const set = (patch: Partial<MarketingEventosFilters>) => onChange({ ...filters, ...patch });
  const activeCount = countActive(filters);
  const [open, setOpen] = useState(false);

  const years = useMemo(() => yearOptions.slice().sort((a, b) => b.localeCompare(a)), [yearOptions]);

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
            placeholder="Buscar evento o curso…"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {(
            [
              { label: 'En curso', patch: { status: 'en_curso' as const } },
              { label: 'Planificados', patch: { status: 'planificado' as const } },
              { label: 'Cerrados', patch: { status: 'cerrado' as const } },
            ] as const
          ).map((p) => (
            <Button
              key={p.label}
              type="button"
              size="sm"
              variant={filters.status === p.patch.status ? 'default' : 'outline'}
              className="h-8"
              onClick={() =>
                set({
                  status: filters.status === p.patch.status ? 'all' : p.patch.status,
                })
              }
            >
              {p.label}
            </Button>
          ))}
        </div>

        {activeCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-8"
            onClick={() => onChange(defaultMarketingEventosFilters())}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Limpiar
          </Button>
        ) : null}
      </div>

      <CollapsibleContent>
        <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-3 dark:border-slate-700">
          <div className="space-y-1.5">
            <Label className="text-xs">Estado</Label>
            <Select
              value={filters.status}
              onValueChange={(v) => set({ status: v as MarketingEventosFilters['status'] })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(MARKETING_EVENT_STATUS_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select
              value={filters.kind}
              onValueChange={(v) => set({ kind: v as MarketingEventosFilters['kind'] })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(MARKETING_EVENT_KIND_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Año</Label>
            <Select
              value={filters.year}
              onValueChange={(v) => set({ year: v as MarketingEventosFilters['year'] })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
