import { describe, expect, it } from 'vitest';

import { buildVeterinariUrl, normalizeVeterinariBaseUrl } from './veterinariApi';

describe('veterinariApi', () => {
  it('normaliza base URL', () => {
    expect(normalizeVeterinariBaseUrl('https://host/api/oapi/')).toBe('https://host/api/oapi');
  });

  it('buildVeterinariUrl arma GetClientes con page', () => {
    const url = buildVeterinariUrl('https://host/api/oapi', 'GetClientes');
    expect(url).toBe('https://host/api/oapi/GetClientes?page=1');
  });

  it('buildVeterinariUrl agrega year/month a GetVentas', () => {
    const url = buildVeterinariUrl('https://host/api/oapi', 'GetVentas');
    expect(url).toContain('GetVentas');
    expect(url).toContain('page=1');
    expect(url).toMatch(/year=\d+/);
    expect(url).toMatch(/month=\d+/);
  });
});
