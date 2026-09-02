import { AlertTriangle, LayoutGrid, Pencil, Sparkles, Users } from 'lucide-react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import type {
  AsistenciaLiveConsolidatedSummary,
  AsistenciaLiveSedeSummary,
  AsistenciaSettings,
  AsistenciaShiftFilter,
} from '../../types/asistencia';
import { ASISTENCIA_WORK_SHIFT_LABELS } from '../../types/asistencia';
import type { AsistenciaStaffLiveState } from '../../types/asistencia';
import type { TurnosPlanVsReal } from '../../types/turnos';
import { AsistenciaLiveSedeBlock } from './AsistenciaLiveDnd';
import { AsistenciaStatusLegend } from './AsistenciaStatusLegend';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

type LayoutPersist = (
  updater: (prev: AsistenciaSettings) => AsistenciaSettings,
  message?: string
) => Promise<boolean>;

type Props = {
  mode: 'single' | 'consolidated';
  shiftFilter?: AsistenciaShiftFilter;
  viewDate?: Date;
  summary?: AsistenciaLiveSedeSummary;
  consolidated?: AsistenciaLiveConsolidatedSummary;
  asistenciaSettings?: AsistenciaSettings;
  editLayout: boolean;
  canEditLayout: boolean;
  onEditLayoutChange: (value: boolean) => void;
  onPersistLayout: LayoutPersist;
  onRefresh?: () => void;
  loading?: boolean;
  onStaffClick?: (live: AsistenciaStaffLiveState) => void;
  getPlanVsReal?: (live: AsistenciaStaffLiveState) => TurnosPlanVsReal | undefined;
};

function LiveHeaderBadges({
  workingCount,
  absentCount,
  lateCount,
}: {
  workingCount: number;
  absentCount: number;
  lateCount: number;
}) {
  return (
    <>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        {workingCount} Trabajando
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300">
        <AlertTriangle className="h-3 w-3" />
        {absentCount} Ausentes
      </span>
      {lateCount > 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300">
          {lateCount} Tarde
        </span>
      ) : null}
    </>
  );
}

export function AsistenciaLiveView({
  mode,
  shiftFilter = 'all',
  viewDate,
  summary,
  consolidated,
  asistenciaSettings,
  editLayout,
  canEditLayout,
  onEditLayoutChange,
  onPersistLayout,
  onRefresh,
  loading,
  onStaffClick,
  getPlanVsReal,
}: Props) {
  const isConsolidated = mode === 'consolidated' && consolidated;
  const workingCount = isConsolidated ? consolidated.workingCount : (summary?.workingCount ?? 0);
  const absentCount = isConsolidated ? consolidated.absentCount : (summary?.absentCount ?? 0);
  const lateCount = isConsolidated ? consolidated.lateCount : (summary?.lateCount ?? 0);

  const shiftLabel =
    shiftFilter === 'all' ? 'Todos los turnos' : `Turno ${ASISTENCIA_WORK_SHIFT_LABELS[shiftFilter]}`;

  const title = isConsolidated ? 'Consolidado operativo en vivo' : 'Sede operativa en vivo';
  const description = isConsolidated
    ? `Organigrama unificado — ${consolidated.sedes.length} sede(s) · ${shiftLabel}`
    : `Organigrama en tiempo real — ${summary?.sedeName ?? ''} · ${shiftLabel}`;

  const totalStaff = isConsolidated
    ? consolidated.sedes.reduce((n, s) => n + s.areas.reduce((a, b) => a + b.totalCount, 0), 0)
    : (summary?.areas.reduce((n, a) => n + a.totalCount, 0) ?? 0);

  return (
    <DndProvider backend={HTML5Backend}>
      <Card className="overflow-hidden border-border bg-card text-card-foreground shadow-sm dark:border-slate-800 dark:bg-[#0f0d18]">
        <CardHeader className="border-b border-border pb-4 dark:border-slate-800/80">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl text-foreground">
                {isConsolidated ? (
                  <LayoutGrid className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                ) : (
                  <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                )}
                {title}
              </CardTitle>
              <CardDescription className="text-muted-foreground">{description}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <LiveHeaderBadges
                workingCount={workingCount}
                absentCount={absentCount}
                lateCount={lateCount}
              />
              {canEditLayout ? (
                <Button
                  type="button"
                  variant={editLayout ? 'default' : 'outline'}
                  size="sm"
                  className={
                    editLayout
                      ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                      : 'border-border text-foreground dark:border-slate-600 dark:text-slate-300'
                  }
                  onClick={() => onEditLayoutChange(!editLayout)}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  {editLayout ? 'Listo' : 'Editar layout'}
                </Button>
              ) : null}
              {onRefresh ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-border text-foreground dark:border-slate-600 dark:text-slate-300"
                  onClick={onRefresh}
                  disabled={loading}
                >
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                  Actualizar
                </Button>
              ) : null}
            </div>
          </div>

          {editLayout ? (
            <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-950/30 dark:text-indigo-200">
              Modo edición: arrastra tarjetas entre áreas, reordénalas dentro del área o mueve columnas
              agarrando el encabezado del área.
            </div>
          ) : null}

          {!isConsolidated && summary && !summary.isOperational ? (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200">
              Sede no operativa: faltan puestos críticos (
              {summary.criticalMissing.map((s) => s.fullName).join(', ')})
            </div>
          ) : isConsolidated && !consolidated.isFullyOperational ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
              Al menos una sede no está operativa por puestos críticos ausentes.
            </div>
          ) : totalStaff > 0 && !editLayout ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-950/20 dark:text-emerald-200">
              {isConsolidated
                ? 'Vista consolidada de todas las sedes visibles'
                : `Dotación crítica cubierta · Horario ${summary?.scheduleLabel ?? ''}`}
            </div>
          ) : null}
          {!editLayout ? <AsistenciaStatusLegend className="mt-3" /> : null}
        </CardHeader>

        <CardContent className="space-y-2 pb-10 pt-8">
          {isConsolidated ? (
            consolidated.sedes.map((sedeSummary) => (
              <AsistenciaLiveSedeBlock
                key={sedeSummary.sedeName}
                summary={sedeSummary}
                asistenciaSettings={asistenciaSettings}
                editLayout={editLayout}
                onPersistLayout={onPersistLayout}
                compact
                viewDate={viewDate}
                onStaffClick={onStaffClick}
                getPlanVsReal={getPlanVsReal}
              />
            ))
          ) : summary ? (
            <AsistenciaLiveSedeBlock
              summary={summary}
              asistenciaSettings={asistenciaSettings}
              editLayout={editLayout}
              onPersistLayout={onPersistLayout}
              viewDate={viewDate}
              onStaffClick={onStaffClick}
              getPlanVsReal={getPlanVsReal}
            />
          ) : null}
        </CardContent>
      </Card>
    </DndProvider>
  );
}
