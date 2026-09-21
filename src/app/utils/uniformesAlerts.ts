import type { SystemAlert } from '../types';
import type { UniformesSettings } from '../types/uniformes';
import { mergeUniformesSettings } from './uniformesData';

/**
 * Alertas de confirmación de recepción de uniformes.
 * El colaborador vinculado (userId) recibe la notificación personal.
 */
export function buildUniformesSystemAlerts(
  settings?: UniformesSettings | null
): SystemAlert[] {
  if (!settings) return [];
  const merged = mergeUniformesSettings(settings);
  const today = new Date();
  const out: SystemAlert[] = [];

  const pending = merged.records.filter((r) => r.status === 'pendiente_firma');

  for (const r of pending) {
    if (!r.userId) continue;
    out.push({
      id: `uniformes-reception-${r.id}`,
      title: 'Confirma recepción de uniforme',
      message: `Tienes una entrega pendiente (${r.deliveryDate}) en ${r.sede}: ${r.items
        .map((i) => i.itemType)
        .slice(0, 3)
        .join(', ')}. Revisa el acta y confirma la recepción.`,
      severity: 'warning',
      type: 'personnel',
      category: 'hr',
      date: r.updatedAt ? new Date(r.updatedAt) : r.createdAt ? new Date(r.createdAt) : today,
      read: false,
      actionLink: 'uniformes',
      actionLabel: 'Ir a Uniformes',
      metadata: {
        targetUserIds: [r.userId],
        deliveryId: r.id,
        kind: 'uniform_reception',
      },
    });
  }

  if (pending.length > 0) {
    out.push({
      id: 'uniformes-pending-reception-summary',
      title: `${pending.length} acta(s) de uniforme sin confirmar`,
      message:
        'Hay entregas pendientes de confirmación de recepción por el colaborador. Revisa el historial de actas.',
      severity: pending.length >= 5 ? 'critical' : 'info',
      type: 'operational',
      category: 'hr',
      date: today,
      read: false,
      actionLink: 'uniformes',
      actionLabel: 'Ver actas',
      metadata: { source: 'uniformes', kind: 'uniform_reception_summary' },
    });
  }

  return out;
}
