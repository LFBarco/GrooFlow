/** Código de turno en la grilla de planificación. */
export type TurnoShiftCode = 'day' | 'night' | 'off' | 'training';

export type TurnosViewMode = 'day' | 'week' | 'month' | 'vacancies';

export type TurnosGridDensity = 'compact' | 'comfortable' | 'spacious';

/** Tipo de cobertura en una asignación. */
export type TurnoCoverageKind = 'regular' | 'inter_sede' | 'external';

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

/** Persona en el roster de turnos (organigrama / maestro; externos manuales). */
export interface TurnosRosterEntry {
  id: string;
  /** organigrama = staff Asistencia proyectado desde Buk.pe; user/asistencia = legado. */
  source: 'user' | 'asistencia' | 'manual' | 'organigrama';
  userId?: string;
  asistenciaStaffId?: string;
  bukEmployeeId?: number;
  fullName: string;
  initials: string;
  roleLabel: string;
  /** Área operativa (médica, grooming, mantenimiento, etc.). */
  workArea?: string;
  homeSede: string;
  email?: string;
  active: boolean;
  sortOrder?: number;
  /** Personal externo (no pertenece al roster habitual de ninguna sede). */
  isExternal?: boolean;
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
  /** regular | inter_sede (otra sede interna) | external (personal externo). */
  coverageKind?: TurnoCoverageKind;
  /** Postulación aprobada que originó la asignación. */
  applicationId?: string;
  /** Aprobación del colaborador cuando el encargado asigna el horario. */
  staffApprovalStatus?: 'pending' | 'confirmed' | 'rejected';
  assignedBy?: string;
}

/** Turno vacante publicado para cobertura entre sedes. */
export interface TurnosVacancy {
  id: string;
  date: string;
  shift: 'day' | 'night';
  workSede: string;
  workArea?: string;
  reason?: string;
  status: 'open' | 'filled' | 'cancelled';
  createdAt: string;
  createdBy?: string;
  filledAssignmentId?: string;
}

export type TurnosCoverageApplicationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/** Postulación de personal para cubrir un turno vacante. */
export interface TurnosCoverageApplication {
  id: string;
  vacancyId: string;
  staffId: string;
  staffName: string;
  homeSede: string;
  isExternal?: boolean;
  note?: string;
  status: TurnosCoverageApplicationStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

/** Plantilla de semana reutilizable. */
export interface TurnosWeekTemplate {
  id: string;
  name: string;
  sede?: string;
  /** staffId → turnos por índice de día (0 = lunes de la semana). */
  assignments: Record<string, TurnoShiftCode[]>;
  createdAt: string;
}

/** Estado de publicación de una semana por sede. */
export interface TurnosWeekPublish {
  weekKey: string;
  sede: string;
  status: 'draft' | 'published';
  publishedAt?: string;
  publishedBy?: string;
}

/** Entrada de historial de cambios. */
export interface TurnosChangeLogEntry {
  id: string;
  at: string;
  by?: string;
  action: string;
  detail?: string;
}

/** Reglas laborales configurables. */
export interface TurnosLaborRules {
  maxConsecutiveNights?: number;
  minDaysOffPerMonth?: number;
  maxConsecutiveWorkDays?: number;
}

export interface TurnosSettings {
  version: 1;
  assignments: TurnoAssignment[];
  roster: TurnosRosterEntry[];
  /** Última sincronización roster ← usuarios/asistencia (ISO). */
  rosterSyncedAt?: string;
  staffing?: TurnosStaffingConfig;
  vacancies?: TurnosVacancy[];
  applications?: TurnosCoverageApplication[];
  templates?: TurnosWeekTemplate[];
  publishedWeeks?: TurnosWeekPublish[];
  changeLog?: TurnosChangeLogEntry[];
  laborRules?: TurnosLaborRules;
  /** Si true, asignaciones del encargado requieren confirmación del colaborador. */
  requireStaffShiftApproval?: boolean;
}

export interface TurnosDaySummary {
  date: string;
  dayCount: number;
  nightCount: number;
  offCount: number;
  trainingCount: number;
  coverCount: number;
  externalCoverCount: number;
  understaffed: boolean;
  /** Brechas vs reglas de dotación configuradas. */
  staffingGaps: TurnosStaffingGap[];
}

/** Regla de dotación mínima por sede / área / turno. */
export interface TurnosMinStaffRule {
  id: string;
  /** Sede objetivo o "Todas". */
  sede: string;
  /** Área operativa o "Todas". */
  workArea: string;
  shift: 'day' | 'night';
  minimum: number;
}

/** Umbrales mínimos de dotación. */
export interface TurnosStaffingConfig {
  /** Mínimo combinado turno día + noche por día (fallback sin reglas). Default 2. */
  minDayNightTotal?: number;
  rules?: TurnosMinStaffRule[];
}

export interface TurnosStaffingGap {
  sede: string;
  workArea: string;
  shift: 'day' | 'night';
  required: number;
  actual: number;
  missing: number;
}

export interface TurnosFilters {
  search: string;
  workArea: string;
  roleLabel: string;
  shift: string;
  unassignedOnly: boolean;
  coverOnly: boolean;
  externalOnly: boolean;
  homeSede: string;
  filterDate: string;
  planVsRealStatus: string;
  alertsOnly: boolean;
}

/** Cruce planificado (turnos) vs marcación Buk. */
export type TurnosPlanVsRealStatus =
  | 'ok'
  | 'absent'
  | 'off_ok'
  | 'unplanned'
  | 'mismatch'
  | 'pending'
  | 'na';

export interface TurnosPlanVsReal {
  status: TurnosPlanVsRealStatus;
  label: string;
  detail?: string;
}

export interface TurnosPeriodKpi {
  dayShifts: number;
  nightShifts: number;
  offShifts: number;
  trainingShifts: number;
  coverShifts: number;
  externalCoverShifts: number;
  understaffedDays: number;
  unassignedStaff: number;
  activeStaff: number;
  openVacancies: number;
  pendingApplications: number;
}

/** Alerta de validación laboral. */
export interface TurnosLaborAlert {
  staffId: string;
  staffName: string;
  date: string;
  code: 'max_nights' | 'min_off' | 'max_consecutive';
  message: string;
  severity: 'warning' | 'error';
}

