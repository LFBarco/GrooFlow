/**
 * Carga datos de ejemplo operativos en KV (y SQL si aplica).
 * No toca usuarios, roles ni configuración de sistema (salvo asistencia vía caller).
 */
import { api } from '../services/api';
import { getSupabaseClientLazy } from '../services/repository/supabaseLazy';
import { saveAppKvKey } from '../services/repository/appKvSql';
import {
  saveProvidersToSql,
  savePettyCashToSql,
  saveInvoicesToSql,
  savePurchaseRequestsToSql,
} from '../services/repository/businessDomainsSql';
import { savePettyCashMetaToSql } from '../services/repository/pettyCashMetaSql';
import { isFleetSqlEnabled, saveFleetToSql } from '../services/repository/fleetSql';
import { isInventorySqlEnabled, saveInventoryToSql } from '../services/repository/inventorySql';
import { isProductionSqlEnabled } from '../services/repository/sqlDomainUtils';
import { isTransactionsSqlEnabled, saveTransactionsToSql } from '../services/repository/transactionsSql';
import {
  buildExampleOperationalPayload,
  type ExampleOperationalPayload,
} from '../data/exampleOperationalSeed';
import { PETTY_CASH_META_KV_KEY } from './pettyCashMeta';

export type LoadExampleOperationalResult = {
  ok: boolean;
  failed: string[];
  payload: ExampleOperationalPayload;
};

export async function loadExampleOperationalData(options?: {
  userId?: string | null;
  sedeNames?: string[];
}): Promise<LoadExampleOperationalResult> {
  const failed: string[] = [];
  const payload = buildExampleOperationalPayload(options?.sedeNames);

  const kvWrites: Array<[string, unknown]> = [
    ['data:transactions', payload.transactions],
    ['data:invoices', payload.invoices],
    ['data:providers', payload.providers],
    ['data:pettyCash', payload.pettyCash],
    [PETTY_CASH_META_KV_KEY, payload.pettyCashMeta],
    ['data:requests', payload.requests],
    ['data:products', payload.products],
    ['data:feeReceipts', payload.feeReceipts],
    ['data:chartOfAccounts', payload.chartOfAccounts],
    ['data:treasuryInvoices', payload.treasuryInvoices],
    ['data:treasuryBankBalance', payload.treasuryBankBalance],
    ['data:treasuryPaidHistory', payload.treasuryPaidHistory],
    ['data:treasurySubscriptions', payload.treasurySubscriptions],
    ['data:treasuryBankMovements', payload.treasuryBankMovements],
    ['data:reconciliation', payload.reconciliation],
    ['settings:alertReadState', { readIds: [], updatedAt: new Date().toISOString() }],
    ['data:fleet', payload.fleet],
    ['data:inventory', payload.inventory],
  ];

  for (const [key, value] of kvWrites) {
    const ok = await api.saveKey(key, value);
    if (!ok) failed.push(`kv:${key}`);
  }

  const userId = options?.userId ?? null;
  if (!isProductionSqlEnabled() || !userId) {
    return { ok: failed.length === 0, failed, payload };
  }

  const client = await getSupabaseClientLazy();
  if (!client) {
    return { ok: failed.length === 0, failed, payload };
  }

  const sqlTasks: Array<{ label: string; run: () => Promise<{ ok: boolean }> }> = [];

  if (isTransactionsSqlEnabled()) {
    sqlTasks.push({
      label: 'transactions',
      run: () => saveTransactionsToSql(client, payload.transactions, userId),
    });
  }

  sqlTasks.push(
    { label: 'providers', run: () => saveProvidersToSql(client, payload.providers, userId) },
    { label: 'pettyCash', run: () => savePettyCashToSql(client, payload.pettyCash, userId) },
    {
      label: 'pettyCashMeta',
      run: () => savePettyCashMetaToSql(client, payload.pettyCashMeta, userId),
    },
    { label: 'invoices', run: () => saveInvoicesToSql(client, payload.invoices, userId) },
    { label: 'requests', run: () => savePurchaseRequestsToSql(client, payload.requests, userId) },
    { label: 'products', run: () => saveAppKvKey(client, 'data:products', payload.products, userId) },
    {
      label: 'feeReceipts',
      run: () => saveAppKvKey(client, 'data:feeReceipts', payload.feeReceipts, userId),
    },
    {
      label: 'chartOfAccounts',
      run: () => saveAppKvKey(client, 'data:chartOfAccounts', payload.chartOfAccounts, userId),
    },
    {
      label: 'treasuryInvoices',
      run: () => saveAppKvKey(client, 'data:treasuryInvoices', payload.treasuryInvoices, userId),
    },
    {
      label: 'treasuryBankBalance',
      run: () =>
        saveAppKvKey(client, 'data:treasuryBankBalance', payload.treasuryBankBalance, userId),
    },
    {
      label: 'treasuryPaidHistory',
      run: () =>
        saveAppKvKey(client, 'data:treasuryPaidHistory', payload.treasuryPaidHistory, userId),
    },
    {
      label: 'treasurySubscriptions',
      run: () =>
        saveAppKvKey(client, 'data:treasurySubscriptions', payload.treasurySubscriptions, userId),
    },
    {
      label: 'treasuryBankMovements',
      run: () =>
        saveAppKvKey(client, 'data:treasuryBankMovements', payload.treasuryBankMovements, userId),
    },
    {
      label: 'reconciliation',
      run: () => saveAppKvKey(client, 'data:reconciliation', payload.reconciliation, userId),
    }
  );

  if (isFleetSqlEnabled()) {
    sqlTasks.push({
      label: 'fleet',
      run: () => saveFleetToSql(client, payload.fleet, userId),
    });
  }
  if (isInventorySqlEnabled()) {
    sqlTasks.push({
      label: 'inventory',
      run: () => saveInventoryToSql(client, payload.inventory, userId),
    });
  }

  for (const task of sqlTasks) {
    const result = await task.run();
    if (!result.ok) failed.push(`sql:${task.label}`);
  }

  return { ok: failed.length === 0, failed, payload };
}
