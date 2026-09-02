/** Fila normalizada de empleado Buk.pe para tablas RRHH. */
export interface BukPeEmployeeRow {
  bukId: number;
  personId?: number;
  fullName: string;
  firstName?: string;
  surname?: string;
  documentType?: string;
  documentNumber?: string;
  email?: string;
  personalEmail?: string;
  phone?: string;
  status: string;
  isActive: boolean;
  isTerminated: boolean;
  birthday?: string;
  gender?: string;
  nationality?: string;
  address?: string;
  distrito?: string;
  departamento?: string;
  cargo?: string;
  cargoCode?: string;
  area?: string;
  sede?: string;
  contractType?: string;
  startDate?: string;
  endDate?: string;
  activeSince?: string;
  activeUntil?: string;
  pensionFund?: string;
  healthCompany?: string;
  paymentMethod?: string;
  bank?: string;
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
  lastSyncAt?: string;
  lastSyncOk?: boolean;
  lastSyncMessage?: string;
  lastSyncStats?: RrhhSyncStats;
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
