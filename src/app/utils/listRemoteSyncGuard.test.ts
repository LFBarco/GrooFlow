import { describe, expect, it } from 'vitest';
import { shouldApplyListRemoteSnapshot, shouldApplyValueRemoteSnapshot } from './listRemoteSyncGuard';

describe('shouldApplyListRemoteSnapshot', () => {
  it('rechaza durante cooldown', () => {
    expect(shouldApplyListRemoteSnapshot([{ id: '1' }], [{ id: '2' }], Date.now() + 5000)).toBe(
      false
    );
  });

  it('acepta remoto con datos si local vacío', () => {
    expect(shouldApplyListRemoteSnapshot([], [{ id: '1' }], 0)).toBe(true);
  });

  it('rechaza remoto vacío si local tiene filas', () => {
    expect(shouldApplyListRemoteSnapshot([{ id: '1' }], [], 0)).toBe(false);
  });

  it('acepta remoto más corto fuera de cooldown (borrado SQL)', () => {
    expect(
      shouldApplyListRemoteSnapshot(
        [
          { id: '1', name: 'a' },
          { id: '2', name: 'b' },
        ],
        [{ id: '1', name: 'a' }],
        0
      )
    ).toBe(true);
  });

  it('acepta actualización de fila existente', () => {
    expect(
      shouldApplyListRemoteSnapshot(
        [{ id: '1', name: 'local' }],
        [{ id: '1', name: 'remoto' }],
        0
      )
    ).toBe(true);
  });
});

describe('shouldApplyValueRemoteSnapshot', () => {
  it('respeta cooldown', () => {
    expect(shouldApplyValueRemoteSnapshot('dark', 'light', Date.now() + 1000)).toBe(false);
  });

  it('acepta cambio fuera de cooldown', () => {
    expect(shouldApplyValueRemoteSnapshot('dark', 'light', 0)).toBe(true);
  });
});
