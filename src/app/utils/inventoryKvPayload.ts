import type { InventoryDataset } from '../types/inventory';
import { normalizeInventoryDataset } from './inventoryData';

function timestampOf(raw?: string): number {
  if (!raw) return 0;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? 0 : t;
}

function pickInventoryList<T extends { id: string }>(
  kvList: T[],
  sqlList: T[],
  getTs: (row: T) => number
): T[] {
  if (kvList.length !== sqlList.length) {
    /** SQL refleja borrados/altas en producción cuando las listas difieren. */
    return sqlList;
  }
  const sqlMap = new Map(sqlList.map((row) => [row.id, row]));
  const kvIds = new Set(kvList.map((row) => row.id));
  const sqlIds = new Set(sqlList.map((row) => row.id));
  if (kvIds.size !== sqlIds.size || [...kvIds].some((id) => !sqlIds.has(id))) {
    return sqlList;
  }
  return kvList.map((kvRow) => {
    const sqlRow = sqlMap.get(kvRow.id);
    if (!sqlRow) return kvRow;
    return getTs(sqlRow) >= getTs(kvRow) ? sqlRow : kvRow;
  });
}

/** Combina KV + SQL al cargar; SQL gana en borrados (menos filas o ids distintos). */
export function mergeInventoryKvAndSql(kv: InventoryDataset, sql: InventoryDataset): InventoryDataset {
  const nk = normalizeInventoryDataset(kv);
  const ns = normalizeInventoryDataset(sql);
  const categoryConfig =
    (ns.categoryConfig?.length ?? 0) >= (nk.categoryConfig?.length ?? 0)
      ? ns.categoryConfig
      : nk.categoryConfig;
  return normalizeInventoryDataset({
    equipment: pickInventoryList(nk.equipment, ns.equipment, (e) => timestampOf(e.updatedAt || e.createdAt)),
    maintenance: pickInventoryList(nk.maintenance, ns.maintenance, (m) =>
      timestampOf(m.createdAt)
    ),
    categoryConfig,
  });
}
