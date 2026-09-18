/** Fila normalizada de empleado Buk.pe para tablas RRHH. */
export type RrhhIdentityStatus =
  | 'linked'
  | 'pending_access'
  | 'terminated_still_active'
  | 'terminated'
  | 'unmatched_doc'
  | 'unmatched';

export interface BukPeEmployeeRow {
  bukId: number;
  personId?: number;
  fullName: string;
  firstName?: string;
  surname?: string;
  secondSurname?: string;
  documentType?: string;
  documentNumber?: string;
  email?: string;
  personalEmail?: string;
  phone?: string;
  officePhone?: string;
  status: string;
  isActive: boolean;
  isTerminated: boolean;
  birthday?: string;
  gender?: string;
  nationality?: string;
  countryCode?: string;
  civilStatus?: string;
  address?: string;
  street?: string;
  streetNumber?: string;
  officeNumber?: string;
  city?: string;
  region?: string;
  distrito?: string;
  departamento?: string;
  locationId?: string;
  codeSheet?: string;
  periodType?: string;
  university?: string;
  degree?: string;
  privateRole?: boolean;
  /** Cargo (roles.name) */
  cargo?: string;
  cargoCode?: string;
  roleId?: number;
  roleDescription?: string;
  roleRequirements?: string;
  /**
   * Familia de cargos (role_family.name).
   * Histórico: se usaba como «área» en UI.
   */
  area?: string;
  roleFamilyId?: number;
  roleFamilyName?: string;
  roleFamilyQuantity?: number;
  /** Área organizacional (organization/areas vía current_job.area_id). */
  orgAreaId?: number;
  orgAreaName?: string;
  orgAreaParentName?: string;
  orgAreaStatus?: string;
  orgAreaCostCenter?: string;
  orgAreaDepth?: number;
  companyId?: number;
  weeklyHours?: number;
  costCenter?: string;
  periodicity?: string;
  frequency?: string;
  workingScheduleType?: string;
  bossId?: number;
  bossDocument?: string;
  noticeDate?: string;
  contractSubscriptionDate?: string;
  sede?: string;
  contractType?: string;
  startDate?: string;
  endDate?: string;
  activeSince?: string;
  activeUntil?: string;
  terminationReason?: string;
  pensionFund?: string;
  pensionRegime?: string;
  healthCompany?: string;
  paymentMethod?: string;
  paymentPeriod?: string;
  paymentCurrency?: string;
  accountType?: string;
  advancePayment?: string;
  bank?: string;
  retired?: boolean;
  retirementRegime?: string;
  /** Campos enriquecidos desde Buk Asistencia (Ctrlit). */
  rutAsistencia?: string;
  recintoNombre?: string;
  recintoCodigo?: string;
  recintoLabel?: string;
  areaAsistencia?: string;
  especialidad?: string;
  supervisor?: string;
  contratoAsistencia?: string;
  turnoAsistencia?: string;
  codigoTurno?: string;
  ultimaMarcacionEntrada?: string;
  ultimaMarcacionSalida?: string;
  ultimaAsistenciaDia?: string;
  turnoNoche?: boolean;
  art22?: boolean;
  trabIdAsistencia?: number;
  asistenciaEnriched?: boolean;
  asistenciaSyncedAt?: string;
  /** Metadatos de sincronización incremental. */
  firstSyncedAt?: string;
  lastUpdatedAt?: string;
  contentHash?: string;
  missingFromSource?: boolean;
  /** Usuario Gestión vinculado (columna BD). */
  linkedUsuarioId?: string | null;
  /** DNI normalizado (solo dígitos) para cruce. */
  documentKey?: string;
  /**
   * linked | pending_access | terminated_still_active | terminated | unmatched_doc | unmatched
   */
  identityStatus?: RrhhIdentityStatus;
  raw?: Record<string, unknown>;
}

export interface RrhhSyncStats {
  added: number;
  updated: number;
  unchanged: number;
  removedFromSource: number;
  total: number;
}

export type RrhhUserLinkMethod = 'email' | 'personal_email' | 'document' | 'name' | 'manual';

export interface RrhhUserLink {
  userId: string;
  bukEmployeeId: number;
  matchMethod: RrhhUserLinkMethod;
  linkedAt: string;
  employeeName?: string;
  employeeEmail?: string;
}

export interface RrhhSyncLogEntry {
  at: string;
  ok: boolean;
  message: string;
  employeesLoaded?: number;
  usersDisabled?: number;
  usersLinked?: number;
  stats?: RrhhSyncStats;
  asistenciaMatched?: number;
  durationMs?: number;
}

export interface RrhhColumnDef {
  id: string;
  label: string;
  defaultVisible?: boolean;
  group?: string;
}

export interface RrhhSettings {
  visibleColumns: string[];
  autoDisableOnTermination: boolean;
  /** Enriquecer colaboradores con recinto, turno y marcaciones de Buk Asistencia. */
  includeAsistenciaEnrichment?: boolean;
  /** Sync programado Buk.pe → BD. */
  staffSyncEnabled?: boolean;
  /** Intervalo en minutos (default 60). El cron corre cada 15 min y respeta este valor. */
  staffSyncIntervalMinutes?: number;
  lastSyncAt?: string;
  lastSyncOk?: boolean;
  lastSyncMessage?: string;
  lastSyncStats?: RrhhSyncStats;
  /** Cola pendientes de acceso (Fase 2/3). */
  pendingAccessCount?: number;
  pendingAccessAt?: string;
  /** Última corrida del orquestador /jobs/pipelines. */
  lastPipelineAt?: string;
  lastPipelineOk?: boolean;
  lastPipelineSummary?: string;
  employees: BukPeEmployeeRow[];
  userLinks: RrhhUserLink[];
  syncLog: RrhhSyncLogEntry[];
}

export interface RrhhDashboardKpis {
  total: number;
  active: number;
  terminated: number;
  linkedUsers: number;
  unlinkedActive: number;
  pendingDisable: number;
  withAsistencia: number;
  withoutAsistencia: number;
  byArea: { area: string; count: number }[];
  byCargo: { cargo: string; count: number }[];
  byRecinto: { recinto: string; count: number }[];
}

export interface RrhhRecommendation {
  id: string;
  severity: 'info' | 'warning' | 'action';
  title: string;
  detail: string;
}
