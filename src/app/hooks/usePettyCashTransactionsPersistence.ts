import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { toast } from 'sonner';

import { savePettyCashToSql } from '../services/repository/businessDomainsSql';
import { isProductionSqlEnabled } from '../services/repository/sqlDomainUtils';
import { getSupabaseClientLazy } from '../services/repository/supabaseLazy';
import { getAuthUserId } from '../services/productionSqlBridge';
import type { PettyCashTransaction } from '../types';
import {
  backupDomainSqlAfterKvSave,
  ensureSqlSave,
} from '../utils/sqlAutosaveBackup';
import { DOMAIN_KV_COOLDOWN_MS } from './persistence/domainKvCooldown';
import {
  enqueueKvSerializedSave,
  kvSaveSucceeded,
  type KvSaveResult,
} from '../utils/kvSerializedSave';

const PRODUCTION_USE_SQL = isProductionSqlEnabled();
const PETTY_CASH_KV_SAVE_TIMEOUT_MS = 45_000;

function withKvSaveTimeout(promise: Promise<KvSaveResult>): Promise<KvSaveResult> {
  return Promise.race([
    promise,
    new Promise<KvSaveResult>((resolve) => {
      setTimeout(() => resolve('failed'), PETTY_CASH_KV_SAVE_TIMEOUT_MS);
    }),
  ]);
}

export type UsePettyCashTransactionsPersistenceOptions = {
  isDataLoaded: boolean;
  transactions: PettyCashTransaction[];
  setPettyCashTransactions: Dispatch<SetStateAction<PettyCashTransaction[]>>;
  hydratedRef: MutableRefObject<boolean>;
  skipHydrateRef: MutableRefObject<boolean>;
  chainRef: MutableRefObject<Promise<KvSaveResult>>;
  latestRef: MutableRefObject<PettyCashTransaction[]>;
  cooldownUntilRef: MutableRefObject<number>;
  kvApplyGenerationRef: MutableRefObject<number>;
  lastSaveErrorAtRef: MutableRefObject<Record<string, number>>;
};

/** Autosave KV + SQL de movimientos de caja chica (`data:pettyCash`). */
export function usePettyCashTransactionsPersistence(
  options: UsePettyCashTransactionsPersistenceOptions
) {
  const {
    isDataLoaded,
    transactions,
    setPettyCashTransactions,
    hydratedRef,
    skipHydrateRef,
    chainRef,
    latestRef,
    cooldownUntilRef,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
  } = options;

  const skipExplicitAutosaveRef = useRef(false);

  useEffect(() => {
    if (!isDataLoaded || !hydratedRef.current) return;
    if (skipExplicitAutosaveRef.current) return;
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

  const persistPettyCashNow = useCallback(
    async (next: PettyCashTransaction[]): Promise<boolean> => {
      if (!isDataLoaded) {
        toast.error(
          'Los datos siguen cargando desde la nube. Espera el aviso «Datos sincronizados con la nube» e intenta de nuevo.'
        );
        return false;
      }
      if (!hydratedRef.current) {
        toast.error(
          'Caja chica aún no terminó de sincronizar. Espera unos segundos antes de registrar gastos.'
        );
        return false;
      }

      skipExplicitAutosaveRef.current = true;
      skipHydrateRef.current = true;
      try {
        if (PRODUCTION_USE_SQL) {
          const uid = await getAuthUserId();
          const client = await getSupabaseClientLazy();
          if (!client) return false;
          const sqlOk = await ensureSqlSave(
            true,
            'data:pettyCash',
            () => savePettyCashToSql(client, next, uid),
            lastSaveErrorAtRef
          );
          if (!sqlOk) return false;
        }

        const result = await withKvSaveTimeout(
          enqueueKvSerializedSave(
            chainRef,
            kvApplyGenerationRef,
            latestRef,
            'data:pettyCash',
            next,
            { updateLatestRef: false }
          )
        );

        if (result === 'skipped') {
          toast.error(
            'No se pudo confirmar el guardado (sesión en transición). Espera un momento e intenta de nuevo.'
          );
          return false;
        }
        if (!kvSaveSucceeded(result)) {
          toast.error(
            'No se pudo guardar Caja chica en la nube. Revisa sesión/red antes de cerrar o actualizar la página.'
          );
          return false;
        }

        latestRef.current = next;
        hydratedRef.current = true;
        cooldownUntilRef.current = Date.now() + DOMAIN_KV_COOLDOWN_MS;
        setPettyCashTransactions(next);
        return true;
      } catch (e) {
        console.warn('[GrooFlow] pettyCash persist:', e);
        toast.error('Error al guardar caja chica en la nube.');
        return false;
      } finally {
        skipHydrateRef.current = false;
        skipExplicitAutosaveRef.current = false;
      }
    },
    [isDataLoaded, setPettyCashTransactions]
  );

  return { persistPettyCashNow };
}
