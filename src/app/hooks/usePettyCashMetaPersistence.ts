import { useEffect, type MutableRefObject } from 'react';

import { savePettyCashMetaToSql } from '../services/repository/pettyCashMetaSql';
import { isProductionSqlEnabled } from '../services/repository/sqlDomainUtils';
import type { SystemSettings } from '../types';
import { backupDomainSqlAfterKvSave } from '../utils/sqlAutosaveBackup';
import {
  autosaveKvDomain,
  type CloudSyncTracker,
} from '../utils/kvDomainPersistence';
import {
  extractPettyCashMeta,
  mergePettyCashMetaIntoSettings,
  normalizePettyCashMeta,
  PETTY_CASH_META_KV_KEY,
  type PettyCashWeekMetaPayload,
} from '../utils/pettyCashMeta';
import { kvPayloadsEqual } from '../utils/kvCrossTabSync';

const PRODUCTION_USE_SQL = isProductionSqlEnabled();

export type UsePettyCashMetaPersistenceOptions = {
  isDataLoaded: boolean;
  systemSettingsHydratedRef: MutableRefObject<boolean>;
  systemSettings: SystemSettings;
  pettyCashMetaLatestRef: MutableRefObject<PettyCashWeekMetaPayload>;
  pettyCashMetaChainRef: MutableRefObject<Promise<unknown>>;
  cooldownUntilRef: MutableRefObject<number>;
  kvApplyGenerationRef: MutableRefObject<number>;
  lastSaveErrorAtRef: MutableRefObject<Record<string, number>>;
  cloudSync: CloudSyncTracker;
};

/** Autosave KV + SQL de cierres/dotaciones (`data:pettyCashMeta`). */
export function usePettyCashMetaPersistence(options: UsePettyCashMetaPersistenceOptions): void {
  const {
    isDataLoaded,
    systemSettingsHydratedRef,
    systemSettings,
    pettyCashMetaLatestRef,
    pettyCashMetaChainRef,
    cooldownUntilRef,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
    cloudSync,
  } = options;

  useEffect(() => {
    if (!isDataLoaded || !systemSettingsHydratedRef.current) return;
    const meta = extractPettyCashMeta(systemSettings.pettyCash);
    pettyCashMetaLatestRef.current = meta;
    void autosaveKvDomain({
      kvKey: PETTY_CASH_META_KV_KEY,
      payload: meta,
      refs: {
        chainRef: pettyCashMetaChainRef,
        latestRef: pettyCashMetaLatestRef,
        cooldownUntilRef,
      },
      kvApplyGenerationRef,
      lastSaveErrorAtRef,
      errorMessage:
        'No se pudieron guardar cierres y dotaciones de caja chica en la nube.',
      sync: cloudSync,
    }).then((ok) => {
      if (ok) {
        void backupDomainSqlAfterKvSave(
          PRODUCTION_USE_SQL,
          PETTY_CASH_META_KV_KEY,
          meta,
          savePettyCashMetaToSql,
          lastSaveErrorAtRef
        );
      }
    });
  }, [
    systemSettings.pettyCash?.weekClosures,
    systemSettings.pettyCash?.weekPreClosures,
    systemSettings.pettyCash?.fundDeliveries,
    isDataLoaded,
    systemSettingsHydratedRef,
    pettyCashMetaLatestRef,
    pettyCashMetaChainRef,
    cooldownUntilRef,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
  ]);
}

/** Aplica meta remoto (Realtime / otra pestaña) al estado de sistema. */
export function applyPettyCashMetaRemoteUpdate(
  currentSettings: SystemSettings,
  remoteRaw: unknown,
  latestRef: MutableRefObject<PettyCashWeekMetaPayload>
): SystemSettings | null {
  const meta = normalizePettyCashMeta(remoteRaw);
  if (kvPayloadsEqual(latestRef.current, meta)) return null;
  latestRef.current = meta;
  return mergePettyCashMetaIntoSettings(currentSettings, meta);
}
