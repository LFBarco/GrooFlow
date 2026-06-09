import type { MutableRefObject } from 'react';
import { toast } from 'sonner';

import { backupAppKvAfterKvSave } from './sqlAutosaveBackup';
import {
  persistKvDomainNow,
  type CloudSyncTracker,
  type KvDomainRefs,
} from './kvDomainPersistence';
import { isProductionSqlEnabled } from '../services/repository/sqlDomainUtils';

const PRODUCTION_USE_SQL = isProductionSqlEnabled();

/**
 * Guardado inmediato KV + réplica `app_kv` (plan de cuentas, productos, tesorería blob, etc.).
 */
export async function persistAppKvDomainNow<T>(options: {
  kvKey: string;
  payload: T;
  refs: KvDomainRefs<T>;
  kvApplyGenerationRef: MutableRefObject<number>;
  lastSaveErrorAtRef: MutableRefObject<Record<string, number>>;
  cloudSync?: CloudSyncTracker;
  errorMessage: string;
  successMessage?: string;
  isDataLoaded: boolean;
  hydratedRef: MutableRefObject<boolean>;
}): Promise<boolean> {
  const {
    kvKey,
    payload,
    refs,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
    cloudSync,
    errorMessage,
    successMessage,
    isDataLoaded,
    hydratedRef,
  } = options;

  if (!isDataLoaded || !hydratedRef.current) {
    toast.error(
      'Los datos siguen cargando desde la nube. Espera el aviso «Datos sincronizados con la nube» e intenta de nuevo.'
    );
    return false;
  }

  const kvOk = await persistKvDomainNow({
    kvKey,
    payload,
    refs,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
    errorMessage,
    successMessage: PRODUCTION_USE_SQL ? undefined : successMessage,
    sync: cloudSync,
  });

  if (!kvOk) return false;

  hydratedRef.current = true;

  if (PRODUCTION_USE_SQL) {
    const sqlOk = await backupAppKvAfterKvSave(
      true,
      kvKey,
      payload,
      lastSaveErrorAtRef
    );
    if (!sqlOk) return false;
  }

  if (successMessage) toast.success(successMessage);
  return true;
}
