import { useEffect, type MutableRefObject } from 'react';
import { isRestBackend } from '../config/backend';
import { repository } from '../services/repository';
import { PETTY_CASH_META_KV_KEY } from '../utils/pettyCashMeta';

/** Claves operativas que deben refrescarse entre usuarios en Hostinger REST (sin Supabase Realtime). */
const REST_POLL_KEYS = [
  'data:pettyCash',
  PETTY_CASH_META_KV_KEY,
  'data:fleet',
  'data:inventory',
] as const;

const POLL_MS = 12_000;

/**
 * Polling + refresh al volver a la pestaña para backends REST.
 * Complementa BroadcastChannel (solo misma pestaña/navegador).
 */
export function useRestKvPollingSync(
  enabled: boolean,
  applyRef: MutableRefObject<((key: string, value: unknown) => void) | null>
): void {
  useEffect(() => {
    if (!enabled || !isRestBackend()) return;

    let cancelled = false;
    let inFlight = false;

    const pull = async () => {
      if (cancelled || inFlight) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      inFlight = true;
      try {
        const kv = repository.kv;
        await Promise.all(
          REST_POLL_KEYS.map(async (key) => {
            try {
              const value = await kv.get(key);
              if (cancelled || value === null || value === undefined) return;
              applyRef.current?.(key, value);
            } catch {
              /* red intermitente: reintentar en el siguiente ciclo */
            }
          })
        );
      } finally {
        inFlight = false;
      }
    };

    void pull();
    const timer = window.setInterval(() => {
      void pull();
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void pull();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [enabled, applyRef]);
}
