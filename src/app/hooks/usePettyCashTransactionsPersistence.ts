import { useEffect, type MutableRefObject } from 'react';
import { toast } from 'sonner';

import { savePettyCashToSql } from '../services/repository/businessDomainsSql';
import { isProductionSqlEnabled } from '../services/repository/sqlDomainUtils';
import type { PettyCashTransaction } from '../types';
import { backupDomainSqlAfterKvSave } from '../utils/sqlAutosaveBackup';
import { DOMAIN_KV_COOLDOWN_MS } from './persistence/domainKvCooldown';
import {
  enqueueKvSerializedSave,
  kvSaveSucceeded,
  type KvSaveResult,
} from '../utils/kvSerializedSave';

const PRODUCTION_USE_SQL = isProductionSqlEnabled();

export type UsePettyCashTransactionsPersistenceOptions = {
  isDataLoaded: boolean;
  transactions: PettyCashTransaction[];
  hydratedRef: MutableRefObject<boolean>;
  chainRef: MutableRefObject<Promise<KvSaveResult>>;
  latestRef: MutableRefObject<PettyCashTransaction[]>;
  cooldownUntilRef: MutableRefObject<number>;
  kvApplyGenerationRef: MutableRefObject<number>;
  lastSaveErrorAtRef: MutableRefObject<Record<string, number>>;
};

/** Autosave KV + SQL de movimientos de caja chica (`data:pettyCash`). */
export function usePettyCashTransactionsPersistence(
  options: UsePettyCashTransactionsPersistenceOptions
): void {
  const {
    isDataLoaded,
    transactions,
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
      'data:pettyCash',
      transactions
    ).then((result) => {
      if (kvSaveSucceeded(result)) {
        cooldownUntilRef.current = Date.now() + DOMAIN_KV_COOLDOWN_MS;
        void backupDomainSqlAfterKvSave(
          PRODUCTION_USE_SQL,
          'data:pettyCash',
          transactions,
          savePettyCashToSql,
          lastSaveErrorAtRef
        );
        return;
      }
      if (result === 'skipped') return;
      const now = Date.now();
      const last = lastSaveErrorAtRef.current['data:pettyCash'] ?? 0;
      if (now - last < 8000) return;
      lastSaveErrorAtRef.current['data:pettyCash'] = now;
      toast.error(
        'No se pudo guardar Caja chica en la nube. Revisa sesión/red antes de cerrar o actualizar la página.'
      );
    });
  }, [transactions, isDataLoaded]);
}
