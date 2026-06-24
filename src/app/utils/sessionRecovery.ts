import { getSupabaseClient } from '../services/repository/supabase';
import { isAccessTokenExpired } from './accessToken';

const REFRESH_TIMEOUT_MS = 5000;

/**
 * Tras minutos con la pestaña en segundo plano el JWT puede caducar y el SDK
 * tarda en renovarlo. Refresca de forma proactiva al volver a la pestaña.
 */
export async function recoverSupabaseSessionAfterIdle(): Promise<boolean> {
  const backend = import.meta.env.VITE_BACKEND ?? 'supabase';
  if (backend !== 'supabase') return true;

  try {
    const sb = getSupabaseClient();
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;

    if (data.session?.user && token && !isAccessTokenExpired(token)) {
      return true;
    }

    await Promise.race([
      sb.auth.refreshSession(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), REFRESH_TIMEOUT_MS)),
    ]);

    const { data: after } = await sb.auth.getSession();
    return Boolean(after.session?.user?.id);
  } catch {
    try {
      const { data: fallback } = await getSupabaseClient().auth.getSession();
      return Boolean(fallback.session?.user?.id);
    } catch {
      return false;
    }
  }
}
