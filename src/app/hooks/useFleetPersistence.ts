import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { toast } from 'sonner';

import {
  isFleetSqlEnabled,
  loadFleetFromSql,
  saveFleetChecklistToSql,
  saveFleetToSql,
  type FleetSqlTimestamps,
} from '../services/repository/fleetSql';
import { getSupabaseClientLazy } from '../services/repository/supabaseLazy';
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
import { backupDomainSqlAfterKvSave } from '../utils/sqlAutosaveBackup';
import {
  fleetRowKey,
  mergeFleetTimestampsFromDataset,
} from '../utils/fleetSqlTimestamps';

const FLEET_USE_SQL = isFleetSqlEnabled();
const FLEET_KV_TIMEOUT_MS = 12_000;
/** Autoguardado rápido tras dejar de editar. */
const FLEET_AUTOSAVE_DEBOUNCE_MS = 800;

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
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSignatureRef = useRef<string | null>(null);

  const reloadFleetFromSql = useCallback(async (): Promise<FleetDataset | null> => {
    const client = await getSupabaseClientLazy();
    if (!client) return null;
    const result = await loadFleetFromSql(client);
    if (!result.ok || !result.data) return null;
    if (result.timestamps) sqlTimestampsRef.current = result.timestamps;
    latestRef.current = result.data;
    setFleetDataset(result.data);
    return result.data;
  }, [latestRef, setFleetDataset, sqlTimestampsRef]);

  const backupFleetSql = useCallback(
    (dataset: FleetDataset, allowPruneWhenEmpty?: boolean) =>
      backupDomainSqlAfterKvSave(
        FLEET_USE_SQL,
        'data:fleet',
        dataset,
        (client, data, userId) =>
          saveFleetToSql(client, data, userId, {
            allowPruneWhenEmpty,
            skipOptimisticLock: true,
          }),
        lastSaveErrorAtRef
      ).then((ok) => {
        if (ok) {
          sqlTimestampsRef.current = mergeFleetTimestampsFromDataset(
            sqlTimestampsRef.current,
            dataset
          );
          extendFleetCooldown(cooldownUntilRef);
        }
        return ok;
      }),
    [cooldownUntilRef, lastSaveErrorAtRef, sqlTimestampsRef]
  );

  useEffect(() => {
    if (!isDataLoaded || !hydratedRef.current) return;
    if (skipExplicitAutosaveRef.current) {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      return;
    }

    latestRef.current = fleetDataset;

    // Tras hidratar desde la nube, no reescribir el mismo payload (evita 503 por presión DB).
    if (lastSavedSignatureRef.current === null) {
      try {
        lastSavedSignatureRef.current = JSON.stringify(slimFleetDatasetForKv(fleetDataset));
      } catch {
        lastSavedSignatureRef.current = '';
      }
      return;
    }

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      const payload = slimFleetDatasetForKv(latestRef.current);
      let signature = '';
      try {
        signature = JSON.stringify(payload);
      } catch {
        signature = '';
      }
      if (signature && lastSavedSignatureRef.current === signature) {
        return;
      }
      void autosaveKvDomain({
        kvKey: 'data:fleet',
        payload,
        refs: fleetRefs,
        kvApplyGenerationRef,
        lastSaveErrorAtRef,
        enqueueOptions: { updateLatestRef: false },
        errorMessage:
          'No se pudo guardar Flota clínica en la nube. Revisa sesión/red antes de cerrar o actualizar la página.',
        sync: cloudSync,
      }).then((kvOk) => {
        if (!kvOk) return;
        if (signature) lastSavedSignatureRef.current = signature;
        void backupFleetSql(latestRef.current);
      });
    }, FLEET_AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [fleetDataset, isDataLoaded, backupFleetSql, cloudSync]);

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

      const prev = latestRef.current;
      const next: FleetDataset = { ...prev, checklistSections: cleanSections };

      skipExplicitAutosaveRef.current = true;
      skipHydrateRef.current = true;
      let syncOpen = false;
      try {
        latestRef.current = next;
        setFleetDataset(next);

        const kvPayload = slimFleetDatasetForKv(next);
        cloudSync.onStart();
        syncOpen = true;
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
          cloudSync.onEnd(false, 'data:fleet');
          syncOpen = false;
          if (!options?.silent) toast.error('Guardado interrumpido (recarga de sesión). Intenta de nuevo.');
          return false;
        }
        if (!kvSaveSucceeded(kvResult)) {
          cloudSync.onEnd(false, 'data:fleet');
          syncOpen = false;
          if (!options?.silent) {
            toast.error('No se guardó la plantilla del checklist en la nube. Revisa conexión e intenta de nuevo.');
          }
          return false;
        }

        extendFleetCooldown(cooldownUntilRef);
        hydratedRef.current = true;
        cloudSync.onEnd(true, 'data:fleet');
        syncOpen = false;

        if (FLEET_USE_SQL) {
          void getSupabaseClientLazy().then((client) => {
            if (!client) return;
            return saveFleetChecklistToSql(client, cleanSections, {
            skipOptimisticLock: true,
          }).then((clResult) => {
            if (clResult.ok) {
              sqlTimestampsRef.current.set(
                fleetRowKey('fleet_checklist', 'default'),
                new Date().toISOString()
              );
              return;
            }
            const now = Date.now();
            const last = lastSaveErrorAtRef.current['data:fleet'] ?? 0;
            if (now - last >= 8000 && !options?.silent) {
              lastSaveErrorAtRef.current['data:fleet'] = now;
              toast.error(
                clResult.errors[0] ??
                  'No se pudo guardar la plantilla del checklist en SQL. Revisa sesión o permisos.'
              );
            }
          });
          });
        }

        if (!options?.silent) toast.success('Plantilla del checklist guardada.');
        return true;
      } catch (e) {
        console.warn('[GrooFlow] fleet checklist persist:', e);
        if (syncOpen) cloudSync.onEnd(false, 'data:fleet');
        if (!options?.silent) {
          toast.error('Error de red al guardar la plantilla. Comprueba conexión e inténtalo de nuevo.');
        }
        return false;
      } finally {
        skipHydrateRef.current = false;
        skipExplicitAutosaveRef.current = false;
      }
    },
    [isDataLoaded, setFleetDataset, cooldownUntilRef, sqlTimestampsRef, cloudSync, lastSaveErrorAtRef]
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
      let syncOpen = false;
      try {
        latestRef.current = clean;
        setFleetDataset(clean);

        const kvPayload = slimFleetDatasetForKv(clean);
        cloudSync.onStart();
        syncOpen = true;
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
          cloudSync.onEnd(false, 'data:fleet');
          syncOpen = false;
          toast.error('Guardado interrumpido (recarga de sesión). Intenta de nuevo.');
          return false;
        }
        if (!kvSaveSucceeded(kvResult)) {
          cloudSync.onEnd(false, 'data:fleet');
          syncOpen = false;
          toast.error('No se guardó la flota en la nube. Revisa conexión e intenta de nuevo sin cerrar sesión.');
          return false;
        }

        extendFleetCooldown(cooldownUntilRef);
        hydratedRef.current = true;
        cloudSync.onEnd(true, 'data:fleet');
        syncOpen = false;

        if (FLEET_USE_SQL) {
          void backupFleetSql(clean, true);
        }

        if (successMessage) toast.success(successMessage);
        return true;
      } catch (e) {
        console.warn('[GrooFlow] fleet persist:', e);
        if (syncOpen) cloudSync.onEnd(false, 'data:fleet');
        toast.error('Error de red al guardar la flota. Comprueba conexión e inténtalo de nuevo.');
        return false;
      } finally {
        skipHydrateRef.current = false;
        skipExplicitAutosaveRef.current = false;
      }
    },
    [isDataLoaded, setFleetDataset, cooldownUntilRef, backupFleetSql, cloudSync]
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
