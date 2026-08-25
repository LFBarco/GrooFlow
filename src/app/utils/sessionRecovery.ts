import { isSupabaseBackend } from '../config/backend';
import { getSupabaseClientLazy } from '../services/repository/supabaseLazy';
import { isAccessTokenExpired } from './accessToken';

const REFRESH_TIMEOUT_MS = 5000;

/**
 * Tras minutos con la pestaña en segundo plano el JWT puede caducar y el SDK
 * tarda en renovarlo. Refresca de forma proactiva al volver a la pestaña.
 */
export async function recoverSupabaseSessionAfterIdle(): Promise<boolean> {
  if (!isSupabaseBackend()) return true;

  try {
    const sb = await getSupabaseClientLazy();
    if (!sb) return true;
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
      const sb = await getSupabaseClientLazy();
      if (!sb) return false;
      const { data: fallback } = await sb.auth.getSession();
      return Boolean(fallback.session?.user?.id);
    } catch {
      return false;
    }
  }
}
