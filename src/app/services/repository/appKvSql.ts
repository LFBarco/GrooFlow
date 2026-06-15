/**
 * Persistencia SQL directa en `public.app_kv` (blobs JSON compartidos).
 * Usado para settings, productos, honorarios, tesorería, plan de cuentas.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { mergeSystemSettings } from '../../data/initialData';
import type { SystemSettings } from '../../types';
import { mergeAsistenciaSettings, mergeAsistenciaStaffLists } from '../../utils/asistenciaData';
import { isMissingTableError, isProductionSqlEnabled } from './sqlDomainUtils';

const SETTINGS_SYSTEM_KEY = 'settings:system';

/** Fusiona SQL + KV para settings:system sin perder asistencia.staff ni sedeProfiles. */
export function mergeSystemSettingsSqlAndKv(
  sql: Partial<SystemSettings> | null | undefined,
  kv: Partial<SystemSettings> | null | undefined
): SystemSettings {
  const fromSql = mergeSystemSettings(sql);
  const fromKv = mergeSystemSettings(kv);
  const staff = mergeAsistenciaStaffLists(fromSql.asistencia?.staff, fromKv.asistencia?.staff);
  const profileMap = new Map<string, NonNullable<typeof fromSql.asistencia>['sedeProfiles'][number]>();
  for (const p of fromSql.asistencia?.sedeProfiles ?? []) profileMap.set(p.sedeName, p);
  for (const p of fromKv.asistencia?.sedeProfiles ?? []) profileMap.set(p.sedeName, p);

  const asistencia = mergeAsistenciaSettings({
    ...fromSql.asistencia,
    ...fromKv.asistencia,
    staff,
    sedeProfiles: [...profileMap.values()],
    buk: { ...fromSql.asistencia?.buk, ...fromKv.asistencia?.buk },
    requirements:
      (fromKv.asistencia?.requirements?.length ?? 0) >= (fromSql.asistencia?.requirements?.length ?? 0)
        ? fromKv.asistencia?.requirements
        : fromSql.asistencia?.requirements,
    sedeMappings:
      (fromKv.asistencia?.sedeMappings?.length ?? 0) >= (fromSql.asistencia?.sedeMappings?.length ?? 0)
        ? fromKv.asistencia?.sedeMappings
        : fromSql.asistencia?.sedeMappings,
  });

  return mergeSystemSettings({
    ...fromSql,
    ...fromKv,
    asistencia,
    pettyCash: { ...fromSql.pettyCash, ...fromKv.pettyCash },
    veterinari: { ...fromSql.veterinari, ...fromKv.veterinari },
    providers: { ...fromSql.providers, ...fromKv.providers },
    accounting: { ...fromSql.accounting, ...fromKv.accounting },
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
