import { describe, expect, it } from 'vitest';

interface AuditLogRow {
  id: string;
  timestamp: string; // ISO String
  userEmail: string;
  action: string;
  module: string;
  details: string;
}

function filterAuditLogs(
  logs: AuditLogRow[],
  filters: { module?: string; userEmail?: string; search?: string }
): AuditLogRow[] {
  return logs.filter((log) => {
    if (filters.module && filters.module !== 'todos' && log.module !== filters.module) return false;
    if (filters.userEmail && log.userEmail.toLowerCase() !== filters.userEmail.toLowerCase()) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!log.details.toLowerCase().includes(q) && !log.action.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

describe('Audit Panel Module', () => {
  const sampleLogs: AuditLogRow[] = [
    { id: '1', timestamp: '2026-09-08T10:00:00Z', userEmail: 'admin@grooflow.com', action: 'CREATE_USER', module: 'Usuarios', details: 'Usuario maria@vet.com creado' },
    { id: '2', timestamp: '2026-09-08T11:00:00Z', userEmail: 'cajero@grooflow.com', action: 'APPROVE_EXPENSE', module: 'Caja Chica', details: 'Egreso #105 aprobado por S/ 45.00' },
    { id: '3', timestamp: '2026-09-08T12:00:00Z', userEmail: 'admin@grooflow.com', action: 'UPDATE_SETTINGS', module: 'Configuración', details: 'Cambio de razón social' },
  ];

  it('filtra logs por módulo específico', () => {
    const filtered = filterAuditLogs(sampleLogs, { module: 'Caja Chica' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.module).toBe('Caja Chica');
  });

  it('filtra logs por usuario específico', () => {
    const filtered = filterAuditLogs(sampleLogs, { userEmail: 'admin@grooflow.com' });
    expect(filtered).toHaveLength(2);
  });

  it('filtra por búsqueda libre de texto', () => {
    const filtered = filterAuditLogs(sampleLogs, { search: 'razón social' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.action).toBe('UPDATE_SETTINGS');
  });
});
