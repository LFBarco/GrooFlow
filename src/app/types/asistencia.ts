/** Grupo de área para cobertura operativa (legacy / resumen Buk). */
export type AsistenciaAreaGroup = 'medica' | 'peluqueria' | 'global';

export const ASISTENCIA_AREA_GROUP_LABELS: Record<AsistenciaAreaGroup, string> = {
  medica: 'Área médica',
  peluqueria: 'Peluquería / baño',
  global: 'Global / operaciones',
};

/** Área del organigrama operativo por sede. */
export type AsistenciaStaffArea = 'administracion' | 'medica' | 'peluqueria';

export const ASISTENCIA_STAFF_AREA_LABELS: Record<AsistenciaStaffArea, string> = {
  administracion: 'Administración',
  medica: 'Área Médica',
  peluqueria: 'Peluquería',
};

export const ASISTENCIA_STAFF_AREAS: AsistenciaStaffArea[] = [
  'administracion',
  'medica',
  'peluqueria',
];

export type AsistenciaLiveStatus = 'trabajando' | 'presente' | 'tarde' | 'ausente';

/** Turno operativo del personal y del organigrama en vivo. */
export type AsistenciaWorkShift = 'day' | 'night';

export type AsistenciaShiftFilter = 'all' | AsistenciaWorkShift;

export const ASISTENCIA_WORK_SHIFT_LABELS: Record<AsistenciaWorkShift, string> = {
  day: 'Día',
  night: 'Noche',
};

export const ASISTENCIA_DEFAULT_DAY_EXPECTED_TIME = '08:00';
export const ASISTENCIA_DEFAULT_NIGHT_EXPECTED_TIME = '20:00';
/** Tolerancia de llegada turno día (minutos después de scheduleStart). */
export const ASISTENCIA_DEFAULT_DAY_TOLERANCE_MINUTES = 10;

export type BukPunctualityStatus = 'on_time' | 'late' | 'pending';

export const ASISTENCIA_LIVE_STATUS_LABELS: Record<AsistenciaLiveStatus, string> = {
  trabajando: 'Trabajando',
  presente: 'Presente',
  tarde: 'Tarde',
  ausente: 'Ausente',
};

/** Persona registrada en la estructura de la sede. */
export interface AsistenciaStaffMember {
  id: string;
  sedeName: string;
  fullName: string;
  cargoLabel: string;
  /** Id de columna del organigrama (área built-in o personalizada). */
  area: string;
  /** HH:mm esperado de llegada. */
  expectedTime: string;
  /** Turno operativo (cruce con Buk `turno_noche` y filtro del organigrama). */
  shift?: AsistenciaWorkShift;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  isCritical: boolean;
  isManager?: boolean;
  /** RUT para cruce directo con Buk. */
  rut?: string;
  matchArea?: string;
  matchSpecialty?: string;
  sortOrder?: number;
}

/** Columna personalizada del organigrama (además de las 3 built-in). */
export interface AsistenciaCustomOrgColumn {
  id: string;
  label: string;
}

/** Configuración operativa de una sede. */
export interface AsistenciaSedeProfile {
  sedeName: string;
  scheduleStart?: string;
  scheduleEnd?: string;
  /** Horario referencial del turno nocturno en esta sede. */
  scheduleNightStart?: string;
  scheduleNightEnd?: string;
  /** Minutos de tolerancia tras la hora de entrada (turno día). */
  scheduleToleranceMinutes?: number;
  bukRecintoCode?: string;
  /** Columnas extra del organigrama. */
  customOrgColumns?: AsistenciaCustomOrgColumn[];
  /** Etiquetas por id de columna. */
  areaLabels?: Record<string, string>;
  /** Orden de columnas (ids built-in + custom). */
  areaOrder?: string[];
  /** Cargos permitidos por columna (override). */
  cargoByColumn?: Record<string, string[]>;
  /** Ocultar columnas sin personal asignado. */
  hideEmptyAreas?: boolean;
}

export interface AsistenciaStaffLiveState {
  staff: AsistenciaStaffMember;
  status: AsistenciaLiveStatus;
  entradaFormat?: string;
  stillOnSite: boolean;
  /** Detalle operativo (ej. salida marcada el mismo día). */
  statusNote?: string;
  /** Por qué no hubo match con Buk (solo si ausente y hay datos cargados). */
  matchHint?: string;
}

export interface AsistenciaLiveAreaBlock {
  area: string;
  /** Etiqueta visible (personalizable por sede). */
  label: string;
  staff: AsistenciaStaffLiveState[];
  activeCount: number;
  totalCount: number;
}

export interface AsistenciaLiveSedeSummary {
  sedeName: string;
  scheduleLabel: string;
  workingCount: number;
  absentCount: number;
  lateCount: number;
  manager: AsistenciaStaffLiveState | null;
  areas: AsistenciaLiveAreaBlock[];
  isOperational: boolean;
  criticalMissing: AsistenciaStaffMember[];
  /** Códigos de recinto Buk vistos en la fecha seleccionada (ayuda a configurar sede). */
  bukRecintosOnDate: string[];
  recordsOnDateCount: number;
}

/** Consolidado multi-sede para organigrama en vivo. */
export interface AsistenciaLiveConsolidatedSummary {
  workingCount: number;
  absentCount: number;
  lateCount: number;
  isFullyOperational: boolean;
  sedes: AsistenciaLiveSedeSummary[];
}

export const ASISTENCIA_CARGO_PRESETS = [
  'Encargado de sede',
  'Recepcionista',
  'Counter',
  'Médico veterinario',
  'Asistente veterinario',
  'Peluquero',
  'Bañador',
  'Limpieza',
  'Mantenimiento',
] as const;

/** Cargo visible del líder operativo en la cima del organigrama. */
export const ASISTENCIA_SEDE_LEADER_CARGO = 'Encargado de sede';

/** Cargos sugeridos por área built-in del organigrama. */
export const ASISTENCIA_CARGOS_BY_BUILTIN_AREA: Record<AsistenciaStaffArea, string[]> = {
  administracion: [
    'Encargado de sede',
    'Jefe de área',
    'Recepcionista',
    'Counter',
    'Limpieza',
    'Mantenimiento',
  ],
  medica: ['Jefe médico', 'Médico veterinario', 'Asistente veterinario'],
  peluqueria: ['Peluquero', 'Bañador'],
};

/** Registro crudo de Buk Asistencia (Ctrlit). */
export interface BukAsistenciaRecord {
  id: number;
  trab_id: number;
  rut_trabajador: string;
  nombre: string;
  apellido_materno?: string;
  apellido_paterno?: string;
  id_recinto?: number;
  nombre_recinto?: string;
  codigo_recinto?: string;
  rut_empleador?: string;
  especialidad?: string;
  area?: string;
  contrato?: string;
  supervisor?: string;
  entrada?: string | null;
  salida?: string | null;
  entrada_turno?: string | null;
  salida_turno?: string | null;
  dia_entrada?: string;
  entrada_format?: string;
  salida_format?: string;
  turno_noche?: boolean;
  art22?: boolean;
  turno?: string;
  codigo_turno?: string;
}

export interface BukAsistenciaPagination {
  next?: string | null;
  previous?: string | null;
  count: number;
  page: number;
  totalPages: number;
}

export interface BukAsistenciaResponse {
  pagination: BukAsistenciaPagination;
  data: BukAsistenciaRecord[];
}

/** Requisito de dotación por sede / área / cargo (configurable). */
export interface AsistenciaOrgRequirement {
  id: string;
  /** Sede del catálogo GooFlow. */
  sedeName: string;
  /** Código recinto Buk (opcional; si falta se infiere del mapeo). */
  bukRecintoCode?: string;
  areaGroup: AsistenciaAreaGroup;
  /** Etiqueta visible del cargo en la estructura. */
  cargoLabel: string;
  /** Subcadena en campo `area` de Buk (ej. MEDICOS VETERINARIOS). */
  matchArea?: string;
  /** Subcadena en campo `especialidad` de Buk. */
  matchSpecialty?: string;
  requiredCount: number;
  sortOrder?: number;
}

export interface AsistenciaAreaKeywords {
  medica: string[];
  peluqueria: string[];
}

export interface AsistenciaSedeMapping {
  sedeName: string;
  bukRecintoCode: string;
  bukRecintoName?: string;
}

export interface BukAsistenciaIntegrationSettings {
  apiBaseUrl?: string;
  apiToken?: string;
  enabled?: boolean;
  lastValidatedAt?: string;
  lastValidationOk?: boolean;
  lastValidationMessage?: string;
}

export interface AsistenciaSettings {
  buk?: BukAsistenciaIntegrationSettings;
  requirements: AsistenciaOrgRequirement[];
  /** Personal nominal por sede (organigrama operativo). */
  staff?: AsistenciaStaffMember[];
  /** Horarios y mapeo Buk por sede. */
  sedeProfiles?: AsistenciaSedeProfile[];
  areaKeywords?: AsistenciaAreaKeywords;
  sedeMappings?: AsistenciaSedeMapping[];
}

export type AsistenciaCoverageStatus = 'complete' | 'partial' | 'missing' | 'over';

export interface AsistenciaPresentPerson {
  rut: string;
  fullName: string;
  especialidad?: string;
  area?: string;
  entradaFormat?: string;
  stillOnSite: boolean;
}

export interface AsistenciaRequirementCoverage {
  requirement: AsistenciaOrgRequirement;
  presentCount: number;
  requiredCount: number;
  status: AsistenciaCoverageStatus;
  present: AsistenciaPresentPerson[];
}

export interface AsistenciaSedeCoverage {
  sedeName: string;
  bukRecintoCode?: string;
  byArea: Record<AsistenciaAreaGroup, AsistenciaRequirementCoverage[]>;
  totalRequired: number;
  totalPresent: number;
  completeSlots: number;
  totalSlots: number;
  isComplete: boolean;
}

export interface AsistenciaDaySummary {
  dateLabel: string;
  sedes: AsistenciaSedeCoverage[];
  globalByArea: Record<
    AsistenciaAreaGroup,
    { required: number; present: number; slots: number; completeSlots: number }
  >;
  totalPresentUnique: number;
  fetchedAt: string;
}
