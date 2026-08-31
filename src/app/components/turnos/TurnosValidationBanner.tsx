import { AlertTriangle } from 'lucide-react';

import type { TurnosLaborAlert } from '../../types/turnos';
import { cn } from '../ui/utils';

type Props = {
  alerts: TurnosLaborAlert[];
  className?: string;
};

export function TurnosValidationBanner({ alerts, className }: Props) {
  if (alerts.length === 0) return null;

  const errors = alerts.filter((a) => a.severity === 'error');
  const warnings = alerts.filter((a) => a.severity === 'warning');
  const shown = [...errors, ...warnings].slice(0, 5);

  return (
    <div
      className={cn(
        'rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm dark:border-amber-500/30 dark:bg-amber-950/20',
        className
      )}
    >
      <div className="mb-2 flex items-center gap-2 font-medium text-amber-900 dark:text-amber-100">
        <AlertTriangle className="h-4 w-4" />
        Validaciones laborales ({alerts.length})
      </div>
      <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-200/90">
        {shown.map((a, i) => (
          <li key={`${a.staffId}-${a.code}-${i}`}>
            <span className={a.severity === 'error' ? 'font-semibold' : ''}>{a.staffName}</span>
            {' — '}
            {a.message}
          </li>
        ))}
        {alerts.length > shown.length ? (
          <li className="text-muted-foreground">… y {alerts.length - shown.length} más</li>
        ) : null}
      </ul>
    </div>
  );
}
