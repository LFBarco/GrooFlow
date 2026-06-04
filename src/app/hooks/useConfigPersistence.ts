import { useEffect, type MutableRefObject } from 'react';
import { toast } from 'sonner';

import type { ConfigStructure } from '../data/initialData';
import { isProductionSqlEnabled } from '../services/repository/sqlDomainUtils';
import { backupAppKvAfterKvSave } from '../utils/sqlAutosaveBackup';
import { DOMAIN_KV_COOLDOWN_MS } from './persistence/domainKvCooldown';
import {
  enqueueKvSerializedSave,
  kvSaveSucceeded,
  type KvSaveResult,
} from '../utils/kvSerializedSave';

const PRODUCTION_USE_SQL = isProductionSqlEnabled();

export type UseConfigPersistenceOptions = {
  isDataLoaded: boolean;
  config: ConfigStructure;
  hydratedRef: MutableRefObject<boolean>;
  chainRef: MutableRefObject<Promise<KvSaveResult>>;
  latestRef: MutableRefObject<ConfigStructure>;
  cooldownUntilRef: MutableRefObject<number>;
  kvApplyGenerationRef: MutableRefObject<number>;
  lastSaveErrorAtRef: MutableRefObject<Record<string, number>>;
};

/** Autosave KV + SQL de configuración operativa (`settings:config`). */
export function useConfigPersistence(options: UseConfigPersistenceOptions): void {
  const {
    isDataLoaded,
    config,
    hydratedRef,
    chainRef,
    latestRef,
    cooldownUntilRef,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
  } = options;

  useEffect(() => {
    if (!isDataLoaded || !hydratedRef.current) return;
    void enqueueKvSerializedSave(
      chainRef,
      kvApplyGenerationRef,
      latestRef,
      'settings:config',
      config
    ).then((result) => {
      if (kvSaveSucceeded(result)) {
        cooldownUntilRef.current = Date.now() + DOMAIN_KV_COOLDOWN_MS;
        void backupAppKvAfterKvSave(
          PRODUCTION_USE_SQL,
          'settings:config',
          config,
          lastSaveErrorAtRef
        );
        return;
      }
      if (result === 'skipped') return;
      const now = Date.now();
      const last = lastSaveErrorAtRef.current['settings:config'] ?? 0;
      if (now - last < 8000) return;
      lastSaveErrorAtRef.current['settings:config'] = now;
      toast.error('No se pudo guardar Configuración → Operaciones. Reintente en unos segundos.');
    });
  }, [config, isDataLoaded]);
}
