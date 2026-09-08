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
  /** Sede principal (para el campo Sede del formulario). */
  homeSede: string;
  /** Etiqueta de sedes de Gestión (puede listar varias). */
  sedesLabel: string;
  /** Claves normalizadas de todas las sedes (filtro visible). */
  sedeKeys?: string[];
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

/** Cargo oficial = puesto de Gestión. No usar rol GrooFlow (groomer) ni cargo Buk. */
function resolveGestionJobTitle(u: {
  jobTitle?: string;
  workArea?: string;
  roleLabel?: string;
  nivelNombre?: string;
}): string {
  const puesto = u.jobTitle?.trim();
  if (puesto) return puesto;
  const area = u.workArea?.trim();
  if (area) return area;
  return 'Sin cargo';
}

/** Lista sedes de app_usuarios; compacta si hay muchas (como en /config/usuarios). */
function formatSedesLabel(sedes: string[]): string {
  const unique = [...new Set(sedes.map((s) => s.trim()).filter(Boolean))];
  if (unique.length === 0) return 'Sin sede';
  if (unique.length <= 3) return unique.join(', ');
  return `${unique.slice(0, 3).join(', ')} +${unique.length - 3}`;
}

function resolveUserSedes(
  u: { sedes?: string[]; location?: string | null },
  matchedSede: string | undefined,
  catalog: string[]
): { primary: string; label: string; keys: string[] } {
  const raw =
    u.sedes && u.sedes.length > 0
      ? u.sedes
      : [u.location, matchedSede].filter((s): s is string => !!String(s ?? '').trim());
  const names = raw
    .map((s) => (catalog.length > 0 ? resolveCanonicalSedeName(String(s), catalog) : String(s).trim()))
    .filter(Boolean);
  const unique = [...new Set(names)];
  const primary = unique[0] || matchedSede || 'Principal';
  return {
    primary: catalog.length > 0 ? resolveCanonicalSedeName(primary, catalog) : primary,
    label: formatSedesLabel(unique.length ? unique : [primary]),
    keys: unique.map((s) => normalizeSedeKey(s)),
  };
}

function normalizePersonName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ');
}

/** Resuelve la opción del select al editar un registro. Preferencia: usuario Gestión. */
export function resolveStaffOptionKey(
  record: {
    userId?: string;
    asistenciaStaffId?: string;
    bukEmployeeId?: number;
    documentNumber?: string;
  },
  options: StaffOption[]
): string {
  if (record.userId) {
    const byUser = options.find((o) => o.userId === record.userId);
    if (byUser) return byUser.id;
    const legacy = `user-${record.userId}`;
    if (options.some((o) => o.id === legacy)) return legacy;
  }
  if (record.asistenciaStaffId) {
    const byAsist = options.find((o) => o.asistenciaStaffId === record.asistenciaStaffId);
    if (byAsist) return byAsist.id;
    const id = `asist-${record.asistenciaStaffId}`;
    if (options.some((o) => o.id === id)) return id;
  }
  if (record.bukEmployeeId) {
    const byBuk = options.find((o) => o.bukEmployeeId === record.bukEmployeeId);
    if (byBuk) return byBuk.id;
  }
  const doc = docKey(record.documentNumber);
  if (doc) {
    const byDoc = options.find((o) => docKey(o.documentNumber) === doc);
    if (byDoc) return byDoc.id;
  }
  return 'manual';
}

/**
 * Lista de colaboradores: Gestión = maestro de persona/cargo.
 * Organigrama Asistencia solo aporta ids de cruce (asistenciaStaffId / bukEmployeeId).
 * Buk no define el cargo mostrado en Uniformes / Accidentes.
 */
export function buildStaffOptions(input: {
  users: User[];
  asistencia?: AsistenciaSettings | null;
  visibleSedes?: string[];
  /** Si false, ignora organigrama (solo Gestión). Default true = enriquece con ids Asistencia. */
  includeAsistencia?: boolean;
}): StaffOption[] {
  const map = new Map<string, StaffOption>();
  const identityKeys = new Set<string>();
  const asistencia = mergeAsistenciaSettings(input.asistencia);
  const sedeNames = input.visibleSedes ?? [];
  const includeAsistencia = input.includeAsistencia !== false;
  const staffList = includeAsistencia ? (asistencia.staff ?? []) : [];

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
    if (parts.userId) return `user:${parts.userId}`;
    const doc = docKey(parts.documentNumber);
    if (doc) return `doc:${doc}`;
    if (parts.bukEmployeeId) return `buk:${parts.bukEmployeeId}`;
    const email = parts.email?.trim().toLowerCase();
    if (email) return `email:${email}`;
    return `name:${normalizePersonName(parts.name)}`;
  };

  const staffByUserId = new Map<string, (typeof staffList)[number]>();
  const staffByEmail = new Map<string, (typeof staffList)[number]>();
  const staffByDoc = new Map<string, (typeof staffList)[number]>();
  for (const s of staffList) {
    const uid = String(s.usuarioId ?? '').trim();
    if (uid) staffByUserId.set(uid, s);
    const em = (s.email ?? '').trim().toLowerCase();
    if (em) staffByEmail.set(em, s);
    const d = docKey(s.rut);
    if (d) staffByDoc.set(d, s);
  }

  const coveredStaffIds = new Set<string>();

  for (const u of input.users) {
    if (u.status === 'inactive') continue;
    const doc = docKey(u.documentNumber);
    const email = u.email?.trim().toLowerCase();
    const matched =
      (u.id ? staffByUserId.get(u.id) : undefined) ||
      (email ? staffByEmail.get(email) : undefined) ||
      (doc ? staffByDoc.get(doc) : undefined);
    if (matched) coveredStaffIds.add(matched.id);

    const sedesInfo = resolveUserSedes(u, matched?.sedeName, sedeNames);
    const opt: StaffOption = {
      id: `user-${u.id}`,
      userId: u.id,
      asistenciaStaffId: matched?.id,
      bukEmployeeId: matched?.bukEmployeeId,
      documentNumber: doc || docKey(matched?.rut) || undefined,
      email: email || matched?.email || undefined,
      label: u.name,
      name: u.name,
      jobTitle: resolveGestionJobTitle(u),
      workArea: u.workArea ?? (matched?.area ? mapAreaFromAsistencia(matched.area) : 'Otro'),
      contractType: contractTypeLabel(u.contractType),
      homeSede: sedesInfo.primary,
      sedesLabel: sedesInfo.label,
      sedeKeys: sedesInfo.keys,
      seniorityMonths: computeSeniorityMonths(u.hireDate),
      hireDate: u.hireDate,
      uniformSizes: u.uniformSizes,
    };
    register(
      opt,
      identityKeyFor({
        userId: opt.userId,
        documentNumber: opt.documentNumber,
        bukEmployeeId: opt.bukEmployeeId,
        email: opt.email,
        name: opt.name,
      })
    );
  }

  for (const s of staffList) {
    if (coveredStaffIds.has(s.id)) continue;
    const doc = docKey(s.rut);
    const email = (s.email ?? '').trim().toLowerCase();
    const rawSede = s.sedeName;
    const homeSede =
      sedeNames.length > 0 ? resolveCanonicalSedeName(rawSede, sedeNames) : rawSede;
    const opt: StaffOption = {
      id: `asist-${s.id}`,
      asistenciaStaffId: s.id,
      bukEmployeeId: s.bukEmployeeId,
      documentNumber: doc || undefined,
      email: email || undefined,
      userId: s.usuarioId ? String(s.usuarioId) : undefined,
      label: s.fullName,
      name: s.fullName,
      jobTitle: s.cargoLabel?.trim() || 'Sin cargo',
      workArea: s.area ? mapAreaFromAsistencia(s.area) : 'Otro',
      contractType: 'No registrado',
      homeSede,
      sedesLabel: homeSede || 'Sin sede',
      sedeKeys: homeSede ? [normalizeSedeKey(homeSede)] : [],
      seniorityMonths: 0,
    };
    register(
      opt,
      identityKeyFor({
        userId: opt.userId,
        documentNumber: opt.documentNumber,
        bukEmployeeId: opt.bukEmployeeId,
        email: opt.email,
        name: opt.name,
      })
    );
  }

  let list = [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const displaySeen = new Set<string>();
  list = list.filter((s) => {
    const key = `${normalizePersonName(s.name)}::${normalizeSedeKey(s.homeSede)}`;
    if (displaySeen.has(key)) return false;
    displaySeen.add(key);
    return true;
  });

  if (input.visibleSedes?.length) {
    const visibleKeys = new Set(input.visibleSedes.map((v) => normalizeSedeKey(v)));
    list = list.filter((s) => {
      const keys =
        s.sedeKeys && s.sedeKeys.length > 0
          ? s.sedeKeys
          : [normalizeSedeKey(s.homeSede)];
      return keys.some((k) => visibleKeys.has(k));
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
