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

/** Lista de colaboradores para autocomplete (usuarios de Gestión; asistencia solo si no hay match). */
export function buildStaffOptions(input: {
  users: User[];
  asistencia?: AsistenciaSettings | null;
  visibleSedes?: string[];
  /** false = solo usuarios de Gestión (p. ej. entrega de uniformes). */
  includeAsistencia?: boolean;
}): StaffOption[] {
  const map = new Map<string, StaffOption>();
  const identityKeys = new Set<string>();
  const asistencia = mergeAsistenciaSettings(input.asistencia);
  const sedeNames = input.visibleSedes ?? [];
  const includeAsistencia = input.includeAsistencia !== false;

  const normalizePersonName = (name: string): string =>
    name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ');

  const register = (opt: StaffOption, identityKey: string) => {
    if (identityKeys.has(identityKey)) return;
    identityKeys.add(identityKey);
    map.set(opt.id, opt);
  };

  const staffIdentityKey = (email: string | undefined, name: string): string => {
    const normalizedEmail = email?.trim().toLowerCase();
    if (normalizedEmail) return `email:${normalizedEmail}`;
    return `name:${normalizePersonName(name)}`;
  };

  const userEmails = new Set<string>();
  const userNames = new Set<string>();

  for (const u of input.users) {
    if (u.status === 'inactive') continue;
    const rawSede = u.location ?? u.sedes?.[0] ?? 'Principal';
    const homeSede =
      sedeNames.length > 0 ? resolveCanonicalSedeName(rawSede, sedeNames) : rawSede;
    const opt: StaffOption = {
      id: `user-${u.id}`,
      userId: u.id,
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
    if (u.email?.trim()) userEmails.add(u.email.trim().toLowerCase());
    userNames.add(normalizePersonName(u.name));
    register(opt, staffIdentityKey(u.email, u.name));
  }

  if (includeAsistencia) {
    const asistSeen = new Set<string>();
    for (const s of asistencia.staff ?? []) {
      const email = (s.email ?? '').trim().toLowerCase();
      const nameKey = normalizePersonName(s.fullName);
      if (email && userEmails.has(email)) continue;
      if (userNames.has(nameKey)) continue;

      const identityKey = staffIdentityKey(s.email, s.fullName);
      if (asistSeen.has(identityKey)) continue;
      asistSeen.add(identityKey);

      const id = `asist-${s.id}`;
      if (map.has(id)) continue;
      const rawSede = s.sedeName;
      const homeSede =
        sedeNames.length > 0 ? resolveCanonicalSedeName(rawSede, sedeNames) : rawSede;
      const opt: StaffOption = {
        id,
        label: s.fullName,
        name: s.fullName,
        jobTitle: s.cargoLabel,
        workArea: s.area ? mapAreaFromAsistencia(s.area) : 'Otro',
        contractType: 'No registrado',
        homeSede,
        seniorityMonths: 0,
      };
      register(opt, identityKey);
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
