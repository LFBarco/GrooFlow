import { describe, expect, it } from 'vitest';
import { getProductionConfigIssues } from './productionGuard';

describe('productionGuard', () => {
  it('no reporta issues en desarrollo', () => {
    expect(
      getProductionConfigIssues({
        prod: false,
        backend: 'local',
        productionSql: undefined,
        supabaseUrl: undefined,
      })
    ).toEqual([]);
  });

  it('detecta backend local en producción', () => {
    const codes = getProductionConfigIssues({
      prod: true,
      backend: 'local',
      productionSql: undefined,
      supabaseUrl: 'https://x.supabase.co',
    }).map((i) => i.code);
    expect(codes).toContain('backend_local');
  });

  it('detecta SQL desactivado en producción', () => {
    const codes = getProductionConfigIssues({
      prod: true,
      backend: 'supabase',
      productionSql: 'false',
      supabaseUrl: 'https://x.supabase.co',
    }).map((i) => i.code);
    expect(codes).toContain('sql_disabled');
  });
});
