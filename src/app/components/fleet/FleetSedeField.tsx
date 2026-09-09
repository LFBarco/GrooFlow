import { useMemo } from 'react';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { buildFormSedeOptions, resolveCanonicalSedeName } from '../../utils/gestionSedes';

export function buildFleetSedeOptions(
  visibleSedes: string[] | undefined,
  defaultSede: string | undefined,
  currentValue?: string
) {
  const baseSedes = buildFormSedeOptions(visibleSedes ?? []);
  const resolvedDefault =
    resolveCanonicalSedeName(defaultSede?.trim() || baseSedes[0] || '', baseSedes) ||
    baseSedes[0] ||
    '';
  const current = currentValue?.trim() || '';
  const canonicalCurrent = current ? resolveCanonicalSedeName(current, baseSedes) : '';
  const options = [...baseSedes];
  // Solo añadir valor actual si no mapea a ninguna sede del catálogo (dato histórico).
  if (canonicalCurrent && !baseSedes.includes(canonicalCurrent) && current && !options.includes(current)) {
    options.unshift(current);
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
  const display = value || options[0] || '';

  if (options.length === 0) {
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <div className="flex items-center h-10 px-3 rounded-md border border-border bg-muted/50 text-sm text-muted-foreground">
          Sin sedes en catálogo de Gestión
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {baseSedes.length === 1 ? (
        <div className="flex items-center h-10 px-3 rounded-md border border-border bg-muted/50 text-sm text-foreground">
          {display || baseSedes[0]}
        </div>
      ) : (
        <Select value={display || options[0]} onValueChange={onChange}>
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
