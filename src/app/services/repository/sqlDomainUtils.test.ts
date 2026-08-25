import { describe, it, expect, vi } from 'vitest';
import { isProductionSqlEnabled } from './sqlDomainUtils';

describe('sqlDomainUtils', () => {
  it('isProductionSqlEnabled activo solo con backend supabase', () => {
    vi.stubEnv('VITE_BACKEND', 'supabase');
    vi.stubEnv('VITE_PRODUCTION_SQL', 'true');
    expect(isProductionSqlEnabled()).toBe(true);
  });

  it('isProductionSqlEnabled desactivado con VITE_PRODUCTION_SQL=false', () => {
    vi.stubEnv('VITE_BACKEND', 'supabase');
    vi.stubEnv('VITE_PRODUCTION_SQL', 'false');
    expect(isProductionSqlEnabled()).toBe(false);
  });
});
