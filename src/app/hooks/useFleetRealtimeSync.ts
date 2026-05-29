import { useEffect, type MutableRefObject } from 'react';
import { getSupabaseClient } from '../services/repository/supabase';
import { isFleetSqlEnabled, loadFleetFromSql } from '../services/repository/fleetSql';
import { normalizeFleetDataset } from '../utils/fleetData';
import { kvPayloadsEqual } from '../utils/kvCrossTabSync';
import type { FleetDataset } from '../types/fleet';

/**
 * Realtime multi-dispositivo sobre tablas fleet_* (Fase 4).
 * Recarga SQL y aplica al state si el payload difiere del local.
 */
export function useFleetRealtimeSync(
  enabled: boolean,
  applyRef: MutableRefObject<((dataset: FleetDataset) => void) | null>,
  latestRef: MutableRefObject<FleetDataset>,
  cooldownUntilRef: MutableRefObject<number>
): void {
  useEffect(() => {
    if (!enabled || !isFleetSqlEnabled()) return;

    const client = getSupabaseClient();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const reload = async () => {
      if (cancelled) return;
      if (Date.now() < cooldownUntilRef.current) return;
      const result = await loadFleetFromSql(client);
      if (!result.ok || !result.data) return;
      if (kvPayloadsEqual(latestRef.current, result.data)) return;
      latestRef.current = result.data;
      applyRef.current?.(normalizeFleetDataset(result.data));
    };

    const scheduleReload = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void reload();
      }, 600);
    };

    const channel = client
      .channel('grooflow-fleet-realtime-v1')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fleet_vehicles' },
        scheduleReload
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fleet_maintenance' },
        scheduleReload
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fleet_fuel_entries' },
        scheduleReload
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fleet_inspections' },
        scheduleReload
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fleet_checklist' },
        scheduleReload
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      void client.removeChannel(channel);
    };
  }, [enabled, applyRef, latestRef, cooldownUntilRef]);
}
