import type {
  TurnoAssignment,
  TurnoCoverageKind,
  TurnoShiftCode,
  TurnosDaySummary,
  TurnosFilters,
  TurnosPeriodKpi,
  TurnosRosterEntry,
  TurnosSettings,
  TurnosStaffingGap,
} from '../types/turnos';
import { toDateKey } from './turnosCalendar';
import { buildRosterFromSources } from './turnosRosterFromOrganigrama';

export { buildRosterFromSources };
export {
  canManageTurnosSede,
  canPublishTurnosWeek,
  isEncargadoSedeRole,
} from './turnosRosterFromOrganigrama';

export const TURNOS_SETTINGS_KV_KEY = 'settings:turnos';

export function defaultTurnosSettings(): TurnosSettings {
  return {
    version: 1,
    assignments: [],
    roster: [],
    staffing: { minDayNightTotal: 2 },
    vacancies: [],
    applications: [],
    templates: [],
    publishedWeeks: [],
    changeLog: [],
    laborRules: {
      maxConsecutiveNights: 4,
      minDaysOffPerMonth: 4,
      maxConsecutiveWorkDays: 6,
    },
    requireStaffShiftApproval: true,
  };
}

export function mergeTurnosSettings(partial?: Partial<TurnosSettings> | null): TurnosSettings {
  const base = defaultTurnosSettings();
  if (!partial || typeof partial !== 'object') return { ...base };
  return {
    version: 1,
    assignments: Array.isArray(partial.assignments) ? partial.assignments : base.assignments,
    roster: Array.isArray(partial.roster) ? partial.roster : base.roster,
    rosterSyncedAt: partial.rosterSyncedAt,
    staffing: { ...base.staffing, ...(partial.staffing ?? {}) },
    vacancies: Array.isArray(partial.vacancies) ? partial.vacancies : base.vacancies,
    applications: Array.isArray(partial.applications) ? partial.applications : base.applications,
    templates: Array.isArray(partial.templates) ? partial.templates : base.templates,
    publishedWeeks: Array.isArray(partial.publishedWeeks)
      ? partial.publishedWeeks
      : base.publishedWeeks,
    changeLog: Array.isArray(partial.changeLog) ? partial.changeLog : base.changeLog,
    laborRules: { ...base.laborRules, ...(partial.laborRules ?? {}) },
    requireStaffShiftApproval:
      partial.requireStaffShiftApproval ?? base.requireStaffShiftApproval,
  };
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

export function newAssignmentId(): string {
  return `turno_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function resolveCoverageKind(
  staff: TurnosRosterEntry | undefined,
  workSede: string,
  homeSede: string
): TurnoCoverageKind {
  if (staff?.isExternal) return 'external';
  if (homeSede.trim().toLowerCase() !== workSede.trim().toLowerCase()) return 'inter_sede';
  return 'regular';
}

export function getOpenVacancies(settings: TurnosSettings, sedeFilter?: string) {
  return (settings.vacancies ?? []).filter((v) => {
    if (v.status !== 'open') return false;
    if (sedeFilter && sedeFilter !== 'Todas' && v.workSede !== sedeFilter) return false;
    return true;
  });
}

export function getPendingApplications(settings: TurnosSettings, sedeFilter?: string) {
  const vacancyMap = new Map((settings.vacancies ?? []).map((v) => [v.id, v]));
  return (settings.applications ?? []).filter((a) => {
    if (a.status !== 'pending') return false;
    const vac = vacancyMap.get(a.vacancyId);
    if (!vac || vac.status !== 'open') return false;
    if (sedeFilter && sedeFilter !== 'Todas' && vac.workSede !== sedeFilter) return false;
    return true;
  });
}

export function upsertAssignment(
  settings: TurnosSettings,
  input: Omit<TurnoAssignment, 'id' | 'updatedAt' | 'coverageKind'> & {
    id?: string;
    coverageKind?: TurnoCoverageKind;
  }
): TurnosSettings {
  const id = input.id ?? newAssignmentId();
  const staff = settings.roster.find((r) => r.id === input.staffId);
  const coverageKind =
    input.coverageKind ??
    resolveCoverageKind(staff, input.workSede, input.homeSede ?? staff?.homeSede ?? input.workSede);
  const next: TurnoAssignment = {
    ...input,
    homeSede: input.homeSede ?? staff?.homeSede ?? input.workSede,
    coverageKind,
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

export function assignmentCoverageKind(
  a: TurnoAssignment,
  staff?: TurnosRosterEntry
): TurnoCoverageKind {
  if (a.coverageKind) return a.coverageKind;
  return resolveCoverageKind(staff, a.workSede, a.homeSede);
}

export function isCoverAssignment(a: TurnoAssignment, staff?: TurnosRosterEntry): boolean {
  const kind = assignmentCoverageKind(a, staff);
  return kind === 'inter_sede' || kind === 'external';
}

export function isInterSedeCover(a: TurnoAssignment, staff?: TurnosRosterEntry): boolean {
  return assignmentCoverageKind(a, staff) === 'inter_sede';
}

export function isExternalCover(a: TurnoAssignment, staff?: TurnosRosterEntry): boolean {
  return assignmentCoverageKind(a, staff) === 'external';
}

function rosterAreaForStaff(settings: TurnosSettings, staffId: string): string {
  return settings.roster.find((r) => r.id === staffId)?.workArea || 'Sin área';
}

export function computeStaffingGaps(
  settings: TurnosSettings,
  date: string,
  workSede?: string
): TurnosStaffingGap[] {
  const rules = settings.staffing?.rules ?? [];
  if (rules.length === 0) return [];

  const rows = assignmentsForDate(settings, date, workSede);
  const gaps: TurnosStaffingGap[] = [];

  for (const rule of rules) {
    if (rule.minimum <= 0) continue;
    const actual = rows.filter((a) => {
      if (a.shift !== rule.shift) return false;
      if (rule.sede !== 'Todas' && a.workSede !== rule.sede) return false;
      const area = rosterAreaForStaff(settings, a.staffId);
      if (rule.workArea !== 'Todas' && area !== rule.workArea) return false;
      return true;
    }).length;

    if (actual < rule.minimum) {
      gaps.push({
        sede: rule.sede,
        workArea: rule.workArea,
        shift: rule.shift,
        required: rule.minimum,
        actual,
        missing: rule.minimum - actual,
      });
    }
  }
  return gaps;
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
  const coverCount = rows.filter((r) => isInterSedeCover(r)).length;
  const externalCoverCount = rows.filter((r) => isExternalCover(r)).length;
  const staffingGaps = computeStaffingGaps(settings, date, workSede);
  const minTotal = settings.staffing?.minDayNightTotal ?? 2;
  const legacyUnder = staffingGaps.length === 0 && dayCount + nightCount < minTotal;
  return {
    date,
    dayCount,
    nightCount,
    offCount,
    trainingCount,
    coverCount,
    externalCoverCount,
    understaffed: staffingGaps.length > 0 || legacyUnder,
    staffingGaps,
  };
}

export function defaultTurnosFilters(): TurnosFilters {
  return {
    search: '',
    workArea: 'Todas',
    roleLabel: 'Todos',
    shift: 'Todos',
    unassignedOnly: false,
    coverOnly: false,
    externalOnly: false,
    homeSede: 'Todas',
    filterDate: '',
    planVsRealStatus: 'Todos',
    alertsOnly: false,
  };
}

export function countActiveFilters(filters: TurnosFilters): number {
  let n = 0;
  if (filters.search.trim()) n += 1;
  if (filters.workArea !== 'Todas') n += 1;
  if (filters.roleLabel !== 'Todos') n += 1;
  if (filters.shift !== 'Todos') n += 1;
  if (filters.homeSede !== 'Todas') n += 1;
  if (filters.filterDate) n += 1;
  if (filters.planVsRealStatus !== 'Todos') n += 1;
  if (filters.unassignedOnly) n += 1;
  if (filters.coverOnly) n += 1;
  if (filters.externalOnly) n += 1;
  if (filters.alertsOnly) n += 1;
  return n;
}

export function staffHasAssignmentInRange(
  settings: TurnosSettings,
  staffId: string,
  dateKeys: string[],
  workSede: string
): boolean {
  const keySet = new Set(dateKeys);
  return settings.assignments.some((a) => {
    if (a.staffId !== staffId || !keySet.has(a.date)) return false;
    if (workSede === 'Todas') return true;
    return a.workSede === workSede;
  });
}

export function staffHasCoverInRange(
  settings: TurnosSettings,
  staffId: string,
  dateKeys: string[],
  workSede: string,
  externalOnly = false
): boolean {
  const keySet = new Set(dateKeys);
  return settings.assignments.some((a) => {
    if (a.staffId !== staffId || !keySet.has(a.date)) return false;
    if (workSede !== 'Todas' && a.workSede !== workSede) return false;
    if (externalOnly) return isExternalCover(a);
    return isInterSedeCover(a);
  });
}

export function staffMatchesShiftFilter(
  settings: TurnosSettings,
  staffId: string,
  dateKeys: string[],
  workSede: string,
  shiftFilter: string,
  roster: TurnosRosterEntry[],
  filterDate?: string
): boolean {
  if (shiftFilter === 'Todos') return true;
  const staff = roster.find((r) => r.id === staffId);
  const keys = filterDate ? [filterDate] : dateKeys;
  const keySet = new Set(keys);
  return settings.assignments.some((a) => {
    if (a.staffId !== staffId || !keySet.has(a.date) || a.shift !== shiftFilter) return false;
    const cellSede = workSede === 'Todas' ? staff?.homeSede : workSede;
    return a.workSede === cellSede;
  });
}

export function filterTurnosRoster(
  roster: TurnosRosterEntry[],
  settings: TurnosSettings,
  filters: TurnosFilters,
  dateKeys: string[],
  workSede: string,
  options?: {
    alertStaffIds?: Set<string>;
    planVsRealStaffIds?: Set<string>;
  }
): TurnosRosterEntry[] {
  let list = roster;
  const q = filters.search.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.roleLabel.toLowerCase().includes(q) ||
        (r.workArea ?? '').toLowerCase().includes(q)
    );
  }
  if (filters.workArea && filters.workArea !== 'Todas') {
    list = list.filter((r) => (r.workArea || 'Sin área') === filters.workArea);
  }
  if (filters.roleLabel && filters.roleLabel !== 'Todos') {
    list = list.filter((r) => r.roleLabel === filters.roleLabel);
  }
  if (filters.homeSede && filters.homeSede !== 'Todas') {
    list = list.filter((r) => r.homeSede === filters.homeSede);
  }
  if (filters.unassignedOnly) {
    list = list.filter(
      (r) => !staffHasAssignmentInRange(settings, r.id, dateKeys, workSede)
    );
  }
  if (filters.coverOnly) {
    list = list.filter((r) => staffHasCoverInRange(settings, r.id, dateKeys, workSede, false));
  }
  if (filters.externalOnly) {
    list = list.filter((r) => staffHasCoverInRange(settings, r.id, dateKeys, workSede, true) || r.isExternal);
  }
  if (filters.shift !== 'Todos') {
    list = list.filter((r) =>
      staffMatchesShiftFilter(
        settings,
        r.id,
        dateKeys,
        workSede,
        filters.shift,
        roster,
        filters.filterDate || undefined
      )
    );
  }
  if (filters.alertsOnly && options?.alertStaffIds) {
    list = list.filter((r) => options.alertStaffIds!.has(r.id));
  }
  if (filters.planVsRealStatus !== 'Todos' && options?.planVsRealStaffIds) {
    list = list.filter((r) => options.planVsRealStaffIds!.has(r.id));
  }
  return list;
}

export function computePeriodKpis(
  settings: TurnosSettings,
  dateKeys: string[],
  roster: TurnosRosterEntry[],
  workSede: string
): TurnosPeriodKpi {
  const resolvedSede = workSede === 'Todas' ? undefined : workSede;
  let dayShifts = 0;
  let nightShifts = 0;
  let offShifts = 0;
  let trainingShifts = 0;
  let coverShifts = 0;
  let externalCoverShifts = 0;
  let understaffedDays = 0;

  for (const key of dateKeys) {
    const summary = summarizeDay(settings, key, resolvedSede);
    dayShifts += summary.dayCount;
    nightShifts += summary.nightCount;
    offShifts += summary.offCount;
    trainingShifts += summary.trainingCount;
    coverShifts += summary.coverCount;
    externalCoverShifts += summary.externalCoverCount;
    if (summary.understaffed) understaffedDays += 1;
  }

  const unassignedStaff = roster.filter(
    (r) => !staffHasAssignmentInRange(settings, r.id, dateKeys, workSede)
  ).length;

  return {
    dayShifts,
    nightShifts,
    offShifts,
    trainingShifts,
    coverShifts,
    externalCoverShifts,
    understaffedDays,
    unassignedStaff,
    activeStaff: roster.length,
    openVacancies: getOpenVacancies(settings, workSede).length,
    pendingApplications: getPendingApplications(settings, workSede).length,
  };
}

export function copyWeekAssignments(
  settings: TurnosSettings,
  sourceDateKeys: string[],
  targetDateKeys: string[],
  workSede: string
): TurnosSettings {
  if (sourceDateKeys.length !== targetDateKeys.length) return settings;
  let next = settings;
  const toRemove = new Set(
    settings.assignments
      .filter((a) => {
        if (!targetDateKeys.includes(a.date)) return false;
        if (workSede === 'Todas') return true;
        return a.workSede === workSede;
      })
      .map((a) => a.id)
  );
  next = {
    ...next,
    assignments: next.assignments.filter((a) => !toRemove.has(a.id)),
  };

  for (let i = 0; i < sourceDateKeys.length; i++) {
    const sourceDate = sourceDateKeys[i]!;
    const targetDate = targetDateKeys[i]!;
    const sourceRows = settings.assignments.filter((a) => {
      if (a.date !== sourceDate) return false;
      if (workSede === 'Todas') return true;
      return a.workSede === workSede;
    });
    for (const row of sourceRows) {
      next = upsertAssignment(next, {
        staffId: row.staffId,
        date: targetDate,
        shift: row.shift,
        homeSede: row.homeSede,
        workSede: row.workSede,
        notes: row.notes,
        startTime: row.startTime,
        endTime: row.endTime,
      });
    }
  }
  return next;
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
    isExternal: entry.isExternal,
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

/** Patrón rotativo D → N → L → L (4 días). */
export const TURNOS_ROTATION_PATTERN: TurnoShiftCode[] = ['day', 'night', 'off', 'off'];

export function bulkFillRotatingPattern(
  settings: TurnosSettings,
  input: {
    staffId: string;
    dates: string[];
    workSede: string;
    startIndex?: number;
  }
): TurnosSettings {
  const roster = settings.roster.find((r) => r.id === input.staffId);
  let next = settings;
  input.dates.forEach((date, index) => {
    const shift = TURNOS_ROTATION_PATTERN[(index + (input.startIndex ?? 0)) % TURNOS_ROTATION_PATTERN.length]!;
    next = upsertAssignment(next, {
      staffId: input.staffId,
      date,
      shift,
      homeSede: roster?.homeSede ?? input.workSede,
      workSede: input.workSede,
    });
  });
  return next;
}

export function updateAssignmentDetails(
  settings: TurnosSettings,
  assignmentId: string,
  patch: Pick<TurnoAssignment, 'notes' | 'startTime' | 'endTime'>
): TurnosSettings {
  const existing = settings.assignments.find((a) => a.id === assignmentId);
  if (!existing) return settings;
  return {
    ...settings,
    assignments: settings.assignments.map((a) =>
      a.id === assignmentId
        ? { ...a, ...patch, updatedAt: new Date().toISOString() }
        : a
    ),
  };
}

export function newStaffingRuleId(): string {
  return `staff_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export type StaffMember = AsistenciaStaffMember;
