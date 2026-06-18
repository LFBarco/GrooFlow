import { describe, expect, it } from 'vitest';
import { isDemoLoginEnabled, tryDemoLogin } from './demoLogin';

const devLocal: Parameters<typeof isDemoLoginEnabled>[0] = {
  prod: false,
  dev: true,
  backend: 'local',
  allowDemoLogin: false,
};

const devSupabaseNoFlag: Parameters<typeof isDemoLoginEnabled>[0] = {
  prod: false,
  dev: true,
  backend: 'supabase',
  allowDemoLogin: false,
};

const devSupabaseWithFlag: Parameters<typeof isDemoLoginEnabled>[0] = {
  prod: false,
  dev: true,
  backend: 'supabase',
  allowDemoLogin: true,
};

describe('demoLogin', () => {
  it('nunca habilita demo en build de producción', () => {
    expect(
      isDemoLoginEnabled({
        prod: true,
        dev: false,
        backend: 'local',
        allowDemoLogin: true,
      })
    ).toBe(false);
    expect(
      tryDemoLogin('admin@grooflow.com', '123456', {
        prod: true,
        dev: false,
        backend: 'local',
        allowDemoLogin: true,
      })
    ).toBe(false);
  });

  it('permite demo con backend local en desarrollo', () => {
    expect(isDemoLoginEnabled(devLocal)).toBe(true);
    expect(tryDemoLogin('admin@grooflow.com', '123456', devLocal)).toBe(true);
    expect(tryDemoLogin('admin@grooflow.com', 'wrong', devLocal)).toBe(false);
  });

  it('requiere flag explícito con backend supabase en dev', () => {
    expect(isDemoLoginEnabled(devSupabaseNoFlag)).toBe(false);
    expect(isDemoLoginEnabled(devSupabaseWithFlag)).toBe(true);
    expect(tryDemoLogin('admin@vetflow.com', '123456', devSupabaseWithFlag)).toBe(true);
  });
});
