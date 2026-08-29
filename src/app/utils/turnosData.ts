import type { AsistenciaSettings, AsistenciaStaffMember } from '../types/asistencia';
import type { User } from '../types';
import type {
  TurnoAssignment,
  TurnoShiftCode,
  TurnosDaySummary,
  TurnosRosterEntry,
  TurnosSettings,
} from '../types/turnos';
import { mergeAsistenciaSettings } from './asistenciaData';
import { toDateKey } from './turnosCalendar';

export const TURNOS_SETTINGS_KV_KEY = 'settings:turnos';

export function defaultTurnosSettings(): TurnosSettings {
  return { version: 1, assignments: [], roster: [] };
}

export function mergeTurnosSettings(partial?: Partial<TurnosSettings> | null): TurnosSettings {
  const base = defaultTurnosSettings();
  if (!partial || typeof partial !== 'object') return { ...base };
  return {
    version: 1,
    assignments: Array.isArray(partial.assignments) ? partial.assignments : base.assignments,
    roster: Array.isArray(partial.roster) ? partial.roster : base.roster,
    rosterSyncedAt: partial.rosterSyncedAt,
  };
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function rosterKey(entry: Pick<TurnosRosterEntry, 'source' | 'userId' | 'asistenciaStaffId' | 'fullName'>): string {
  if (entry.userId) return `user:${entry.userId}`;
  if (entry.asistenciaStaffId) return `asist:${entry.asistenciaStaffId}`;
  return `manual:${entry.fullName.trim().toLowerCase()}`;
}

/** Fusiona usuarios activos y personal de asistencia en el roster de turnos. */
export function buildRosterFromSources(input: {
  users: User[];
  asistencia?: AsistenciaSettings | null;
  existing?: TurnosRosterEntry[];
}): TurnosRosterEntry[] {
  const map = new Map<string, TurnosRosterEntry>();
  for (const e of input.existing ?? []) {
    map.set(rosterKey(e), e);
  }

  for (const u of input.users) {
    if (u.status === 'inactive') continue;
    const homeSede = u.sedes?.[0] ?? u.location ?? 'Principal';
    const entry: TurnosRosterEntry = {
      id: `user-${u.id}`,
      source: 'user',
      userId: u.id,
      fullName: u.name,
      initials: u.initials || initialsFromName(u.name),
      roleLabel: u.role,
      homeSede,
      email: u.email,
      active: true,
    };
    map.set(rosterKey(entry), { ...map.get(rosterKey(entry)), ...entry });
  }

  const asistencia = mergeAsistenciaSettings(input.asistencia);
  for (const s of asistencia.staff ?? []) {
    const entry: TurnosRosterEntry = {
      id: `asist-${s.id}`,
      source: 'asistencia',
      asistenciaStaffId: s.id,
      fullName: s.fullName,
      initials: initialsFromName(s.fullName),
      roleLabel: s.cargoLabel,
      homeSede: s.sedeName,
      active: true,
      sortOrder: s.sortOrder,
    };
    const key = rosterKey(entry);
    const prev = map.get(key);
    map.set(key, prev ? { ...prev, ...entry, id: prev.id } : entry);
  }

  return [...map.values()]
    .filter((r) => r.active)
    .sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        a.homeSede.localeCompare(b.homeSede, 'es') ||
        a.fullName.localeCompare(b.fullName, 'es')
    );
}

export function newAssignmentId(): string {
  return `turno_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function upsertAssignment(
  settings: TurnosSettings,
  input: Omit<TurnoAssignment, 'id' | 'updatedAt'> & { id?: string }
): TurnosSettings {
  const id = input.id ?? newAssignmentId();
  const next: TurnoAssignment = {
    ...input,
    id,
    updatedAt: new Date().toISOString(),
  };
  const rest = settings.assignments.filter(
    (a) =>
      !(
        a.staffId === next.staffId &&
        a.date === next.date &&
        a.workSede === next.workSede
      )
  );
  return { ...settings, assignments: [...rest, next] };
}

export function removeAssignment(settings: TurnosSettings, assignmentId: string): TurnosSettings {
  return {
    ...settings,
    assignments: settings.assignments.filter((a) => a.id !== assignmentId),
  };
}

export function moveAssignment(
  settings: TurnosSettings,
  assignmentId: string,
  target: { staffId: string; date: string; workSede: string }
): TurnosSettings {
  const existing = settings.assignments.find((a) => a.id === assignmentId);
  if (!existing) return settings;
  const roster = settings.roster.find((r) => r.id === target.staffId);
  return upsertAssignment(settings, {
    ...existing,
    staffId: target.staffId,
    date: target.date,
    workSede: target.workSede,
    homeSede: roster?.homeSede ?? existing.homeSede,
    id: assignmentId,
  });
}

export function assignmentForCell(
  settings: TurnosSettings,
  staffId: string,
  date: string,
  workSede: string
): TurnoAssignment | undefined {
  return settings.assignments.find(
    (a) => a.staffId === staffId && a.date === date && a.workSede === workSede
  );
}

export function assignmentsForDate(
  settings: TurnosSettings,
  date: string,
  workSede?: string
): TurnoAssignment[] {
  return settings.assignments.filter(
    (a) =>
      a.date === date &&
      (!workSede || workSede === 'Todas' || a.workSede === workSede)
  );
}

export function isCoverAssignment(a: TurnoAssignment): boolean {
  return a.homeSede.trim().toLowerCase() !== a.workSede.trim().toLowerCase();
}

export function summarizeDay(
  settings: TurnosSettings,
  date: string,
  workSede?: string
): TurnosDaySummary {
  const rows = assignmentsForDate(settings, date, workSede);
  const dayCount = rows.filter((r) => r.shift === 'day').length;
  const nightCount = rows.filter((r) => r.shift === 'night').length;
  const offCount = rows.filter((r) => r.shift === 'off').length;
  const trainingCount = rows.filter((r) => r.shift === 'training').length;
  const coverCount = rows.filter(isCoverAssignment).length;
  return {
    date,
    dayCount,
    nightCount,
    offCount,
    trainingCount,
    coverCount,
    understaffed: dayCount + nightCount < 2,
  };
}

export function rosterForSede(
  roster: TurnosRosterEntry[],
  sedeFilter: string
): TurnosRosterEntry[] {
  if (!sedeFilter || sedeFilter === 'Todas') return roster;
  return roster.filter(
    (r) =>
      r.homeSede === sedeFilter ||
      r.homeSede.toLowerCase().includes(sedeFilter.toLowerCase())
  );
}

/** Personal visible en la grilla: sede habitual o con asignación en el rango. */
export function rosterForPlanning(
  roster: TurnosRosterEntry[],
  assignments: TurnoAssignment[],
  sedeFilter: string,
  dateKeys: string[]
): TurnosRosterEntry[] {
  if (!sedeFilter || sedeFilter === 'Todas') return roster;
  const keySet = new Set(dateKeys);
  const covering = new Set<string>();
  for (const a of assignments) {
    if (keySet.has(a.date) && a.workSede === sedeFilter) {
      covering.add(a.staffId);
    }
  }
  return roster.filter((r) => r.homeSede === sedeFilter || covering.has(r.id));
}

export function upsertManualRosterEntry(
  settings: TurnosSettings,
  entry: Omit<TurnosRosterEntry, 'id' | 'source' | 'active'> & { id?: string }
): TurnosSettings {
  const id = entry.id ?? `manual_${Date.now().toString(36)}`;
  const next: TurnosRosterEntry = {
    ...entry,
    id,
    source: 'manual',
    active: true,
    initials: entry.initials || initialsFromName(entry.fullName),
  };
  const rest = settings.roster.filter((r) => r.id !== id);
  return { ...settings, roster: [...rest, next] };
}

export function removeRosterEntry(settings: TurnosSettings, staffId: string): TurnosSettings {
  return {
    ...settings,
    roster: settings.roster.filter((r) => r.id !== staffId),
    assignments: settings.assignments.filter((a) => a.staffId !== staffId),
  };
}

export function bulkFillWeek(
  settings: TurnosSettings,
  input: {
    staffId: string;
    dates: string[];
    shift: TurnoShiftCode;
    workSede: string;
  }
): TurnosSettings {
  const roster = settings.roster.find((r) => r.id === input.staffId);
  let next = settings;
  for (const date of input.dates) {
    next = upsertAssignment(next, {
      staffId: input.staffId,
      date,
      shift: input.shift,
      homeSede: roster?.homeSede ?? input.workSede,
      workSede: input.workSede,
    });
  }
  return next;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export type StaffMember = AsistenciaStaffMember;
