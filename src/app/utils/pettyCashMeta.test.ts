import { describe, expect, it } from 'vitest';

import { initialSystemSettings } from '../data/initialData';
import {
  extractPettyCashMeta,
  mergePettyCashMetaIntoSettings,
  resolvePettyCashMeta,
  stripPettyCashMetaForSystemKv,
} from './pettyCashMeta';

describe('pettyCashMeta', () => {
  it('extrae y fusiona metadatos en settings', () => {
    const meta = {
      weekClosures: [{ id: 'c1', custodianId: 'u1', weekNumber: '2026-W20', closedAt: '', openingFund: 0, expensesTotal: 0, closingBalance: 0, carriedForward: 0 }],
      weekPreClosures: [],
      fundDeliveries: [],
    };
    const merged = mergePettyCashMetaIntoSettings(initialSystemSettings, meta);
    expect(merged.pettyCash.weekClosures).toHaveLength(1);
  });

  it('strip elimina arrays operativos del payload de sistema', () => {
    const withMeta = mergePettyCashMetaIntoSettings(initialSystemSettings, {
      weekClosures: [{ id: 'c1', custodianId: 'u1', weekNumber: '1', closedAt: '', openingFund: 0, expensesTotal: 0, closingBalance: 0, carriedForward: 0 }],
      weekPreClosures: [],
      fundDeliveries: [{ id: 'd1', custodianId: 'u1', weekNumber: '1', configuredAmount: 100, deliveredAmount: 100, deliveredAt: '', deliveredByUserId: 'a' }],
    });
    const stripped = stripPettyCashMetaForSystemKv(withMeta);
    expect(stripped.pettyCash.weekClosures).toEqual([]);
    expect(stripped.pettyCash.fundDeliveries).toEqual([]);
    expect(stripped.pettyCash.totalFundLimit).toBe(withMeta.pettyCash.totalFundLimit);
  });

  it('resolve une meta remoto y legacy sin perder registros', () => {
    const remote = extractPettyCashMeta({
      ...initialSystemSettings.pettyCash,
      weekClosures: [
        {
          id: 'r',
          custodianId: 'u',
          weekNumber: '2026-W02',
          closedAt: '',
          openingFund: 0,
          expensesTotal: 0,
          closingBalance: 0,
          carriedForward: 0,
        },
      ],
    });
    const legacy = extractPettyCashMeta({
      ...initialSystemSettings.pettyCash,
      fundDeliveries: [
        {
          id: 'l',
          custodianId: 'u',
          weekNumber: '2026-W01',
          configuredAmount: 100,
          deliveredAmount: 100,
          deliveredAt: '',
          deliveredByUserId: 'a',
        },
      ],
    });
    const out = resolvePettyCashMeta(remote, legacy);
    expect(out.weekClosures).toHaveLength(1);
    expect(out.fundDeliveries).toHaveLength(1);
    expect(out.weekClosures[0]?.id).toBe('r');
    expect(out.fundDeliveries[0]?.id).toBe('l');
  });
});
