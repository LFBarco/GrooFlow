import { useEffect, type MutableRefObject } from 'react';
import { isRestBackend } from '../config/backend';
import { repository } from '../services/repository';
import { resourceRevisions } from '../services/repository/rest';
import { PETTY_CASH_META_KV_KEY } from '../utils/pettyCashMeta';

/** Claves operativas que deben refrescarse entre usuarios en Hostinger REST (sin Supabase Realtime). */
const REST_POLL_KEYS = [
  'data:pettyCash',
  PETTY_CASH_META_KV_KEY,
  'data:fleet',
  'data:inventory',
] as const;

const POLL_MS = 12_000;

type ApplyRemoteFn = (key: string, value: unknown) => boolean | void;

/**
 * Polling + refresh al volver a la pestaña para backends REST.
 * Complementa BroadcastChannel (solo misma pestaña/navegador).
 *
 * Importante: no adelanta la revisión KV si el snapshot no se aplicó (cooldown /
 * guard local). Si no, un PUT posterior usa revisión nueva con datos viejos y
 * puede fallar con 409 o pisar altas ajenas.
 */
export function useRestKvPollingSync(
  enabled: boolean,
  applyRef: MutableRefObject<ApplyRemoteFn | null>
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
              const status =
                typeof kv.getWithStatus === 'function'
                  ? await kv.getWithStatus(key, { updateRevision: false })
                  : {
                      ok: true as const,
                      value: await kv.get(key),
                      revision: undefined as string | undefined,
                    };
              if (cancelled || !status.ok || status.value === null || status.value === undefined) {
                return;
              }
              const applied = applyRef.current?.(key, status.value) === true;
              if (applied && typeof status.revision === 'string' && status.revision !== '') {
                resourceRevisions.set(key, status.revision);
              }
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
