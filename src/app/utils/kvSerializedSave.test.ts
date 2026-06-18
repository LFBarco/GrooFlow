import { describe, expect, it } from 'vitest';

import {
  KV_CHAIN_IDLE,
  flushKvSaveChain,
  flushKvSaveChains,
  kvFlushHasFailures,
  kvSaveSucceeded,
  type KvSaveResult,
} from './kvSerializedSave';

describe('kvSerializedSave flush', () => {
  it('flushKvSaveChain devuelve el resultado de la cadena', async () => {
    const ref = { current: Promise.resolve('saved' as KvSaveResult) };
    await expect(flushKvSaveChain(ref)).resolves.toBe('saved');
  });

  it('flushKvSaveChains agrega resultados por cadena', async () => {
    const ok = { current: Promise.resolve('saved' as KvSaveResult) };
    const fail = { current: Promise.resolve('failed' as KvSaveResult) };
    const skipped = { current: Promise.resolve('skipped' as KvSaveResult) };
    const idle = { current: KV_CHAIN_IDLE };

    const results = await flushKvSaveChains([ok, fail, skipped, idle]);
    expect(results).toEqual(['saved', 'failed', 'skipped', 'saved']);
  });

  it('kvFlushHasFailures solo reacciona a failed', () => {
    expect(kvFlushHasFailures(['saved', 'skipped'])).toBe(false);
    expect(kvFlushHasFailures(['saved', 'failed'])).toBe(true);
    expect(kvSaveSucceeded('skipped')).toBe(false);
  });

  it('flushKvSaveChain tolera rechazos de la promesa', async () => {
    const ref = {
      current: Promise.reject(new Error('network')).catch(() => 'failed' as KvSaveResult),
    };
    await expect(flushKvSaveChain(ref)).resolves.toBe('failed');
  });
});
