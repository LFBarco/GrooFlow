import { describe, expect, it } from 'vitest';
import { isPasswordRecoveryUrl } from '../pages/PasswordRecoveryPage';

describe('isPasswordRecoveryUrl', () => {
  it('detecta type=recovery en el hash', () => {
    expect(isPasswordRecoveryUrl('#access_token=x&type=recovery&expires_in=3600')).toBe(true);
  });

  it('retorna false sin hash de recuperación', () => {
    expect(isPasswordRecoveryUrl('')).toBe(false);
    expect(isPasswordRecoveryUrl('#access_token=x&type=refresh')).toBe(false);
  });
});
