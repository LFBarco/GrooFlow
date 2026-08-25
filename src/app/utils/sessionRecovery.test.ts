import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const refreshSessionMock = vi.fn();

vi.mock('../services/repository/supabaseLazy', () => ({
  getSupabaseClientLazy: async () => ({
    auth: {
      getSession: getSessionMock,
      refreshSession: refreshSessionMock,
    },
  }),
}));

import { recoverSupabaseSessionAfterIdle } from './sessionRecovery';

function jwtWithExp(expSecondsFromNow: number): string {
  const exp = Math.floor(Date.now() / 1000) + expSecondsFromNow;
  const payload = btoa(JSON.stringify({ exp }));
  return `hdr.${payload}.sig`;
}

describe('recoverSupabaseSessionAfterIdle', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_BACKEND', 'supabase');
    getSessionMock.mockReset();
    refreshSessionMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('no refresca si el token sigue vigente', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { user: { id: 'u1' }, access_token: jwtWithExp(3600) } },
    });

    await expect(recoverSupabaseSessionAfterIdle()).resolves.toBe(true);
    expect(refreshSessionMock).not.toHaveBeenCalled();
  });

  it('refresca si el token expiró y devuelve true con sesión válida', async () => {
    getSessionMock
      .mockResolvedValueOnce({
        data: { session: { user: { id: 'u1' }, access_token: jwtWithExp(-60) } },
      })
      .mockResolvedValueOnce({
        data: { session: { user: { id: 'u1' }, access_token: jwtWithExp(3600) } },
      });
    refreshSessionMock.mockResolvedValue({ data: { session: {} }, error: null });

    await expect(recoverSupabaseSessionAfterIdle()).resolves.toBe(true);
    expect(refreshSessionMock).toHaveBeenCalledTimes(1);
  });

  it('en modo local no llama a Supabase', async () => {
    vi.stubEnv('VITE_BACKEND', 'local');
    await expect(recoverSupabaseSessionAfterIdle()).resolves.toBe(true);
    expect(getSessionMock).not.toHaveBeenCalled();
  });
});
