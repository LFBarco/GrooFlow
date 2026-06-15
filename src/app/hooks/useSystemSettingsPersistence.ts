import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { toast } from 'sonner';

import { mergeSystemSettings } from '../data/initialData';
import { saveAppKvKey } from '../services/repository/appKvSql';
import { savePettyCashMetaToSql } from '../services/repository/pettyCashMetaSql';
import { getSupabaseClient } from '../services/repository/supabase';
import { isProductionSqlEnabled } from '../services/repository/sqlDomainUtils';
import type { SystemSettings } from '../types';
import {
  backupAppKvAfterKvSave,
  ensureSqlSave,
} from '../utils/sqlAutosaveBackup';
import {
  autosaveKvDomain,
  persistKvDomainNow,
  type CloudSyncTracker,
} from '../utils/kvDomainPersistence';
import {
  enqueueKvSerializedSave,
  kvSaveSucceeded,
  type KvSaveResult,
} from '../utils/kvSerializedSave';
import {
  extractPettyCashMeta,
  PETTY_CASH_META_KV_KEY,
  stripPettyCashMetaForSystemKv,
  type PettyCashWeekMetaPayload,
} from '../utils/pettyCashMeta';

const PRODUCTION_USE_SQL = isProductionSqlEnabled();

export type UseSystemSettingsPersistenceOptions = {
  isDataLoaded: boolean;
  systemSettings: SystemSettings;
  setSystemSettings: Dispatch<SetStateAction<SystemSettings>>;
  hydratedRef: MutableRefObject<boolean>;
  skipHydrateRef: MutableRefObject<boolean>;
  chainRef: MutableRefObject<Promise<unknown>>;
  latestRef: MutableRefObject<SystemSettings>;
  cooldownUntilRef: MutableRefObject<number>;
  pettyCashMetaLatestRef: MutableRefObject<PettyCashWeekMetaPayload>;
  pettyCashMetaChainRef: MutableRefObject<Promise<unknown>>;
  kvApplyGenerationRef: MutableRefObject<number>;
  lastSaveErrorAtRef: MutableRefObject<Record<string, number>>;
  cloudSync: CloudSyncTracker;
};

export function useSystemSettingsPersistence(
  options: UseSystemSettingsPersistenceOptions
) {
  const {
    isDataLoaded,
    systemSettings,
    setSystemSettings,
    hydratedRef,
    skipHydrateRef,
    chainRef,
    latestRef,
    cooldownUntilRef,
    pettyCashMetaLatestRef,
    pettyCashMetaChainRef,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
    cloudSync,
  } = options;

  useEffect(() => {
    if (!isDataLoaded || !hydratedRef.current) return;
    const systemPayload = stripPettyCashMetaForSystemKv(systemSettings);
    void autosaveKvDomain({
      kvKey: 'settings:system',
      payload: systemPayload,
      refs: { chainRef, latestRef, cooldownUntilRef },
      kvApplyGenerationRef,
      lastSaveErrorAtRef,
      errorMessage: 'No se pudo guardar la configuración del sistema en la nube.',
      sync: cloudSync,
    }).then((ok) => {
      if (ok) {
        void backupAppKvAfterKvSave(
          PRODUCTION_USE_SQL,
          'settings:system',
          systemPayload,
          lastSaveErrorAtRef
        );
      }
    });
  }, [systemSettings, isDataLoaded]);

  const persistSystemSettingsNow = useCallback(
    async (
      nextOrUpdater: SystemSettings | ((prev: SystemSettings) => SystemSettings),
      successMessage?: string
    ): Promise<boolean> => {
      const next =
        typeof nextOrUpdater === 'function' ? nextOrUpdater(latestRef.current) : nextOrUpdater;
      const merged = mergeSystemSettings(next);
      setSystemSettings(merged);
      if (!isDataLoaded || !hydratedRef.current) {
        toast.error(
          'Los datos siguen cargando desde la nube. Espera unos segundos y vuelve a intentar.'
        );
        return false;
      }
      latestRef.current = merged;
      const meta = extractPettyCashMeta(merged.pettyCash);
      pettyCashMetaLatestRef.current = meta;
      const systemPayload = stripPettyCashMetaForSystemKv(merged);

      if (PRODUCTION_USE_SQL) {
        const { data: sess } = await getSupabaseClient().auth.getSession();
        const uid = sess.session?.user?.id ?? null;
        const [settingsSqlOk, metaSqlOk] = await Promise.all([
          ensureSqlSave(
            true,
            'settings:system',
            () => saveAppKvKey(getSupabaseClient(), 'settings:system', systemPayload, uid),
            lastSaveErrorAtRef
          ),
          ensureSqlSave(
            true,
            PETTY_CASH_META_KV_KEY,
            () => savePettyCashMetaToSql(getSupabaseClient(), meta, uid),
            lastSaveErrorAtRef
          ),
        ]);
        if (!settingsSqlOk || !metaSqlOk) return false;
      }

      const metaKvOk = await enqueueKvSerializedSave(
        pettyCashMetaChainRef,
        kvApplyGenerationRef,
        pettyCashMetaLatestRef,
        PETTY_CASH_META_KV_KEY,
        meta
      );
      if (!kvSaveSucceeded(metaKvOk)) {
        toast.error('No se pudieron guardar cierres y dotaciones de caja chica en la nube.');
        return false;
      }

      return persistKvDomainNow({
        kvKey: 'settings:system',
        payload: systemPayload,
        refs: {
          hydratedFromKvRef: hydratedRef,
          skipHydrateRef,
          cooldownUntilRef,
          chainRef,
          latestRef,
        },
        kvApplyGenerationRef,
        lastSaveErrorAtRef,
        errorMessage: 'No se pudo guardar la configuración del sistema en la nube.',
        successMessage,
        sync: cloudSync,
      });
    },
    [isDataLoaded, setSystemSettings, cloudSync]
  );

  const handlePersistSystemSettings = useCallback(
    (nextOrUpdater: SystemSettings | ((prev: SystemSettings) => SystemSettings)) => {
      void persistSystemSettingsNow(nextOrUpdater);
    },
    [persistSystemSettingsNow]
  );

  return { persistSystemSettingsNow, handlePersistSystemSettings };
}
