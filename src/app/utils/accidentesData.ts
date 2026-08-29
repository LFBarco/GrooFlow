import { differenceInCalendarDays, differenceInMonths, parseISO } from 'date-fns';

import type { AsistenciaSettings } from '../types/asistencia';
import type { User } from '../types';
import type {
  AccidentesFilters,
  AccidentesKpiConfig,
  AccidentesSettings,
  WorkplaceAccidentRecord,
} from '../types/accidentes';
import { mergeAsistenciaSettings } from './asistenciaData';

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
    records: Array.isArray(partial.records) ? partial.records : base.records,
    config: { ...base.config, ...(partial.config ?? {}) },
  };
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
  const next: WorkplaceAccidentRecord = {
    ...record,
    id,
    createdAt: existing?.createdAt ?? record.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const rest = settings.records.filter((r) => r.id !== id);
  return { ...settings, records: [next, ...rest] };
}

export function removeAccidentRecord(
  settings: AccidentesSettings,
  recordId: string
): AccidentesSettings {
  return { ...settings, records: settings.records.filter((r) => r.id !== recordId) };
}

export function filterAccidentRecords(
  records: WorkplaceAccidentRecord[],
  filters: AccidentesFilters
): WorkplaceAccidentRecord[] {
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
    return true;
  });
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

/** Lista de colaboradores para autocomplete (usuarios + asistencia). */
export function buildStaffOptions(input: {
  users: User[];
  asistencia?: AsistenciaSettings | null;
  visibleSedes?: string[];
}): StaffOption[] {
  const map = new Map<string, StaffOption>();
  const asistencia = mergeAsistenciaSettings(input.asistencia);

  for (const u of input.users) {
    if (u.status === 'inactive') continue;
    const homeSede = u.location ?? u.sedes?.[0] ?? 'Principal';
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
    };
    map.set(opt.id, opt);
  }

  for (const s of asistencia.staff ?? []) {
    const id = `asist-${s.id}`;
    if (map.has(id)) continue;
    const opt: StaffOption = {
      id,
      label: s.fullName,
      name: s.fullName,
      jobTitle: s.cargoLabel,
      workArea: s.area ? mapAreaFromAsistencia(s.area) : 'Otro',
      contractType: 'No registrado',
      homeSede: s.sedeName,
      seniorityMonths: 0,
    };
    map.set(id, opt);
  }

  let list = [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  if (input.visibleSedes?.length) {
    list = list.filter(
      (s) =>
        input.visibleSedes!.includes(s.homeSede) ||
        input.visibleSedes!.some((v) => s.homeSede.toLowerCase().includes(v.toLowerCase()))
    );
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
    .filter((r) => r.estimatedLostDays > 0 || r.immediateCare === 'dias_baja')
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  if (withLostTime.length === 0) return differenceInCalendarDays(new Date(), parseISO('2020-01-01'));
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
