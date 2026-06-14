import {
  AlertTriangle,
  Building2,
  Crown,
  Scissors,
  Sparkles,
  Stethoscope,
  User,
  Users,
} from 'lucide-react';

import type { AsistenciaLiveSedeSummary, AsistenciaLiveStatus, AsistenciaStaffArea } from '../../types/asistencia';
import { ASISTENCIA_LIVE_STATUS_LABELS, ASISTENCIA_STAFF_AREA_LABELS } from '../../types/asistencia';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

const AREA_THEME: Record<
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

const STATUS_DOT: Record<AsistenciaLiveStatus, string> = {
  trabajando: 'bg-emerald-500',
  presente: 'bg-cyan-400',
  tarde: 'bg-amber-500',
  ausente: 'bg-red-500',
};

type Props = {
  summary: AsistenciaLiveSedeSummary;
  onRefresh?: () => void;
  loading?: boolean;
};

function StaffCard({
  name,
  cargo,
  status,
  time,
  avatarUrl,
  critical,
}: {
  name: string;
  cargo: string;
  status: AsistenciaLiveStatus;
  time?: string;
  avatarUrl?: string;
  critical?: boolean;
}) {
  const absent = status === 'ausente';
  return (
    <div
      className={`relative rounded-xl border p-3 min-w-[160px] ${
        absent
          ? 'border-red-500/30 bg-slate-900/80'
          : 'border-slate-700 bg-slate-900/90'
      }`}
    >
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
    </div>
  );
}

export function AsistenciaLiveOrgChart({ summary, onRefresh, loading }: Props) {
  const totalStaff = summary.areas.reduce((n, a) => n + a.totalCount, 0);

  return (
    <Card className="border-slate-800 bg-[#0f0d18] overflow-hidden">
      <CardHeader className="border-b border-slate-800/80 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-400" />
              Sede Operativa en Vivo
            </CardTitle>
            <CardDescription className="text-slate-400">
              Organigrama en tiempo real con estado del personal — {summary.sedeName}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {summary.workingCount} Trabajando
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-950/40 px-3 py-1 text-xs font-medium text-red-300">
              <AlertTriangle className="h-3 w-3" />
              {summary.absentCount} Ausentes
            </span>
            {summary.lateCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-950/40 px-3 py-1 text-xs font-medium text-amber-300">
                {summary.lateCount} Tarde
              </span>
            ) : null}
            {onRefresh ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-slate-600 text-slate-300"
                onClick={onRefresh}
                disabled={loading}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                Actualizar
              </Button>
            ) : null}
          </div>
        </div>
        {!summary.isOperational ? (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            Sede no operativa: faltan puestos críticos (
            {summary.criticalMissing.map((s) => s.fullName).join(', ')})
          </div>
        ) : totalStaff > 0 ? (
          <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-200">
            Dotación crítica cubierta · Horario {summary.scheduleLabel}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="pt-8 pb-10">
        <div className="flex flex-col items-center">
          <div className="mb-2">
            {summary.manager ? (
              <StaffCard
                name={summary.manager.staff.fullName}
                cargo={summary.manager.staff.cargoLabel}
                status={summary.manager.status}
                time={summary.manager.entradaFormat ?? summary.manager.staff.expectedTime}
                avatarUrl={summary.manager.staff.avatarUrl}
                critical={summary.manager.staff.isCritical}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-600 bg-slate-900/40 px-8 py-4 text-center">
                <Crown className="h-5 w-5 text-slate-500 mx-auto mb-1" />
                <p className="text-sm text-slate-500">Sin Gerente Asignado</p>
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-slate-700" />
          <div className="h-px w-full max-w-3xl bg-slate-700" />

          <div className="grid w-full max-w-5xl grid-cols-1 md:grid-cols-3 gap-6 mt-4">
            {summary.areas.map((block) => {
              const theme = AREA_THEME[block.area];
              const Icon = theme.icon;
              const pct =
                block.totalCount > 0
                  ? Math.round((block.activeCount / block.totalCount) * 100)
                  : 0;
              return (
                <div key={block.area} className="flex flex-col items-center">
                  <div className={`w-full rounded-xl border p-4 ${theme.card} ${theme.glow}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-4 w-4 text-white/80" />
                      <span className="font-semibold text-white">
                        {ASISTENCIA_STAFF_AREA_LABELS[block.area]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-2">
                      Personal Activo {block.activeCount}/{block.totalCount}
                    </p>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${theme.bar}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="h-4 w-px bg-slate-700" />

                  <div className="flex flex-col gap-2 w-full items-center pt-1">
                    {block.staff.length === 0 ? (
                      <div className="w-full rounded-xl border border-dashed border-slate-700 py-6 text-center text-xs text-slate-500">
                        Sin personal asignado
                      </div>
                    ) : (
                      block.staff
                        .filter((s) => !s.staff.isManager)
                        .map((s) => (
                          <StaffCard
                            key={s.staff.id}
                            name={s.staff.fullName}
                            cargo={s.staff.cargoLabel}
                            status={s.status}
                            time={s.entradaFormat ?? s.staff.expectedTime}
                            avatarUrl={s.staff.avatarUrl}
                            critical={s.staff.isCritical}
                          />
                        ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
