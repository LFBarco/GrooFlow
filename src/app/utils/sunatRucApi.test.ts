import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  normalizeRucDigits,
  isValidRucDigits,
  lookupRucInDbOrSunat,
  type SunatRucInfo,
} from './sunatRucApi';

describe('SUNAT & BD RUC Lookup System', () => {
  const mockProviders = [
    { ruc: '20123456789', name: 'Distribuidora Veterinaria S.A.C.', direccion: 'Av. Brasil 123' },
    { ruc: '20987654321', name: 'Servicios Médicos Groomers', direccion: 'Calle Las Flores 456' },
  ];

  it('normalizes and validates RUC digits correctly', () => {
    expect(normalizeRucDigits(' 20-123.456.789 ')).toBe('20123456789');
    expect(isValidRucDigits('20123456789')).toBe(true);
    expect(isValidRucDigits('12345678')).toBe(false);
  });

  it('finds provider in internal BD catalog first before querying external SUNAT', async () => {
    const result = await lookupRucInDbOrSunat('20123456789', mockProviders);
    expect(result).not.toBeNull();
    expect(result?.source).toBe('bd');
    expect(result?.razonSocial).toBe('Distribuidora Veterinaria S.A.C.');
    expect(result?.direccion).toBe('Av. Brasil 123');
  });

  it('falls back to SUNAT API when RUC is not found in internal BD catalog', async () => {
    // RUC not in mockProviders
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          razonSocial: 'Empresa Externa SUNAT S.A.C.',
          direccion: 'Av. Javier Prado 100',
        }),
      } as Response;
    });

    const result = await lookupRucInDbOrSunat('20555666777', mockProviders);
    expect(result).not.toBeNull();
    expect(result?.source).toBe('sunat');
    expect(result?.razonSocial).toBe('Empresa Externa SUNAT S.A.C.');

    fetchSpy.mockRestore();
  });
});
