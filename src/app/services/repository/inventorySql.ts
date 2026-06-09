/**
 * Inventario de equipos — persistencia SQL + Realtime.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  InventoryDataset,
  InventoryEquipment,
  InventoryMaintenanceRecord,
} from '../../types/inventory';
import { normalizeInventoryDataset } from '../../utils/inventoryData';
import { deleteRowsByIdBatched, fetchAllRowIds, selectAllRowsPaginated } from './sqlDomainUtils';

export type InventorySqlLoadResult = {
  ok: boolean;
  data: InventoryDataset | null;
  empty: boolean;
};

function equipmentRow(e: InventoryEquipment, userId: string | null) {
  return {
    id: e.id,
    sede: e.sede?.trim() || null,
    category: e.category,
    body: e as unknown as Record<string, unknown>,
    user_id: userId,
    updated_at: e.updatedAt || new Date().toISOString(),
  };
}

function maintenanceRow(m: InventoryMaintenanceRecord, userId: string | null) {
  return {
    id: m.id,
    equipment_id: m.equipmentId,
    sede: m.sede?.trim() || null,
    body: m as unknown as Record<string, unknown>,
    user_id: userId,
    updated_at: m.createdAt || new Date().toISOString(),
  };
}

function isMissingTableError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  return (
    err.code === '42P01' ||
    err.code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table')
  );
}

async function loadBodies<T>(client: SupabaseClient, table: string) {
  const { rows, errors, missingTable } = await selectAllRowsPaginated(client, table, {
    select: 'body',
  });
  if (missingTable || errors.length > 0) {
    return { items: [] as T[], missingTable, errors };
  }
  return {
    items: rows.map((r) => r.body as T),
    missingTable: false,
    errors: [],
  };
}

export async function loadInventoryFromSql(client: SupabaseClient): Promise<InventorySqlLoadResult> {
  const [eqLoad, maintLoad] = await Promise.all([
    loadBodies<InventoryEquipment>(client, 'inventory_equipment'),
    loadBodies<InventoryMaintenanceRecord>(client, 'inventory_maintenance'),
  ]);

  if (eqLoad.missingTable || maintLoad.missingTable) {
    return { ok: false, data: null, empty: true };
  }

  const loadErrors = [...eqLoad.errors, ...maintLoad.errors].filter(Boolean);
  if (loadErrors.length > 0) {
    console.warn('[inventorySql] load error', loadErrors);
    return { ok: false, data: null, empty: false };
  }

  const empty = eqLoad.items.length === 0 && maintLoad.items.length === 0;
  const data = normalizeInventoryDataset({
    equipment: eqLoad.items,
    maintenance: maintLoad.items,
  });
  return { ok: true, data, empty };
}

export type InventorySqlSaveResult = { ok: boolean; errors: string[] };

export async function saveInventoryToSql(
  client: SupabaseClient,
  dataset: InventoryDataset,
  userId: string | null,
  options?: { allowPruneWhenEmpty?: boolean }
): Promise<InventorySqlSaveResult> {
  const errors: string[] = [];
  if (!userId) {
    return { ok: false, errors: ['Sin sesión de usuario (auth.uid)'] };
  }

  const eqRows = dataset.equipment.map((e) => equipmentRow(e, userId));
  const maintRows = dataset.maintenance.map((m) => maintenanceRow(m, userId));

  const upsert = async (table: string, rows: Record<string, unknown>[]) => {
    if (rows.length === 0) return true;
    const { error } = await client.from(table).upsert(rows, { onConflict: 'id' });
    if (error) {
      errors.push(`${table}: ${error.message}`);
      console.warn(`[inventorySql] upsert ${table}`, error);
      return false;
    }
    return true;
  };

  const prune = async (table: string, keepIds: Set<string>) => {
    const { ids: existing, errors: listErrors } = await fetchAllRowIds(client, table);
    if (listErrors.length > 0) return;
    const toDelete = existing.filter((id) => !keepIds.has(id));
    if (toDelete.length === 0) return;
    const deleteErrors = await deleteRowsByIdBatched(client, table, toDelete);
    if (deleteErrors.length > 0) {
      console.warn(`[inventorySql] prune delete ${table}`, deleteErrors);
    }
  };

  const results = await Promise.all([
    upsert('inventory_equipment', eqRows),
    upsert('inventory_maintenance', maintRows),
  ]);

  if (results.every(Boolean)) {
    const isEmpty = dataset.equipment.length === 0 && dataset.maintenance.length === 0;
    if (!isEmpty || options?.allowPruneWhenEmpty) {
      await Promise.all([
        prune('inventory_equipment', new Set(dataset.equipment.map((e) => e.id))),
        prune('inventory_maintenance', new Set(dataset.maintenance.map((m) => m.id))),
      ]);
    }
  }

  return { ok: results.every(Boolean) && errors.length === 0, errors };
}

export async function migrateInventoryKvToSql(
  client: SupabaseClient,
  kvDataset: InventoryDataset,
  userId: string | null
): Promise<boolean> {
  const normalized = normalizeInventoryDataset(kvDataset);
  const result = await saveInventoryToSql(client, normalized, userId);
  return result.ok;
}

export function isInventorySqlEnabled(): boolean {
  const backend = import.meta.env.VITE_BACKEND ?? 'supabase';
  if (backend !== 'supabase') return false;
  return import.meta.env.VITE_INVENTORY_SQL !== 'false';
}
