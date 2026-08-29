import { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { Building2 } from 'lucide-react';

import type { TurnoAssignment, TurnoShiftCode } from '../../types/turnos';
import { TURNO_SHIFT_SHORT } from '../../types/turnos';
import { coverShiftRing, TURNO_SHIFT_STYLES } from '../../utils/turnosStyles';
import { isCoverAssignment } from '../../utils/turnosData';
import { cn } from '../ui/utils';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { TurnosShiftPicker } from './TurnosShiftPicker';
import { TURNO_DND_TYPE, type TurnoDragItem } from './turnosDnd';

type Props = {
  staffId: string;
  date: string;
  workSede: string;
  assignment?: TurnoAssignment;
  canEdit: boolean;
  onAssign: (shift: TurnoShiftCode) => void;
  onClear: () => void;
  onMove: (assignmentId: string, target: { staffId: string; date: string; workSede: string }) => void;
};

export function TurnosShiftCell({
  staffId,
  date,
  workSede,
  assignment,
  canEdit,
  onAssign,
  onClear,
  onMove,
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
  const isCover = assignment ? isCoverAssignment(assignment) : false;

  const cell = (
    <button
      ref={ref}
      type="button"
      disabled={!canEdit}
      className={cn(
        'group relative flex h-10 w-full min-w-[2.5rem] items-center justify-center rounded-lg border border-transparent text-xs font-bold transition-all',
        canEdit && 'cursor-pointer hover:border-border/80',
        !shift && 'bg-muted/30 dark:bg-slate-800/40',
        shift && styles?.pill,
        isCover && coverShiftRing(true),
        isDragging && 'opacity-40',
        isOver && canDrop && 'ring-2 ring-primary/60 ring-offset-1',
        !canEdit && 'cursor-default'
      )}
      title={
        isCover
          ? `Cobertura en ${assignment?.workSede} (sede habitual: ${assignment?.homeSede})`
          : undefined
      }
    >
      {shift ? (
        <>
          {TURNO_SHIFT_SHORT[shift]}
          {isCover ? (
            <Building2 className="absolute -top-1 -right-1 h-3 w-3 text-cyan-600 dark:text-cyan-400" />
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
        <TurnosShiftPicker
          value={shift}
          onSelect={onAssign}
          onClear={assignment ? onClear : undefined}
        />
      </PopoverContent>
    </Popover>
  );
}
