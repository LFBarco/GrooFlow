import { describe, expect, it } from 'vitest';
import {
  kvKeyDisplayLabel,
  kvPayloadsEqual,
  markCrossTabEchoWindow,
  shouldBroadcastKvUpdate,
} from './kvCrossTabSync';

describe('kvCrossTabSync', () => {
  it('genera etiquetas legibles para claves conocidas', () => {
    expect(kvKeyDisplayLabel('data:fleet')).toBe('Flota clínica');
    expect(kvKeyDisplayLabel('data:transactions')).toBe('Transacciones');
  });

  it('compara payloads por JSON estable', () => {
    expect(kvPayloadsEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(kvPayloadsEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('suprime broadcast durante ventana eco cross-tab', () => {
    markCrossTabEchoWindow('data:transactions', 5000);
    expect(shouldBroadcastKvUpdate('data:transactions')).toBe(false);
    expect(shouldBroadcastKvUpdate('data:providers')).toBe(true);
  });
});
