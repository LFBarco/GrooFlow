/**
 * Transacciones — persistencia SQL directa (producción).
 * Fuente de verdad cuando VITE_TRANSACTIONS_SQL !== 'false'.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getGrooflowBackend } from '../../config/backend';
import type { Transaction } from '../types';
import { parseTransactionDate } from '../../utils/transactionDate';
import { deleteRowsByIdBatched, fetchAllRowIds, selectAllRowsPaginated } from './sqlDomainUtils';

export type TransactionsSqlLoadResult = {
  ok: boolean;
  data: Transaction[] | null;
  empty: boolean;
};

function rowToTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: String(row.id),
    amount: Number(row.amount) || 0,
    type: row.type === 'income' ? 'income' : 'expense',
    category: String(row.category ?? 'Otros'),
    subcategory: row.subcategory ? String(row.subcategory) : undefined,
    concept: row.concept ? String(row.concept) : undefined,
    description: String(row.description ?? ''),
    date: parseTransactionDate(row.date),
    account: row.account ? String(row.account) : undefined,
    currency: row.currency ? String(row.currency) : undefined,
    operation: row.operation ? String(row.operation) : undefined,
    reference: row.reference ? String(row.reference) : undefined,
    providerId: row.provider_id ? String(row.provider_id) : undefined,
    location: row.location ? String(row.location) : undefined,
  };
}

function transactionToRow(t: Transaction, userId: string | null) {
  return {
    id: t.id,
    amount: t.amount,
    type: t.type,
    category: t.category,
    subcategory: t.subcategory ?? null,
    concept: t.concept ?? null,
    description: t.description ?? '',
    date: parseTransactionDate(t.date).toISOString(),
    provider_id: t.providerId ?? null,
    location: t.location ?? null,
    account: t.account ?? null,
    currency: t.currency ?? null,
    operation: t.operation ?? null,
    reference: t.reference ?? null,
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
}

export async function loadTransactionsFromSql(
  client: SupabaseClient
): Promise<TransactionsSqlLoadResult> {
  const { rows, errors, missingTable } = await selectAllRowsPaginated(client, 'transactions', {
    order: { column: 'date', ascending: false },
  });

  if (missingTable) {
    return { ok: false, data: null, empty: true };
  }
  if (errors.length > 0) {
    console.warn('[transactionsSql] load error', errors);
    return { ok: false, data: null, empty: false };
  }

  const transactions = rows.map(rowToTransaction);
  return { ok: true, data: transactions, empty: transactions.length === 0 };
}

export type TransactionsSqlSaveResult = {
  ok: boolean;
  errors: string[];
};

export async function saveTransactionsToSql(
  client: SupabaseClient,
  transactions: Transaction[],
  userId: string | null,
  options?: { allowPruneWhenEmpty?: boolean }
): Promise<TransactionsSqlSaveResult> {
  const errors: string[] = [];
  if (!userId) {
    return { ok: false, errors: ['Sin sesión de usuario (auth.uid)'] };
  }

  const rows = transactions.map((t) => transactionToRow(t, userId));
  const keepIds = new Set(transactions.map((t) => t.id));

  if (rows.length > 0) {
    const { error } = await client.from('transactions').upsert(rows, { onConflict: 'id' });
    if (error) {
      errors.push(error.message);
      console.warn('[transactionsSql] upsert failed', error);
      return { ok: false, errors };
    }
  }

  if (transactions.length === 0 && !options?.allowPruneWhenEmpty) {
    return { ok: true, errors: [] };
  }

  const { ids: existing, errors: listErrors } = await fetchAllRowIds(client, 'transactions');
  errors.push(...listErrors);
  if (listErrors.length > 0) {
    return { ok: false, errors };
  }

  const toDelete = existing.filter((id) => !keepIds.has(id));
  if (toDelete.length > 0) {
    const deleteErrors = await deleteRowsByIdBatched(client, 'transactions', toDelete);
    errors.push(...deleteErrors.map((msg) => (msg.startsWith('delete') ? msg : `delete: ${msg}`)));
    if (deleteErrors.length > 0) {
      console.warn('[transactionsSql] prune delete failed', deleteErrors);
      return { ok: false, errors };
    }
  }

  return { ok: errors.length === 0, errors: [] };
}

export async function migrateTransactionsKvToSql(
  client: SupabaseClient,
  kvTransactions: Transaction[],
  userId: string | null
): Promise<boolean> {
  const result = await saveTransactionsToSql(client, kvTransactions, userId);
  return result.ok;
}

export function isTransactionsSqlEnabled(): boolean {
  if (getGrooflowBackend() !== 'supabase') return false;
  return import.meta.env.VITE_TRANSACTIONS_SQL !== 'false';
}
