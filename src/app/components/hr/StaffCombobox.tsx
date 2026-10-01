import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, UserRound } from 'lucide-react';

import type { StaffOption } from '../../utils/accidentesData';
import { Button } from '../ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '../ui/utils';

export const MANUAL_STAFF_KEY = 'manual';

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

type Props = {
  options: StaffOption[];
  value: string;
  onChange: (key: string) => void;
  disabled?: boolean;
  allowManual?: boolean;
  placeholder?: string;
};

export function StaffCombobox({
  options,
  value,
  onChange,
  disabled,
  allowManual = true,
  placeholder = 'Buscar colaborador por nombre, DNI o puesto…',
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => options.find((o) => o.id === value) ?? null, [options, value]);
  const haystack = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of options) {
      map.set(
        o.id,
        fold([o.name, o.documentNumber, o.jobTitle, o.workArea, o.sedesLabel].filter(Boolean).join(' '))
      );
    }
    map.set(MANUAL_STAFF_KEY, 'otro manual no esta en colaboradores');
    return map;
  }, [options]);

  return (
    // modal: dentro de un Dialog, sin esto la rueda del mouse no desplaza la lista.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('h-auto min-h-9 w-full justify-between py-2', !selected && value !== MANUAL_STAFF_KEY && 'text-muted-foreground')}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <UserRound className="h-4 w-4 shrink-0 opacity-60" />
            {selected ? (
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{selected.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {[selected.documentNumber ? `DNI ${selected.documentNumber}` : '', selected.jobTitle, selected.workArea]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
            ) : value === MANUAL_STAFF_KEY ? (
              <span className="truncate text-sm">Otro / manual (no está en Colaboradores)</span>
            ) : (
              <span className="truncate text-sm">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,560px)] p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            const hay = haystack.get(itemValue) ?? '';
            const terms = fold(search).split(/\s+/).filter(Boolean);
            return terms.every((t) => hay.includes(t)) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Nombre, DNI, puesto, área o sede…" />
          <CommandList className="max-h-72">
            <CommandEmpty>Sin coincidencias en Colaboradores.</CommandEmpty>
            <CommandGroup heading={`${options.length} colaboradores activos`}>
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.id}
                  onSelect={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4 shrink-0', value === o.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{o.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {[o.jobTitle, o.workArea, o.sedesLabel].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {o.documentNumber ? (
                    <span className="ml-2 shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {o.documentNumber}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
            {allowManual ? (
              <CommandGroup>
                <CommandItem
                  value={MANUAL_STAFF_KEY}
                  onSelect={() => {
                    onChange(MANUAL_STAFF_KEY);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn('mr-2 h-4 w-4', value === MANUAL_STAFF_KEY ? 'opacity-100' : 'opacity-0')}
                  />
                  Otro / manual (practicante, tercero, visitante)
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
