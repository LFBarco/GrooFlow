import { differenceInCalendarDays, differenceInMonths, parseISO } from 'date-fns';

import type { AsistenciaSettings } from '../types/asistencia';
import type { User } from '../types';
import type {
  AccidentesFilters,
  AccidentesKpiConfig,
  AccidentesSettings,
  AccidentEventType,
  AccidentWorkflowStatus,
  WorkplaceAccidentRecord,
} from '../types/accidentes';
import { mergeAsistenciaSettings } from './asistenciaData';
import { normalizeSedeKey, resolveCanonicalSedeName } from './gestionSedes';

export const ACCIDENTES_SETTINGS_KV_KEY = 'settings:accidentes-trabajo';

export function defaultAccidentesConfig(): AccidentesKpiConfig {
  return {
    hoursPerWorkerMonth: 208,
    dailyLostDayCost: 120,
  };
}

export function defaultAccidentesSettings(): AccidentesSettings {
  return {
    version: 1,
    records: [],
    config: defaultAccidentesConfig(),
  };
}

export function mergeAccidentesSettings(
  partial?: Partial<AccidentesSettings> | null
): AccidentesSettings {
  const base = defaultAccidentesSettings();
  if (!partial || typeof partial !== 'object') return { ...base };
  return {
    version: 1,
    records: Array.isArray(partial.records)
      ? partial.records.map(normalizeAccidentRecord)
      : base.records,
    config: { ...base.config, ...(partial.config ?? {}) },
  };
}

export function normalizeAccidentRecord(
  record: WorkplaceAccidentRecord
): WorkplaceAccidentRecord {
  return {
    ...record,
    eventType: record.eventType ?? 'accidente',
    workflowStatus: record.workflowStatus ?? 'reportado',
    attachments: record.attachments ?? [],
    correctiveActions: record.correctiveActions ?? [],
  };
}

export const ACCIDENT_WORKFLOW_ORDER: AccidentWorkflowStatus[] = [
  'reportado',
  'investigacion',
  'acciones',
  'cerrado',
];

export function nextAccidentWorkflowStatus(
  current: AccidentWorkflowStatus
): AccidentWorkflowStatus | null {
  const idx = ACCIDENT_WORKFLOW_ORDER.indexOf(current);
  if (idx < 0 || idx >= ACCIDENT_WORKFLOW_ORDER.length - 1) return null;
  return ACCIDENT_WORKFLOW_ORDER[idx + 1]!;
}

export function newAccidentAttachmentId(): string {
  return `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function newCorrectiveActionId(): string {
  return `ca_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function newAccidentId(): string {
  return `acc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function upsertAccidentRecord(
  settings: AccidentesSettings,
  record: Omit<WorkplaceAccidentRecord, 'id' | 'createdAt' | 'updatedAt'> & {
    id?: string;
    createdAt?: string;
  }
): AccidentesSettings {
  const id = record.id ?? newAccidentId();
  const existing = settings.records.find((r) => r.id === id);
  const next: WorkplaceAccidentRecord = normalizeAccidentRecord({
    ...record,
    id,
    createdAt: existing?.createdAt ?? record.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as WorkplaceAccidentRecord);
  const rest = settings.records.filter((r) => r.id !== id);
  return { ...settings, records: [next, ...rest] };
}

export function removeAccidentRecord(
  settings: AccidentesSettings,
  recordId: string
): AccidentesSettings {
  return { ...settings, records: settings.records.filter((r) => r.id !== recordId) };
}

function hasLostTime(r: WorkplaceAccidentRecord): boolean {
  return r.estimatedLostDays > 0 || r.immediateCare === 'dias_baja';
}

export function filterAccidentRecords(
  records: WorkplaceAccidentRecord[],
  filters: AccidentesFilters
): WorkplaceAccidentRecord[] {
  const q = filters.search?.trim().toLowerCase() ?? '';
  return records.filter((r) => {
    if (filters.dateFrom && r.eventDate < filters.dateFrom) return false;
    if (filters.dateTo && r.eventDate > filters.dateTo) return false;
    if (filters.sede && filters.sede !== 'Todas' && r.sede !== filters.sede) return false;
    if (filters.workArea && filters.workArea !== 'Todas' && r.workArea !== filters.workArea) return false;
    if (filters.workShift && filters.workShift !== 'Todas' && r.workShift !== filters.workShift) return false;
    if (filters.bodyPart && filters.bodyPart !== 'Todas' && r.bodyPart !== filters.bodyPart) return false;
    if (
      filters.injuryNature &&
      filters.injuryNature !== 'Todas' &&
      r.injuryNature !== filters.injuryNature
    ) {
      return false;
    }
    if (filters.severity && filters.severity !== 'Todas' && r.severity !== filters.severity) {
      return false;
    }
    if (filters.withLostTimeOnly && !hasLostTime(r)) return false;
    if (filters.eventType && filters.eventType !== 'Todas') {
      const et: AccidentEventType = r.eventType ?? 'accidente';
      if (et !== filters.eventType) return false;
    }
    if (filters.workflowStatus && filters.workflowStatus !== 'Todas') {
      const ws: AccidentWorkflowStatus = r.workflowStatus ?? 'reportado';
      if (filters.workflowStatus === '__open__') {
        if (ws === 'cerrado') return false;
      } else if (ws !== filters.workflowStatus) {
        return false;
      }
    }
    if (q) {
      const haystack = [r.affectedName, r.jobTitle, r.workArea, r.exactLocation, r.description ?? '']
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function countAccidentesActiveFilters(filters: AccidentesFilters): number {
  let n = 0;
  if (filters.search?.trim()) n += 1;
  if (filters.sede !== 'Todas') n += 1;
  if (filters.workArea !== 'Todas') n += 1;
  if (filters.workShift !== 'Todas') n += 1;
  if (filters.bodyPart !== 'Todas') n += 1;
  if (filters.injuryNature !== 'Todas') n += 1;
  if (filters.severity !== 'Todas') n += 1;
  if (filters.withLostTimeOnly) n += 1;
  if (filters.eventType !== 'Todas') n += 1;
  if (filters.workflowStatus !== 'Todas') n += 1;
  return n;
}

export function computeSeniorityMonths(hireDate?: string, eventDate?: string): number {
  if (!hireDate) return 0;
  try {
    const hire = parseISO(`${hireDate}T12:00:00`);
    const event = eventDate ? parseISO(`${eventDate}T12:00:00`) : new Date();
    return Math.max(0, differenceInMonths(event, hire));
  } catch {
    return 0;
  }
}

export function formatSeniorityLabel(months: number): string {
  if (months < 1) return 'Menos de 1 mes';
  if (months < 12) return `${months} mes${months === 1 ? '' : 'es'}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} año${years === 1 ? '' : 's'}`;
  return `${years}a ${rem}m`;
}

export interface StaffOption {
  id: string;
  label: string;
  userId?: string;
  /** Id en organigrama Asistencia (maestro proyectado). */
  asistenciaStaffId?: string;
  bukEmployeeId?: number;
  /** DNI/RUT canónico (solo dígitos preferible). */
  documentNumber?: string;
  email?: string;
  name: string;
  jobTitle: string;
  workArea: string;
  contractType: string;
  homeSede: string;
  seniorityMonths: number;
  hireDate?: string;
  uniformSizes?: Partial<Record<string, string>>;
}

const CONTRACT_LABELS: Record<string, string> = {
  planta: 'Planta / Indeterminado',
  temporal: 'Temporal',
  practicante: 'Practicante',
  honorarios: 'Honorarios',
  locacion: 'Locación de servicios',
  otro: 'Otro',
};

export function contractTypeLabel(type?: string): string {
  if (!type) return 'No registrado';
  return CONTRACT_LABELS[type] ?? type;
}

function docKey(raw?: string | null): string {
  return String(raw ?? '').replace(/\D+/g, '');
}

function normalizePersonName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ');
}

/** Resuelve la opción del select al editar un registro (Fase 6). */
export function resolveStaffOptionKey(
  record: {
    userId?: string;
    asistenciaStaffId?: string;
    bukEmployeeId?: number;
    documentNumber?: string;
  },
  options: StaffOption[]
): string {
  if (record.asistenciaStaffId) {
    const id = `asist-${record.asistenciaStaffId}`;
    if (options.some((o) => o.id === id || o.asistenciaStaffId === record.asistenciaStaffId)) {
      return options.find((o) => o.asistenciaStaffId === record.asistenciaStaffId)?.id ?? id;
    }
  }
  if (record.bukEmployeeId) {
    const byBuk = options.find((o) => o.bukEmployeeId === record.bukEmployeeId);
    if (byBuk) return byBuk.id;
  }
  if (record.userId) {
    const byUser = options.find((o) => o.userId === record.userId);
    if (byUser) return byUser.id;
    const legacy = `user-${record.userId}`;
    if (options.some((o) => o.id === legacy)) return legacy;
  }
  const doc = docKey(record.documentNumber);
  if (doc) {
    const byDoc = options.find((o) => docKey(o.documentNumber) === doc);
    if (byDoc) return byDoc.id;
  }
  return 'manual';
}

/**
 * Lista de colaboradores (Fase 6): organigrama/maestro primero + usuarios no cubiertos.
 * Identidad: bukEmployeeId → DNI → usuarioId → email → nombre.
 */
export function buildStaffOptions(input: {
  users: User[];
  asistencia?: AsistenciaSettings | null;
  visibleSedes?: string[];
  /** false = solo usuarios Gestión (legado). Default true = organigrama + users. */
  includeAsistencia?: boolean;
}): StaffOption[] {
  const map = new Map<string, StaffOption>();
  const identityKeys = new Set<string>();
  const asistencia = mergeAsistenciaSettings(input.asistencia);
  const sedeNames = input.visibleSedes ?? [];
  const includeAsistencia = input.includeAsistencia !== false;
  const staffList = asistencia.staff ?? [];
  const hasOrganigrama = includeAsistencia && staffList.length > 0;

  const register = (opt: StaffOption, identityKey: string) => {
    if (identityKeys.has(identityKey)) return;
    identityKeys.add(identityKey);
    map.set(opt.id, opt);
  };

  const identityKeyFor = (parts: {
    bukEmployeeId?: number;
    documentNumber?: string;
    userId?: string;
    email?: string;
    name: string;
  }): string => {
    if (parts.bukEmployeeId) return `buk:${parts.bukEmployeeId}`;
    const doc = docKey(parts.documentNumber);
    if (doc) return `doc:${doc}`;
    if (parts.userId) return `user:${parts.userId}`;
    const email = parts.email?.trim().toLowerCase();
    if (email) return `email:${email}`;
    return `name:${normalizePersonName(parts.name)}`;
  };

  const usersById = new Map(input.users.filter((u) => u.status !== 'inactive').map((u) => [u.id, u]));
  const usersByEmail = new Map<string, User>();
  const usersByDoc = new Map<string, User>();
  for (const u of input.users) {
    if (u.status === 'inactive') continue;
    const em = u.email?.trim().toLowerCase();
    if (em) usersByEmail.set(em, u);
    const d = docKey(u.documentNumber);
    if (d) usersByDoc.set(d, u);
  }

  const linkedUserForStaff = (s: (typeof staffList)[number]): User | undefined => {
    const uid = String(s.usuarioId ?? '').trim();
    if (uid && usersById.has(uid)) return usersById.get(uid);
    const em = (s.email ?? '').trim().toLowerCase();
    if (em && usersByEmail.has(em)) return usersByEmail.get(em);
    const d = docKey(s.rut);
    if (d && usersByDoc.has(d)) return usersByDoc.get(d);
    return undefined;
  };

  const coveredUserIds = new Set<string>();
  const coveredDocs = new Set<string>();
  const coveredEmails = new Set<string>();

  if (hasOrganigrama) {
    for (const s of staffList) {
      const linked = linkedUserForStaff(s);
      if (linked) coveredUserIds.add(linked.id);
      const doc = docKey(s.rut) || docKey(linked?.documentNumber);
      if (doc) coveredDocs.add(doc);
      const email = (s.email ?? linked?.email ?? '').trim().toLowerCase();
      if (email) coveredEmails.add(email);

      const rawSede = s.sedeName;
      const homeSede =
        sedeNames.length > 0 ? resolveCanonicalSedeName(rawSede, sedeNames) : rawSede;
      const opt: StaffOption = {
        id: `asist-${s.id}`,
        asistenciaStaffId: s.id,
        bukEmployeeId: s.bukEmployeeId,
        documentNumber: doc || undefined,
        email: email || undefined,
        userId: linked?.id ?? (s.usuarioId ? String(s.usuarioId) : undefined),
        label: s.fullName,
        name: s.fullName,
        jobTitle: s.cargoLabel || linked?.jobTitle || linked?.role || 'Colaborador',
        workArea: s.area ? mapAreaFromAsistencia(s.area) : linked?.workArea || 'Otro',
        contractType: contractTypeLabel(linked?.contractType),
        homeSede,
        seniorityMonths: computeSeniorityMonths(linked?.hireDate),
        hireDate: linked?.hireDate,
        uniformSizes: linked?.uniformSizes,
      };
      register(
        opt,
        identityKeyFor({
          bukEmployeeId: opt.bukEmployeeId,
          documentNumber: opt.documentNumber,
          userId: opt.userId,
          email: opt.email,
          name: opt.name,
        })
      );
    }
  }

  for (const u of input.users) {
    if (u.status === 'inactive') continue;
    const doc = docKey(u.documentNumber);
    const email = u.email?.trim().toLowerCase();
    if (hasOrganigrama) {
      if (coveredUserIds.has(u.id)) continue;
      if (doc && coveredDocs.has(doc)) continue;
      if (email && coveredEmails.has(email)) continue;
    }
    const rawSede = u.location ?? u.sedes?.[0] ?? 'Principal';
    const homeSede =
      sedeNames.length > 0 ? resolveCanonicalSedeName(rawSede, sedeNames) : rawSede;
    const opt: StaffOption = {
      id: `user-${u.id}`,
      userId: u.id,
      documentNumber: doc || undefined,
      email: email || undefined,
      label: u.name,
      name: u.name,
      jobTitle: u.jobTitle ?? u.role,
      workArea: u.workArea ?? 'Otro',
      contractType: contractTypeLabel(u.contractType),
      homeSede,
      seniorityMonths: computeSeniorityMonths(u.hireDate),
      hireDate: u.hireDate,
      uniformSizes: u.uniformSizes,
    };
    register(
      opt,
      identityKeyFor({
        documentNumber: opt.documentNumber,
        userId: opt.userId,
        email: opt.email,
        name: opt.name,
      })
    );
  }

  // Sin organigrama: agregar staff asistencia residual (legado Accidentes).
  if (includeAsistencia && !hasOrganigrama) {
    for (const s of staffList) {
      const email = (s.email ?? '').trim().toLowerCase();
      const doc = docKey(s.rut);
      if (email && [...map.values()].some((o) => o.email === email)) continue;
      if (doc && [...map.values()].some((o) => docKey(o.documentNumber) === doc)) continue;
      if ([...map.values()].some((o) => normalizePersonName(o.name) === normalizePersonName(s.fullName))) {
        continue;
      }
      const rawSede = s.sedeName;
      const homeSede =
        sedeNames.length > 0 ? resolveCanonicalSedeName(rawSede, sedeNames) : rawSede;
      const opt: StaffOption = {
        id: `asist-${s.id}`,
        asistenciaStaffId: s.id,
        bukEmployeeId: s.bukEmployeeId,
        documentNumber: doc || undefined,
        email: email || undefined,
        label: s.fullName,
        name: s.fullName,
        jobTitle: s.cargoLabel,
        workArea: s.area ? mapAreaFromAsistencia(s.area) : 'Otro',
        contractType: 'No registrado',
        homeSede,
        seniorityMonths: 0,
      };
      register(
        opt,
        identityKeyFor({
          bukEmployeeId: opt.bukEmployeeId,
          documentNumber: opt.documentNumber,
          email: opt.email,
          name: opt.name,
        })
      );
    }
  }

  let list = [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const displaySeen = new Set<string>();
  list = list.filter((s) => {
    const key = `${normalizePersonName(s.name)}::${normalizeSedeKey(s.homeSede)}::${(s.jobTitle ?? '').trim().toLowerCase()}`;
    if (displaySeen.has(key)) return false;
    displaySeen.add(key);
    return true;
  });

  if (input.visibleSedes?.length) {
    list = list.filter((s) => {
      const key = normalizeSedeKey(s.homeSede);
      return input.visibleSedes!.some((v) => normalizeSedeKey(v) === key);
    });
  }
  return list;
}

function mapAreaFromAsistencia(area: string): string {
  const lower = area.toLowerCase();
  if (lower.includes('med') || lower.includes('vet')) return 'Área Médica';
  if (lower.includes('groom') || lower.includes('pelu')) return 'Grooming / Peluquería';
  if (lower.includes('admin') || lower.includes('counter') || lower.includes('recep')) {
    return 'Recepción / Counter';
  }
  if (lower.includes('mant')) return 'Mantenimiento';
  if (lower.includes('limp')) return 'Limpieza';
  if (lower.includes('chofer') || lower.includes('flota')) return 'Flota / Choferes';
  return 'Otro';
}

export function daysWithoutAccident(records: WorkplaceAccidentRecord[]): number {
  const withLostTime = records
    .filter(hasLostTime)
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  if (withLostTime.length === 0) {
    return differenceInCalendarDays(new Date(), parseISO('2020-01-01'));
  }
  const last = withLostTime[0]!;
  return differenceInCalendarDays(new Date(), parseISO(`${last.eventDate}T12:00:00`));
}

export function estimateManHours(
  activeWorkers: number,
  config: AccidentesKpiConfig,
  monthsInPeriod: number
): number {
  return activeWorkers * config.hoursPerWorkerMonth * Math.max(monthsInPeriod, 1);
}

export function countActiveWorkers(users: User[], config: AccidentesKpiConfig): number {
  const active = users.filter((u) => u.status !== 'inactive').length;
  return Math.max(active, config.manualHeadcount ?? 0, 1);
}
