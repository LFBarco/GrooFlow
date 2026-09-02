import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import type { SystemAlert } from '../types';
import type { TurnosSettings } from '../types/turnos';
import { TURNO_SHIFT_LABELS } from '../types/turnos';

export function buildTurnosSystemAlerts(settings: TurnosSettings): SystemAlert[] {
  const alerts: SystemAlert[] = [];
  const now = new Date();

  for (const assignment of settings.assignments) {
    if (assignment.staffApprovalStatus !== 'pending') continue;
    const staff = settings.roster.find((r) => r.id === assignment.staffId);
    if (!staff?.userId) continue;
    const dateLabel = format(parseISO(assignment.date), "d MMM yyyy", { locale: es });
    alerts.push({
      id: `turnos-shift-pending-${assignment.id}`,
      title: 'Confirma tu horario asignado',
      message: `${assignment.workSede} · ${dateLabel} · ${TURNO_SHIFT_LABELS[assignment.shift]}. El encargado de sede te asignó este turno.`,
      severity: 'warning',
      type: 'personnel',
      category: 'hr',
      date: assignment.updatedAt ? new Date(assignment.updatedAt) : now,
      read: false,
      actionLink: 'turnos',
      actionLabel: 'Ir a Turnos',
      metadata: {
        targetUserIds: [staff.userId],
        assignmentId: assignment.id,
        kind: 'shift_approval',
      },
    });
  }

  for (const vacancy of settings.vacancies ?? []) {
    if (vacancy.status !== 'open') continue;
    const areaLabel = vacancy.workArea?.trim() || 'Todas las áreas';
    const areaStaff = settings.roster.filter((r) => {
      if (!r.active) return false;
      if (!vacancy.workArea?.trim()) return true;
      return (r.workArea ?? '').toLowerCase() === vacancy.workArea.toLowerCase();
    });
    const targetUserIds = areaStaff.map((r) => r.userId).filter(Boolean) as string[];
    if (targetUserIds.length === 0) continue;

    const dateLabel = format(parseISO(vacancy.date), "d MMM", { locale: es });
    alerts.push({
      id: `turnos-vacancy-${vacancy.id}`,
      title: `Vacante en ${vacancy.workSede}`,
      message: `${dateLabel} · turno ${vacancy.shift === 'day' ? 'día' : 'noche'} · ${areaLabel}. Hay cobertura disponible para postular.`,
      severity: 'info',
      type: 'operational',
      category: 'hr',
      date: new Date(vacancy.createdAt),
      read: false,
      actionLink: 'turnos',
      actionLabel: 'Ver vacantes',
      metadata: {
        targetUserIds,
        vacancyId: vacancy.id,
        workArea: vacancy.workArea,
        kind: 'vacancy_broadcast',
      },
    });
  }

  return alerts;
}

export function filterAlertsForUser(alerts: SystemAlert[], userId?: string): SystemAlert[] {
  if (!userId) return alerts;
  return alerts.filter((a) => {
    const targets = a.metadata?.targetUserIds as string[] | undefined;
    if (!targets?.length) return true;
    return targets.includes(userId);
  });
}
