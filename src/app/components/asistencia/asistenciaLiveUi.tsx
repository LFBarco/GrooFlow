import {
  AlertTriangle,
  Building2,
  Crown,
  GripVertical,
  Scissors,
  Sparkles,
  Stethoscope,
  User,
} from 'lucide-react';

import type { AsistenciaLiveStatus, AsistenciaStaffArea } from '../../types/asistencia';
import { ASISTENCIA_LIVE_STATUS_LABELS } from '../../types/asistencia';

export const AREA_THEME: Record<
  AsistenciaStaffArea,
  { icon: typeof Building2; card: string; bar: string; glow: string }
> = {
  administracion: {
    icon: Building2,
    card: 'border-fuchsia-500/40 bg-fuchsia-950/20',
    bar: 'bg-fuchsia-500',
    glow: 'shadow-[0_0_24px_rgba(217,70,239,0.15)]',
  },
  medica: {
    icon: Stethoscope,
    card: 'border-emerald-500/40 bg-emerald-950/20',
    bar: 'bg-emerald-500',
    glow: 'shadow-[0_0_24px_rgba(16,185,129,0.15)]',
  },
  peluqueria: {
    icon: Scissors,
    card: 'border-sky-500/40 bg-sky-950/20',
    bar: 'bg-sky-500',
    glow: 'shadow-[0_0_24px_rgba(14,165,233,0.15)]',
  },
};

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
}) {
  const absent = status === 'ausente';
  const detailHint = statusNote ?? (absent ? matchHint : undefined);
  return (
    <div
      ref={editLayout ? dragHandleRef : undefined}
      className={`relative rounded-xl border p-3 min-w-[160px] max-w-[220px] transition-opacity ${
        isDragging ? 'opacity-40' : ''
      } ${
        absent ? 'border-red-500/30 bg-slate-900/80' : 'border-slate-700 bg-slate-900/90'
      } ${editLayout ? 'cursor-grab active:cursor-grabbing ring-1 ring-indigo-500/30' : ''}`}
    >
      {editLayout ? (
        <GripVertical className="absolute top-2 right-2 h-3.5 w-3.5 text-indigo-400/70" />
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-slate-800 flex items-center justify-center">
                <User className="h-4 w-4 text-slate-400" />
              </div>
            )}
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 ${STATUS_DOT[status]}`}
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{name}</p>
            <p className="text-xs text-slate-400 truncate">{cargo}</p>
          </div>
        </div>
        {absent ? (
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
        ) : critical ? (
          <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
        <span>{time ?? '—'}</span>
        <span>{ASISTENCIA_LIVE_STATUS_LABELS[status]}</span>
      </div>
      {detailHint ? (
        <p
          className={`mt-2 text-[10px] leading-snug border-t pt-2 ${
            statusNote
              ? 'text-amber-200/90 border-amber-500/20'
              : 'text-red-300/90 border-red-500/20'
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
    <div className="rounded-xl border border-dashed border-slate-600 bg-slate-900/40 px-8 py-4 text-center">
      <Crown className="h-5 w-5 text-slate-500 mx-auto mb-1" />
      <p className="text-sm text-slate-500">Sin Gerente Asignado</p>
    </div>
  );
}
