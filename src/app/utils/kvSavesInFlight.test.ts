import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/api', () => ({
  api: {
    saveKey: vi.fn(),
  },
}));

import { api } from '../services/api';
import {
  enqueueKvSerializedSave,
  getKvSavesInFlightCount,
  KV_CHAIN_IDLE,
  resetKvSavesInFlightForTests,
  type KvSaveResult,
} from './kvSerializedSave';

describe('getKvSavesInFlightCount', () => {
  beforeEach(() => {
    resetKvSavesInFlightForTests();
    vi.mocked(api.saveKey).mockReset();
  });

  it('sube y baja con encolados KV', async () => {
    vi.mocked(api.saveKey).mockImplementation(
      () => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 40))
    );

    const chainRef = { current: KV_CHAIN_IDLE as Promise<KvSaveResult> };
    const genRef = { current: 0 };
    const latestRef = { current: { x: 1 } };

    expect(getKvSavesInFlightCount()).toBe(0);
    const pending = enqueueKvSerializedSave(
      chainRef,
      genRef,
      latestRef,
      'data:test',
      { x: 2 }
    );
    expect(getKvSavesInFlightCount()).toBe(1);

    await pending;
    expect(getKvSavesInFlightCount()).toBe(0);
  });
});
