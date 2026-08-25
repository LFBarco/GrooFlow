import { useEffect, type MutableRefObject } from 'react';

import { getSupabaseClientLazy } from '../services/repository/supabaseLazy';
import { isFleetSqlEnabled, loadFleetFromSql } from '../services/repository/fleetSql';
import { normalizeFleetDataset } from '../utils/fleetData';
import { mergeFleetRemoteIntoLocal } from '../utils/fleetMerge';
import { kvPayloadsEqual } from '../utils/kvCrossTabSync';
import { shouldApplyFleetRemoteSnapshot } from '../utils/fleetRemoteSyncGuard';
import type { FleetDataset } from '../types/fleet';

/**
 * Realtime multi-dispositivo sobre tablas fleet_* (Fase 4).
 * Respeta cooldown local y no pisa KV con SQL vacío/desactualizado.
 */
export function useFleetRealtimeSync(
  enabled: boolean,
  applyRef: MutableRefObject<((dataset: FleetDataset) => void) | null>,
  latestRef: MutableRefObject<FleetDataset>,
  cooldownUntilRef: MutableRefObject<number>
): void {
  useEffect(() => {
    if (!enabled || !isFleetSqlEnabled()) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let reloadInFlight = false;
    let dispose: (() => void) | undefined;

    void getSupabaseClientLazy().then((client) => {
    if (!client || cancelled) return;

    const reload = async (source: 'realtime' | 'poll') => {
      if (cancelled || reloadInFlight) return;
      reloadInFlight = true;
      try {
        const result = await loadFleetFromSql(client);
        if (!result.ok || !result.data) {
          if (import.meta.env.DEV) {
            console.warn(`[fleet-realtime] reload (${source}) sin datos`, result);
          }
          return;
        }

        const remote = normalizeFleetDataset(result.data);
        if (
          !shouldApplyFleetRemoteSnapshot(
            latestRef.current,
            remote,
            cooldownUntilRef.current
          )
        ) {
          return;
        }

        const merged = mergeFleetRemoteIntoLocal(latestRef.current, remote);
        if (kvPayloadsEqual(latestRef.current, merged)) return;

        latestRef.current = merged;
        applyRef.current?.(merged);
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
      .channel('grooflow-fleet-realtime-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fleet_vehicles' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fleet_maintenance' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fleet_fuel_entries' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fleet_inspections' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fleet_checklist' }, scheduleReload)
      .subscribe((status, err) => {
        if (import.meta.env.DEV) {
          console.info('[fleet-realtime] channel', status, err ?? '');
        }
      });

    dispose = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      void client.removeChannel(channel);
    };
    });

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [enabled, applyRef, latestRef, cooldownUntilRef]);
}
