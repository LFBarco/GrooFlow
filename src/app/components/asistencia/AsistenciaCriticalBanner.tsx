import { AlertTriangle } from 'lucide-react';

import type { AsistenciaStaffMember } from '../../types/asistencia';

type Props = {
  missing: AsistenciaStaffMember[];
  sedeLabel?: string;
};

export function AsistenciaCriticalBanner({ missing, sedeLabel }: Props) {
  if (missing.length === 0) return null;

  return (
    <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 dark:border-red-500/40 dark:bg-red-950/30">
      <p className="flex items-start gap-2 text-sm font-medium text-red-800 dark:text-red-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {missing.length} puesto(s) crítico(s) ausente(s)
          {sedeLabel ? ` · ${sedeLabel}` : ''}
        </span>
      </p>
      <ul className="mt-2 flex flex-wrap gap-2 text-xs text-red-700 dark:text-red-300/90">
        {missing.map((s) => (
          <li
            key={s.id}
            className="rounded-full border border-red-200 bg-white/70 px-2.5 py-0.5 dark:border-red-500/30 dark:bg-red-950/50"
          >
            {s.fullName} · {s.cargoLabel}
            {s.sedeName ? ` · ${s.sedeName}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
