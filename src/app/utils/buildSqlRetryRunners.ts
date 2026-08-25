import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  AlertThresholds,
  ChartOfAccountEntry,
  InvoiceDraft,
  PettyCashTransaction,
  Product,
  Provider,
  PurchaseRequest,
  SystemSettings,
  User,
} from '../types';
import type { ConfigStructure } from '../data/initialData';
import type { Role } from '../components/users/types';
import type { FleetDataset } from '../types/fleet';
import type { InventoryDataset } from '../types/inventory';
import type { AlertReadState } from '../hooks/alertReadPersistenceBridge';
import type { ReconciliationDataset } from '../reconciliation/domain/types';
import { saveAppKvKey } from '../services/repository/appKvSql';
import {
  saveAppUsersToSql,
  saveInvoicesToSql,
  savePettyCashToSql,
  saveProvidersToSql,
  savePurchaseRequestsToSql,
  saveRolesToSql,
} from '../services/repository/businessDomainsSql';
import { saveFleetToSql } from '../services/repository/fleetSql';
import { saveInventoryToSql } from '../services/repository/inventorySql';
import { savePettyCashMetaToSql } from '../services/repository/pettyCashMetaSql';
import { saveTransactionsToSql } from '../services/repository/transactionsSql';
import { PETTY_CASH_META_KV_KEY, type PettyCashWeekMetaPayload } from './pettyCashMeta';
import type { AsistenciaSettings } from '../types/asistencia';
import { ASISTENCIA_SETTINGS_KV_KEY } from './asistenciaPersistence';
import { getSqlSaveQueue } from './sqlSaveQueue';
import type { SqlRetryRunnerMap } from './sqlRetryProcessor';

export type FeeReceiptGlobal = {
  id: string;
  sede: string;
  [key: string]: unknown;
};

export type SqlRetryLatestSnapshot = {
  config: ConfigStructure;
  systemSettings: SystemSettings;
  theme: 'dark' | 'light';
  alertThresholds: AlertThresholds;
  transactions: import('../types').Transaction[];
  providers: Provider[];
  pettyCash: PettyCashTransaction[];
  invoices: InvoiceDraft[];
  requests: PurchaseRequest[];
  users: User[];
  roles: Role[];
  feeReceipts: FeeReceiptGlobal[];
  products: Product[];
  chartOfAccounts: ChartOfAccountEntry[];
  treasuryInvoices: unknown[];
  treasuryBankBalance: number | undefined;
  treasuryPaidHistory: unknown[];
  treasurySubscriptions: unknown[];
  treasuryBankMovements: unknown[];
  fleet: FleetDataset;
  inventory: InventoryDataset;
  pettyCashMeta: PettyCashWeekMetaPayload;
  asistencia: AsistenciaSettings;
  reconciliation: ReconciliationDataset;
  alertReadState: AlertReadState;
};

export type BuildSqlRetryRunnersInput = {
  client: SupabaseClient;
  uid: string | null;
  productionSql: boolean;
  transactionsSql: boolean;
  fleetSql: boolean;
  inventorySql: boolean;
  canWriteUsersRoles?: boolean;
  latest: SqlRetryLatestSnapshot;
};

function queuedRunner(storageKey: string, run: () => Promise<{ ok: boolean; errors: string[] }>) {
  return () =>
    getSqlSaveQueue(storageKey).enqueue(`retry:${storageKey}`, run);
}

/** Mapa de runners para `processPendingSqlRetries` a partir del estado actual. */
export function buildSqlRetryRunners(input: BuildSqlRetryRunnersInput): SqlRetryRunnerMap {
  const { client, uid, latest } = input;
  const runners: SqlRetryRunnerMap = {};

  const appKv = (kvKey: keyof SqlRetryLatestSnapshot | string, value: unknown) =>
    queuedRunner(kvKey, () => saveAppKvKey(client, kvKey, value, uid));

  if (input.transactionsSql) {
    runners['data:transactions'] = queuedRunner('data:transactions', () =>
      saveTransactionsToSql(client, latest.transactions, uid)
    );
  }
  if (input.fleetSql) {
    runners['data:fleet'] = queuedRunner('data:fleet', () =>
      saveFleetToSql(client, latest.fleet, uid)
    );
  }
  if (input.inventorySql) {
    runners['data:inventory'] = queuedRunner('data:inventory', () =>
      saveInventoryToSql(client, latest.inventory, uid)
    );
  }
  if (!input.productionSql) return runners;

  runners['settings:config'] = appKv('settings:config', latest.config);
  runners['settings:system'] = appKv('settings:system', latest.systemSettings);
  runners[ASISTENCIA_SETTINGS_KV_KEY] = appKv(ASISTENCIA_SETTINGS_KV_KEY, latest.asistencia);
  runners['settings:theme'] = appKv('settings:theme', latest.theme);
  runners['settings:alertThresholds'] = appKv('settings:alertThresholds', latest.alertThresholds);
  runners['data:providers'] = queuedRunner('data:providers', () =>
    saveProvidersToSql(client, latest.providers, uid)
  );
  runners['data:pettyCash'] = queuedRunner('data:pettyCash', () =>
    savePettyCashToSql(client, latest.pettyCash, uid)
  );
  runners[PETTY_CASH_META_KV_KEY] = queuedRunner(PETTY_CASH_META_KV_KEY, () =>
    savePettyCashMetaToSql(client, latest.pettyCashMeta, uid)
  );
  runners['data:invoices'] = queuedRunner('data:invoices', () =>
    saveInvoicesToSql(client, latest.invoices, uid)
  );
  runners['data:requests'] = queuedRunner('data:requests', () =>
    savePurchaseRequestsToSql(client, latest.requests, uid)
  );
  if (input.canWriteUsersRoles) {
    runners['data:users'] = queuedRunner('data:users', () =>
      saveAppUsersToSql(client, latest.users, uid)
    );
    runners['data:roles'] = queuedRunner('data:roles', () =>
      saveRolesToSql(client, latest.roles, uid)
    );
  }
  runners['data:feeReceipts'] = appKv('data:feeReceipts', latest.feeReceipts);
  runners['data:products'] = appKv('data:products', latest.products);
  runners['data:chartOfAccounts'] = appKv('data:chartOfAccounts', latest.chartOfAccounts);
  runners['data:treasuryInvoices'] = appKv('data:treasuryInvoices', latest.treasuryInvoices);
  runners['data:treasuryBankBalance'] = appKv(
    'data:treasuryBankBalance',
    latest.treasuryBankBalance
  );
  runners['data:treasuryPaidHistory'] = appKv('data:treasuryPaidHistory', latest.treasuryPaidHistory);
  runners['data:treasurySubscriptions'] = appKv(
    'data:treasurySubscriptions',
    latest.treasurySubscriptions
  );
  runners['data:treasuryBankMovements'] = appKv(
    'data:treasuryBankMovements',
    latest.treasuryBankMovements
  );
  runners['data:reconciliation'] = appKv('data:reconciliation', latest.reconciliation);
  runners['settings:alertReadState'] = appKv(
    'settings:alertReadState',
    latest.alertReadState
  );

  return runners;
}
