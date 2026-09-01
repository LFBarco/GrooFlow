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
  raw?: Record<string, unknown>;
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
  lastSyncAt?: string;
  lastSyncOk?: boolean;
  lastSyncMessage?: string;
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
  byArea: { area: string; count: number }[];
  byCargo: { cargo: string; count: number }[];
}

export interface RrhhRecommendation {
  id: string;
  severity: 'info' | 'warning' | 'action';
  title: string;
  detail: string;
}
