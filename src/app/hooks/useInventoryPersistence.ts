import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import { toast } from 'sonner';



import {

  isInventorySqlEnabled,

  saveInventoryToSql,

} from '../services/repository/inventorySql';

import { getSupabaseClient } from '../services/repository/supabase';

import type { InventoryDataset } from '../types/inventory';

import { backupToSqlAfterKvSave, ensureSqlSave } from '../utils/sqlAutosaveBackup';

import {

  enqueueKvSerializedSave,

  kvSaveSucceeded,

  KV_CHAIN_IDLE,

  type KvSaveResult,

} from '../utils/kvSerializedSave';

import {

  autosaveKvDomain,

  type CloudSyncTracker,

  type KvDomainRefs,

} from '../utils/kvDomainPersistence';



const INVENTORY_USE_SQL = isInventorySqlEnabled();

const INVENTORY_KV_SAVE_TIMEOUT_MS = 45_000;



function withKvSaveTimeout(promise: Promise<KvSaveResult>): Promise<KvSaveResult> {

  return Promise.race([

    promise,

    new Promise<KvSaveResult>((resolve) => {

      setTimeout(() => resolve('failed'), INVENTORY_KV_SAVE_TIMEOUT_MS);

    }),

  ]);

}



export type UseInventoryPersistenceOptions = {

  isDataLoaded: boolean;

  inventoryDataset: InventoryDataset;

  setInventoryDataset: Dispatch<SetStateAction<InventoryDataset>>;

  hydratedRef: MutableRefObject<boolean>;

  skipHydrateRef: MutableRefObject<boolean>;

  chainRef: MutableRefObject<Promise<KvSaveResult>>;

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



  const skipExplicitAutosaveRef = useRef(false);



  useEffect(() => {

    if (!isDataLoaded || !hydratedRef.current) return;

    if (skipExplicitAutosaveRef.current) return;



    latestRef.current = inventoryDataset;

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

      if (!isDataLoaded || !hydratedRef.current) {

        toast.error('Los datos siguen cargando desde la nube. Espera unos segundos y vuelve a intentar.');

        return false;

      }



      let clean: InventoryDataset;

      try {

        clean = JSON.parse(JSON.stringify(next)) as InventoryDataset;

      } catch (e) {

        console.warn('[GrooFlow] inventory serialize:', e);

        toast.error('No se pudo preparar el inventario para guardar.');

        return false;

      }



      skipExplicitAutosaveRef.current = true;

      skipHydrateRef.current = true;

      try {

        latestRef.current = clean;

        setInventoryDataset(clean);



        const kvResult = await withKvSaveTimeout(

          enqueueKvSerializedSave(

            chainRef,

            kvApplyGenerationRef,

            latestRef,

            'data:inventory',

            clean

          )

        );



        if (kvResult === 'skipped') {

          toast.error('Guardado interrumpido (recarga de sesión). Intenta de nuevo.');

          return false;

        }

        if (!kvSaveSucceeded(kvResult)) {

          toast.error(

            'No se guardó el inventario en la nube. Revisa conexión e intenta de nuevo sin cerrar sesión.'

          );

          return false;

        }



        cooldownUntilRef.current = Date.now() + 8000;

        hydratedRef.current = true;



        if (INVENTORY_USE_SQL) {

          const { data: sess } = await getSupabaseClient().auth.getSession();

          const sqlOk = await ensureSqlSave(

            true,

            'data:inventory',

            () =>

              saveInventoryToSql(

                getSupabaseClient(),

                clean,

                sess.session?.user?.id ?? null,

                { allowPruneWhenEmpty: true }

              ),

            lastSaveErrorAtRef,

            'No se pudo guardar el inventario de equipos en SQL. Revisa sesión o permisos.'

          );

          if (!sqlOk) return false;

        }



        if (successMessage) toast.success(successMessage);

        return true;

      } catch (e) {

        console.warn('[GrooFlow] inventory persist:', e);

        toast.error('Error de red al guardar inventario. Comprueba conexión e inténtalo de nuevo.');

        return false;

      } finally {

        skipHydrateRef.current = false;

        skipExplicitAutosaveRef.current = false;

      }

    },

    [isDataLoaded, setInventoryDataset]

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



export { KV_CHAIN_IDLE as INVENTORY_KV_CHAIN_IDLE };


