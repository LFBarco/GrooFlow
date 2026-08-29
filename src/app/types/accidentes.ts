/** Gravedad del accidente de trabajo. */
export type AccidentSeverity = 'leve' | 'grave' | 'muy_grave' | 'mortal';

/** Turno en el momento del evento. */
export type AccidentWorkShift = 'day' | 'night' | 'mixed' | 'off_duty';

/** Consecuencia inmediata. */
export type AccidentImmediateCare =
  | 'atencion_sitio'
  | 'traslado_hospital'
  | 'dias_baja'
  | 'sin_baja';

export const ACCIDENT_SEVERITY_LABELS: Record<AccidentSeverity, string> = {
  leve: 'Leve',
  grave: 'Grave',
  muy_grave: 'Muy grave',
  mortal: 'Mortal',
};

export const ACCIDENT_SHIFT_LABELS: Record<AccidentWorkShift, string> = {
  day: 'Día',
  night: 'Noche',
  mixed: 'Mixto / Rotativo',
  off_duty: 'Fuera de turno',
};

export const ACCIDENT_CARE_LABELS: Record<AccidentImmediateCare, string> = {
  atencion_sitio: 'Atención en el sitio',
  traslado_hospital: 'Traslado a hospital / clínica',
  dias_baja: 'Días de baja médica',
  sin_baja: 'Sin baja',
};

/** Áreas operativas — clínica veterinaria. */
export const VET_WORK_AREAS = [
  'Área Médica',
  'Grooming / Peluquería',
  'Farmacia',
  'Laboratorio',
  'Recepción / Counter',
  'Administración',
  'Mantenimiento',
  'Flota / Choferes',
  'Limpieza',
  'Bodega / Almacén',
  'Otro',
] as const;

export type VetWorkArea = (typeof VET_WORK_AREAS)[number];

export const INJURY_NATURE_OPTIONS = [
  'Corte / laceración',
  'Contusión / golpe',
  'Fractura',
  'Esguince / torcedura',
  'Quemadura',
  'Herida punzante',
  'Mordedura / arañazo animal',
  'Contacto químico / alergia',
  'Caída mismo nivel',
  'Caída distinto nivel',
  'Estrés térmico',
  'Atrapamiento',
  'Otros',
] as const;

export const BODY_PART_OPTIONS = [
  'Cabeza',
  'Ojos',
  'Cara',
  'Cuello',
  'Hombro derecho',
  'Hombro izquierdo',
  'Brazo derecho',
  'Brazo izquierdo',
  'Mano derecha',
  'Mano izquierda',
  'Tórax',
  'Espalda',
  'Abdomen',
  'Cadera',
  'Pierna derecha',
  'Pierna izquierda',
  'Rodilla derecha',
  'Rodilla izquierda',
  'Pie derecho',
  'Pie izquierdo',
  'Múltiples zonas',
] as const;

export const CAUSING_AGENT_OPTIONS = [
  'Herramienta manual',
  'Maquinaria grooming',
  'Equipo médico / quirúrgico',
  'Equipo de diagnóstico (RX, eco)',
  'Sustancia química / desinfectante',
  'Animal / paciente',
  'Caída mismo nivel',
  'Caída distinto nivel',
  'Vehículo / flota',
  'Piso resbaladizo / mojado',
  'Mobiliario',
  'Objeto en altura',
  'Estrés ergonómico',
  'Otro',
] as const;

export type InjuryNature = (typeof INJURY_NATURE_OPTIONS)[number];
export type BodyPart = (typeof BODY_PART_OPTIONS)[number];
export type CausingAgent = (typeof CAUSING_AGENT_OPTIONS)[number];

/** Registro estructurado de accidente de trabajo. */
export interface WorkplaceAccidentRecord {
  id: string;
  /** Sede donde ocurrió el evento. */
  sede: string;
  /** Vinculación con usuario del sistema (opcional). */
  userId?: string;
  /** Snapshot del afectado al momento del registro. */
  affectedName: string;
  jobTitle: string;
  workArea: string;
  /** Antigüedad en meses al momento del accidente. */
  seniorityMonths: number;
  contractType: string;
  /** yyyy-MM-dd */
  eventDate: string;
  /** HH:mm */
  eventTime: string;
  exactLocation: string;
  workShift: AccidentWorkShift;
  severity: AccidentSeverity;
  injuryNature: string;
  bodyPart: string;
  causingAgent: string;
  immediateCare: AccidentImmediateCare;
  estimatedLostDays: number;
  medicalCost: number;
  indemnizationCost: number;
  description?: string;
  preventiveActions?: string;
  reportedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AccidentesKpiConfig {
  /** Horas hombre mensuales por trabajador (default 208). */
  hoursPerWorkerMonth: number;
  /** Costo diario estimado por día de baja (soles). */
  dailyLostDayCost: number;
  /** Headcount manual si no hay usuarios activos suficientes. */
  manualHeadcount?: number;
}

export interface AccidentesSettings {
  version: 1;
  records: WorkplaceAccidentRecord[];
  config: AccidentesKpiConfig;
}

export interface AccidentesFilters {
  dateFrom: string;
  dateTo: string;
  sede: string;
  workArea: string;
  workShift: string;
  bodyPart: string;
  injuryNature: string;
}

export interface AccidentesKpiSnapshot {
  totalAccidents: number;
  accidentsWithLostTime: number;
  totalLostDays: number;
  frequencyIndex: number;
  gravityIndex: number;
  sinistralityRate: number;
  daysWithoutAccident: number;
  lastAccidentDate: string | null;
  totalCost: number;
  medicalCost: number;
  indemnizationCost: number;
  lostDaysCost: number;
  manHours: number;
  activeWorkers: number;
  byArea: Array<{ area: string; count: number }>;
  bySeverity: Array<{ severity: AccidentSeverity; count: number }>;
  byBodyPart: Array<{ part: string; count: number }>;
  byMonth: Array<{ month: string; count: number; lostDays: number }>;
  byShift: Array<{ shift: AccidentWorkShift; count: number }>;
}
