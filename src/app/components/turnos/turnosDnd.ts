import type { TurnoShiftCode } from '../../types/turnos';

export const TURNO_DND_TYPE = 'turno-assignment';

export interface TurnoDragItem {
  assignmentId: string;
  staffId: string;
  date: string;
  workSede: string;
  shift: TurnoShiftCode;
}
