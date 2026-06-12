import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { toast } from 'sonner';

import { saveProvidersToSql } from '../services/repository/businessDomainsSql';
import { isProductionSqlEnabled } from '../services/repository/sqlDomainUtils';
import type { Provider } from '../types';
import { backupDomainSqlAfterKvSave } from '../utils/sqlAutosaveBackup';
import { DOMAIN_KV_COOLDOWN_MS } from './persistence/domainKvCooldown';
import {
  enqueueKvSerializedSave,
  kvSaveSucceeded,
  type KvSaveResult,
} from '../utils/kvSerializedSave';

const PRODUCTION_USE_SQL = isProductionSqlEnabled();
const PROVIDERS_KV_SAVE_TIMEOUT_MS = 45_000;

function withKvSaveTimeout(promise: Promise<KvSaveResult>): Promise<KvSaveResult> {
  return Promise.race([
    promise,
    new Promise<KvSaveResult>((resolve) => {
      setTimeout(() => resolve('failed'), PROVIDERS_KV_SAVE_TIMEOUT_MS);
    }),
  ]);
}

export type UseProvidersPersistenceOptions = {
  isDataLoaded: boolean;
  providers: Provider[];
  setProviders: Dispatch<SetStateAction<Provider[]>>;
  cloudHydrationDoneRef: MutableRefObject<boolean>;
  hydratedRef: MutableRefObject<boolean>;
  skipHydrateRef: MutableRefObject<boolean>;
  chainRef: MutableRefObject<Promise<KvSaveResult>>;
  latestRef: MutableRefObject<Provider[]>;
  cooldownUntilRef: MutableRefObject<number>;
  kvApplyGenerationRef: MutableRefObject<number>;
  lastSaveErrorAtRef: MutableRefObject<Record<string, number>>;
};

export function useProvidersPersistence(options: UseProvidersPersistenceOptions) {
  const {
    isDataLoaded,
    providers,
    setProviders,
    cloudHydrationDoneRef,
    hydratedRef,
    skipHydrateRef,
    chainRef,
    latestRef,
    cooldownUntilRef,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
  } = options;

  /** Evita que el autosave compita con guardado explícito (formulario proveedores). */
  const skipExplicitAutosaveRef = useRef(false);

  useEffect(() => {
    if (!isDataLoaded || !cloudHydrationDoneRef.current || !hydratedRef.current) return;
    if (skipExplicitAutosaveRef.current) return;
    void enqueueKvSerializedSave(
      chainRef,
      kvApplyGenerationRef,
      latestRef,
      'data:providers',
      providers
    ).then((result) => {
      if (kvSaveSucceeded(result)) {
        cooldownUntilRef.current = Date.now() + DOMAIN_KV_COOLDOWN_MS;
        hydratedRef.current = true;
        void backupDomainSqlAfterKvSave(
          PRODUCTION_USE_SQL,
          'data:providers',
          providers,
          saveProvidersToSql,
          lastSaveErrorAtRef
        );
        return;
      }
      if (result === 'skipped') return;
      const now = Date.now();
      const last = lastSaveErrorAtRef.current['data:providers'] ?? 0;
      if (now - last < 8000) return;
      lastSaveErrorAtRef.current['data:providers'] = now;
      toast.error(
        'No se pudo guardar el directorio de proveedores en la nube. Revisa sesión/red y vuelve a intentar.'
      );
    });
  }, [providers, isDataLoaded]);

  const handleUpdateProviders = useCallback(
    async (next: Provider[]): Promise<boolean> => {
      if (!isDataLoaded || !hydratedRef.current) {
        toast.error(
          'Los datos siguen cargando desde la nube. Espera unos segundos e intenta de nuevo.'
        );
        return false;
      }
      let clean: Provider[];
      try {
        clean = JSON.parse(JSON.stringify(next)) as Provider[];
      } catch (e) {
        console.warn('[GrooFlow] providers serialize:', e);
        toast.error(
          'No se pudo preparar la lista de proveedores para guardar. Revisa datos raros/caracteres en importación.'
        );
        return false;
      }

      skipExplicitAutosaveRef.current = true;
      skipHydrateRef.current = true;
      try {
        latestRef.current = clean;
        setProviders(next);

        const result = await withKvSaveTimeout(
          enqueueKvSerializedSave(
            chainRef,
            kvApplyGenerationRef,
            latestRef,
            'data:providers',
            clean
          )
        );

        if (result === 'skipped') {
          toast.error('Guardado interrumpido (recarga de sesión). Intenta de nuevo.');
          return false;
        }
        if (!kvSaveSucceeded(result)) {
          toast.error(
            result === 'failed'
              ? 'Tiempo agotado o error al guardar proveedores en la nube. Revisa conexión e intenta de nuevo.'
              : 'No se guardó el directorio en la nube. Reintenta sin cerrar sesión.'
          );
          return false;
        }

        cooldownUntilRef.current = Date.now() + DOMAIN_KV_COOLDOWN_MS;
        hydratedRef.current = true;

        if (PRODUCTION_USE_SQL) {
          void backupDomainSqlAfterKvSave(
            true,
            'data:providers',
            clean,
            saveProvidersToSql,
            lastSaveErrorAtRef
          );
        }
        return true;
      } catch (e) {
        console.warn('[GrooFlow] providers persist:', e);
        toast.error('Error de red al guardar proveedores. Comprueba conexión e inténtalo de nuevo.');
        return false;
      } finally {
        skipHydrateRef.current = false;
        skipExplicitAutosaveRef.current = false;
      }
    },
    [isDataLoaded, setProviders]
  );

  return { handleUpdateProviders };
}
