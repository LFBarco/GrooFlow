/**
 * Persistencia SQL directa en `public.app_kv` (blobs JSON compartidos).
 * Usado para settings, productos, honorarios, tesorería, plan de cuentas.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { mergeSystemSettings } from '../../data/initialData';
import type { SystemSettings } from '../../types';
import { mergeAsistenciaSettings, mergeAsistenciaStaffLists } from '../../utils/asistenciaData';
import { isMissingTableError, isProductionSqlEnabled } from './sqlDomainUtils';

import type { AsistenciaOrgRequirement } from '../../types/asistencia';

const SETTINGS_SYSTEM_KEY = 'settings:system';

function mergeByKey<T>(
  kvItems: T[] | undefined,
  sqlItems: T[] | undefined,
  keyOf: (item: T) => string
): T[] {
  const map = new Map<string, T>();
  for (const item of kvItems ?? []) map.set(keyOf(item), item);
  for (const item of sqlItems ?? []) map.set(keyOf(item), item);
  return [...map.values()];
}

/** Fusiona SQL + KV para settings:system; SQL gana en conflictos de asistencia. */
export function mergeSystemSettingsSqlAndKv(
  sql: Partial<SystemSettings> | null | undefined,
  kv: Partial<SystemSettings> | null | undefined
): SystemSettings {
  const fromSql = mergeSystemSettings(sql);
  const fromKv = mergeSystemSettings(kv);
  const staff = mergeAsistenciaStaffLists(fromKv.asistencia?.staff, fromSql.asistencia?.staff);
  const sedeProfiles = mergeByKey(
    fromKv.asistencia?.sedeProfiles,
    fromSql.asistencia?.sedeProfiles,
    (p) => p.sedeName
  );
  const sedeMappings = mergeByKey(
    fromKv.asistencia?.sedeMappings,
    fromSql.asistencia?.sedeMappings,
    (m) => m.sedeName
  );
  const requirements = mergeByKey(
    fromKv.asistencia?.requirements,
    fromSql.asistencia?.requirements,
    (r) => r.id
  ) as AsistenciaOrgRequirement[];

  const asistencia = mergeAsistenciaSettings({
    ...fromKv.asistencia,
    ...fromSql.asistencia,
    staff,
    sedeProfiles,
    sedeMappings,
    requirements,
    buk: { ...fromKv.asistencia?.buk, ...fromSql.asistencia?.buk },
  });

  return mergeSystemSettings({
    ...fromKv,
    ...fromSql,
    asistencia,
    pettyCash: { ...fromKv.pettyCash, ...fromSql.pettyCash },
    veterinari: { ...fromKv.veterinari, ...fromSql.veterinari },
    providers: { ...fromKv.providers, ...fromSql.providers },
    accounting: { ...fromKv.accounting, ...fromSql.accounting },
  });
}

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
    if (Array.isArray(sqlLoad.data) && Array.isArray(kvValue)) {
      const sqlArr = sqlLoad.data as { id: string }[];
      const kvArr = kvValue as { id: string }[];
      const sqlIds = new Set(sqlArr.map((r) => r.id));
      const kvOnly = kvArr.filter((r) => !sqlIds.has(r.id));
      if (kvOnly.length > 0) {
        const merged = [...sqlArr, ...kvOnly] as T;
        if (userId) await migrateAppKvKey(client, key, merged, userId);
        return merged;
      }
    }
    if (
      key === SETTINGS_SYSTEM_KEY &&
      kvValue != null &&
      !isEmpty(kvValue) &&
      typeof sqlLoad.data === 'object' &&
      typeof kvValue === 'object' &&
      !Array.isArray(sqlLoad.data) &&
      !Array.isArray(kvValue)
    ) {
      const merged = mergeSystemSettingsSqlAndKv(
        sqlLoad.data as Partial<SystemSettings>,
        kvValue as Partial<SystemSettings>
      );
      if (userId) await migrateAppKvKey(client, key, merged, userId);
      return merged as T;
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
