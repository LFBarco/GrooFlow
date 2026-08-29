import { useMemo, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { AlertTriangle, ArrowDownAZ, ArrowUpAZ, Moon, Sun } from 'lucide-react';

import type { TurnoShiftCode, TurnosRosterEntry, TurnosSettings } from '../../types/turnos';
import { TURNO_SHIFT_LABELS } from '../../types/turnos';
import {
  assignmentForCell,
  moveAssignment,
  removeAssignment,
  rosterForPlanning,
  summarizeDay,
  upsertAssignment,
} from '../../utils/turnosData';
import { dayHeaderLabel, isToday, toDateKey } from '../../utils/turnosCalendar';
import { TURNO_SHIFT_STYLES } from '../../utils/turnosStyles';
import { cn } from '../ui/utils';
import { TurnosShiftCell } from './TurnosShiftCell';

type SortDir = 'asc' | 'desc' | null;

type Props = {
  settings: TurnosSettings;
  weekDays: Date[];
  workSede: string;
  canEdit: boolean;
  showAllStaff?: boolean;
  onUpdate: (updater: (prev: TurnosSettings) => TurnosSettings) => void;
};

function sortRosterByArea(roster: TurnosRosterEntry[], dir: SortDir): TurnosRosterEntry[] {
  if (!dir) return roster;
  const factor = dir === 'asc' ? 1 : -1;
  return [...roster].sort((a, b) => {
    const areaA = (a.workArea || 'Sin área').toLocaleLowerCase('es');
    const areaB = (b.workArea || 'Sin área').toLocaleLowerCase('es');
    const cmp = areaA.localeCompare(areaB, 'es') || a.fullName.localeCompare(b.fullName, 'es');
    return cmp * factor;
  });
}

export function TurnosWeekGrid({ settings, weekDays, workSede, canEdit, showAllStaff, onUpdate }: Props) {
  const [areaSort, setAreaSort] = useState<SortDir>(null);
  const dateKeys = useMemo(() => weekDays.map(toDateKey), [weekDays]);
  const baseRoster = useMemo(() => {
    if (showAllStaff && workSede !== 'Todas') return settings.roster;
    return rosterForPlanning(settings.roster, settings.assignments, workSede, dateKeys);
  }, [settings.roster, settings.assignments, workSede, dateKeys, showAllStaff]);

  const roster = useMemo(() => sortRosterByArea(baseRoster, areaSort), [baseRoster, areaSort]);

  const cycleAreaSort = () => {
    setAreaSort((prev) => (prev === null ? 'asc' : prev === 'asc' ? 'desc' : null));
  };

  const handleAssign = (staff: TurnosRosterEntry, date: string, shift: TurnoShiftCode) => {
    onUpdate((prev) =>
      upsertAssignment(prev, {
        staffId: staff.id,
        date,
        shift,
        homeSede: staff.homeSede,
        workSede: workSede === 'Todas' ? staff.homeSede : workSede,
      })
    );
  };

  const handleClear = (assignmentId: string) => {
    onUpdate((prev) => removeAssignment(prev, assignmentId));
  };

  const handleMove = (
    assignmentId: string,
    target: { staffId: string; date: string; workSede: string }
  ) => {
    onUpdate((prev) => moveAssignment(prev, assignmentId, target));
  };

  const resolvedSede = workSede === 'Todas' ? undefined : workSede;
  const SortIcon = areaSort === 'desc' ? ArrowUpAZ : ArrowDownAZ;

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm dark:border-slate-700">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 dark:border-slate-700 dark:bg-slate-900/40">
              <th className="sticky left-0 z-10 min-w-[220px] bg-muted/30 px-3 py-3 text-left text-xs font-medium text-muted-foreground dark:bg-slate-900/40">
                <button
                  type="button"
                  onClick={cycleAreaSort}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-muted/60 hover:text-foreground',
                    areaSort && 'text-foreground'
                  )}
                  title={
                    areaSort === 'asc'
                      ? 'Ordenado por área A→Z (clic para invertir)'
                      : areaSort === 'desc'
                        ? 'Ordenado por área Z→A (clic para quitar)'
                        : 'Ordenar por área'
                  }
                >
                  Personal
                  <SortIcon
                    className={cn('h-3.5 w-3.5', areaSort ? 'opacity-100' : 'opacity-50')}
                  />
                </button>
              </th>
              {weekDays.map((day) => {
                const key = toDateKey(day);
                const { weekday, day: dayNum } = dayHeaderLabel(day);
                const summary = summarizeDay(settings, key, resolvedSede);
                const today = isToday(day);
                return (
                  <th
                    key={key}
                    className={cn(
                      'min-w-[3.5rem] px-1 py-2 text-center',
                      today && 'bg-sky-50/80 dark:bg-sky-950/30'
                    )}
                  >
                    <div className="text-[10px] font-semibold text-muted-foreground">{weekday}</div>
                    <div className={cn('text-sm font-bold', today && 'text-sky-600 dark:text-sky-400')}>
                      {dayNum}
                    </div>
                    <div className="mt-1 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className="inline-flex items-center gap-0.5">
                        <Sun className="h-3 w-3 text-amber-500" />
                        {summary.dayCount}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <Moon className="h-3 w-3 text-indigo-400" />
                        {summary.nightCount}
                      </span>
                      {summary.understaffed ? (
                        <AlertTriangle className="h-3 w-3 text-rose-500" title="Dotación baja" />
                      ) : null}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {roster.length === 0 ? (
              <tr>
                <td colSpan={weekDays.length + 1} className="px-4 py-10 text-center text-muted-foreground">
                  No hay personal para esta sede. Sincroniza con usuarios o agrega personal manual.
                </td>
              </tr>
            ) : (
              roster.map((staff) => (
                <tr
                  key={staff.id}
                  className="border-b border-border/60 hover:bg-muted/20 dark:border-slate-800 dark:hover:bg-slate-900/30"
                >
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 dark:bg-slate-950">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200">
                        {staff.initials}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{staff.fullName}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {staff.roleLabel}
                          {staff.workArea ? ` · ${staff.workArea}` : ''}
                          {' · '}
                          {staff.homeSede}
                        </p>
                      </div>
                    </div>
                  </td>
                  {weekDays.map((day) => {
                    const dateKey = toDateKey(day);
                    const cellSede = workSede === 'Todas' ? staff.homeSede : workSede;
                    const assignment = assignmentForCell(settings, staff.id, dateKey, cellSede);
                    return (
                      <td key={dateKey} className="px-1 py-1.5">
                        <TurnosShiftCell
                          staffId={staff.id}
                          date={dateKey}
                          workSede={cellSede}
                          assignment={assignment}
                          canEdit={canEdit}
                          onAssign={(shift) => handleAssign(staff, dateKey, shift)}
                          onClear={() => assignment && handleClear(assignment.id)}
                          onMove={handleMove}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
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
          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-medium text-cyan-800 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200">
            Anillo cian = cobertura inter-sede
          </span>
        </div>
        {canEdit ? (
          <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground dark:border-slate-700">
            Arrastra un turno a otra celda para reprogramar · clic para editar · flecha en Personal ordena por área
          </p>
        ) : null}
      </div>
    </DndProvider>
  );
}
