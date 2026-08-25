import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { toast } from 'sonner';

import { mergeSystemSettings } from '../data/initialData';
import { mergeSystemSettingsSqlAndKv } from '../services/repository/appKvSql';
import { saveAppKvKey } from '../services/repository/appKvSql';
import { savePettyCashMetaToSql } from '../services/repository/pettyCashMetaSql';
import { getSupabaseClientLazy } from '../services/repository/supabaseLazy';
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
import { PRODUCTION_REMOTE_COOLDOWN_MS } from '../utils/listRemoteSyncGuard';
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
import { stripAsistenciaForSystemKv } from '../utils/asistenciaPersistence';

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

  const lastSystemPayloadSigRef = useRef('');

  function buildSystemKvPayload(settings: SystemSettings): SystemSettings {
    return stripAsistenciaForSystemKv(stripPettyCashMetaForSystemKv(settings));
  }

  useEffect(() => {
    if (!isDataLoaded || !hydratedRef.current) return;
    const systemPayload = buildSystemKvPayload(systemSettings);
    const sig = JSON.stringify(systemPayload);
    if (sig === lastSystemPayloadSigRef.current) return;
    lastSystemPayloadSigRef.current = sig;
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
        typeof nextOrUpdater === 'function'
          ? nextOrUpdater(latestRef.current)
          : mergeSystemSettingsSqlAndKv(
              mergeSystemSettings(nextOrUpdater),
              latestRef.current
            );
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
      const systemPayload = buildSystemKvPayload(merged);
      lastSystemPayloadSigRef.current = JSON.stringify(systemPayload);

      if (PRODUCTION_USE_SQL) {
        const client = await getSupabaseClientLazy();
        if (!client) return false;
        const { data: sess } = await client.auth.getSession();
        const uid = sess.session?.user?.id ?? null;
        const [settingsSqlOk, metaSqlOk] = await Promise.all([
          ensureSqlSave(
            true,
            'settings:system',
            () => saveAppKvKey(client, 'settings:system', systemPayload, uid),
            lastSaveErrorAtRef
          ),
          ensureSqlSave(
            true,
            PETTY_CASH_META_KV_KEY,
            () => savePettyCashMetaToSql(client, meta, uid),
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
      }).then((ok) => {
        if (ok) {
          cooldownUntilRef.current = Date.now() + PRODUCTION_REMOTE_COOLDOWN_MS;
        }
        return ok;
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
