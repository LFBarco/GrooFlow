import type { SystemAlert } from '../types';
import type { RrhhSettings } from '../types/rrhh';
import { mergeRrhhSettings } from './rrhhData';

function isSameLocalDay(iso: string | undefined | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/**
 * Alertas de identidad / pipelines RRHH (Fase 3) para el Centro de Alertas.
 */
export function buildRrhhSystemAlerts(settings?: RrhhSettings | null): SystemAlert[] {
  if (!settings) return [];
  const s = mergeRrhhSettings(settings);
  const today = new Date();
  const out: SystemAlert[] = [];

  if (s.staffSyncEnabled === false) {
    return out;
  }

  if (s.lastSyncOk === false) {
    out.push({
      id: 'rrhh-sync-failed',
      title: 'Sync RRHH fallido',
      message: s.lastSyncMessage || 'El último pipeline Buk.pe → RRHH terminó con error.',
      severity: 'critical',
      type: 'system',
      category: 'hr',
      date: today,
      actionLink: 'rrhh',
      actionLabel: 'Ver RRHH',
      read: false,
      metadata: { source: 'rrhh-pipeline' },
    });
  } else if (!s.lastSyncAt) {
    out.push({
      id: 'rrhh-never-synced',
      title: 'RRHH sin sincronizar',
      message: 'Aún no hay sync Buk.pe → maestro. Ejecuta Sincronizar o configura el cron.',
      severity: 'warning',
      type: 'system',
      category: 'hr',
      date: today,
      actionLink: 'rrhh',
      actionLabel: 'Sincronizar',
      read: false,
      metadata: { source: 'rrhh-pipeline' },
    });
  } else if (!isSameLocalDay(s.lastSyncAt)) {
    out.push({
      id: 'rrhh-no-sync-today',
      title: 'Sin sync RRHH hoy',
      message: `Último sync: ${new Date(s.lastSyncAt).toLocaleString('es-PE')}. Revisa el cron o sincroniza manualmente.`,
      severity: 'warning',
      type: 'system',
      category: 'hr',
      date: today,
      actionLink: 'rrhh',
      actionLabel: 'Ver RRHH',
      read: false,
      metadata: { source: 'rrhh-pipeline' },
    });
  }

  const pending = Number(s.pendingAccessCount ?? 0);
  if (pending > 0) {
    out.push({
      id: 'rrhh-pending-access',
      title: `${pending} pendiente(s) de acceso`,
      message:
        'Hay personal activo en Buk.pe sin usuario Gestión. No se crea acceso automático: revisa Identidad en RRHH.',
      severity: pending >= 10 ? 'warning' : 'info',
      type: 'personnel',
      category: 'hr',
      date: today,
      actionLink: 'rrhh',
      actionLabel: 'Ver pendientes',
      read: false,
      metadata: { source: 'rrhh-pending', count: pending },
    });
  }

  if (s.lastPipelineOk === false && s.lastPipelineSummary) {
    out.push({
      id: 'rrhh-pipeline-unhealthy',
      title: 'Pipeline identidad con incidencias',
      message: s.lastPipelineSummary,
      severity: 'warning',
      type: 'system',
      category: 'hr',
      date: today,
      actionLink: 'rrhh',
      actionLabel: 'Ver estado',
      read: false,
      metadata: { source: 'rrhh-pipeline' },
    });
  }

  return out;
}
