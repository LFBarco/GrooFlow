import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { toast } from 'sonner';

import {
  saveProvidersToSql,
} from '../services/repository/businessDomainsSql';
import { getSupabaseClient } from '../services/repository/supabase';
import { isProductionSqlEnabled } from '../services/repository/sqlDomainUtils';
import type { Provider } from '../types';
import { backupDomainSqlAfterKvSave, ensureSqlSave } from '../utils/sqlAutosaveBackup';
import { DOMAIN_KV_COOLDOWN_MS } from './persistence/domainKvCooldown';
import {
  enqueueKvSerializedSave,
  kvSaveSucceeded,
  type KvSaveResult,
} from '../utils/kvSerializedSave';

const PRODUCTION_USE_SQL = isProductionSqlEnabled();

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

  useEffect(() => {
    if (!isDataLoaded || !cloudHydrationDoneRef.current || !hydratedRef.current) return;
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
      if (!isDataLoaded) {
        toast.error(
          'Los datos siguen cargando desde la nube. Espera el aviso «Datos sincronizados con la nube» y vuelve a intentar.'
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

      skipHydrateRef.current = true;
      try {
        latestRef.current = clean;

        if (PRODUCTION_USE_SQL) {
          const { data: sess } = await getSupabaseClient().auth.getSession();
          const sqlOk = await ensureSqlSave(
            true,
            'data:providers',
            () => saveProvidersToSql(getSupabaseClient(), clean, sess.session?.user?.id ?? null),
            lastSaveErrorAtRef
          );
          if (!sqlOk) return false;
        }

        const result = await enqueueKvSerializedSave(
          chainRef,
          kvApplyGenerationRef,
          latestRef,
          'data:providers',
          clean
        );
        if (!kvSaveSucceeded(result)) {
          toast.error(
            'No se guardó el directorio en la nube (red, sesión o límite de tamaño). Reintenta sin cerrar sesión.'
          );
          return false;
        }
        cooldownUntilRef.current = Date.now() + DOMAIN_KV_COOLDOWN_MS;
        hydratedRef.current = true;
        setProviders(next);
        return true;
      } catch (e) {
        console.warn('[GrooFlow] providers persist:', e);
        toast.error('Error de red al guardar proveedores. Comprueba conexión e inténtalo de nuevo.');
        return false;
      } finally {
        skipHydrateRef.current = false;
      }
    },
    [isDataLoaded, setProviders]
  );

  return { handleUpdateProviders };
}
