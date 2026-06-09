import { describe, expect, it } from 'vitest';

import {
  buildVeterinariUrl,
  normalizeVeterinariBaseUrl,
  normalizeVeterinariToken,
  sanitizeVeterinariBaseUrl,
} from './veterinariApi';

describe('veterinariApi', () => {
  it('normaliza base URL', () => {
    expect(normalizeVeterinariBaseUrl('https://host/api/oapi/')).toBe('https://host/api/oapi');
  });

  it('sanitize quita endpoint y query pegados en la base', () => {
    expect(
      sanitizeVeterinariBaseUrl('https://host/api/oapi/GetVentas?page=1')
    ).toBe('https://host/api/oapi');
  });

  it('buildVeterinariUrl arma GetClientes con page', () => {
    const url = buildVeterinariUrl('https://host/api/oapi', 'GetClientes');
    expect(url).toBe('https://host/api/oapi/GetClientes?page=1');
  });

  it('buildVeterinariUrl agrega year/month a GetVentas', () => {
    const url = buildVeterinariUrl('https://host/api/oapi', 'GetVentas', {
      year: 2026,
      month: 1,
    });
    expect(url).toContain('GetVentas');
    expect(url).toContain('page=1');
    expect(url).toContain('year=2026');
    expect(url).toContain('month=1');
  });

  it('normalizeVeterinariToken quita Bearer', () => {
    expect(normalizeVeterinariToken('Bearer abc-123')).toBe('abc-123');
  });

  it('buildVeterinariUrl no duplica path si la base tenía GetVentas', () => {
    const url = buildVeterinariUrl(
      'https://host/api/oapi/GetVentas?page=1',
      'GetVentas'
    );
    expect(url).toMatch(/^https:\/\/host\/api\/oapi\/GetVentas\?/);
    expect(url).not.toContain('GetVentas/GetVentas');
    const u = new URL(url);
    expect(u.searchParams.get('month')).toMatch(/^\d+$/);
  });
});
