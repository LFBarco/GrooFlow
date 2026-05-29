import { useMemo } from 'react';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export function buildFleetSedeOptions(
  visibleSedes: string[] | undefined,
  defaultSede: string | undefined,
  currentValue?: string
) {
  const resolvedDefault = defaultSede?.trim() || visibleSedes?.[0]?.trim() || 'Principal';
  const baseSedes = visibleSedes && visibleSedes.length > 0 ? visibleSedes : ['Principal'];
  const set = new Set<string>(baseSedes);
  const options = [...baseSedes];
  for (const s of [resolvedDefault, currentValue]) {
    const t = s?.trim();
    if (t && !set.has(t)) {
      set.add(t);
      options.unshift(t);
    }
  }
  return { baseSedes, options, resolvedDefault };
}

export function useFleetSedeOptions(
  visibleSedes: string[] | undefined,
  defaultSede: string | undefined,
  currentValue?: string
) {
  return useMemo(
    () => buildFleetSedeOptions(visibleSedes, defaultSede, currentValue),
    [visibleSedes, defaultSede, currentValue]
  );
}

export function FleetSedeField({
  label = 'Base / sede',
  value,
  onChange,
  visibleSedes,
  defaultSede,
}: {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  visibleSedes?: string[];
  defaultSede?: string;
}) {
  const { baseSedes, options } = useFleetSedeOptions(visibleSedes, defaultSede, value);
  const display = value || options[0] || 'Principal';

  return (
    <div className="space-y-1.5">
      <Label className="text-slate-300">{label}</Label>
      {baseSedes.length === 1 ? (
        <div className="flex items-center h-10 px-3 rounded-md border border-slate-700 bg-slate-900/50 text-sm text-slate-200">
          {display}
        </div>
      ) : (
        <Select value={display} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccione sede" />
          </SelectTrigger>
          <SelectContent>
            {options.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
