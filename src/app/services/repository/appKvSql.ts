/**
 * Persistencia SQL directa en `public.app_kv` (blobs JSON compartidos).
 * Usado para settings, productos, honorarios, tesorería, plan de cuentas.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingTableError, isProductionSqlEnabled } from './sqlDomainUtils';

export type AppKvLoadResult<T> = {
  ok: boolean;
  data: T | null;
  empty: boolean;
};

export type AppKvSaveResult = {
  ok: boolean;
  errors: string[];
};

export function isAppKvSqlEnabled(): boolean {
  return isProductionSqlEnabled();
}

export async function loadAppKvKey<T>(
  client: SupabaseClient,
  key: string
): Promise<AppKvLoadResult<T>> {
  const { data, error } = await client
    .from('app_kv')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return { ok: false, data: null, empty: true };
    }
    console.warn('[appKvSql] load error', key, error);
    return { ok: false, data: null, empty: false };
  }

  if (!data?.value) {
    return { ok: true, data: null, empty: true };
  }

  return { ok: true, data: data.value as T, empty: false };
}

export async function saveAppKvKey(
  client: SupabaseClient,
  key: string,
  value: unknown,
  userId: string | null
): Promise<AppKvSaveResult> {
  if (!userId) {
    return { ok: false, errors: ['Sin sesión de usuario (auth.uid)'] };
  }
  const { error } = await client.from('app_kv').upsert(
    {
      key,
      value: value as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );
  if (error) {
    console.warn('[appKvSql] save error', key, error);
    return { ok: false, errors: [error.message] };
  }
  return { ok: true, errors: [] };
}

export async function migrateAppKvKey<T>(
  client: SupabaseClient,
  key: string,
  kvValue: T,
  userId: string | null
): Promise<boolean> {
  const result = await saveAppKvKey(client, key, kvValue, userId);
  return result.ok;
}

/** Resuelve datos: SQL gana si tiene filas; si no, migra desde KV. */
export async function resolveAppKvFromSql<T>(
  client: SupabaseClient,
  key: string,
  kvValue: T | null | undefined,
  userId: string | null,
  isEmpty: (v: T | null | undefined) => boolean
): Promise<T | null | undefined> {
  if (!isAppKvSqlEnabled()) return kvValue;

  const sqlLoad = await loadAppKvKey<T>(client, key);

  if (!sqlLoad.ok) {
    return kvValue;
  }

  if (sqlLoad.ok && sqlLoad.data != null && !isEmpty(sqlLoad.data)) {
    if (
      Array.isArray(sqlLoad.data) &&
      Array.isArray(kvValue) &&
      kvValue.length > sqlLoad.data.length
    ) {
      if (userId) await migrateAppKvKey(client, key, kvValue, userId);
      return kvValue;
    }
    return sqlLoad.data;
  }
  if (kvValue != null && !isEmpty(kvValue)) {
    if (userId) {
      await migrateAppKvKey(client, key, kvValue, userId);
    }
    return kvValue;
  }
  if (sqlLoad.ok && sqlLoad.data != null) {
    return sqlLoad.data;
  }
  return kvValue ?? null;
}
