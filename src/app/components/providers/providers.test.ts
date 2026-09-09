import { describe, expect, it } from 'vitest';
import type { Provider } from '../../types';

function validateProviderDocument(ruc: string, docType?: 'RUC' | 'DNI' | 'CE'): { valid: boolean; error?: string } {
  const digits = ruc.trim();
  if (!/^\d+$/.test(digits)) {
    return { valid: false, error: 'El número de documento debe contener solo dígitos' };
  }
  const type = docType || (digits.length === 11 ? 'RUC' : digits.length === 8 ? 'DNI' : 'CE');
  if (type === 'RUC' && digits.length !== 11) {
    return { valid: false, error: 'El RUC debe tener exactamente 11 dígitos' };
  }
  if (type === 'DNI' && digits.length !== 8) {
    return { valid: false, error: 'El DNI debe tener exactamente 8 dígitos' };
  }
  return { valid: true };
}

function isProviderActiveForContext(provider: Provider, context: 'pettyCash' | 'purchases' | 'professionalFees'): boolean {
  if (!provider.usageContexts) return true; // Si no está especificado, está activo en todos
  return provider.usageContexts[context] !== false;
}

describe('Provider Manager Module', () => {
  it('valida RUC peruano de 11 dígitos', () => {
    const validRuc = validateProviderDocument('20601234567', 'RUC');
    expect(validRuc.valid).toBe(true);

    const invalidRuc = validateProviderDocument('206012345', 'RUC');
    expect(invalidRuc.valid).toBe(false);
    expect(invalidRuc.error).toContain('11 dígitos');
  });

  it('valida DNI de 8 dígitos', () => {
    const validDni = validateProviderDocument('45678901', 'DNI');
    expect(validDni.valid).toBe(true);

    const invalidDni = validateProviderDocument('4567890', 'DNI');
    expect(invalidDni.valid).toBe(false);
    expect(invalidDni.error).toContain('8 dígitos');
  });

  it('evalúa contexto de uso permitido para el proveedor', () => {
    const p: Provider = {
      id: 'p1',
      ruc: '20601111111',
      name: 'Distribuidora Médica S.A.C.',
      category: 'Proveedores',
      defaultCreditDays: 30,
      usageContexts: {
        pettyCash: true,
        purchases: true,
        professionalFees: false,
      },
    };

    expect(isProviderActiveForContext(p, 'pettyCash')).toBe(true);
    expect(isProviderActiveForContext(p, 'purchases')).toBe(true);
    expect(isProviderActiveForContext(p, 'professionalFees')).toBe(false);
  });
});
