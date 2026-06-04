import { useCallback, useEffect } from 'react';

import { getAuthUserId } from '../services/productionSqlBridge';
import { getSupabaseClient } from '../services/repository/supabase';
import { isFleetSqlEnabled } from '../services/repository/fleetSql';
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
};

/**
 * Reintenta saves SQL pendientes tras hidratación y al recuperar conexión.
 */
export function useSqlRetryProcessor(options: UseSqlRetryProcessorOptions) {
  const { isDataLoaded, getLatestSnapshot } = options;

  const processPendingSqlRetryQueue = useCallback(
    async (notify?: boolean) => {
      const productionSql = isProductionSqlEnabled();
      const transactionsSql = isTransactionsSqlEnabled();
      const fleetSql = isFleetSqlEnabled();
      if (!productionSql && !transactionsSql && !fleetSql) return;
      if (!isDataLoaded) return;

      const uid = await getAuthUserId();
      const client = getSupabaseClient();
      const runners = buildSqlRetryRunners({
        client,
        uid,
        productionSql,
        transactionsSql,
        fleetSql,
        latest: getLatestSnapshot(),
      });

      await processPendingSqlRetries(runners, { notify });
    },
    [isDataLoaded, getLatestSnapshot]
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
