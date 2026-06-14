import type { AsistenciaAreaGroup, AsistenciaCoverageStatus } from '../../types/asistencia';
import { ASISTENCIA_AREA_GROUP_LABELS } from '../../types/asistencia';

const STATUS_STYLES: Record<AsistenciaCoverageStatus, string> = {
  complete: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300',
  partial: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300',
  missing: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300',
  over: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300',
};

const STATUS_LABELS: Record<AsistenciaCoverageStatus, string> = {
  complete: 'Completo',
  partial: 'Parcial',
  missing: 'Faltante',
  over: 'Sobredotado',
};

export function CoverageStatusBadge({ status }: { status: AsistenciaCoverageStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function AreaGroupLabel({ group }: { group: AsistenciaAreaGroup }) {
  return <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{ASISTENCIA_AREA_GROUP_LABELS[group]}</span>;
}

export function CoverageBar({ present, required }: { present: number; required: number }) {
  const pct = required > 0 ? Math.min(100, Math.round((present / required) * 100)) : present > 0 ? 100 : 0;
  const color =
    pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : present > 0 ? 'bg-orange-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
        {present}/{required || '—'}
      </span>
    </div>
  );
}
