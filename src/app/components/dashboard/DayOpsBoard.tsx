import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Link2,
  RefreshCw,
  Users,
  UserX,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import type { AsistenciaOperationalContext } from '../../types/asistencia';
import type { RrhhSettings } from '../../types/rrhh';
import type { TurnosSettings } from '../../types/turnos';
import {
  hydrateAsistenciaOperationalFromCloud,
  loadAsistenciaOperationalContext,
} from '../../utils/asistenciaOperationalContext';
import { getOpenVacancies, mergeTurnosSettings } from '../../utils/turnosData';
import { mergeRrhhSettings } from '../../utils/rrhhData';
import { fetchRrhhPipelineHealth, type RrhhPipelineHealth } from '../../utils/rrhhApi';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

type NavigateTarget = 'asistencia' | 'turnos' | 'rrhh' | 'alerts';

type Props = {
  rrhhSettings?: RrhhSettings | null;
  turnosSettings?: TurnosSettings | null;
  onNavigate?: (target: NavigateTarget) => void;
};

function isSameLocalDay(iso?: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function OpsKpi({
  label,
  value,
  hint,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'ok' | 'warn' | 'bad' | 'neutral';
  icon: typeof Users;
}) {
  const toneClass =
    tone === 'ok'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'warn'
        ? 'text-amber-600 dark:text-amber-400'
        : tone === 'bad'
          ? 'text-rose-600 dark:text-rose-400'
          : 'text-foreground';
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardDescription className="text-xs">{label}</CardDescription>
          <CardTitle className={`text-2xl tabular-nums ${toneClass}`}>{value}</CardTitle>
        </div>
        <Icon className={`h-4 w-4 shrink-0 ${toneClass}`} />
      </CardHeader>
      {hint ? <CardContent className="pt-0 text-xs text-muted-foreground">{hint}</CardContent> : null}
    </Card>
  );
}

/**
 * Fase 7 — Tablero operativo del día (cobertura, críticos, sync, vacantes).
 * Solo lectura FE a partir de KV / contexto local + pipeline health opcional.
 */
export function DayOpsBoard({ rrhhSettings, turnosSettings, onNavigate }: Props) {
  const [opsCtx, setOpsCtx] = useState<AsistenciaOperationalContext | null>(() =>
    loadAsistenciaOperationalContext()
  );
  const [pipeline, setPipeline] = useState<RrhhPipelineHealth | null>(null);
  const [loadingPipe, setLoadingPipe] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void hydrateAsistenciaOperationalFromCloud().then((ctx) => {
      if (!cancelled && ctx) setOpsCtx(ctx);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingPipe(true);
    void fetchRrhhPipelineHealth()
      .then((h) => {
        if (!cancelled) setPipeline(h);
      })
      .catch(() => {
        if (!cancelled) setPipeline(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingPipe(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rrhh = useMemo(() => mergeRrhhSettings(rrhhSettings), [rrhhSettings]);
  const turnos = useMemo(() => mergeTurnosSettings(turnosSettings), [turnosSettings]);

  const todayYmd = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const openVacancies = useMemo(() => getOpenVacancies(turnos), [turnos]);
  const vacanciesToday = useMemo(
    () => openVacancies.filter((v) => v.date === todayYmd),
    [openVacancies, todayYmd]
  );

  const criticalCount = opsCtx?.criticalMissing?.length ?? 0;
  const coverageGaps = (opsCtx?.coverageGaps ?? []).filter(
    (g) => g.required > 0 && g.present < g.required
  );

  const syncOk =
    pipeline?.rrhh.lastSyncOk === true ||
    (pipeline == null && rrhh.lastSyncOk !== false && Boolean(rrhh.lastSyncAt));
  const syncToday =
    pipeline?.rrhh.syncedToday === true ||
    (pipeline == null && isSameLocalDay(rrhh.lastSyncAt));
  const pendingAccess = pipeline?.rrhh.pendingAccess ?? rrhh.pendingAccessCount ?? 0;
  const marcacionesOk =
    pipeline?.marcaciones.enabled === false
      ? null
      : pipeline?.marcaciones.lastOk === true
        ? true
        : pipeline?.marcaciones.lastOk === false
          ? false
          : null;

  const dateLabel = format(new Date(), "EEEE d 'de' MMMM", { locale: es });
  const opsStale =
    opsCtx?.dateYmd && opsCtx.dateYmd !== todayYmd
      ? `Contexto Asistencia de ${opsCtx.dateYmd}`
      : null;

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-4 shadow-sm dark:border-slate-700 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Operativa del día
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5 capitalize">{dateLabel}</p>
          {opsStale ? (
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">{opsStale}. Abre Asistencia para refrescar.</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => onNavigate?.('asistencia')}>
            Asistencia
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onNavigate?.('turnos')}>
            Turnos
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onNavigate?.('rrhh')}>
            RRHH
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OpsKpi
          label="Ausencias críticas"
          value={criticalCount}
          tone={criticalCount > 0 ? 'bad' : 'ok'}
          hint={
            criticalCount > 0
              ? opsCtx!.criticalMissing
                  .slice(0, 2)
                  .map((c) => `${c.fullName} (${c.sedeName})`)
                  .join(' · ')
              : opsCtx
                ? 'Sin críticos ausentes en el contexto actual'
                : 'Sin datos: abre Asistencia hoy'
          }
          icon={UserX}
        />
        <OpsKpi
          label="Cobertura baja"
          value={coverageGaps.length}
          tone={coverageGaps.length > 0 ? 'warn' : 'ok'}
          hint={
            coverageGaps.length > 0
              ? coverageGaps
                  .slice(0, 2)
                  .map((g) => `${g.cargoLabel} ${g.sedeName}: ${g.present}/${g.required}`)
                  .join(' · ')
              : 'Dotación mínima cubierta o sin requisitos'
          }
          icon={Users}
        />
        <OpsKpi
          label="Sync identidad"
          value={
            loadingPipe && !pipeline
              ? '…'
              : !rrhh.lastSyncAt && !pipeline?.rrhh.lastSyncAt
                ? '—'
                : syncOk && syncToday
                  ? 'OK'
                  : syncOk
                    ? 'Atraso'
                    : 'Error'
          }
          tone={!rrhh.lastSyncAt && !pipeline ? 'neutral' : syncOk && syncToday ? 'ok' : syncOk ? 'warn' : 'bad'}
          hint={
            pipeline?.summary ||
            rrhh.lastSyncMessage ||
            (pendingAccess > 0 ? `${pendingAccess} pendientes de acceso` : 'Buk.pe → maestro')
          }
          icon={syncOk ? CheckCircle2 : RefreshCw}
        />
        <OpsKpi
          label="Vacantes turnos"
          value={vacanciesToday.length || openVacancies.length}
          tone={(vacanciesToday.length || openVacancies.length) > 0 ? 'warn' : 'ok'}
          hint={
            vacanciesToday.length > 0
              ? `${vacanciesToday.length} hoy · ${openVacancies.length} abiertas`
              : openVacancies.length > 0
                ? `${openVacancies.length} abiertas (próximos días)`
                : 'Sin vacantes abiertas'
          }
          icon={CalendarClock}
        />
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant={syncToday ? 'default' : 'secondary'}>
          RRHH {syncToday ? 'sync hoy' : 'sin sync hoy'}
        </Badge>
        {marcacionesOk === true ? (
          <Badge variant="default">Marcaciones OK</Badge>
        ) : marcacionesOk === false ? (
          <Badge variant="destructive">Marcaciones error</Badge>
        ) : (
          <Badge variant="outline">Marcaciones n/d</Badge>
        )}
        {pendingAccess > 0 ? (
          <Badge variant="outline" className="border-amber-300 text-amber-800 dark:text-amber-200">
            <Link2 className="h-3 w-3 mr-1" />
            {pendingAccess} pendientes acceso
          </Badge>
        ) : null}
        {criticalCount > 0 ? (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Revisar críticos
          </Badge>
        ) : null}
        {(vacanciesToday.length > 0 || openVacancies.length > 0) && onNavigate ? (
          <Button
            type="button"
            size="sm"
            variant="link"
            className="h-auto p-0 text-xs"
            onClick={() => onNavigate('turnos')}
          >
            Ver vacantes →
          </Button>
        ) : null}
        {criticalCount > 0 && onNavigate ? (
          <Button
            type="button"
            size="sm"
            variant="link"
            className="h-auto p-0 text-xs"
            onClick={() => onNavigate('asistencia')}
          >
            Ver Asistencia →
          </Button>
        ) : null}
      </div>
    </section>
  );
}
