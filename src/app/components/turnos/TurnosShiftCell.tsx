import { memo, useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { StickyNote } from 'lucide-react';

import type { TurnoAssignment, TurnoShiftCode, TurnosRosterEntry } from '../../types/turnos';
import { TURNO_SHIFT_LABELS, TURNO_SHIFT_SHORT } from '../../types/turnos';
import { assignmentCoverageKind, isCoverAssignment } from '../../utils/turnosData';
import { coverageVisual, TURNO_SHIFT_STYLES } from '../../utils/turnosStyles';
import { cn } from '../ui/utils';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { TurnosAssignmentEditor } from './TurnosAssignmentEditor';
import { TURNO_DND_TYPE, type TurnoDragItem } from './turnosDnd';

type Props = {
  staffId: string;
  staff?: TurnosRosterEntry;
  date: string;
  workSede: string;
  assignment?: TurnoAssignment;
  canEdit: boolean;
  cellHeight?: string;
  onAssign: (shift: TurnoShiftCode) => void;
  onClear: () => void;
  onMove: (assignmentId: string, target: { staffId: string; date: string; workSede: string }) => void;
  onSaveDetails?: (assignmentId: string, patch: { notes?: string; startTime?: string; endTime?: string }) => void;
};

function assignmentTooltip(assignment: TurnoAssignment, staff?: TurnosRosterEntry): string {
  const kind = assignmentCoverageKind(assignment, staff);
  const visual = coverageVisual(kind);
  const lines: string[] = [TURNO_SHIFT_LABELS[assignment.shift]];
  if (assignment.startTime || assignment.endTime) {
    lines.push(`Horario: ${assignment.startTime ?? '—'} – ${assignment.endTime ?? '—'}`);
  }
  if (assignment.notes?.trim()) {
    lines.push(assignment.notes.trim());
  }
  if (kind !== 'regular') {
    lines.push(`${visual.label} · ${assignment.workSede} (habitual: ${assignment.homeSede})`);
  }
  return lines.join(' · ');
}

export const TurnosShiftCell = memo(function TurnosShiftCell({
  staffId,
  staff,
  date,
  workSede,
  assignment,
  canEdit,
  cellHeight = 'h-10',
  onAssign,
  onClear,
  onMove,
  onSaveDetails,
}: Props) {
  const ref = useRef<HTMLButtonElement | null>(null);

  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: TURNO_DND_TYPE,
      item: assignment
        ? ({
            assignmentId: assignment.id,
            staffId: assignment.staffId,
            date: assignment.date,
            workSede: assignment.workSede,
            shift: assignment.shift,
          } satisfies TurnoDragItem)
        : undefined,
      canDrag: () => canEdit && !!assignment,
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [assignment, canEdit]
  );

  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: TURNO_DND_TYPE,
      canDrop: () => canEdit,
      drop: (item: TurnoDragItem) => {
        if (item.staffId === staffId && item.date === date && item.workSede === workSede) return;
        onMove(item.assignmentId, { staffId, date, workSede });
      },
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }),
        canDrop: monitor.canDrop(),
      }),
    }),
    [staffId, date, workSede, canEdit, onMove]
  );

  drag(drop(ref));

  const shift = assignment?.shift;
  const styles = shift ? TURNO_SHIFT_STYLES[shift] : null;
  const coverageKind = assignment ? assignmentCoverageKind(assignment, staff) : 'regular';
  const visual = coverageVisual(coverageKind);
  const isCover = assignment ? isCoverAssignment(assignment, staff) : false;
  const hasNotes = Boolean(assignment?.notes?.trim() || assignment?.startTime || assignment?.endTime);
  const tooltipText = assignment ? assignmentTooltip(assignment, staff) : undefined;

  const cell = (
    <button
      ref={ref}
      type="button"
      disabled={!canEdit}
      title={tooltipText}
      className={cn(
        'group relative flex w-full min-w-[2.5rem] items-center justify-center rounded-lg border text-xs font-bold transition-colors',
        cellHeight,
        canEdit && 'cursor-pointer hover:border-border/80',
        !shift && 'border-dashed border-[#CBD5E1]/80 bg-muted/30 dark:border-slate-600 dark:bg-slate-800/40',
        shift && 'border-transparent',
        shift && styles?.pill,
        shift === 'off' &&
          'bg-[length:8px_8px] bg-[linear-gradient(135deg,rgba(148,163,184,0.15)_25%,transparent_25%,transparent_50%,rgba(148,163,184,0.15)_50%,rgba(148,163,184,0.15)_75%,transparent_75%,transparent)]',
        isCover && visual.ring,
        isDragging && 'opacity-40',
        isOver && canDrop && 'ring-2 ring-primary/60 ring-offset-1',
        !canEdit && 'cursor-default'
      )}
    >
      {shift ? (
        <>
          {TURNO_SHIFT_SHORT[shift]}
          {visual.badge ? (
            <span
              className={cn(
                'absolute -top-1 -right-1 rounded px-0.5 text-[8px] font-bold text-white',
                coverageKind === 'external' ? 'bg-orange-500' : 'bg-cyan-500'
              )}
            >
              {visual.badge}
            </span>
          ) : null}
          {hasNotes ? (
            <StickyNote className="absolute -bottom-0.5 -left-0.5 h-3 w-3 text-foreground/50" />
          ) : null}
        </>
      ) : (
        <span className="text-muted-foreground/40 group-hover:text-muted-foreground">+</span>
      )}
    </button>
  );

  if (!canEdit) return cell;

  return (
    <Popover>
      <PopoverTrigger asChild>{cell}</PopoverTrigger>
      <PopoverContent className="w-auto border-border p-0 dark:border-slate-700" align="start">
        <TurnosAssignmentEditor
          assignment={assignment}
          onSelect={onAssign}
          onClear={assignment ? onClear : undefined}
          onSaveDetails={
            assignment && onSaveDetails
              ? (patch) => onSaveDetails(assignment.id, patch)
              : undefined
          }
        />
      </PopoverContent>
    </Popover>
  );
});
