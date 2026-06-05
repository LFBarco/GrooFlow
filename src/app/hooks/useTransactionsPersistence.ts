import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { toast } from 'sonner';

import {
  saveTransactionsToSql,
  isTransactionsSqlEnabled,
} from '../services/repository/transactionsSql';
import { getSupabaseClient } from '../services/repository/supabase';
import type { Transaction } from '../types';
import {
  backupDomainSqlAfterKvSave,
  ensureSqlSave,
} from '../utils/sqlAutosaveBackup';
import { KV_DOMAIN_COOLDOWN_MS } from '../utils/kvDomainPersistence';
import {
  enqueueKvSerializedSave,
  kvSaveSucceeded,
  type KvSaveResult,
} from '../utils/kvSerializedSave';

const TRANSACTIONS_USE_SQL = isTransactionsSqlEnabled();

export type UseTransactionsPersistenceOptions = {
  isDataLoaded: boolean;
  transactions: Transaction[];
  setTransactions: Dispatch<SetStateAction<Transaction[]>>;
  cloudHydrationDoneRef: MutableRefObject<boolean>;
  hydratedFromKvRef: MutableRefObject<boolean>;
  chainRef: MutableRefObject<Promise<KvSaveResult>>;
  latestRef: MutableRefObject<Transaction[]>;
  cooldownUntilRef: MutableRefObject<number>;
  kvApplyGenerationRef: MutableRefObject<number>;
  lastSaveErrorAtRef: MutableRefObject<Record<string, number>>;
};

export function useTransactionsPersistence(options: UseTransactionsPersistenceOptions) {
  const {
    isDataLoaded,
    transactions,
    setTransactions,
    cloudHydrationDoneRef,
    hydratedFromKvRef,
    chainRef,
    latestRef,
    cooldownUntilRef,
    kvApplyGenerationRef,
    lastSaveErrorAtRef,
  } = options;

  useEffect(() => {
    if (!isDataLoaded || !cloudHydrationDoneRef.current) return;
    if (transactions.length === 0 && !hydratedFromKvRef.current) return;
    void enqueueKvSerializedSave(
      chainRef,
      kvApplyGenerationRef,
      latestRef,
      'data:transactions',
      transactions
    ).then((result) => {
      if (kvSaveSucceeded(result)) {
        hydratedFromKvRef.current = true;
        cooldownUntilRef.current = Date.now() + KV_DOMAIN_COOLDOWN_MS;
        void backupDomainSqlAfterKvSave(
          TRANSACTIONS_USE_SQL,
          'data:transactions',
          transactions,
          (client, data, uid) =>
            saveTransactionsToSql(
              client,
              data,
              uid,
              data.length === 0 ? { allowPruneWhenEmpty: true } : undefined
            ),
          lastSaveErrorAtRef
        );
        return;
      }
      if (result === 'skipped') return;
      const now = Date.now();
      const last = lastSaveErrorAtRef.current['data:transactions'] ?? 0;
      if (now - last < 8000) return;
      lastSaveErrorAtRef.current['data:transactions'] = now;
      toast.error(
        'No se pudieron guardar las transacciones en la nube. Revisa sesión/red antes de cerrar.'
      );
    });
  }, [transactions, isDataLoaded]);

  const persistTransactionsNow = useCallback(
    async (
      next: Transaction[],
      successMessage?: string,
      saveOptions?: { allowPruneWhenEmpty?: boolean }
    ): Promise<boolean> => {
      setTransactions(next);
      if (!isDataLoaded || !cloudHydrationDoneRef.current) {
        toast.error(
          'Los datos siguen cargando desde la nube. Espera unos segundos y vuelve a intentar.'
        );
        return false;
      }
      latestRef.current = next;

      if (TRANSACTIONS_USE_SQL) {
        const { data: sess } = await getSupabaseClient().auth.getSession();
        const uid = sess.session?.user?.id ?? null;
        const sqlOpts = {
          ...saveOptions,
          ...(next.length === 0 ? { allowPruneWhenEmpty: true } : {}),
        };
        const sqlOk = await ensureSqlSave(
          true,
          'data:transactions',
          () => saveTransactionsToSql(getSupabaseClient(), next, uid, sqlOpts),
          lastSaveErrorAtRef
        );
        if (!sqlOk) return false;
      }

      const result = await enqueueKvSerializedSave(
        chainRef,
        kvApplyGenerationRef,
        latestRef,
        'data:transactions',
        next
      );
      if (kvSaveSucceeded(result)) {
        hydratedFromKvRef.current = true;
        cooldownUntilRef.current = Date.now() + KV_DOMAIN_COOLDOWN_MS;
        if (successMessage) toast.success(successMessage);
        return true;
      }
      if (result === 'skipped') {
        toast.error(
          'No se pudo confirmar el guardado (sesión en transición). Espera un momento e intenta de nuevo.'
        );
        return false;
      }
      toast.error(
        'No se pudieron guardar las transacciones en la nube. No cierres ni actualices; revisa conexión/sesión.'
      );
      return false;
    },
    [isDataLoaded, setTransactions]
  );

  return { persistTransactionsNow };
}
