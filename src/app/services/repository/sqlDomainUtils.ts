/**
 * Utilidades compartidas para persistencia SQL de producción.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type SqlLoadResult<T> = {
  ok: boolean;
  data: T[] | null;
  empty: boolean;
};

export type SqlSaveResult = {
  ok: boolean;
  errors: string[];
};

export function isMissingTableError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  return (
    err.code === '42P01' ||
    err.code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table')
  );
}

/** Activo por defecto cuando backend es Supabase (VITE_PRODUCTION_SQL !== 'false'). */
export function isProductionSqlEnabled(): boolean {
  const backend = import.meta.env.VITE_BACKEND ?? 'supabase';
  if (backend !== 'supabase') return false;
  return import.meta.env.VITE_PRODUCTION_SQL !== 'false';
}

export async function pruneRowsById(
  client: SupabaseClient,
  table: string,
  keepIds: Set<string>
): Promise<string[]> {
  const errors: string[] = [];
  const { data: existing, error: listErr } = await client.from(table).select('id');
  if (listErr) {
    if (!isMissingTableError(listErr)) {
      console.warn(`[sql] prune list ${table} failed`, listErr);
      errors.push(listErr.message);
    }
    return errors;
  }
  const toDelete = (existing ?? [])
    .map((r) => r.id as string)
    .filter((id) => !keepIds.has(id));
  if (toDelete.length === 0) return errors;
  const { error: delErr } = await client.from(table).delete().in('id', toDelete);
  if (delErr) {
    console.warn(`[sql] prune delete ${table} failed`, delErr);
    errors.push(`delete: ${delErr.message}`);
  }
  return errors;
}

export async function upsertWithPrune<T extends { id: string }>(
  client: SupabaseClient,
  table: string,
  items: T[],
  toRows: (items: T[]) => Record<string, unknown>[],
  userId: string | null,
  options?: { allowPruneWhenEmpty?: boolean }
): Promise<SqlSaveResult> {
  const errors: string[] = [];
  if (!userId) {
    return { ok: false, errors: ['Sin sesión de usuario (auth.uid)'] };
  }
  const rows = toRows(items);
  const keepIds = new Set(items.map((i) => i.id));
  if (rows.length > 0) {
    const { error } = await client.from(table).upsert(rows, { onConflict: 'id' });
    if (error) {
      errors.push(error.message);
      return { ok: false, errors };
    }
  }
  /** Nunca borrar toda la tabla por autosave con lista vacía (error de carga / hidratación). */
  if (items.length === 0 && !options?.allowPruneWhenEmpty) {
    return { ok: true, errors: [] };
  }
  const pruneErrors = await pruneRowsById(client, table, keepIds);
  errors.push(...pruneErrors);
  return { ok: errors.length === 0, errors };
}
