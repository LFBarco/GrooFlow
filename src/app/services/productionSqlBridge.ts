/**
 * Puente SQL → KV para persistencia de producción.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { isProductionSqlEnabled, type SqlSaveResult } from './repository/sqlDomainUtils';
import { saveAppKvKey } from './repository/appKvSql';
import {
  saveProvidersToSql,
  savePettyCashToSql,
  saveInvoicesToSql,
  savePurchaseRequestsToSql,
  saveAppUsersToSql,
  saveRolesToSql,
} from './repository/businessDomainsSql';
import { getSupabaseClientLazy } from './repository/supabaseLazy';

export { isProductionSqlEnabled };

export async function getAuthUserId(): Promise<string | null> {
  const client = await getSupabaseClientLazy();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.user?.id ?? null;
}

export async function saveSqlWithResult(
  saver: (client: SupabaseClient, userId: string | null) => Promise<SqlSaveResult>,
  label: string
): Promise<boolean> {
  if (!isProductionSqlEnabled()) return true;
  const client = await getSupabaseClientLazy();
  if (!client) return true;
  const uid = await getAuthUserId();
  const result = await saver(client, uid);
  if (!result.ok) {
    console.warn(`[productionSql] ${label} failed`, result.errors);
  }
  return result.ok;
}

export async function saveAppKvWithAuth(key: string, value: unknown): Promise<boolean> {
  if (!isProductionSqlEnabled()) return true;
  const client = await getSupabaseClientLazy();
  if (!client) return true;
  const uid = await getAuthUserId();
  const result = await saveAppKvKey(client, key, value, uid);
  if (!result.ok) {
    console.warn(`[productionSql] app_kv ${key} failed`, result.errors);
  }
  return result.ok;
}

export const domainSavers = {
  providers: saveProvidersToSql,
  pettyCash: savePettyCashToSql,
  invoices: saveInvoicesToSql,
  requests: savePurchaseRequestsToSql,
  users: saveAppUsersToSql,
  roles: saveRolesToSql,
};
