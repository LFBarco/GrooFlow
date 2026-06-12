import { useEffect, type MutableRefObject } from 'react';

import { getSupabaseClient } from '../services/repository/supabase';
import {
  isTransactionsSqlEnabled,
  loadTransactionsFromSql,
} from '../services/repository/transactionsSql';
import type { Transaction } from '../types';
import { shouldApplyTransactionsRemoteSnapshot } from '../utils/transactionsRemoteSyncGuard';

/**
 * Realtime multi-dispositivo sobre `public.transactions`.
 */
export function useTransactionsRealtimeSync(
  enabled: boolean,
  applyRef: MutableRefObject<((items: Transaction[]) => void) | null>,
  latestRef: MutableRefObject<Transaction[]>,
  cooldownUntilRef: MutableRefObject<number>
): void {
  useEffect(() => {
    if (!enabled || !isTransactionsSqlEnabled()) return;

    const client = getSupabaseClient();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    let reloadInFlight = false;

    const reload = async (source: 'realtime' | 'poll') => {
      if (cancelled || reloadInFlight) return;
      reloadInFlight = true;
      try {
        const result = await loadTransactionsFromSql(client);
        if (!result.ok || !result.data) {
          if (import.meta.env.DEV) {
            console.warn(`[transactions-realtime] reload (${source}) sin datos`, result);
          }
          return;
        }
        const remote = result.data;
        if (
          !shouldApplyTransactionsRemoteSnapshot(
            latestRef.current,
            remote,
            cooldownUntilRef.current
          )
        ) {
          return;
        }
        latestRef.current = remote;
        applyRef.current?.(remote);
      } finally {
        reloadInFlight = false;
      }
    };

    const scheduleReload = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void reload('realtime');
      }, 400);
    };

    const channel = client
      .channel('grooflow-transactions-realtime-v1')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, scheduleReload)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && import.meta.env.PROD) {
          void reload('realtime');
        }
      });

    pollTimer = setInterval(() => {
      void reload('poll');
    }, 45_000);

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (pollTimer) clearInterval(pollTimer);
      void client.removeChannel(channel);
    };
  }, [enabled, applyRef, latestRef, cooldownUntilRef]);
}
