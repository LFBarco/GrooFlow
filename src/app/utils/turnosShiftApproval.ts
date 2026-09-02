import type { TurnosSettings } from '../types/turnos';
import { appendChangeLog } from './turnosAudit';
import { upsertAssignment } from './turnosData';

export function upsertAssignmentByManager(
  settings: TurnosSettings,
  input: Parameters<typeof upsertAssignment>[1],
  actor?: { userId?: string; name?: string; isManager?: boolean }
): TurnosSettings {
  const staff = settings.roster.find((r) => r.id === input.staffId);
  const requireApproval = settings.requireStaffShiftApproval !== false;
  const isSelf = Boolean(actor?.userId && staff?.userId && actor.userId === staff.userId);
  const needsApproval =
    requireApproval && actor?.isManager !== false && !isSelf && Boolean(staff?.userId);

  let next = upsertAssignment(settings, {
    ...input,
    staffApprovalStatus: needsApproval ? 'pending' : 'confirmed',
    assignedBy: actor?.name,
  });

  if (needsApproval) {
    next = appendChangeLog(next, {
      by: actor?.name,
      action: 'shift_assigned_pending',
      detail: `${staff?.fullName ?? input.staffId} · ${input.date} · ${input.shift}`,
    });
  }

  return next;
}

export function confirmShiftAssignment(
  settings: TurnosSettings,
  assignmentId: string,
  actorName?: string
): TurnosSettings {
  const assignment = settings.assignments.find((a) => a.id === assignmentId);
  if (!assignment || assignment.staffApprovalStatus !== 'pending') return settings;

  let next: TurnosSettings = {
    ...settings,
    assignments: settings.assignments.map((a) =>
      a.id === assignmentId
        ? { ...a, staffApprovalStatus: 'confirmed' as const, updatedAt: new Date().toISOString() }
        : a
    ),
  };
  next = appendChangeLog(next, {
    by: actorName,
    action: 'shift_confirmed',
    detail: `${assignment.date} · ${assignment.shift}`,
  });
  return next;
}

export function rejectShiftAssignment(
  settings: TurnosSettings,
  assignmentId: string,
  actorName?: string
): TurnosSettings {
  const assignment = settings.assignments.find((a) => a.id === assignmentId);
  if (!assignment || assignment.staffApprovalStatus !== 'pending') return settings;

  let next: TurnosSettings = {
    ...settings,
    assignments: settings.assignments.map((a) =>
      a.id === assignmentId
        ? { ...a, staffApprovalStatus: 'rejected' as const, updatedAt: new Date().toISOString() }
        : a
    ),
  };
  next = appendChangeLog(next, {
    by: actorName,
    action: 'shift_rejected',
    detail: `${assignment.date} · ${assignment.shift}`,
  });
  return next;
}

export function getPendingShiftApprovalsForUser(
  settings: TurnosSettings,
  userId?: string
) {
  if (!userId) return [];
  return settings.assignments.filter((a) => {
    if (a.staffApprovalStatus !== 'pending') return false;
    const staff = settings.roster.find((r) => r.id === a.staffId);
    return staff?.userId === userId;
  });
}
