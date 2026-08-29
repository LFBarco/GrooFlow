import { useMemo } from 'react';
import { Building2, Users } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import type { TurnoShiftCode, TurnosSettings } from '../../types/turnos';
import { TURNO_SHIFT_LABELS, TURNO_SHIFT_SHORT } from '../../types/turnos';
import {
  assignmentForCell,
  assignmentsForDate,
  isCoverAssignment,
  rosterForPlanning,
  upsertAssignment,
} from '../../utils/turnosData';
import { toDateKey } from '../../utils/turnosCalendar';
import { TURNO_SHIFT_STYLES } from '../../utils/turnosStyles';
import { cn } from '../ui/utils';
import { Card, CardContent } from '../ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { TurnosShiftPicker } from './TurnosShiftPicker';

type Props = {
  settings: TurnosSettings;
  date: Date;
  workSede: string;
  canEdit: boolean;
  showAllStaff?: boolean;
  onUpdate: (updater: (prev: TurnosSettings) => TurnosSettings) => void;
};

const SHIFT_ORDER: TurnoShiftCode[] = ['day', 'night', 'training', 'off'];

export function TurnosDayView({ settings, date, workSede, canEdit, showAllStaff, onUpdate }: Props) {
  const dateKey = toDateKey(date);
  const resolvedSede = workSede === 'Todas' ? undefined : workSede;
  const roster = useMemo(() => {
    if (showAllStaff && workSede !== 'Todas') return settings.roster;
    return rosterForPlanning(settings.roster, settings.assignments, workSede, [dateKey]);
  }, [settings.roster, settings.assignments, workSede, dateKey, showAllStaff]);

  const grouped = useMemo(() => {
    const map = new Map<TurnoShiftCode, typeof roster>();
    for (const code of SHIFT_ORDER) map.set(code, []);
    const unassigned: typeof roster = [];

    for (const staff of roster) {
      const cellSede = workSede === 'Todas' ? staff.homeSede : workSede;
      const assignment = assignmentForCell(settings, staff.id, dateKey, cellSede);
      if (!assignment) {
        unassigned.push(staff);
        continue;
      }
      map.get(assignment.shift)?.push(staff);
    }
    return { map, unassigned };
  }, [roster, settings, dateKey, workSede]);

  const dayAssignments = assignmentsForDate(settings, dateKey, resolvedSede);
  const coverCount = dayAssignments.filter(isCoverAssignment).length;

  const handleAssign = (staffId: string, homeSede: string, shift: TurnoShiftCode) => {
    const cellSede = workSede === 'Todas' ? homeSede : workSede;
    onUpdate((prev) =>
      upsertAssignment(prev, {
        staffId,
        date: dateKey,
        shift,
        homeSede,
        workSede: cellSede,
      })
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm dark:border-slate-700">
        <div>
          <p className="font-semibold capitalize text-foreground">
            {format(date, "EEEE d 'de' MMMM yyyy", { locale: es })}
          </p>
          <p className="text-xs text-muted-foreground">
            {dayAssignments.length} asignaciones
            {coverCount > 0 ? ` · ${coverCount} cobertura inter-sede` : ''}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {SHIFT_ORDER.map((code) => {
          const staffList = grouped.map.get(code) ?? [];
          return (
            <Card key={code} className="border-border dark:border-slate-700">
              <CardContent className="pt-4">
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold',
                      TURNO_SHIFT_STYLES[code].pill
                    )}
                  >
                    {TURNO_SHIFT_SHORT[code]}
                  </span>
                  <div>
                    <p className="font-medium">{TURNO_SHIFT_LABELS[code]}</p>
                    <p className="text-xs text-muted-foreground">{staffList.length} personas</p>
                  </div>
                </div>
                {staffList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin asignaciones</p>
                ) : (
                  <ul className="space-y-2">
                    {staffList.map((staff) => {
                      const cellSede = workSede === 'Todas' ? staff.homeSede : workSede;
                      const assignment = assignmentForCell(settings, staff.id, dateKey, cellSede);
                      const isCover = assignment ? isCoverAssignment(assignment) : false;
                      return (
                        <li
                          key={staff.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 dark:border-slate-800"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200">
                              {staff.initials}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{staff.fullName}</p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {staff.roleLabel}
                                {staff.workArea ? ` · ${staff.workArea}` : ''}
                                {' · '}
                                {staff.homeSede}
                              </p>
                            </div>
                          </div>
                          {isCover ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-cyan-700 dark:text-cyan-300">
                              <Building2 className="h-3 w-3" />
                              {assignment?.workSede}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {grouped.unassigned.length > 0 ? (
        <Card className="border-dashed border-border dark:border-slate-700">
          <CardContent className="pt-4">
            <div className="mb-3 flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <p className="font-medium">Sin turno asignado ({grouped.unassigned.length})</p>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {grouped.unassigned.map((staff) => (
                <li
                  key={staff.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2 dark:bg-slate-900/40"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold dark:bg-slate-700">
                      {staff.initials}
                    </span>
                    <span className="truncate text-sm">{staff.fullName}</span>
                  </div>
                  {canEdit ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted dark:border-slate-700"
                        >
                          Asignar
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto border-border p-0 dark:border-slate-700" align="end">
                        <TurnosShiftPicker
                          onSelect={(shift) => handleAssign(staff.id, staff.homeSede, shift)}
                        />
                      </PopoverContent>
                    </Popover>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
