import { describe, expect, it } from 'vitest';
import { GUEST_USER, EMPTY_INITIAL_TRANSACTIONS } from './appSession';

describe('appSession', () => {
  it('GUEST_USER es invitado activo con todas las sedes', () => {
    expect(GUEST_USER.id).toBe('guest');
    expect(GUEST_USER.allSedes).toBe(true);
    expect(GUEST_USER.status).toBe('active');
  });

  it('transacciones iniciales vacías en producción', () => {
    expect(EMPTY_INITIAL_TRANSACTIONS).toEqual([]);
  });
});
