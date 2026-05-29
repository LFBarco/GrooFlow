import { describe, expect, it } from 'vitest';
import { shouldAllowKvRemoteHydrate } from './kvDomainPersistence';

describe('shouldAllowKvRemoteHydrate', () => {
  it('bloquea si el GET falló', () => {
    expect(
      shouldAllowKvRemoteHydrate(true, { current: false }, { current: 0 })
    ).toBe(false);
  });

  it('bloquea durante skip hydrate', () => {
    expect(
      shouldAllowKvRemoteHydrate(false, { current: true }, { current: 0 })
    ).toBe(false);
  });

  it('bloquea durante cooldown post-save', () => {
    expect(
      shouldAllowKvRemoteHydrate(false, { current: false }, { current: Date.now() + 5000 })
    ).toBe(false);
  });

  it('permite hydrate cuando no hay bloqueos', () => {
    expect(
      shouldAllowKvRemoteHydrate(false, { current: false }, { current: 0 })
    ).toBe(true);
  });
});
