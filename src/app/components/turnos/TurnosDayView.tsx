import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Building2, GripVertical, Printer, Users } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import type { TurnoShiftCode, TurnosRosterEntry, TurnosSettings } from '../../types/turnos';
import { TURNO_SHIFT_LABELS, TURNO_SHIFT_SHORT } from '../../types/turnos';
import {
  assignmentCoverageKind,
  assignmentForCell,
  assignmentsForDate,
  isCoverAssignment,
  removeAssignment,
  upsertAssignment,
} from '../../utils/turnosData';
import { upsertAssignmentByManager } from '../../utils/turnosShiftApproval';
import { toDateKey } from '../../utils/turnosCalendar';
import { coverageVisual, TURNO_SHIFT_STYLES, workAreaAvatarClass } from '../../utils/turnosStyles';
import { printTurnosDay } from '../../utils/turnosExport';
import { cn } from '../ui/utils';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { TurnosShiftPicker } from './TurnosShiftPicker';

type Props = {
  settings: TurnosSettings;
  date: Date;
  roster: TurnosRosterEntry[];
  workSede: string;
  canEdit: boolean;
  assignActor?: { userId?: string; name?: string; isManager?: boolean };
  onUpdate: (updater: (prev: TurnosSettings) => TurnosSettings) => void;
};

const SHIFT_ORDER: TurnoShiftCode[] = ['day', 'night', 'training', 'off'];
const UNASSIGNED = 'unassigned';

function StaffCard({
  staff,
  assignment,
  workSede,
  draggable,
}: {
  staff: TurnosRosterEntry;
  assignment?: ReturnType<typeof assignmentForCell>;
  workSede: string;
  draggable?: boolean;
}) {
  const kind = assignment ? assignmentCoverageKind(assignment, staff) : 'regular';
  const visual = coverageVisual(kind);
  const isCover = assignment ? isCoverAssignment(assignment, staff) : false;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 dark:border-slate-800',
        isCover && visual.ring
      )}
    >
      {draggable ? <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" /> : null}
      <span
        className={cn(
          'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
          workAreaAvatarClass(staff.workArea)
        )}
      >
        {staff.initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{staff.fullName}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {staff.roleLabel}
          {staff.workArea ? ` · ${staff.workArea}` : ''}
          {' · '}
          {staff.homeSede}
        </p>
      </div>
      {visual.badge ? (
        <span
          className={cn(
            'rounded px-1 text-[9px] font-bold text-white',
            kind === 'external' ? 'bg-orange-500' : 'bg-cyan-500'
          )}
        >
          {visual.badge}
        </span>
      ) : isCover ? (
        <span className="inline-flex items-center gap-1 text-[10px] text-cyan-700 dark:text-cyan-300">
          <Building2 className="h-3 w-3" />
          {assignment?.workSede}
        </span>
      ) : null}
    </div>
  );
}

function DraggableStaff({
  id,
  staff,
  assignment,
  workSede,
  canEdit,
}: {
  id: string;
  staff: TurnosRosterEntry;
  assignment?: ReturnType<typeof assignmentForCell>;
  workSede: string;
  canEdit: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    disabled: !canEdit,
  });

  return (
    <div
      ref={setNodeRef}
      {...(canEdit ? { ...listeners, ...attributes } : {})}
      className={cn('touch-none', isDragging && 'opacity-40')}
    >
      <StaffCard staff={staff} assignment={assignment} workSede={workSede} draggable={canEdit} />
    </div>
  );
}

function ShiftColumn({
  shiftCode,
  staffList,
  settings,
  dateKey,
  workSede,
  canEdit,
}: {
  shiftCode: TurnoShiftCode | typeof UNASSIGNED;
  staffList: TurnosRosterEntry[];
  settings: TurnosSettings;
  dateKey: string;
  workSede: string;
  canEdit: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: shiftCode, disabled: !canEdit });
  const code = shiftCode === UNASSIGNED ? 'off' : shiftCode;

  return (
    <div ref={setNodeRef} className={cn(isOver && canEdit && 'rounded-xl ring-2 ring-primary/50')}>
    <Card className="border-border dark:border-slate-700">
      <CardContent className="pt-4">
        <div className="mb-3 flex items-center gap-2">
          {shiftCode !== UNASSIGNED ? (
            <span
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold',
                TURNO_SHIFT_STYLES[code].pill
              )}
            >
              {TURNO_SHIFT_SHORT[code]}
            </span>
          ) : (
            <Users className="h-5 w-5 text-muted-foreground" />
          )}
          <div>
            <p className="font-medium">
              {shiftCode === UNASSIGNED ? 'Sin asignar' : TURNO_SHIFT_LABELS[shiftCode]}
            </p>
            <p className="text-xs text-muted-foreground">{staffList.length} personas</p>
          </div>
        </div>
        {canEdit && shiftCode !== UNASSIGNED ? (
          <p className="mb-2 text-[10px] text-muted-foreground">Suelta aquí para reasignar</p>
        ) : null}
        <ul className="space-y-2">
          {staffList.map((staff) => {
            const cellSede = workSede === 'Todas' ? staff.homeSede : workSede;
            const assignment = assignmentForCell(settings, staff.id, dateKey, cellSede);
            return (
              <li key={staff.id}>
                <DraggableStaff
                  id={staff.id}
                  staff={staff}
                  assignment={assignment}
                  workSede={workSede}
                  canEdit={canEdit}
                />
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
    </div>
  );
}

export function TurnosDayView({ settings, date, roster, workSede, canEdit, assignActor, onUpdate }: Props) {
  const dateKey = toDateKey(date);
  const resolvedSede = workSede === 'Todas' ? undefined : workSede;
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const grouped = useMemo(() => {
    const map = new Map<TurnoShiftCode, TurnosRosterEntry[]>();
    for (const code of SHIFT_ORDER) map.set(code, []);
    const unassigned: TurnosRosterEntry[] = [];

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
  const coverCount = dayAssignments.filter((a) => isCoverAssignment(a)).length;

  const assignShift = (staffId: string, homeSede: string, shift: TurnoShiftCode) => {
    const cellSede = workSede === 'Todas' ? homeSede : workSede;
    const payload = {
      staffId,
      date: dateKey,
      shift,
      homeSede,
      workSede: cellSede,
    };
    if (canEdit && assignActor) {
      onUpdate((prev) => upsertAssignmentByManager(prev, payload, assignActor));
      return;
    }
    onUpdate((prev) => upsertAssignment(prev, payload));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || !canEdit) return;

    const staffId = String(active.id);
    const target = String(over.id) as TurnoShiftCode | typeof UNASSIGNED;
    const staff = roster.find((s) => s.id === staffId);
    if (!staff) return;

    const cellSede = workSede === 'Todas' ? staff.homeSede : workSede;
    const existing = assignmentForCell(settings, staffId, dateKey, cellSede);

    if (target === UNASSIGNED) {
      if (existing) {
        onUpdate((prev) => removeAssignment(prev, existing.id));
      }
      return;
    }

    if (existing?.shift === target) return;
    assignShift(staffId, staff.homeSede, target);
  };

  const activeStaff = activeId ? roster.find((s) => s.id === activeId) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm dark:border-slate-700">
        <div>
          <p className="font-semibold capitalize text-foreground">
            {format(date, "EEEE d 'de' MMMM yyyy", { locale: es })}
          </p>
          <p className="text-xs text-muted-foreground">
            {dayAssignments.length} asignaciones
            {coverCount > 0 ? ` · ${coverCount} cobertura` : ''}
            {canEdit ? ' · Arrastra entre columnas' : ''}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => printTurnosDay({ settings, roster, date, workSede })}
        >
          <Printer className="mr-1 h-4 w-4" />
          Imprimir día
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {SHIFT_ORDER.map((code) => (
            <ShiftColumn
              key={code}
              shiftCode={code}
              staffList={grouped.map.get(code) ?? []}
              settings={settings}
              dateKey={dateKey}
              workSede={workSede}
              canEdit={canEdit}
            />
          ))}
        </div>

        {grouped.unassigned.length > 0 ? (
          <div className="mt-4 max-w-xl">
            <ShiftColumn
              shiftCode={UNASSIGNED}
              staffList={grouped.unassigned}
              settings={settings}
              dateKey={dateKey}
              workSede={workSede}
              canEdit={canEdit}
            />
          </div>
        ) : null}

        <DragOverlay>
          {activeStaff ? (
            <StaffCard staff={activeStaff} workSede={workSede} draggable />
          ) : null}
        </DragOverlay>
      </DndContext>

      {grouped.unassigned.length > 0 && canEdit ? (
        <p className="text-xs text-muted-foreground">
          También puedes asignar desde el panel sin asignar con el botón Asignar en cada fila.
        </p>
      ) : null}
    </div>
  );
}
