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

export const SQL_PAGE_SIZE = 1000;
/** PostgREST limita `.in()` en DELETE por longitud de URL; lotes pequeños evitan 400 Bad Request. */
const SQL_DELETE_BATCH_SIZE = 50;

export type SelectPaginatedOptions = {
  select?: string;
  order?: { column: string; ascending?: boolean };
  filter?: { column: string; value: string };
};

/** Carga todas las filas de una tabla paginando (evita límite ~1000 de PostgREST). */
export async function selectAllRowsPaginated(
  client: SupabaseClient,
  table: string,
  options?: SelectPaginatedOptions
): Promise<{ rows: Record<string, unknown>[]; errors: string[]; missingTable: boolean }> {
  const rows: Record<string, unknown>[] = [];
  const errors: string[] = [];
  let from = 0;
  let missingTable = false;

  while (true) {
    let query = client
      .from(table)
      .select(options?.select ?? '*')
      .range(from, from + SQL_PAGE_SIZE - 1);

    if (options?.order) {
      query = query.order(options.order.column, {
        ascending: options.order.ascending ?? true,
      });
    }
    if (options?.filter) {
      query = query.eq(options.filter.column, options.filter.value);
    }

    const { data, error } = await query;
    if (error) {
      if (isMissingTableError(error)) {
        missingTable = true;
      } else {
        console.warn(`[sql] select ${table} page failed`, error);
        errors.push(error.message);
      }
      break;
    }

    const page = (data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < SQL_PAGE_SIZE) break;
    from += SQL_PAGE_SIZE;
  }

  return { rows, errors, missingTable };
}

export async function fetchAllRowIds(
  client: SupabaseClient,
  table: string
): Promise<{ ids: string[]; errors: string[] }> {
  const ids: string[] = [];
  const errors: string[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await client
      .from(table)
      .select('id')
      .range(from, from + SQL_PAGE_SIZE - 1);

    if (error) {
      if (!isMissingTableError(error)) {
        console.warn(`[sql] list ids ${table} failed`, error);
        errors.push(error.message);
      }
      break;
    }

    const rows = data ?? [];
    for (const row of rows) {
      const id = String(row.id ?? '').trim();
      if (id) ids.push(id);
    }

    if (rows.length < SQL_PAGE_SIZE) break;
    from += SQL_PAGE_SIZE;
  }

  return { ids, errors };
}

async function deleteIdsOneByOne(
  client: SupabaseClient,
  table: string,
  ids: string[]
): Promise<string[]> {
  const errors: string[] = [];
  for (const id of ids) {
    const { error } = await client.from(table).delete().eq('id', id);
    if (error) errors.push(`delete ${id}: ${error.message}`);
  }
  return errors;
}

export async function deleteRowsByIdBatched(
  client: SupabaseClient,
  table: string,
  ids: string[]
): Promise<string[]> {
  const valid = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
  if (valid.length === 0) return [];

  const errors: string[] = [];
  for (let i = 0; i < valid.length; i += SQL_DELETE_BATCH_SIZE) {
    const chunk = valid.slice(i, i + SQL_DELETE_BATCH_SIZE);
    const { error } = await client.from(table).delete().in('id', chunk);
    if (!error) continue;

    console.warn(`[sql] batch delete ${table} failed, retrying one-by-one`, error);
    errors.push(...(await deleteIdsOneByOne(client, table, chunk)));
  }
  return errors;
}

export async function pruneRowsById(
  client: SupabaseClient,
  table: string,
  keepIds: Set<string>
): Promise<string[]> {
  const errors: string[] = [];
  const { ids: existing, errors: listErrors } = await fetchAllRowIds(client, table);
  errors.push(...listErrors);

  const toDelete = existing.filter((id) => !keepIds.has(id));
  if (toDelete.length === 0) return errors;

  const deleteErrors = await deleteRowsByIdBatched(client, table, toDelete);
  errors.push(...deleteErrors.map((msg) => (msg.startsWith('delete') ? msg : `delete: ${msg}`)));
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
