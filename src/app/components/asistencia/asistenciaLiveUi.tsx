import {
  AlertTriangle,
  Building2,
  Crown,
  GripVertical,
  LayoutGrid,
  Scissors,
  Sparkles,
  Stethoscope,
  User,
  type LucideIcon,
} from 'lucide-react';

import type { AsistenciaLiveStatus } from '../../types/asistencia';
import { ASISTENCIA_LIVE_STATUS_LABELS } from '../../types/asistencia';
import { isBuiltinOrgColumnId } from '../../utils/asistenciaOrgColumns';

const BUILTIN_THEME = {
  administracion: {
    icon: Building2,
    card: 'border-fuchsia-200 bg-fuchsia-50 dark:border-fuchsia-500/40 dark:bg-fuchsia-950/20',
    bar: 'bg-fuchsia-500',
    glow: 'shadow-sm dark:shadow-[0_0_24px_rgba(217,70,239,0.15)]',
  },
  medica: {
    icon: Stethoscope,
    card: 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-950/20',
    bar: 'bg-emerald-500',
    glow: 'shadow-sm dark:shadow-[0_0_24px_rgba(16,185,129,0.15)]',
  },
  peluqueria: {
    icon: Scissors,
    card: 'border-sky-200 bg-sky-50 dark:border-sky-500/40 dark:bg-sky-950/20',
    bar: 'bg-sky-500',
    glow: 'shadow-sm dark:shadow-[0_0_24px_rgba(14,165,233,0.15)]',
  },
} as const;

const CUSTOM_THEME = {
  icon: LayoutGrid,
  card: 'border-violet-200 bg-violet-50 dark:border-violet-500/40 dark:bg-violet-950/20',
  bar: 'bg-violet-500',
  glow: 'shadow-sm dark:shadow-[0_0_24px_rgba(139,92,246,0.15)]',
};

export function themeForColumnId(columnId: string): {
  icon: LucideIcon;
  card: string;
  bar: string;
  glow: string;
} {
  if (isBuiltinOrgColumnId(columnId)) return BUILTIN_THEME[columnId];
  return CUSTOM_THEME;
}

export const STATUS_DOT: Record<AsistenciaLiveStatus, string> = {
  trabajando: 'bg-emerald-500',
  presente: 'bg-cyan-400',
  tarde: 'bg-amber-500',
  ausente: 'bg-red-500',
};

export function StaffLiveCard({
  name,
  cargo,
  status,
  time,
  avatarUrl,
  critical,
  matchHint,
  statusNote,
  editLayout,
  dragHandleRef,
  isDragging,
  shiftLabel,
}: {
  name: string;
  cargo: string;
  status: AsistenciaLiveStatus;
  time?: string;
  avatarUrl?: string;
  critical?: boolean;
  matchHint?: string;
  statusNote?: string;
  editLayout?: boolean;
  dragHandleRef?: (node: HTMLDivElement | null) => void;
  isDragging?: boolean;
  shiftLabel?: string;
}) {
  const absent = status === 'ausente';
  const detailHint = statusNote ?? (absent ? matchHint : undefined);
  return (
    <div
      ref={editLayout ? dragHandleRef : undefined}
      className={`relative min-w-[160px] max-w-[220px] rounded-xl border p-3 transition-opacity ${
        isDragging ? 'opacity-40' : ''
      } ${
        absent
          ? 'border-red-200 bg-red-50/90 dark:border-red-500/30 dark:bg-slate-900/80'
          : 'border-border bg-card dark:border-slate-700 dark:bg-slate-900/90'
      } ${editLayout ? 'cursor-grab ring-1 ring-indigo-500/30 active:cursor-grabbing' : ''}`}
    >
      {editLayout ? (
        <GripVertical className="absolute right-2 top-2 h-3.5 w-3.5 text-indigo-500/70 dark:text-indigo-400/70" />
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted dark:bg-slate-800">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card dark:border-slate-900 ${STATUS_DOT[status]}`}
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{cargo}</p>
            {shiftLabel ? (
              <p className="truncate text-[10px] text-indigo-600 dark:text-indigo-300/90">{shiftLabel}</p>
            ) : null}
          </div>
        </div>
        {absent ? (
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
        ) : critical ? (
          <Sparkles className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{time ?? '—'}</span>
        <span>{ASISTENCIA_LIVE_STATUS_LABELS[status]}</span>
      </div>
      {detailHint ? (
        <p
          className={`mt-2 border-t pt-2 text-[10px] leading-snug ${
            statusNote
              ? 'border-amber-200 text-amber-800 dark:border-amber-500/20 dark:text-amber-200/90'
              : 'border-red-200 text-red-700 dark:border-red-500/20 dark:text-red-300/90'
          }`}
        >
          {detailHint}
        </p>
      ) : null}
    </div>
  );
}

export function ManagerPlaceholder() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/40 px-8 py-4 text-center dark:border-slate-600 dark:bg-slate-900/40">
      <Crown className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Sin encargado de sede asignado</p>
    </div>
  );
}
