import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '../ui/utils';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';

export type SearchableSelectOption = {
  value: number;
  label: string;
  sublabel?: string;
  meta?: string;
  searchText?: string;
};

type SearchableSelectProps = {
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  options: SearchableSelectOption[];
  value: number | null;
  onValueChange: (value: number | null) => void;
  disabled?: boolean;
};

export function SearchableSelect({
  label,
  placeholder = 'Seleccionar…',
  searchPlaceholder = 'Buscar…',
  options,
  value,
  onValueChange,
  disabled,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);

  return (
    <div className="w-full">
      {label ? <span className="g-field-label">{label}</span> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn('asignacion-searchable-select__trigger mt-1 h-auto min-h-9 py-2', !selected && 'text-muted-foreground')}
          >
            <span className="flex min-w-0 flex-1 flex-col items-start text-left">
              {selected ? (
                <>
                  <span className="truncate text-sm font-medium">{selected.label}</span>
                  {selected.sublabel ? (
                    <span className="truncate text-xs text-muted-foreground">{selected.sublabel}</span>
                  ) : null}
                </>
              ) : (
                <span>{placeholder}</span>
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(100vw-2rem,420px)] p-0" align="start">
          <Command
            filter={(itemValue, search) => {
              const opt = options.find((o) => String(o.value) === itemValue);
              const hay = `${opt?.searchText ?? ''} ${opt?.label ?? ''} ${opt?.sublabel ?? ''} ${opt?.meta ?? ''}`.toLowerCase();
              return hay.includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>Sin coincidencias.</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={String(opt.value)}
                    onSelect={() => {
                      onValueChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === opt.value ? 'opacity-100' : 'opacity-0')} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{opt.label}</span>
                      {opt.sublabel ? (
                        <span className="truncate text-xs text-muted-foreground">{opt.sublabel}</span>
                      ) : null}
                    </span>
                    {opt.meta ? <span className="asignacion-searchable-select__option-meta">{opt.meta}</span> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
