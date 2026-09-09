import { describe, expect, it } from 'vitest';
import type { SystemAlert } from '../../types';

function sortAlertsBySeverity(alerts: SystemAlert[]): SystemAlert[] {
  const severityWeight: Record<SystemAlert['severity'], number> = {
    critical: 4,
    warning: 3,
    info: 2,
    success: 1,
  };
  return [...alerts].sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity]);
}

function countUnreadAlerts(alerts: SystemAlert[]): number {
  return alerts.filter((a) => !a.read).length;
}

function markAlertAsRead(alerts: SystemAlert[], alertId: string): SystemAlert[] {
  return alerts.map((a) => (a.id === alertId ? { ...a, read: true } : a));
}

describe('Alerts Center Module', () => {
  const sampleAlerts: SystemAlert[] = [
    { id: 'a1', title: 'Factura Vencida', message: 'Factura #F001 venció hace 3 días', severity: 'warning', type: 'expiration', category: 'financial', date: new Date(), read: false },
    { id: 'a2', title: 'Saldo Crítico Caja Chica', message: 'Saldo por debajo del 10%', severity: 'critical', type: 'liquidity', category: 'financial', date: new Date(), read: false },
    { id: 'a3', title: 'Mantenimiento Programado', message: 'Ecógrafo requiere servicio', severity: 'info', type: 'operational', category: 'operational', date: new Date(), read: true },
  ];

  it('ordena alertas por severidad (crítico primero)', () => {
    const sorted = sortAlertsBySeverity(sampleAlerts);
    expect(sorted[0]?.severity).toBe('critical');
    expect(sorted[1]?.severity).toBe('warning');
    expect(sorted[2]?.severity).toBe('info');
  });

  it('cuenta correctamente el número de alertas no leídas', () => {
    const unreadCount = countUnreadAlerts(sampleAlerts);
    expect(unreadCount).toBe(2);
  });

  it('marca una alerta individual como leída', () => {
    const updated = markAlertAsRead(sampleAlerts, 'a2');
    expect(updated.find((a) => a.id === 'a2')?.read).toBe(true);
    expect(countUnreadAlerts(updated)).toBe(1);
  });
});
