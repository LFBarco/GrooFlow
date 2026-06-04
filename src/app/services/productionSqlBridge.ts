/**

 * Puente SQL → KV para persistencia de producción.

 */

import { getSupabaseClient } from './repository/supabase';

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



export { isProductionSqlEnabled };



export async function getAuthUserId(): Promise<string | null> {

  const { data } = await getSupabaseClient().auth.getSession();

  return data.session?.user?.id ?? null;

}



export async function saveSqlWithResult(

  saver: (client: ReturnType<typeof getSupabaseClient>, userId: string | null) => Promise<SqlSaveResult>,

  label: string

): Promise<boolean> {

  if (!isProductionSqlEnabled()) return true;

  const uid = await getAuthUserId();

  const result = await saver(getSupabaseClient(), uid);

  if (!result.ok) {

    console.warn(`[productionSql] ${label} failed`, result.errors);

  }

  return result.ok;

}



export async function saveAppKvWithAuth(key: string, value: unknown): Promise<boolean> {

  if (!isProductionSqlEnabled()) return true;

  const uid = await getAuthUserId();

  const result = await saveAppKvKey(getSupabaseClient(), key, value, uid);

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


