import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  AlertTriangle,
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarRange,
  Layers,
  Moon,
  Repeat,
  Sun,
} from 'lucide-react';

import type { AsistenciaSettings, BukAsistenciaRecord } from '../../types/asistencia';
import type {
  TurnoShiftCode,
  TurnosGridDensity,
  TurnosRosterEntry,
  TurnosSettings,
} from '../../types/turnos';
import { TURNO_SHIFT_LABELS } from '../../types/turnos';
import {
  assignmentForCell,
  bulkFillRotatingPattern,
  bulkFillWeek,
  moveAssignment,
  removeAssignment,
  summarizeDay,
  updateAssignmentDetails,
  upsertAssignment,
} from '../../utils/turnosData';
import { upsertAssignmentByManager } from '../../utils/turnosShiftApproval';
import { comparePlanVsReal } from '../../utils/turnosAsistenciaBridge';
import { dayHeaderLabel, isToday, toDateKey } from '../../utils/turnosCalendar';
import {
  isWeekendColumn,
  TODAY_COLUMN_CLASS,
  TURNO_SHIFT_STYLES,
  TURNOS_GRID_DENSITY,
  WEEKEND_COLUMN_CLASS,
  workAreaAvatarClass,
} from '../../utils/turnosStyles';
import { bulkFillAreaWeek } from '../../utils/turnosTemplates';
import { cn } from '../ui/utils';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { TurnosShiftCell } from './TurnosShiftCell';
import { TurnosShiftPicker } from './TurnosShiftPicker';
import { TurnosPlanVsRealBadge } from './TurnosPlanVsRealBadge';

type SortDir = 'asc' | 'desc' | null;

type Props = {
  settings: TurnosSettings;
  weekDays: Date[];
  roster: TurnosRosterEntry[];
  workSede: string;
  canEdit: boolean;
  showPlanVsReal?: boolean;
  asistencia?: AsistenciaSettings | null;
  bukRecords?: BukAsistenciaRecord[];
  density?: TurnosGridDensity;
  groupByArea?: boolean;
  readOnlyPublished?: boolean;
  assignActor?: { userId?: string; name?: string; isManager?: boolean };
  onUpdate: (updater: (prev: TurnosSettings) => TurnosSettings, message?: string) => void;
};

function sortRosterByArea(roster: TurnosRosterEntry[], dir: SortDir): TurnosRosterEntry[] {
  if (!dir) {
    return [...roster].sort((a, b) => {
      const areaA = (a.workArea || 'Sin área').toLocaleLowerCase('es');
      const areaB = (b.workArea || 'Sin área').toLocaleLowerCase('es');
      return (
        areaA.localeCompare(areaB, 'es') || a.fullName.localeCompare(b.fullName, 'es')
      );
    });
  }
  const factor = dir === 'asc' ? 1 : -1;
  return [...roster].sort((a, b) => {
    const areaA = (a.workArea || 'Sin área').toLocaleLowerCase('es');
    const areaB = (b.workArea || 'Sin área').toLocaleLowerCase('es');
    const cmp = areaA.localeCompare(areaB, 'es') || a.fullName.localeCompare(b.fullName, 'es');
    return cmp * factor;
  });
}

const ROW_HEIGHT: Record<TurnosGridDensity, number> = {
  compact: 44,
  comfortable: 52,
  spacious: 64,
};

export function TurnosWeekGrid({
  settings,
  weekDays,
  roster,
  workSede,
  canEdit,
  showPlanVsReal,
  asistencia,
  bukRecords = [],
  density = 'comfortable',
  groupByArea = true,
  readOnlyPublished = false,
  assignActor,
  onUpdate,
}: Props) {
  const [areaSort, setAreaSort] = useState<SortDir>('asc');
  const [scrollTop, setScrollTop] = useState(0);
  const [bulkArea, setBulkArea] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const densityStyles = TURNOS_GRID_DENSITY[density];
  const effectiveCanEdit = canEdit && !readOnlyPublished;
  const dateKeys = useMemo(() => weekDays.map(toDateKey), [weekDays]);
  const sortedRoster = useMemo(() => sortRosterByArea(roster, areaSort), [roster, areaSort]);

  const rowHeight = ROW_HEIGHT[density];
  const viewportHeight = 560;
  const overscan = 8;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
  const endIndex = Math.min(sortedRoster.length, startIndex + visibleCount);
  const virtualRoster = sortedRoster.slice(startIndex, endIndex);
  const paddingTop = startIndex * rowHeight;
  const paddingBottom = Math.max(0, (sortedRoster.length - endIndex) * rowHeight);

  const areaOptions = useMemo(
    () => [...new Set(roster.map((r) => r.workArea || 'Sin área'))].sort((a, b) => a.localeCompare(b, 'es')),
    [roster]
  );

  const cycleAreaSort = () => {
    setAreaSort((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const fillAreaWeek = (shift: TurnoShiftCode) => {
    if (!bulkArea) return;
    onUpdate(
      (prev) =>
        bulkFillAreaWeek(prev, {
          workArea: bulkArea,
          dateKeys,
          shift,
          workSede,
        }),
      `Turno ${shift} aplicado al área ${bulkArea}.`
    );
  };

  const handleAssign = (staff: TurnosRosterEntry, date: string, shift: TurnoShiftCode) => {
    const payload = {
      staffId: staff.id,
      date,
      shift,
      homeSede: staff.homeSede,
      workSede: workSede === 'Todas' ? staff.homeSede : workSede,
    };
    if (canEdit && assignActor) {
      onUpdate(
        (prev) => upsertAssignmentByManager(prev, payload, assignActor),
        staff.userId && assignActor.userId !== staff.userId
          ? 'Turno asignado — pendiente de confirmación del colaborador.'
          : undefined
      );
      return;
    }
    onUpdate((prev) => upsertAssignment(prev, payload));
  };

  const handleClear = (assignmentId: string) => {
    onUpdate((prev) => removeAssignment(prev, assignmentId));
  };

  const handleMove = useCallback(
    (assignmentId: string, target: { staffId: string; date: string; workSede: string }) => {
      onUpdate((prev) => moveAssignment(prev, assignmentId, target));
    },
    [onUpdate]
  );

  const handleSaveDetails = useCallback(
    (assignmentId: string, patch: { notes?: string; startTime?: string; endTime?: string }) => {
      onUpdate((prev) => updateAssignmentDetails(prev, assignmentId, patch), 'Detalle de turno guardado.');
    },
    [onUpdate]
  );

  const planVsRealMap = useMemo(() => {
    if (!showPlanVsReal) return null;
    const map = new Map<string, ReturnType<typeof comparePlanVsReal>>();
    for (const staff of sortedRoster) {
      for (const day of weekDays) {
        const dateKey = toDateKey(day);
        const cellSede = workSede === 'Todas' ? staff.homeSede : workSede;
        const assignment = assignmentForCell(settings, staff.id, dateKey, cellSede);
        map.set(
          `${staff.id}:${dateKey}`,
          comparePlanVsReal({
            roster: staff,
            assignment,
            asistencia,
            bukRecords,
            date: day,
            workSede,
          })
        );
      }
    }
    return map;
  }, [showPlanVsReal, sortedRoster, weekDays, settings, workSede, asistencia, bukRecords]);

  const resolvedSede = workSede === 'Todas' ? undefined : workSede;

  const fillStaffWeek = (staff: TurnosRosterEntry, shift: TurnoShiftCode, weekdaysOnly: boolean) => {
    const dates = weekdaysOnly
      ? dateKeys.filter((_, i) => {
          const d = weekDays[i]!;
          const day = d.getDay();
          return day >= 1 && day <= 5;
        })
      : dateKeys;
    const cellSede = workSede === 'Todas' ? staff.homeSede : workSede;
    onUpdate(
      (prev) =>
        bulkFillWeek(prev, {
          staffId: staff.id,
          dates,
          shift,
          workSede: cellSede,
        }),
      `Turno aplicado a ${dates.length} día(s).`
    );
  };

  const fillRotatingWeek = (staff: TurnosRosterEntry) => {
    const cellSede = workSede === 'Todas' ? staff.homeSede : workSede;
    onUpdate(
      (prev) =>
        bulkFillRotatingPattern(prev, {
          staffId: staff.id,
          dates: dateKeys,
          workSede: cellSede,
        }),
      'Patrón D→N→L→L aplicado a la semana.'
    );
  };

  const SortIcon = areaSort === 'desc' ? ArrowUpAZ : ArrowDownAZ;

  let lastArea = '';

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="turnos-print-root overflow-x-auto rounded-xl border border-border bg-card shadow-sm dark:border-slate-700">
        {effectiveCanEdit !== canEdit ? (
          <p className="border-b border-border bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-slate-700 dark:bg-amber-950/30 dark:text-amber-200">
            Semana publicada — edición bloqueada hasta volver a borrador.
          </p>
        ) : null}
        {effectiveCanEdit && areaOptions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 dark:border-slate-700">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Acción masiva por área:</span>
            <select
              className="h-8 rounded-md border border-border bg-background px-2 text-xs dark:border-slate-700"
              value={bulkArea}
              onChange={(e) => setBulkArea(e.target.value)}
            >
              <option value="">Seleccionar área…</option>
              {areaOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            {bulkArea ? (
              <TurnosShiftPicker onSelect={fillAreaWeek} />
            ) : null}
          </div>
        ) : null}
        <div
          ref={scrollRef}
          className="max-h-[560px] overflow-y-auto"
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        >
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 dark:border-slate-700 dark:bg-slate-900/40">
              <th className="sticky left-0 z-10 min-w-[240px] bg-muted/30 px-3 py-3 text-left text-xs font-medium text-muted-foreground dark:bg-slate-900/40">
                <button
                  type="button"
                  onClick={cycleAreaSort}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-muted/60 hover:text-foreground',
                    areaSort && 'text-foreground'
                  )}
                >
                  Personal
                  <SortIcon className={cn('h-3.5 w-3.5', areaSort ? 'opacity-100' : 'opacity-50')} />
                </button>
              </th>
              {weekDays.map((day) => {
                const key = toDateKey(day);
                const { weekday, day: dayNum } = dayHeaderLabel(day);
                const summary = summarizeDay(settings, key, resolvedSede);
                const today = isToday(day);
                const weekend = isWeekendColumn(day);
                return (
                  <th
                    key={key}
                    className={cn(
                      'min-w-[3.5rem] px-1 py-2 text-center',
                      today && TODAY_COLUMN_CLASS,
                      !today && weekend && WEEKEND_COLUMN_CLASS
                    )}
                  >
                    <div className="text-[10px] font-semibold text-muted-foreground">{weekday}</div>
                    <div className={cn('text-sm font-bold', today && 'text-sky-600 dark:text-sky-400')}>
                      {dayNum}
                    </div>
                    <div className="mt-1 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className="inline-flex items-center gap-0.5">
                        <Sun className="h-3 w-3 text-[#F59E0B]" />
                        {summary.dayCount}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <Moon className="h-3 w-3 text-[#7C3AED]" />
                        {summary.nightCount}
                      </span>
                      {summary.understaffed ? (
                        <AlertTriangle
                          className="h-3 w-3 text-rose-500"
                          title={
                            summary.staffingGaps.length > 0
                              ? summary.staffingGaps
                                  .map(
                                    (g) =>
                                      `${g.workArea} · ${g.sede}: faltan ${g.missing} en ${g.shift === 'day' ? 'día' : 'noche'}`
                                  )
                                  .join(' · ')
                              : 'Dotación día+noche bajo el umbral global'
                          }
                        />
                      ) : null}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRoster.length === 0 ? (
              <tr>
                <td colSpan={weekDays.length + 1} className="px-4 py-10 text-center text-muted-foreground">
                  No hay personal con los filtros actuales. Ajusta sede o filtros, o sincroniza el roster.
                </td>
              </tr>
            ) : (
              <>
                {paddingTop > 0 ? (
                  <tr style={{ height: paddingTop }}>
                    <td colSpan={weekDays.length + 1} />
                  </tr>
                ) : null}
                {virtualRoster.map((staff) => {
                const areaKey = staff.workArea || 'Sin área';
                const globalIndex = sortedRoster.indexOf(staff);
                const prevStaff = globalIndex > 0 ? sortedRoster[globalIndex - 1] : null;
                const showAreaDivider =
                  groupByArea && (!prevStaff || (prevStaff.workArea || 'Sin área') !== areaKey);
                if (showAreaDivider) lastArea = areaKey;
                return (
                  <Fragment key={staff.id}>
                    {showAreaDivider ? (
                      <tr className="bg-muted/40 dark:bg-slate-900/50">
                        <td
                          colSpan={weekDays.length + 1}
                          className="sticky left-0 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          {areaKey}
                        </td>
                      </tr>
                    ) : null}
                    <tr className="border-b border-border/60 hover:bg-muted/20 dark:border-slate-800 dark:hover:bg-slate-900/30">
                      <td className={cn('sticky left-0 z-10 bg-card px-3 dark:bg-slate-950', densityStyles.row)}>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'inline-flex shrink-0 items-center justify-center rounded-full text-xs font-bold',
                              densityStyles.avatar,
                              workAreaAvatarClass(staff.workArea)
                            )}
                          >
                            {staff.initials}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-foreground">{staff.fullName}</p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {staff.roleLabel}
                              {staff.workArea ? ` · ${staff.workArea}` : ''}
                              {' · '}
                              {staff.homeSede}
                            </p>
                          </div>
                          {effectiveCanEdit ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  title="Rellenar semana"
                                >
                                  <CalendarRange className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-2" align="start">
                                <p className="mb-2 px-1 text-[11px] font-medium text-muted-foreground">
                                  Rellenar para {staff.fullName.split(' ')[0]}
                                </p>
                                <TurnosShiftPicker
                                  onSelect={(shift) => fillStaffWeek(staff, shift, false)}
                                />
                                <div className="mt-2 flex flex-col gap-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    className="w-full text-xs"
                                    onClick={() => fillRotatingWeek(staff)}
                                  >
                                    <Repeat className="mr-1 h-3 w-3" />
                                    Patrón D→N→L→L
                                  </Button>
                                  <div className="flex gap-1">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="flex-1 text-xs"
                                      onClick={() => fillStaffWeek(staff, 'day', true)}
                                    >
                                      Lun–Vie Día
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="flex-1 text-xs"
                                      onClick={() => fillStaffWeek(staff, 'night', true)}
                                    >
                                      Lun–Vie Noche
                                    </Button>
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : null}
                        </div>
                      </td>
                      {weekDays.map((day) => {
                        const dateKey = toDateKey(day);
                        const cellSede = workSede === 'Todas' ? staff.homeSede : workSede;
                        const assignment = assignmentForCell(settings, staff.id, dateKey, cellSede);
                        const today = isToday(day);
                        const weekend = isWeekendColumn(day);
                        return (
                          <td
                            key={dateKey}
                            className={cn(
                              'px-1 py-1.5',
                              today && TODAY_COLUMN_CLASS,
                              !today && weekend && WEEKEND_COLUMN_CLASS
                            )}
                          >
                            <div className="space-y-1">
                              <TurnosShiftCell
                                staffId={staff.id}
                                staff={staff}
                                date={dateKey}
                                workSede={cellSede}
                                assignment={assignment}
                                canEdit={effectiveCanEdit}
                                cellHeight={densityStyles.cell}
                                onAssign={(shift) => handleAssign(staff, dateKey, shift)}
                                onClear={() => assignment && handleClear(assignment.id)}
                                onMove={handleMove}
                                onSaveDetails={handleSaveDetails}
                              />
                              {showPlanVsReal && planVsRealMap ? (
                                <div className="flex justify-center">
                                  <TurnosPlanVsRealBadge
                                    compact
                                    compare={planVsRealMap.get(`${staff.id}:${dateKey}`)!}
                                  />
                                </div>
                              ) : null}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  </Fragment>
                );
              })}
                {paddingBottom > 0 ? (
                  <tr style={{ height: paddingBottom }}>
                    <td colSpan={weekDays.length + 1} />
                  </tr>
                ) : null}
              </>
            )}
          </tbody>
        </table>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border px-3 py-2 dark:border-slate-700">
          {(['day', 'night', 'off', 'training'] as const).map((code) => (
            <span
              key={code}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
                TURNO_SHIFT_STYLES[code].legend
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', TURNO_SHIFT_STYLES[code].dot)} />
              {TURNO_SHIFT_LABELS[code]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-[11px] font-medium text-cyan-800 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200">
            COV = cobertura inter-sede
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-orange-300 bg-orange-50 px-2.5 py-1 text-[11px] font-medium text-orange-900 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-200">
            EXT = personal externo
          </span>
        </div>
        {effectiveCanEdit ? (
          <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground dark:border-slate-700">
            Arrastra un turno para reprogramar · clic para editar · icono calendario = rellenar semana
          </p>
        ) : null}
      </div>
    </DndProvider>
  );
}
