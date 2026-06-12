import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { toast } from 'sonner';

import { getAuthUserId } from '../services/productionSqlBridge';
import {
  isFleetSqlEnabled,
  loadFleetFromSql,
  saveFleetChecklistToSql,
  saveFleetToSql,
  type FleetSqlTimestamps,
} from '../services/repository/fleetSql';
import { getSupabaseClient } from '../services/repository/supabase';
import type { FleetChecklistSection, FleetDataset } from '../types/fleet';
import { fleetChecklistSignature } from '../utils/fleetData';
import { FLEET_REMOTE_COOLDOWN_MS } from '../utils/fleetRemoteSyncGuard';
import { slimFleetDatasetForKv } from '../utils/fleetKvPayload';
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
const FLEET_KV_TIMEOUT_MS = 45_000;
const FLEET_SQL_AUTOSAVE_DEBOUNCE_MS = 500;

function withKvSaveTimeout(promise: Promise<KvSaveResult>): Promise<KvSaveResult> {
  return Promise.race([
    promise,
    new Promise<KvSaveResult>((resolve) => {
      setTimeout(() => resolve('failed'), FLEET_KV_TIMEOUT_MS);
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
  sqlTimestampsRef: MutableRefObject<FleetSqlTimestamps>;
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
    sqlTimestampsRef,
  } = options;

  const fleetRefs: KvDomainRefs<FleetDataset> = {
    chainRef,
    latestRef,
    cooldownUntilRef,
  };

  const skipExplicitAutosaveRef = useRef(false);
  const sqlSaveChainRef = useRef(Promise.resolve());
  const sqlAutosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reloadFleetFromSql = useCallback(async (): Promise<FleetDataset | null> => {
    const result = await loadFleetFromSql(getSupabaseClient());
    if (!result.ok || !result.data) return null;
    if (result.timestamps) sqlTimestampsRef.current = result.timestamps;
    latestRef.current = result.data;
    setFleetDataset(result.data);
    return result.data;
  }, [latestRef, setFleetDataset, sqlTimestampsRef]);

  const runFleetSqlSave = useCallback(
    async (
      dataset: FleetDataset,
      saveOptions?: { allowPruneWhenEmpty?: boolean; skipOptimisticLock?: boolean }
    ): Promise<{ ok: boolean; conflict?: boolean }> => {
      const uid = await getAuthUserId();
      if (!uid) {
        toast.error('Sin sesión activa. Vuelve a iniciar sesión.');
        return { ok: false };
      }
      const result = await saveFleetToSql(getSupabaseClient(), dataset, uid, {
        ...saveOptions,
        knownTimestamps: sqlTimestampsRef.current,
      });
      if (result.conflict) {
        await reloadFleetFromSql();
        toast.warning(
          'Otro usuario modificó la flota. Se recargaron los datos más recientes.',
          { duration: 8000 }
        );
        return { ok: false, conflict: true };
      }
      if (!result.ok) {
        const now = Date.now();
        const last = lastSaveErrorAtRef.current['data:fleet'] ?? 0;
        if (now - last >= 8000) {
          lastSaveErrorAtRef.current['data:fleet'] = now;
          toast.error(
            result.errors[0] ??
              'No se pudo guardar la flota en SQL. Revisa sesión o permisos.'
          );
        }
        return { ok: false };
      }
      const refreshed = await loadFleetFromSql(getSupabaseClient());
      if (refreshed.timestamps) sqlTimestampsRef.current = refreshed.timestamps;
      extendFleetCooldown(cooldownUntilRef);
      return { ok: true };
    },
    [cooldownUntilRef, lastSaveErrorAtRef, reloadFleetFromSql, sqlTimestampsRef]
  );

  useEffect(() => {
    if (!isDataLoaded || !hydratedRef.current) return;
    if (skipExplicitAutosaveRef.current) return;

    latestRef.current = fleetDataset;

    if (FLEET_USE_SQL) {
      if (sqlAutosaveTimerRef.current) clearTimeout(sqlAutosaveTimerRef.current);
      sqlAutosaveTimerRef.current = setTimeout(() => {
        cloudSync.onStart();
        sqlSaveChainRef.current = sqlSaveChainRef.current
          .then(async () => {
            const ok = await runFleetSqlSave(latestRef.current);
            cloudSync.onEnd(ok.ok, 'data:fleet');
          })
          .catch(() => {
            cloudSync.onEnd(false, 'data:fleet');
          });
      }, FLEET_SQL_AUTOSAVE_DEBOUNCE_MS);
      return () => {
        if (sqlAutosaveTimerRef.current) clearTimeout(sqlAutosaveTimerRef.current);
      };
    }

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
    });
  }, [fleetDataset, isDataLoaded, runFleetSqlSave]);

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
        if (!options?.silent) toast.error('No se pudo preparar la plantilla para guardar.');
        return false;
      }

      const prevSig = fleetChecklistSignature(latestRef.current.checklistSections);
      const nextSig = fleetChecklistSignature(cleanSections);
      if (prevSig === nextSig) return true;

      const next: FleetDataset = { ...latestRef.current, checklistSections: cleanSections };

      skipExplicitAutosaveRef.current = true;
      skipHydrateRef.current = true;
      try {
        latestRef.current = next;
        setFleetDataset(next);

        if (FLEET_USE_SQL) {
          const clResult = await saveFleetChecklistToSql(getSupabaseClient(), cleanSections, {
            knownTimestamps: sqlTimestampsRef.current,
          });
          if (clResult.conflict) {
            await reloadFleetFromSql();
            if (!options?.silent) {
              toast.warning(
                'Otro usuario modificó la plantilla del checklist. Se recargó la versión más reciente.',
                { duration: 8000 }
              );
            }
            return false;
          }
          if (!clResult.ok) {
            const now = Date.now();
            const last = lastSaveErrorAtRef.current['data:fleet'] ?? 0;
            if (now - last >= 8000) {
              lastSaveErrorAtRef.current['data:fleet'] = now;
              if (!options?.silent) {
                toast.error(
                  clResult.errors[0] ??
                    'No se pudo guardar la plantilla del checklist en SQL. Revisa sesión o permisos.'
                );
              }
            }
            return false;
          }
          const refreshed = await loadFleetFromSql(getSupabaseClient());
          if (refreshed.ok && refreshed.data) {
            latestRef.current = refreshed.data;
            setFleetDataset(refreshed.data);
            if (refreshed.timestamps) sqlTimestampsRef.current = refreshed.timestamps;
          }
          extendFleetCooldown(cooldownUntilRef);
          hydratedRef.current = true;
          if (!options?.silent) toast.success('Plantilla del checklist guardada.');
          return true;
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
          if (!options?.silent) toast.error('Guardado interrumpido (recarga de sesión). Intenta de nuevo.');
          return false;
        }
        if (!kvSaveSucceeded(result)) {
          if (!options?.silent) {
            toast.error('No se guardó la plantilla del checklist en la nube. Revisa conexión e intenta de nuevo.');
          }
          return false;
        }

        extendFleetCooldown(cooldownUntilRef);
        hydratedRef.current = true;
        if (!options?.silent) toast.success('Plantilla del checklist guardada.');
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
    [isDataLoaded, setFleetDataset, cooldownUntilRef, sqlTimestampsRef]
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

        if (FLEET_USE_SQL) {
          const { ok, conflict } = await runFleetSqlSave(clean, { allowPruneWhenEmpty: true });
          if (!ok) {
            if (!conflict) {
              toast.error('No se guardó la flota en SQL. Revisa conexión e intenta de nuevo.');
            }
            return false;
          }
          hydratedRef.current = true;
          if (successMessage) toast.success(successMessage);
          return true;
        }

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
          toast.error('No se guardó la flota en la nube. Revisa conexión e intenta de nuevo sin cerrar sesión.');
          return false;
        }

        extendFleetCooldown(cooldownUntilRef);
        hydratedRef.current = true;
        if (successMessage) toast.success(successMessage);
        return true;
      } finally {
        skipHydrateRef.current = false;
        skipExplicitAutosaveRef.current = false;
      }
    },
    [isDataLoaded, setFleetDataset, runFleetSqlSave, cooldownUntilRef]
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

  return { persistFleetNow, persistFleetChecklistNow, handleFleetDatasetUpdate, reloadFleetFromSql };
}
