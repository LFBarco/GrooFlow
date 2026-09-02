import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, Check, X } from 'lucide-react';

import type { TurnosSettings } from '../../types/turnos';
import { TURNO_SHIFT_LABELS } from '../../types/turnos';
import {
  confirmShiftAssignment,
  getPendingShiftApprovalsForUser,
  rejectShiftAssignment,
} from '../../utils/turnosShiftApproval';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';

type Props = {
  settings: TurnosSettings;
  userId?: string;
  userName?: string;
  onUpdate: (updater: (prev: TurnosSettings) => TurnosSettings, message?: string) => void;
};

export function TurnosShiftApprovalBanner({ settings, userId, userName, onUpdate }: Props) {
  const pending = getPendingShiftApprovalsForUser(settings, userId);
  if (pending.length === 0) return null;

  return (
    <div className="space-y-2">
      {pending.map((assignment) => {
        const dateLabel = format(parseISO(assignment.date), "EEEE d MMM", { locale: es });
        return (
          <Alert
            key={assignment.id}
            className="border-amber-300/50 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-950/20"
          >
            <Bell className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-sm">Confirma tu horario asignado</AlertTitle>
            <AlertDescription className="text-sm space-y-2">
              <p>
                {assignment.workSede} · {dateLabel} · {TURNO_SHIFT_LABELS[assignment.shift]}
                {assignment.assignedBy ? ` · asignado por ${assignment.assignedBy}` : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    onUpdate(
                      (prev) => confirmShiftAssignment(prev, assignment.id, userName),
                      'Horario confirmado.'
                    )
                  }
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Aprobar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onUpdate(
                      (prev) => rejectShiftAssignment(prev, assignment.id, userName),
                      'Horario rechazado. Comunica con tu encargado de sede.'
                    )
                  }
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Rechazar
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}
