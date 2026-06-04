import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enqueueSqlRetry, listSqlRetries } from '../services/repository/sqlRetryQueue';
import { processPendingSqlRetries } from './sqlRetryProcessor';

const STORAGE_KEY = 'gooflow:sql-retry-queue:v1';

function mockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k: string) => store.get(k) ?? null,
    key: (i: number) => [...store.keys()][i] ?? null,
    removeItem: (k: string) => void store.delete(k),
    setItem: (k: string, v: string) => void store.set(k, v),
  };
}

describe('processPendingSqlRetries', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockLocalStorage());
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-19T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reintenta y elimina de la cola cuando SQL responde ok', async () => {
    enqueueSqlRetry('data:transactions');
    const created = listSqlRetries()[0]!.createdAt;
    vi.setSystemTime(created + 3000);

    const run = vi.fn().mockResolvedValue({ ok: true, errors: [] });
    const result = await processPendingSqlRetries(
      { 'data:transactions': run },
      { minAgeMs: 0 }
    );

    expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0, skipped: 0 });
    expect(run).toHaveBeenCalledOnce();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify([]));
  });

  it('omite ítems demasiado recientes', async () => {
    enqueueSqlRetry('data:providers');
    const result = await processPendingSqlRetries(
      { 'data:providers': vi.fn().mockResolvedValue({ ok: true, errors: [] }) },
      { minAgeMs: 5000 }
    );
    expect(result.skipped).toBe(1);
    expect(result.processed).toBe(0);
    expect(listSqlRetries()).toHaveLength(1);
  });

  it('incrementa intentos si el runner falla', async () => {
    enqueueSqlRetry('data:invoices');
    const item = listSqlRetries()[0]!;
    vi.setSystemTime(item.createdAt + 5000);

    await processPendingSqlRetries(
      { 'data:invoices': vi.fn().mockResolvedValue({ ok: false, errors: ['err'] }) },
      { minAgeMs: 0 }
    );

    const after = listSqlRetries()[0];
    expect(after?.attempts).toBe(1);
  });
});
