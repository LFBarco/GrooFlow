import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';
import { cn } from './utils';

export type AccountOption = { value: string; label: string };

type Props = {
  options: AccountOption[];
  value?: string;
  noneValue?: string;
  noneLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

/** Combobox buscable para cuentas contables (evita Select con miles de ítems). */
export function AccountCombobox({
  options,
  value,
  noneValue = '__none__',
  noneLabel = '— Sin definir —',
  placeholder = 'Buscar cuenta…',
  disabled,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const current = value && value !== noneValue ? value : noneValue;
  const selectedLabel = useMemo(() => {
    if (current === noneValue) return noneLabel;
    return options.find((o) => o.value === current)?.label ?? current;
  }, [current, noneLabel, noneValue, options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>Sin coincidencias.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={`${noneLabel} none`}
                onSelect={() => {
                  onChange(noneValue);
                  setOpen(false);
                }}
              >
                <Check className={cn('mr-2 h-4 w-4', current === noneValue ? 'opacity-100' : 'opacity-0')} />
                {noneLabel}
              </CommandItem>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.value}`}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', current === o.value ? 'opacity-100' : 'opacity-0')} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
