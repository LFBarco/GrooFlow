import { useEffect, type MutableRefObject } from 'react';

import { getSupabaseClient } from '../services/repository/supabase';

import { isFleetSqlEnabled, loadFleetFromSql } from '../services/repository/fleetSql';

import { normalizeFleetDataset } from '../utils/fleetData';

import { kvPayloadsEqual } from '../utils/kvCrossTabSync';

import type { FleetDataset } from '../types/fleet';



/**

 * Realtime multi-dispositivo sobre tablas fleet_* (Fase 4).

 * Recarga SQL y aplica al state si el payload difiere del local.

 * No usa cooldown de guardado local: los eventos externos deben aplicarse siempre.

 */

export function useFleetRealtimeSync(

  enabled: boolean,

  applyRef: MutableRefObject<((dataset: FleetDataset) => void) | null>,

  latestRef: MutableRefObject<FleetDataset>

): void {

  useEffect(() => {

    if (!enabled || !isFleetSqlEnabled()) return;



    const client = getSupabaseClient();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    let pollTimer: ReturnType<typeof setInterval> | null = null;

    let cancelled = false;

    let reloadInFlight = false;



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

        if (kvPayloadsEqual(latestRef.current, result.data)) return;

        latestRef.current = result.data;

        applyRef.current?.(normalizeFleetDataset(result.data));

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

      .subscribe((status, err) => {

        if (import.meta.env.DEV) {

          console.info('[fleet-realtime] channel', status, err ?? '');

        }

        if (status === 'SUBSCRIBED' && import.meta.env.PROD) {

          // Una recarga inicial por si perdimos eventos durante la conexión

          void reload('realtime');

        }

      });



    /** Respaldo si Realtime no entrega (red, RLS parcial, etc.) */

    pollTimer = setInterval(() => {

      void reload('poll');

    }, 45_000);



    return () => {

      cancelled = true;

      if (debounceTimer) clearTimeout(debounceTimer);

      if (pollTimer) clearInterval(pollTimer);

      void client.removeChannel(channel);

    };

  }, [enabled, applyRef, latestRef]);

}


