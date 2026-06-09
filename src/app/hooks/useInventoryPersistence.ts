import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { toast } from 'sonner';

import {
  isInventorySqlEnabled,
  saveInventoryToSql,
} from '../services/repository/inventorySql';
import { getSupabaseClient } from '../services/repository/supabase';
import type { InventoryDataset } from '../types/inventory';
import { backupToSqlAfterKvSave, ensureSqlSave } from '../utils/sqlAutosaveBackup';
import {
  autosaveKvDomain,
  persistKvDomainNow,
  type CloudSyncTracker,
  type KvDomainRefs,
} from '../utils/kvDomainPersistence';

const INVENTORY_USE_SQL = isInventorySqlEnabled();

export type UseInventoryPersistenceOptions = {
  isDataLoaded: boolean;
  inventoryDataset: InventoryDataset;
  setInventoryDataset: Dispatch<SetStateAction<InventoryDataset>>;
  hydratedRef: MutableRefObject<boolean>;
  skipHydrateRef: MutableRefObject<boolean>;
  chainRef: MutableRefObject<Promise<unknown>>;
  latestRef: MutableRefObject<InventoryDataset>;
  cooldownUntilRef: MutableRefObject<number>;
  kvApplyGenerationRef: MutableRefObject<number>;
  lastSaveErrorAtRef: MutableRefObject<Record<string, number>>;
  cloudSync: CloudSyncTracker;
};

export function useInventoryPersistence(options: UseInventoryPersistenceOptions) {
  const {
    isDataLoaded,
    inventoryDataset,
    setInventoryDataset,
    hydratedRef,
    skipHydrateRef,
    chainRef,
    latestRef,
    cooldownUntilRef,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
    cloudSync,
  } = options;

  const inventoryRefs: KvDomainRefs<InventoryDataset> = {
    chainRef,
    latestRef,
    cooldownUntilRef,
  };

  useEffect(() => {
    if (!isDataLoaded || !hydratedRef.current) return;
    void autosaveKvDomain({
      kvKey: 'data:inventory',
      payload: inventoryDataset,
      refs: inventoryRefs,
      kvApplyGenerationRef,
      lastSaveErrorAtRef,
      errorMessage:
        'No se pudo guardar el inventario de equipos en la nube. Revisa sesión/red antes de cerrar.',
      sync: cloudSync,
    }).then((kvOk) => {
      if (!kvOk) return;
      void backupToSqlAfterKvSave({
        enabled: INVENTORY_USE_SQL,
        storageKey: 'data:inventory',
        lastSaveErrorAtRef,
        run: async () => {
          const { data: sess } = await getSupabaseClient().auth.getSession();
          return saveInventoryToSql(
            getSupabaseClient(),
            latestRef.current,
            sess.session?.user?.id ?? null
          );
        },
      });
    });
  }, [inventoryDataset, isDataLoaded]);

  const persistInventoryNow = useCallback(
    async (next: InventoryDataset, successMessage?: string): Promise<boolean> => {
      setInventoryDataset(next);
      if (!isDataLoaded || !hydratedRef.current) {
        toast.error('Los datos siguen cargando desde la nube. Espera unos segundos y vuelve a intentar.');
        return false;
      }
      latestRef.current = next;

      const kvOk = await persistKvDomainNow({
        kvKey: 'data:inventory',
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
          'No se pudo guardar el inventario en la nube. No cierres ni actualices; revisa conexión/sesión.',
        successMessage: INVENTORY_USE_SQL ? undefined : successMessage,
        sync: cloudSync,
      });

      if (!kvOk) return false;

      if (INVENTORY_USE_SQL) {
        const { data: sess } = await getSupabaseClient().auth.getSession();
        const sqlOk = await ensureSqlSave(
          true,
          'data:inventory',
          () => saveInventoryToSql(getSupabaseClient(), next, sess.session?.user?.id ?? null),
          lastSaveErrorAtRef
        );
        if (!sqlOk) return false;
      }

      if (successMessage) toast.success(successMessage);
      return true;
    },
    [isDataLoaded, setInventoryDataset, cloudSync]
  );

  const handleInventoryDatasetUpdate = useCallback(
    (updater: InventoryDataset | ((prev: InventoryDataset) => InventoryDataset)) => {
      setInventoryDataset((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        latestRef.current = next;
        return next;
      });
    },
    [setInventoryDataset]
  );

  return { persistInventoryNow, handleInventoryDatasetUpdate };
}
