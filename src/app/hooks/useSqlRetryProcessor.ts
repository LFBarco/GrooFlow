import { useCallback, useEffect } from 'react';

import { getAuthUserId } from '../services/productionSqlBridge';
import { getSupabaseClientLazy } from '../services/repository/supabaseLazy';
import { isFleetSqlEnabled } from '../services/repository/fleetSql';
import { isInventorySqlEnabled } from '../services/repository/inventorySql';
import { isProductionSqlEnabled } from '../services/repository/sqlDomainUtils';
import { isTransactionsSqlEnabled } from '../services/repository/transactionsSql';
import {
  buildSqlRetryRunners,
  type SqlRetryLatestSnapshot,
} from '../utils/buildSqlRetryRunners';
import { processPendingSqlRetries } from '../utils/sqlRetryProcessor';

const HYDRATE_RETRY_DELAY_MS = 4000;

export type UseSqlRetryProcessorOptions = {
  isDataLoaded: boolean;
  getLatestSnapshot: () => SqlRetryLatestSnapshot;
  /** app_users / roles: escritura SQL solo admin (RLS). */
  canWriteUsersRoles?: boolean;
};

/**
 * Reintenta saves SQL pendientes tras hidratación y al recuperar conexión.
 */
export function useSqlRetryProcessor(options: UseSqlRetryProcessorOptions) {
  const { isDataLoaded, getLatestSnapshot, canWriteUsersRoles = false } = options;

  const processPendingSqlRetryQueue = useCallback(
    async (notify?: boolean) => {
      const productionSql = isProductionSqlEnabled();
      const transactionsSql = isTransactionsSqlEnabled();
      const fleetSql = isFleetSqlEnabled();
      const inventorySql = isInventorySqlEnabled();
      if (!productionSql && !transactionsSql && !fleetSql && !inventorySql) return;
      if (!isDataLoaded) return;

      const uid = await getAuthUserId();
      const client = await getSupabaseClientLazy();
      if (!client) return;
      const runners = buildSqlRetryRunners({
        client,
        uid,
        productionSql,
        transactionsSql,
        fleetSql,
        inventorySql,
        canWriteUsersRoles,
        latest: getLatestSnapshot(),
      });

      await processPendingSqlRetries(runners, { notify });
    },
    [isDataLoaded, getLatestSnapshot, canWriteUsersRoles]
  );

  useEffect(() => {
    if (!isDataLoaded) return;
    const timer = window.setTimeout(() => {
      void processPendingSqlRetryQueue(true);
    }, HYDRATE_RETRY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isDataLoaded, processPendingSqlRetryQueue]);

  useEffect(() => {
    if (!isDataLoaded) return;
    const onOnline = () => void processPendingSqlRetryQueue(true);
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [isDataLoaded, processPendingSqlRetryQueue]);

  return { processPendingSqlRetryQueue };
}
