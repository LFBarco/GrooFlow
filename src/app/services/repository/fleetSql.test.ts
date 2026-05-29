import { describe, expect, it, vi } from 'vitest';
import { isFleetSqlEnabled } from './fleetSql';

describe('fleetSql', () => {
  it('isFleetSqlEnabled respeta VITE_FLEET_SQL y backend', () => {
    vi.stubEnv('VITE_BACKEND', 'supabase');
    vi.stubEnv('VITE_FLEET_SQL', 'true');
    expect(isFleetSqlEnabled()).toBe(true);
    vi.stubEnv('VITE_FLEET_SQL', 'false');
    expect(isFleetSqlEnabled()).toBe(false);
    vi.unstubAllEnvs();
  });
});
