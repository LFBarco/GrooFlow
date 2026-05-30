/**
 * Borra datos operativos en KV y SQL (no toca usuarios, roles ni configuración).
 */
import { api } from '../services/api';
import { getSupabaseClient } from '../services/repository/supabase';
import { saveAppKvKey } from '../services/repository/appKvSql';
import {
  saveProvidersToSql,
  savePettyCashToSql,
  saveInvoicesToSql,
  savePurchaseRequestsToSql,
} from '../services/repository/businessDomainsSql';
import { isFleetSqlEnabled, saveFleetToSql } from '../services/repository/fleetSql';
import { isProductionSqlEnabled } from '../services/repository/sqlDomainUtils';
import { isTransactionsSqlEnabled, saveTransactionsToSql } from '../services/repository/transactionsSql';
import { normalizeFleetDataset } from './fleetData';

const PRUNE_EMPTY = { allowPruneWhenEmpty: true };

export type ClearOperationalResult = {
  ok: boolean;
  failed: string[];
};

export async function clearOperationalData(userId: string | null): Promise<ClearOperationalResult> {
  const failed: string[] = [];
  const emptyFleet = normalizeFleetDataset({});

  const kvWrites: Array<[string, unknown]> = [
    ['data:transactions', []],
    ['data:invoices', []],
    ['data:providers', []],
    ['data:pettyCash', []],
    ['data:requests', []],
    ['data:products', []],
    ['data:feeReceipts', []],
    ['data:chartOfAccounts', []],
    ['data:treasuryInvoices', []],
    ['data:treasuryBankBalance', null],
    ['data:treasuryPaidHistory', []],
    ['data:fleet', emptyFleet],
  ];

  for (const [key, value] of kvWrites) {
    const ok = await api.saveKey(key, value);
    if (!ok) failed.push(`kv:${key}`);
  }

  if (!isProductionSqlEnabled() || !userId) {
    return { ok: failed.length === 0, failed };
  }

  const client = getSupabaseClient();
  const sqlTasks: Array<{ label: string; run: () => Promise<{ ok: boolean }> }> = [];

  if (isTransactionsSqlEnabled()) {
    sqlTasks.push({
      label: 'transactions',
      run: () => saveTransactionsToSql(client, [], userId, PRUNE_EMPTY),
    });
  }

  sqlTasks.push(
    { label: 'providers', run: () => saveProvidersToSql(client, [], userId, PRUNE_EMPTY) },
    { label: 'pettyCash', run: () => savePettyCashToSql(client, [], userId, PRUNE_EMPTY) },
    { label: 'invoices', run: () => saveInvoicesToSql(client, [], userId, PRUNE_EMPTY) },
    { label: 'requests', run: () => savePurchaseRequestsToSql(client, [], userId, PRUNE_EMPTY) },
    { label: 'products', run: () => saveAppKvKey(client, 'data:products', [], userId) },
    { label: 'feeReceipts', run: () => saveAppKvKey(client, 'data:feeReceipts', [], userId) },
    { label: 'chartOfAccounts', run: () => saveAppKvKey(client, 'data:chartOfAccounts', [], userId) },
    { label: 'treasuryInvoices', run: () => saveAppKvKey(client, 'data:treasuryInvoices', [], userId) },
    { label: 'treasuryBankBalance', run: () => saveAppKvKey(client, 'data:treasuryBankBalance', null, userId) },
    { label: 'treasuryPaidHistory', run: () => saveAppKvKey(client, 'data:treasuryPaidHistory', [], userId) }
  );

  if (isFleetSqlEnabled()) {
    sqlTasks.push({
      label: 'fleet',
      run: () => saveFleetToSql(client, emptyFleet, userId, PRUNE_EMPTY),
    });
  }

  for (const task of sqlTasks) {
    const result = await task.run();
    if (!result.ok) failed.push(`sql:${task.label}`);
  }

  return { ok: failed.length === 0, failed };
}
