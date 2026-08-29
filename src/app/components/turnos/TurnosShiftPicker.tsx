import { Sun, Moon, Coffee, GraduationCap } from 'lucide-react';

import type { TurnoShiftCode } from '../../types/turnos';
import { TURNO_SHIFT_LABELS, TURNO_SHIFT_SHORT } from '../../types/turnos';
import { TURNO_SHIFT_STYLES } from '../../utils/turnosStyles';
import { cn } from '../ui/utils';
const SHIFT_OPTIONS: TurnoShiftCode[] = ['day', 'night', 'off', 'training'];

const SHIFT_ICONS = {
  day: Sun,
  night: Moon,
  off: Coffee,
  training: GraduationCap,
} as const;

type Props = {
  value?: TurnoShiftCode;
  onSelect: (shift: TurnoShiftCode) => void;
  onClear?: () => void;
  className?: string;
};

export function TurnosShiftPicker({ value, onSelect, onClear, className }: Props) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900',
        className
      )}
    >
      <p className="px-2 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        Asignar turno
      </p>
      <div className="space-y-1">
        {SHIFT_OPTIONS.map((code) => {
          const Icon = SHIFT_ICONS[code];
          const styles = TURNO_SHIFT_STYLES[code];
          const active = value === code;
          return (
            <button
              key={code}
              type="button"
              onClick={() => onSelect(code)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors',
                active ? styles.legend : 'hover:bg-muted/60 dark:hover:bg-slate-800'
              )}
            >
              <span
                className={cn(
                  'inline-flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold',
                  styles.pill
                )}
              >
                {TURNO_SHIFT_SHORT[code]}
              </span>
              <Icon className="h-4 w-4 opacity-70" />
              <span className="font-medium">{TURNO_SHIFT_LABELS[code]}</span>
            </button>
          );
        })}
      </div>
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-2 w-full rounded-lg border border-dashed border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/40 dark:border-slate-700"
        >
          Quitar asignación
        </button>
      ) : null}
    </div>
  );
}
