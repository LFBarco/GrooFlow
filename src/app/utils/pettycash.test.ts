import { describe, expect, it } from 'vitest';
import type { PettyCashTransaction, User } from '../types';
import {
  findPettyCashDuplicate,
  pettyCashDocCompositeKey,
  canModifyPettyCashExpense,
} from './pettyCashDocDuplicate';
import {
  isPettyCashMovementActive,
  sumCustodianWeekExpenses,
  sumCustodianWeekIncome,
  getPettyCashWeekBalance,
} from './pettyCashBalance';
import {
  normalizePettyCashMeta,
  extractPettyCashMeta,
  isPettyCashMetaEmpty,
  resolvePettyCashMeta,
  mergePettyCashMetaIntoSettings,
  stripPettyCashMetaForSystemKv,
} from './pettyCashMeta';
import {
  mergePettyCashPrintCounters,
  mergePettyCashRenditionPrint,
  initialSystemSettings,
} from '../data/initialData';

describe('PettyCash Document Duplicate Validation', () => {
  it('generates composite key correctly', () => {
    const key = pettyCashDocCompositeKey('20601234567', 'F001', '00001234');
    expect(key).toBe('20601234567|f001|00001234');
  });

  it('detects duplicate transactions by RUC, series, and voucher number', () => {
    const mockTxs: PettyCashTransaction[] = [
      {
        id: 'tx-1',
        date: new Date('2026-09-01'),
        description: 'Gasto papeleria',
        amount: 50.0,
        type: 'expense',
        category: 'Útiles',
        requester: 'Juan Perez',
        custodianId: 'user-1',
        docNumber: '20601234567',
        docSeries: 'F001',
        voucherNumber: '00001234',
        status: 'approved',
      },
    ];

    const dup = findPettyCashDuplicate(mockTxs, '20601234567', 'F001', '00001234');
    expect(dup).toBeDefined();
    expect(dup?.id).toBe('tx-1');

    const noDup = findPettyCashDuplicate(mockTxs, '20601234567', 'F001', '99999999');
    expect(noDup).toBeUndefined();
  });

  it('ignores voided or rejected transactions when checking duplicates', () => {
    const mockTxs: PettyCashTransaction[] = [
      {
        id: 'tx-void',
        date: new Date('2026-09-01'),
        description: 'Anulado',
        amount: 50.0,
        type: 'expense',
        category: 'Útiles',
        requester: 'Juan Perez',
        docNumber: '20601234567',
        docSeries: 'F001',
        voucherNumber: '00001234',
        status: 'voided',
      },
    ];

    const dup = findPettyCashDuplicate(mockTxs, '20601234567', 'F001', '00001234');
    expect(dup).toBeUndefined();
  });
});

describe('PettyCash Balances & Movements', () => {
  it('identifies active movements', () => {
    const activeTx: PettyCashTransaction = {
      id: '1',
      date: new Date(),
      description: '',
      amount: 10,
      type: 'expense',
      category: 'Otros',
      requester: 'A',
      status: 'approved',
    };
    const voidedTx: PettyCashTransaction = {
      id: '2',
      date: new Date(),
      description: '',
      amount: 10,
      type: 'expense',
      category: 'Otros',
      requester: 'A',
      status: 'voided',
    };

    expect(isPettyCashMovementActive(activeTx)).toBe(true);
    expect(isPettyCashMovementActive(voidedTx)).toBe(false);
  });

  it('calculates weekly expenses correctly', () => {
    const txs: PettyCashTransaction[] = [
      {
        id: '1',
        date: new Date(),
        description: 'Gasto 1',
        amount: 30,
        type: 'expense',
        category: 'Otros',
        requester: 'A',
        custodianId: 'c-1',
        weekNumber: '2026-W36',
        status: 'approved',
      },
      {
        id: '2',
        date: new Date(),
        description: 'Gasto 2',
        amount: 20,
        type: 'expense',
        category: 'Otros',
        requester: 'A',
        custodianId: 'c-1',
        weekNumber: '2026-W36',
        status: 'pending_audit',
      },
      {
        id: '3',
        date: new Date(),
        description: 'Rechazado',
        amount: 100,
        type: 'expense',
        category: 'Otros',
        requester: 'A',
        custodianId: 'c-1',
        weekNumber: '2026-W36',
        status: 'rejected',
      },
    ];

    const totalExp = sumCustodianWeekExpenses(txs, 'c-1', '2026-W36');
    expect(totalExp).toBe(50);
  });
});

describe('PettyCash Metadata & Sanitization', () => {
  it('normalizes empty metadata correctly', () => {
    const norm = normalizePettyCashMeta(null);
    expect(norm.weekClosures).toEqual([]);
    expect(norm.weekPreClosures).toEqual([]);
    expect(norm.fundDeliveries).toEqual([]);
    expect(isPettyCashMetaEmpty(norm)).toBe(true);
  });

  it('strips petty cash metadata from system settings for clean system KV save', () => {
    const settingsWithMeta = mergePettyCashMetaIntoSettings(initialSystemSettings, {
      weekClosures: [
        {
          id: 'closure-1',
          custodianId: 'c-1',
          custodianName: 'Custodio',
          weekNumber: '2026-W36',
          closingDate: '2026-09-05',
          expensesTotal: 50,
          closingBalance: 950,
          fundLimit: 1000,
          carriedOverToNextWeek: 950,
        },
      ],
      weekPreClosures: [],
      fundDeliveries: [],
    });

    expect(settingsWithMeta.pettyCash?.weekClosures.length).toBe(1);

    const stripped = stripPettyCashMetaForSystemKv(settingsWithMeta);
    expect(stripped.pettyCash?.weekClosures).toEqual([]);
  });

  it('merges counters and rendition print settings with defaults', () => {
    const mergedCounters = mergePettyCashPrintCounters({ simpleReceiptNext: 5 });
    expect(mergedCounters.simpleReceiptSerie).toBe('RCC');
    expect(mergedCounters.simpleReceiptNext).toBe(5);

    const mergedRendition = mergePettyCashRenditionPrint({ documentTitle: 'Título Custom' });
    expect(mergedRendition.documentTitle).toBe('Título Custom');
    expect(mergedRendition.showSignaturesBlock).toBe(true);
  });
});
