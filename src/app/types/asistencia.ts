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

/** Filtros unificados del módulo (live + dashboard Buk). */
export type AsistenciaArrivalFilter = 'all' | 'arrived' | 'absent' | 'on_time' | 'late';

export type AsistenciaLiveStatusFilter = 'all' | AsistenciaLiveStatus;

export interface AsistenciaFilters {
  search: string;
  shift: AsistenciaShiftFilter;
  liveStatus: AsistenciaLiveStatusFilter;
  arrivalFilter: AsistenciaArrivalFilter;
  areaFilter: string;
  specialtyFilter: string;
  criticalOnly: boolean;
  noBukMatchOnly: boolean;
}

export const ASISTENCIA_FILTERS_ALL = '__all__';

export const ASISTENCIA_WORK_SHIFT_LABELS: Record<AsistenciaWorkShift, string> = {
  day: 'Día',
  night: 'Noche',
};

/** Día de la semana para turno mixto (lunes = primer día laboral). */
export type AsistenciaWeekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type AsistenciaWeekdayShift = AsistenciaWorkShift | 'off';

export const ASISTENCIA_WEEKDAYS: AsistenciaWeekday[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
];

export const ASISTENCIA_WEEKDAY_LABELS: Record<AsistenciaWeekday, string> = {
  mon: 'Lun',
  tue: 'Mar',
  wed: 'Mié',
  thu: 'Jue',
  fri: 'Vie',
  sat: 'Sáb',
  sun: 'Dom',
};

export type AsistenciaShiftMode = 'fixed' | 'weekly';

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
  /** `fixed`: un solo turno; `weekly`: turno distinto por día (turno mixto). */
  shiftMode?: AsistenciaShiftMode;
  /** Turno por día cuando `shiftMode === 'weekly'`. `off` = no labora ese día. */
  weeklyShifts?: Partial<Record<AsistenciaWeekday, AsistenciaWeekdayShift>>;
  /** Hora esperada turno noche (opcional; default 20:00). */
  expectedTimeNight?: string;
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

/** Subcolumna dentro de una columna del organigrama (área o custom). */
export interface AsistenciaOrgSubColumn {
  id: string;
  label: string;
  parentColumnId: string;
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
  /** Subcolumnas anidadas bajo columnas principales. */
  subOrgColumns?: AsistenciaOrgSubColumn[];
  /** Etiquetas por id de columna. */
  areaLabels?: Record<string, string>;
  /** Orden de columnas (ids built-in + custom). */
  areaOrder?: string[];
  /** Cargos permitidos por columna (override). */
  cargoByColumn?: Record<string, string[]>;
  /** Ocultar columnas sin personal asignado. */
  hideEmptyAreas?: boolean;
  /** Modo de visualización del organigrama en vivo. */
  orgChartMode?: 'columns' | 'tree';
  /** Nodos del organigrama jerárquico (modo tree). */
  orgChartNodes?: AsistenciaOrgChartNode[];
}

/** Nodo del organigrama jerárquico configurable por sede. */
export type AsistenciaOrgChartColor =
  | 'default'
  | 'blue'
  | 'lightblue'
  | 'green'
  | 'orange'
  | 'red'
  | 'violet';

export interface AsistenciaOrgChartNode {
  id: string;
  /** null = hijo directo bajo la sede (nivel raíz). */
  parentId: string | null;
  label: string;
  /** Disposición de los hijos: horizontal (ramas) o vertical (apilado). */
  childrenLayout?: 'horizontal' | 'vertical';
  color?: AsistenciaOrgChartColor;
  /** Área asignable vinculada — el personal de esa área aparece en el nodo. */
  areaId?: string;
  sortOrder?: number;
}

/** Nodo del árbol resuelto con hijos y personal en vivo. */
export interface AsistenciaOrgChartTreeNode {
  node: AsistenciaOrgChartNode;
  children: AsistenciaOrgChartTreeNode[];
  staff: AsistenciaStaffLiveState[];
  activeCount: number;
  totalCount: number;
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

export interface AsistenciaLiveSubAreaBlock {
  area: string;
  label: string;
  staff: AsistenciaStaffLiveState[];
  activeCount: number;
  totalCount: number;
}

export interface AsistenciaLiveAreaBlock {
  area: string;
  /** Etiqueta visible (personalizable por sede). */
  label: string;
  /** Personal asignado directamente a la columna (sin subcolumna). */
  staff: AsistenciaStaffLiveState[];
  /** Subdivisiones dentro de la columna. */
  subAreas?: AsistenciaLiveSubAreaBlock[];
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

export interface BukApiEndpointConfig {
  id: string;
  /** Nombre visible (ej. Asistencia empresa, Empleados). */
  name: string;
  /**
   * Ruta relativa a la base (ej. `asistencia-empresa`) o URL https completa de Ctrlit.
   * Puede incluir query string (`?page=1&page_size=5`).
   */
  pathOrUrl: string;
  description?: string;
  notes?: string;
  enabled?: boolean;
  lastProbedAt?: string;
  lastProbeOk?: boolean;
  lastProbeStatus?: number;
  lastProbeMessage?: string;
  lastProbeRecordCount?: number;
  /** Campos detectados en la última consulta (rutas tipo `data[].rut_trabajador`). */
  lastProbeFieldPaths?: string[];
}

export interface BukAsistenciaIntegrationSettings {
  apiBaseUrl?: string;
  apiToken?: string;
  enabled?: boolean;
  lastValidatedAt?: string;
  lastValidationOk?: boolean;
  lastValidationMessage?: string;
  /** Auto-refresh Buk en horario operativo (módulo Asistencia). */
  autoRefreshEnabled?: boolean;
  autoRefreshIntervalMinutes?: number;
  autoRefreshWindowStart?: string;
  autoRefreshWindowEnd?: string;
  lastAutoRefreshAt?: string;
  /** Sync programado de nómina/turnos → app_usuarios (panel + cron). */
  staffSyncEnabled?: boolean;
  /** Intervalo del sync de usuarios (minutos). Default 60. */
  staffSyncIntervalMinutes?: number;
  lastStaffSyncAt?: string;
  lastStaffSyncOk?: boolean;
  lastStaffSyncMessage?: string;
  /** Catálogo de endpoints Buk adicionales para explorar datos. */
  catalogEndpoints?: BukApiEndpointConfig[];
}

/** Snapshot diario de dotación (persistido localmente). */
export interface AsistenciaDailySnapshot {
  id: string;
  dateYmd: string;
  sedeName: string;
  capturedAt: string;
  source: 'manual' | 'auto';
  workingCount: number;
  absentCount: number;
  lateCount: number;
  criticalAbsentCount: number;
  totalRequired: number;
  totalPresent: number;
  bukRecordsOnDate: number;
}

/** Contexto operativo para alertas globales (session/local). */
export interface AsistenciaOperationalContext {
  updatedAt: string;
  dateYmd: string;
  cacheFetchedAt: number | null;
  criticalMissing: { id: string; fullName: string; cargoLabel: string; sedeName: string }[];
  coverageGaps: { sedeName: string; cargoLabel: string; required: number; present: number }[];
  bukEnabled: boolean;
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
