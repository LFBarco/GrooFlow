import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { toast } from 'sonner';

import { getAuthUserId } from '../services/productionSqlBridge';
import { isFleetSqlEnabled, saveFleetToSql } from '../services/repository/fleetSql';
import { getSupabaseClient } from '../services/repository/supabase';
import type { FleetDataset } from '../types/fleet';
import { backupToSqlAfterKvSave, ensureSqlSave } from '../utils/sqlAutosaveBackup';
import {
  autosaveKvDomain,
  persistKvDomainNow,
  type CloudSyncTracker,
  type KvDomainRefs,
} from '../utils/kvDomainPersistence';

const FLEET_USE_SQL = isFleetSqlEnabled();

export type UseFleetPersistenceOptions = {
  isDataLoaded: boolean;
  fleetDataset: FleetDataset;
  setFleetDataset: Dispatch<SetStateAction<FleetDataset>>;
  hydratedRef: MutableRefObject<boolean>;
  skipHydrateRef: MutableRefObject<boolean>;
  chainRef: MutableRefObject<Promise<unknown>>;
  latestRef: MutableRefObject<FleetDataset>;
  cooldownUntilRef: MutableRefObject<number>;
  kvApplyGenerationRef: MutableRefObject<number>;
  lastSaveErrorAtRef: MutableRefObject<Record<string, number>>;
  cloudSync: CloudSyncTracker;
};

export function useFleetPersistence(options: UseFleetPersistenceOptions) {
  const {
    isDataLoaded,
    fleetDataset,
    setFleetDataset,
    hydratedRef,
    skipHydrateRef,
    chainRef,
    latestRef,
    cooldownUntilRef,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
    cloudSync,
  } = options;

  const fleetRefs: KvDomainRefs<FleetDataset> = {
    chainRef,
    latestRef,
    cooldownUntilRef,
  };

  useEffect(() => {
    if (!isDataLoaded || !hydratedRef.current) return;

    /** Siempre KV (Edge Function probada). SQL es réplica para Realtime. */
    void autosaveKvDomain({
      kvKey: 'data:fleet',
      payload: fleetDataset,
      refs: fleetRefs,
      kvApplyGenerationRef,
      lastSaveErrorAtRef,
      errorMessage:
        'No se pudo guardar Flota clínica en la nube. Revisa sesión/red antes de cerrar o actualizar la página.',
      sync: cloudSync,
    }).then((kvOk) => {
      if (!kvOk) return;
      void backupToSqlAfterKvSave({
        enabled: FLEET_USE_SQL,
        storageKey: 'data:fleet',
        lastSaveErrorAtRef,
        run: async () => {
          const { data: sess } = await getSupabaseClient().auth.getSession();
          return saveFleetToSql(getSupabaseClient(), latestRef.current, sess.session?.user?.id ?? null);
        },
      });
    });
  }, [fleetDataset, isDataLoaded]);

  const persistFleetNow = useCallback(
    async (next: FleetDataset, successMessage?: string): Promise<boolean> => {
      setFleetDataset(next);
      if (!isDataLoaded || !hydratedRef.current) {
        toast.error('Los datos siguen cargando desde la nube. Espera unos segundos y vuelve a intentar.');
        return false;
      }
      latestRef.current = next;

      const kvOk = await persistKvDomainNow({
        kvKey: 'data:fleet',
        payload: next,
        refs: {
          hydratedFromKvRef: hydratedRef,
          skipHydrateRef,
          cooldownUntilRef,
          chainRef,
          latestRef,
        },
        kvApplyGenerationRef,
        lastSaveErrorAtRef,
        errorMessage:
          'No se pudo guardar Flota clínica en la nube. No cierres ni actualices; revisa conexión/sesión.',
        successMessage: FLEET_USE_SQL ? undefined : successMessage,
        sync: cloudSync,
      });

      if (!kvOk) return false;

      if (FLEET_USE_SQL) {
        const uid = await getAuthUserId();
        if (!uid) {
          toast.error('No hay sesión activa. Inicia sesión de nuevo antes de guardar la flota.');
          return false;
        }
        const sqlOk = await ensureSqlSave(
          true,
          'data:fleet',
          () => saveFleetToSql(getSupabaseClient(), next, uid),
          lastSaveErrorAtRef
        );
        if (!sqlOk) return false;
      }

      if (successMessage) toast.success(successMessage);
      return true;
    },
    [isDataLoaded, setFleetDataset, cloudSync]
  );

  const handleFleetDatasetUpdate = useCallback(
    (updater: FleetDataset | ((prev: FleetDataset) => FleetDataset)) => {
      setFleetDataset((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        latestRef.current = next;
        return next;
      });
    },
    [setFleetDataset]
  );

  return { persistFleetNow, handleFleetDatasetUpdate };
}
