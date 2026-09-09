import { describe, expect, it } from 'vitest';
import { normalizeTreasuryInvoices, normalizeTreasurySubscriptions } from '../components/treasury/normalizeTreasuryKv';
import { sanitizeUsersForCloud, sanitizeUserExtraForSql } from '../utils/sanitizeUsersForCloud';

describe('1. API & Contract Integration Tests', () => {
  it('should rehydrate treasury invoices with valid Date objects', () => {
    const rawInvoices = [
      { id: 'inv-1', invoiceNumber: 'F001-123', issueDate: '2026-09-01T00:00:00Z', dueDate: '2026-09-15T00:00:00Z', amount: 1500 }
    ];
    const normalized = normalizeTreasuryInvoices(rawInvoices);
    expect(normalized.length).toBe(1);
    expect(normalized[0].issueDate).toBeInstanceOf(Date);
    expect(normalized[0].dueDate).toBeInstanceOf(Date);
  });

  it('should rehydrate treasury subscriptions with autoGenerate defaults', () => {
    const rawSubs = [
      { id: 'sub-1', name: 'Software License', amount: 250, dayOfMonth: 5, nextDueDate: '2026-10-05' }
    ];
    const normalized = normalizeTreasurySubscriptions(rawSubs);
    expect(normalized.length).toBe(1);
    expect(normalized[0].autoGenerate).toBe(true);
    expect(normalized[0].amount).toBe(250);
  });

  it('should sanitize user payloads before cloud and SQL transmission', () => {
    const rawUsers = [
      { id: 'usr-1', name: 'Juan Perez', email: 'juan@empresa.com', tempPassword: 'secret123', isSystemAdmin: true },
      { id: 'usr-2', name: 'Maria Gomez', email: 'maria@empresa.com', tempPassword: 'pass', isSystemAdmin: false },
    ];
    const sanitized = sanitizeUsersForCloud(rawUsers as any);
    sanitized.forEach((u: any) => {
      expect(u.tempPassword).toBeUndefined();
      expect(u.id).toBeDefined();
      expect(u.email).toBeDefined();
    });

    const safeExtra = sanitizeUserExtraForSql({ tempPassword: '123', password: '456', customRole: 'operator' });
    expect(safeExtra.tempPassword).toBeUndefined();
    expect(safeExtra.password).toBeUndefined();
    expect(safeExtra.customRole).toBe('operator');
  });
});
