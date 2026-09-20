import { useEffect, useState } from 'react';
import type { User } from '../../types';
import { loadFleetChoferOptions, type FleetChoferOption } from '../../utils/fleetChoferOptions';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

const NONE = '__none__';

type Props = {
  label?: string;
  required?: boolean;
  choferes: FleetChoferOption[];
  loading?: boolean;
  /** Id estable (`buk:…` / `user:…`) si se conoce. */
  employeeId?: string;
  /** Nombre snapshot (legacy o sin id). */
  name?: string;
  onChange: (next: { employeeId?: string; fullName?: string }) => void;
  className?: string;
};

export function FleetDriverSelect({
  label = 'Conductor / responsable',
  required,
  choferes,
  loading,
  employeeId,
  name,
  onChange,
  className,
}: Props) {
  const matchedByName = !employeeId && name
    ? choferes.find((c) => c.fullName.trim().toLowerCase() === name.trim().toLowerCase())
    : undefined;
  const value = employeeId || matchedByName?.id || NONE;
  const orphanName = Boolean(name?.trim()) && !employeeId && !matchedByName;

  return (
    <div className={className ?? 'space-y-1.5 sm:col-span-2'}>
      <Label>
        {label}
        {required ? ' *' : ''}
      </Label>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v === NONE) {
            onChange({ employeeId: undefined, fullName: undefined });
            return;
          }
          const opt = choferes.find((c) => c.id === v);
          if (opt) onChange({ employeeId: opt.id, fullName: opt.fullName });
        }}
        disabled={loading}
      >
        <SelectTrigger data-testid="fleet-driver-select">
          <SelectValue
            placeholder={
              loading
                ? 'Cargando choferes…'
                : choferes.length === 0
                  ? 'Sin choferes en colaboradores'
                  : 'Seleccionar chofer'
            }
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Sin asignar</SelectItem>
          {choferes.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.fullName}
              {c.cargo ? ` · ${c.cargo}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {orphanName ? (
        <p className="text-[11px] text-amber-700 dark:text-amber-300">
          Valor actual «{name}» no está en la lista de choferes. Elige uno de colaboradores.
        </p>
      ) : null}
      {choferes.length === 0 && !loading ? (
        <p className="text-[11px] text-muted-foreground">
          Solo aparecen colaboradores con cargo chofer (Buk.pe / usuarios).
        </p>
      ) : null}
    </div>
  );
}

/** Carga opciones de chofer (RRHH + fallback usuarios). */
export function useFleetChoferOptions(users: User[] = []) {
  const [choferes, setChoferes] = useState<FleetChoferOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadFleetChoferOptions(users)
      .then((opts) => {
        if (!cancelled) setChoferes(opts);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [users]);

  return { choferes, loading };
}
