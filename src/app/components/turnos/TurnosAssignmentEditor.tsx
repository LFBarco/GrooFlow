import { StickyNote } from 'lucide-react';

import type { TurnoAssignment, TurnoShiftCode } from '../../types/turnos';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { TurnosShiftPicker } from './TurnosShiftPicker';

type Props = {
  assignment?: TurnoAssignment;
  onSelect: (shift: TurnoShiftCode) => void;
  onClear?: () => void;
  onSaveDetails?: (patch: { notes?: string; startTime?: string; endTime?: string }) => void;
};

export function TurnosAssignmentEditor({
  assignment,
  onSelect,
  onClear,
  onSaveDetails,
}: Props) {
  const notes = assignment?.notes ?? '';
  const startTime = assignment?.startTime ?? '';
  const endTime = assignment?.endTime ?? '';

  return (
    <div className="w-[240px]">
      <TurnosShiftPicker value={assignment?.shift} onSelect={onSelect} onClear={onClear} />
      {assignment && onSaveDetails ? (
        <div className="space-y-2 border-t border-border p-2 dark:border-slate-700">
          <p className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <StickyNote className="h-3 w-3" />
            Horario y notas
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Inicio</Label>
              <Input
                type="time"
                className="h-8 text-xs"
                defaultValue={startTime}
                id={`turno-start-${assignment.id}`}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Fin</Label>
              <Input
                type="time"
                className="h-8 text-xs"
                defaultValue={endTime}
                id={`turno-end-${assignment.id}`}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Notas</Label>
            <Textarea
              className="min-h-[56px] text-xs"
              defaultValue={notes}
              placeholder="Ej. cubre vacaciones…"
              id={`turno-notes-${assignment.id}`}
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="w-full"
            variant="secondary"
            onClick={() => {
              const startEl = document.getElementById(`turno-start-${assignment.id}`) as HTMLInputElement | null;
              const endEl = document.getElementById(`turno-end-${assignment.id}`) as HTMLInputElement | null;
              const notesEl = document.getElementById(`turno-notes-${assignment.id}`) as HTMLTextAreaElement | null;
              onSaveDetails({
                startTime: startEl?.value || undefined,
                endTime: endEl?.value || undefined,
                notes: notesEl?.value.trim() || undefined,
              });
            }}
          >
            Guardar detalle
          </Button>
        </div>
      ) : null}
    </div>
  );
}
