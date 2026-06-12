import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { toast } from 'sonner';

import { getAuthUserId } from '../services/productionSqlBridge';
import { isFleetSqlEnabled, saveFleetChecklistToSql, saveFleetToSql } from '../services/repository/fleetSql';
import { getSupabaseClient } from '../services/repository/supabase';
import type { FleetChecklistSection, FleetDataset } from '../types/fleet';
import { backupToSqlAfterKvSave, ensureSqlSave } from '../utils/sqlAutosaveBackup';
import { slimFleetDatasetForKv } from '../utils/fleetKvPayload';
import { fleetChecklistSignature } from '../utils/fleetData';
import { FLEET_REMOTE_COOLDOWN_MS } from '../utils/fleetRemoteSyncGuard';
import {
  enqueueKvSerializedSave,
  kvSaveSucceeded,
  type KvSaveResult,
} from '../utils/kvSerializedSave';
import {
  autosaveKvDomain,
  type CloudSyncTracker,
  type KvDomainRefs,
} from '../utils/kvDomainPersistence';

const FLEET_USE_SQL = isFleetSqlEnabled();
const FLEET_CHECKLIST_KV_TIMEOUT_MS = 45_000;

function withKvSaveTimeout(promise: Promise<KvSaveResult>): Promise<KvSaveResult> {
  return Promise.race([
    promise,
    new Promise<KvSaveResult>((resolve) => {
      setTimeout(() => resolve('failed'), FLEET_CHECKLIST_KV_TIMEOUT_MS);
    }),
  ]);
}

function extendFleetCooldown(cooldownUntilRef: MutableRefObject<number>) {
  cooldownUntilRef.current = Date.now() + FLEET_REMOTE_COOLDOWN_MS;
}

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

  /** Evita que el autosave compita con guardado explícito (plantilla checklist, etc.). */
  const skipExplicitAutosaveRef = useRef(false);

  useEffect(() => {
    if (!isDataLoaded || !hydratedRef.current) return;
    if (skipExplicitAutosaveRef.current) return;

    latestRef.current = fleetDataset;
    const kvPayload = slimFleetDatasetForKv(fleetDataset);

    void autosaveKvDomain({
      kvKey: 'data:fleet',
      payload: kvPayload,
      refs: fleetRefs,
      kvApplyGenerationRef,
      lastSaveErrorAtRef,
      enqueueOptions: { updateLatestRef: false },
      errorMessage:
        'No se pudo guardar Flota clínica en la nube. Revisa sesión/red antes de cerrar o actualizar la página.',
      sync: cloudSync,
    }).then((kvOk) => {
      if (!kvOk) return;
      extendFleetCooldown(cooldownUntilRef);
      void backupToSqlAfterKvSave({
        enabled: FLEET_USE_SQL,
        storageKey: 'data:fleet',
        lastSaveErrorAtRef,
        run: async () => {
          const uid = await getAuthUserId();
          return saveFleetToSql(getSupabaseClient(), latestRef.current, uid);
        },
      });
    });
  }, [fleetDataset, isDataLoaded]);

  const persistFleetChecklistNow = useCallback(
    async (
      sections: FleetChecklistSection[],
      options?: { silent?: boolean }
    ): Promise<boolean> => {
      if (!isDataLoaded || !hydratedRef.current) {
        if (!options?.silent) {
          toast.error('Los datos siguen cargando desde la nube. Espera unos segundos y vuelve a intentar.');
        }
        return false;
      }

      let cleanSections: FleetChecklistSection[];
      try {
        cleanSections = JSON.parse(JSON.stringify(sections)) as FleetChecklistSection[];
      } catch (e) {
        console.warn('[GrooFlow] fleet checklist serialize:', e);
        if (!options?.silent) {
          toast.error('No se pudo preparar la plantilla para guardar.');
        }
        return false;
      }

      const prevSig = fleetChecklistSignature(latestRef.current.checklistSections);
      const nextSig = fleetChecklistSignature(cleanSections);
      if (prevSig === nextSig) {
        return true;
      }

      const next: FleetDataset = { ...latestRef.current, checklistSections: cleanSections };

      skipExplicitAutosaveRef.current = true;
      skipHydrateRef.current = true;
      try {
        latestRef.current = next;
        setFleetDataset(next);

        if (FLEET_USE_SQL) {
          const checklistOk = await ensureSqlSave(
            true,
            'data:fleet',
            () => saveFleetChecklistToSql(getSupabaseClient(), cleanSections),
            lastSaveErrorAtRef,
            'No se pudo guardar la plantilla del checklist en SQL. Revisa sesión o permisos.'
          );
          if (!checklistOk && !options?.silent) {
            toast.warning('No se pudo guardar la plantilla en SQL; se intentará en KV.', {
              duration: 8000,
            });
          }
        }

        const kvPayload = slimFleetDatasetForKv(next);
        const result = await withKvSaveTimeout(
          enqueueKvSerializedSave(
            chainRef,
            kvApplyGenerationRef,
            latestRef,
            'data:fleet',
            kvPayload,
            { updateLatestRef: false }
          )
        );

        if (result === 'skipped') {
          if (!options?.silent) {
            toast.error('Guardado interrumpido (recarga de sesión). Intenta de nuevo.');
          }
          return false;
        }
        if (!kvSaveSucceeded(result)) {
          if (!options?.silent) {
            toast.error(
              'No se guardó la plantilla del checklist en la nube. Revisa conexión e intenta de nuevo.'
            );
          }
          return false;
        }

        extendFleetCooldown(cooldownUntilRef);
        hydratedRef.current = true;
        if (!options?.silent) {
          toast.success('Plantilla del checklist guardada.');
        }
        return true;
      } catch (e) {
        console.warn('[GrooFlow] fleet checklist persist:', e);
        if (!options?.silent) {
          toast.error('Error de red al guardar la plantilla. Comprueba conexión e inténtalo de nuevo.');
        }
        return false;
      } finally {
        skipHydrateRef.current = false;
        skipExplicitAutosaveRef.current = false;
      }
    },
    [isDataLoaded, setFleetDataset]
  );

  const persistFleetNow = useCallback(
    async (next: FleetDataset, successMessage?: string): Promise<boolean> => {
      if (!isDataLoaded || !hydratedRef.current) {
        toast.error('Los datos siguen cargando desde la nube. Espera unos segundos y vuelve a intentar.');
        return false;
      }

      let clean: FleetDataset;
      try {
        clean = JSON.parse(JSON.stringify(next)) as FleetDataset;
      } catch (e) {
        console.warn('[GrooFlow] fleet serialize:', e);
        toast.error('No se pudo preparar la flota para guardar.');
        return false;
      }

      skipExplicitAutosaveRef.current = true;
      skipHydrateRef.current = true;
      try {
        latestRef.current = clean;
        setFleetDataset(clean);

        const kvPayload = slimFleetDatasetForKv(clean);
        const kvResult = await withKvSaveTimeout(
          enqueueKvSerializedSave(
            chainRef,
            kvApplyGenerationRef,
            latestRef,
            'data:fleet',
            kvPayload,
            { updateLatestRef: false }
          )
        );

        if (kvResult === 'skipped') {
          toast.error('Guardado interrumpido (recarga de sesión). Intenta de nuevo.');
          return false;
        }
        if (!kvSaveSucceeded(kvResult)) {
          toast.error(
            'No se guardó la flota en la nube. Revisa conexión e intenta de nuevo sin cerrar sesión.'
          );
          return false;
        }

        extendFleetCooldown(cooldownUntilRef);
        hydratedRef.current = true;

        if (FLEET_USE_SQL) {
          const uid = await getAuthUserId();
          if (uid) {
            const sqlOk = await ensureSqlSave(
              true,
              'data:fleet',
              () =>
                saveFleetToSql(getSupabaseClient(), clean, uid, { allowPruneWhenEmpty: true }),
              lastSaveErrorAtRef,
              'No se pudo guardar la flota en SQL. Revisa sesión o permisos.'
            );
            if (!sqlOk) {
              toast.warning(
                'Flota guardada en KV; la réplica SQL falló. Revisa permisos si el problema persiste.',
                { duration: 8000 }
              );
            }
          }
        }

        if (successMessage) toast.success(successMessage);
        return true;
      } finally {
        skipHydrateRef.current = false;
        skipExplicitAutosaveRef.current = false;
      }
    },
    [isDataLoaded, setFleetDataset]
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

  return { persistFleetNow, persistFleetChecklistNow, handleFleetDatasetUpdate };
}
