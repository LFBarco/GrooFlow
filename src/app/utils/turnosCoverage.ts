import type {
  TurnoAssignment,
  TurnosCoverageApplication,
  TurnosSettings,
  TurnosVacancy,
} from '../types/turnos';
import {
  newAssignmentId,
  resolveCoverageKind,
  upsertAssignment,
} from './turnosData';
import { appendChangeLog } from './turnosAudit';

export { getOpenVacancies, getPendingApplications, resolveCoverageKind } from './turnosData';

export function newVacancyId(): string {
  return `vac_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function newApplicationId(): string {
  return `app_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function createVacancy(
  settings: TurnosSettings,
  input: Omit<TurnosVacancy, 'id' | 'status' | 'createdAt'> & { createdBy?: string },
  actor?: string
): TurnosSettings {
  const vacancy: TurnosVacancy = {
    ...input,
    id: newVacancyId(),
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  let next: TurnosSettings = {
    ...settings,
    vacancies: [...(settings.vacancies ?? []), vacancy],
  };
  next = appendChangeLog(next, {
    by: actor,
    action: 'vacancy_created',
    detail: `${vacancy.workSede} · ${vacancy.date} · ${vacancy.shift === 'day' ? 'día' : 'noche'}`,
  });
  return next;
}

export function cancelVacancy(
  settings: TurnosSettings,
  vacancyId: string,
  actor?: string
): TurnosSettings {
  let next: TurnosSettings = {
    ...settings,
    vacancies: (settings.vacancies ?? []).map((v) =>
      v.id === vacancyId ? { ...v, status: 'cancelled' as const } : v
    ),
    applications: (settings.applications ?? []).map((a) =>
      a.vacancyId === vacancyId && a.status === 'pending'
        ? { ...a, status: 'cancelled' as const }
        : a
    ),
  };
  next = appendChangeLog(next, { by: actor, action: 'vacancy_cancelled', detail: vacancyId });
  return next;
}

export function applyToVacancy(
  settings: TurnosSettings,
  input: { vacancyId: string; staffId: string; note?: string }
): TurnosSettings {
  const vacancy = (settings.vacancies ?? []).find((v) => v.id === input.vacancyId);
  if (!vacancy || vacancy.status !== 'open') return settings;

  const staff = settings.roster.find((r) => r.id === input.staffId);
  if (!staff) return settings;

  const existing = (settings.applications ?? []).find(
    (a) =>
      a.vacancyId === input.vacancyId &&
      a.staffId === input.staffId &&
      (a.status === 'pending' || a.status === 'approved')
  );
  if (existing) return settings;

  const application: TurnosCoverageApplication = {
    id: newApplicationId(),
    vacancyId: input.vacancyId,
    staffId: input.staffId,
    staffName: staff.fullName,
    homeSede: staff.homeSede,
    isExternal: staff.isExternal,
    note: input.note?.trim() || undefined,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  return {
    ...settings,
    applications: [...(settings.applications ?? []), application],
  };
}

export function approveApplication(
  settings: TurnosSettings,
  applicationId: string,
  reviewer?: string
): TurnosSettings {
  const application = (settings.applications ?? []).find((a) => a.id === applicationId);
  if (!application || application.status !== 'pending') return settings;

  const vacancy = (settings.vacancies ?? []).find((v) => v.id === application.vacancyId);
  if (!vacancy || vacancy.status !== 'open') return settings;

  const staff = settings.roster.find((r) => r.id === application.staffId);
  if (!staff) return settings;

  const coverageKind = resolveCoverageKind(staff, vacancy.workSede, staff.homeSede);
  const assignmentId = newAssignmentId();
  const assignment: TurnoAssignment = {
    id: assignmentId,
    staffId: application.staffId,
    date: vacancy.date,
    shift: vacancy.shift,
    homeSede: staff.homeSede,
    workSede: vacancy.workSede,
    coverageKind,
    applicationId: application.id,
    notes: application.note,
    updatedAt: new Date().toISOString(),
  };

  let next = upsertAssignment(settings, assignment);

  next = {
    ...next,
    vacancies: (next.vacancies ?? []).map((v) =>
      v.id === vacancy.id
        ? { ...v, status: 'filled' as const, filledAssignmentId: assignmentId }
        : v
    ),
    applications: (next.applications ?? []).map((a) => {
      if (a.id === applicationId) {
        return {
          ...a,
          status: 'approved' as const,
          reviewedAt: new Date().toISOString(),
          reviewedBy: reviewer,
        };
      }
      if (a.vacancyId === vacancy.id && a.status === 'pending' && a.id !== applicationId) {
        return {
          ...a,
          status: 'rejected' as const,
          reviewedAt: new Date().toISOString(),
          reviewedBy: reviewer,
        };
      }
      return a;
    }),
  };

  next = appendChangeLog(next, {
    by: reviewer,
    action: 'coverage_approved',
    detail: `${staff.fullName} → ${vacancy.workSede} · ${vacancy.date}`,
  });

  return next;
}

export function rejectApplication(
  settings: TurnosSettings,
  applicationId: string,
  reviewer?: string
): TurnosSettings {
  let next: TurnosSettings = {
    ...settings,
    applications: (settings.applications ?? []).map((a) =>
      a.id === applicationId && a.status === 'pending'
        ? {
            ...a,
            status: 'rejected' as const,
            reviewedAt: new Date().toISOString(),
            reviewedBy: reviewer,
          }
        : a
    ),
  };
  next = appendChangeLog(next, { by: reviewer, action: 'coverage_rejected', detail: applicationId });
  return next;
}

export function syncVacanciesFromStaffingGaps(
  settings: TurnosSettings,
  date: string,
  workSede: string,
  gaps: { shift: 'day' | 'night'; workArea: string; missing: number; sede: string }[],
  actor?: string
): TurnosSettings {
  let next = settings;
  for (const gap of gaps) {
    if (gap.missing <= 0) continue;
    const sede = gap.sede === 'Todas' ? workSede : gap.sede;
    if (workSede !== 'Todas' && sede !== workSede) continue;

    const exists = (next.vacancies ?? []).some(
      (v) =>
        v.status === 'open' &&
        v.date === date &&
        v.shift === gap.shift &&
        v.workSede === sede &&
        (v.workArea ?? 'Todas') === gap.workArea
    );
    if (exists) continue;

    next = createVacancy(
      next,
      {
        date,
        shift: gap.shift,
        workSede: sede,
        workArea: gap.workArea !== 'Todas' ? gap.workArea : undefined,
        reason: `Faltan ${gap.missing} en dotación mínima`,
        createdBy: actor,
      },
      actor
    );
  }
  return next;
}
