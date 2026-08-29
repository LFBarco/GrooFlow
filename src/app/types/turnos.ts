/** Código de turno en la grilla de planificación. */
export type TurnoShiftCode = 'day' | 'night' | 'off' | 'training';

export type TurnosViewMode = 'day' | 'week' | 'month';

export const TURNO_SHIFT_LABELS: Record<TurnoShiftCode, string> = {
  day: 'Turno Día',
  night: 'Turno Noche',
  off: 'Día Libre',
  training: 'Capacitación',
};

export const TURNO_SHIFT_SHORT: Record<TurnoShiftCode, string> = {
  day: 'D',
  night: 'N',
  off: 'L',
  training: 'C',
};

/** Persona en el roster de turnos (sincronizada con usuarios / asistencia). */
export interface TurnosRosterEntry {
  id: string;
  source: 'user' | 'asistencia' | 'manual';
  userId?: string;
  asistenciaStaffId?: string;
  fullName: string;
  initials: string;
  roleLabel: string;
  homeSede: string;
  email?: string;
  active: boolean;
  sortOrder?: number;
}

/** Asignación de turno en una fecha y sede. */
export interface TurnoAssignment {
  id: string;
  staffId: string;
  /** yyyy-MM-dd */
  date: string;
  shift: TurnoShiftCode;
  /** Sede habitual del personal. */
  homeSede: string;
  /** Sede donde trabaja ese día (cobertura inter-sede). */
  workSede: string;
  notes?: string;
  startTime?: string;
  endTime?: string;
  updatedAt?: string;
}

export interface TurnosSettings {
  version: 1;
  assignments: TurnoAssignment[];
  roster: TurnosRosterEntry[];
  /** Última sincronización roster ← usuarios/asistencia (ISO). */
  rosterSyncedAt?: string;
}

export interface TurnosDaySummary {
  date: string;
  dayCount: number;
  nightCount: number;
  offCount: number;
  trainingCount: number;
  coverCount: number;
  understaffed: boolean;
}
