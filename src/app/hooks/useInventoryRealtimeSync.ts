import { useEffect, type MutableRefObject } from 'react';

import { getSupabaseClient } from '../services/repository/supabase';
import { isInventorySqlEnabled, loadInventoryFromSql } from '../services/repository/inventorySql';
import { normalizeInventoryDataset } from '../utils/inventoryData';
import { shouldApplyInventoryRemoteSnapshot } from '../utils/inventoryRemoteSyncGuard';
import type { InventoryDataset } from '../types/inventory';

export function useInventoryRealtimeSync(
  enabled: boolean,
  applyRef: MutableRefObject<((dataset: InventoryDataset) => void) | null>,
  latestRef: MutableRefObject<InventoryDataset>,
  cooldownUntilRef: MutableRefObject<number>
): void {
  useEffect(() => {
    if (!enabled || !isInventorySqlEnabled()) return;

    const client = getSupabaseClient();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    let reloadInFlight = false;

    const reload = async (source: 'realtime' | 'poll') => {
      if (cancelled || reloadInFlight) return;
      reloadInFlight = true;
      try {
        const result = await loadInventoryFromSql(client);
        if (!result.ok || !result.data) {
          if (import.meta.env.DEV) {
            console.warn(`[inventory-realtime] reload (${source}) sin datos`, result);
          }
          return;
        }
        const remote = normalizeInventoryDataset(result.data);
        if (
          !shouldApplyInventoryRemoteSnapshot(
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
      debounceTimer = setTimeout(() => void reload('realtime'), 400);
    };

    const channel = client
      .channel('grooflow-inventory-realtime-v1')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_equipment' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_maintenance' }, scheduleReload)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && import.meta.env.PROD) {
          void reload('realtime');
        }
      });

    pollTimer = setInterval(() => void reload('poll'), 45_000);

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (pollTimer) clearInterval(pollTimer);
      void client.removeChannel(channel);
    };
  }, [enabled, applyRef, latestRef, cooldownUntilRef]);
}
