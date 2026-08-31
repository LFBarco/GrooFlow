import type { TurnoShiftCode, TurnosSettings, TurnosWeekTemplate } from '../types/turnos';
import { upsertAssignment } from './turnosData';
import { appendChangeLog } from './turnosAudit';

export function newTemplateId(): string {
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function saveWeekAsTemplate(
  settings: TurnosSettings,
  input: {
    name: string;
    sede?: string;
    dateKeys: string[];
    staffIds: string[];
    workSede: string;
  },
  actor?: string
): TurnosSettings {
  const assignments: Record<string, TurnoShiftCode[]> = {};

  for (const staffId of input.staffIds) {
    const staff = settings.roster.find((r) => r.id === staffId);
    const row: TurnoShiftCode[] = [];
    for (const date of input.dateKeys) {
      const cellSede =
        input.workSede === 'Todas' ? staff?.homeSede ?? '' : input.workSede;
      const match = settings.assignments.find(
        (a) => a.staffId === staffId && a.date === date && a.workSede === cellSede
      );
      row.push(match?.shift ?? 'off');
    }
    assignments[staffId] = row;
  }

  const template: TurnosWeekTemplate = {
    id: newTemplateId(),
    name: input.name.trim(),
    sede: input.sede,
    assignments,
    createdAt: new Date().toISOString(),
  };

  let next: TurnosSettings = {
    ...settings,
    templates: [...(settings.templates ?? []), template],
  };
  next = appendChangeLog(next, {
    by: actor,
    action: 'template_saved',
    detail: template.name,
  });
  return next;
}

export function applyTemplateToWeek(
  settings: TurnosSettings,
  templateId: string,
  dateKeys: string[],
  workSede: string,
  actor?: string
): TurnosSettings {
  const template = (settings.templates ?? []).find((t) => t.id === templateId);
  if (!template || dateKeys.length === 0) return settings;

  let next = settings;
  for (const [staffId, pattern] of Object.entries(template.assignments)) {
    const staff = settings.roster.find((r) => r.id === staffId);
    if (!staff) continue;
    const cellSede = workSede === 'Todas' ? staff.homeSede : workSede;
    for (let i = 0; i < Math.min(pattern.length, dateKeys.length); i++) {
      const shift = pattern[i]!;
      next = upsertAssignment(next, {
        staffId,
        date: dateKeys[i]!,
        shift,
        homeSede: staff.homeSede,
        workSede: cellSede,
      });
    }
  }

  next = appendChangeLog(next, {
    by: actor,
    action: 'template_applied',
    detail: template.name,
  });
  return next;
}

export function deleteTemplate(
  settings: TurnosSettings,
  templateId: string
): TurnosSettings {
  return {
    ...settings,
    templates: (settings.templates ?? []).filter((t) => t.id !== templateId),
  };
}

export function bulkFillAreaWeek(
  settings: TurnosSettings,
  input: {
    workArea: string;
    dateKeys: string[];
    shift: TurnoShiftCode;
    workSede: string;
  }
): TurnosSettings {
  let next = settings;
  const staffInArea = settings.roster.filter(
    (r) => r.active && (r.workArea || 'Sin área') === input.workArea
  );
  for (const staff of staffInArea) {
    const cellSede = input.workSede === 'Todas' ? staff.homeSede : input.workSede;
    for (const date of input.dateKeys) {
      next = upsertAssignment(next, {
        staffId: staff.id,
        date,
        shift: input.shift,
        homeSede: staff.homeSede,
        workSede: cellSede,
      });
    }
  }
  return next;
}
