import type { InventoryDataset } from '../types/inventory';
import { normalizeInventoryDataset } from './inventoryData';
import { kvPayloadsEqual } from './kvCrossTabSync';

function inventoryCounts(dataset: InventoryDataset) {
  return {
    equipment: dataset.equipment.length,
    maintenance: dataset.maintenance.length,
  };
}

function hasInventoryData(dataset: InventoryDataset): boolean {
  const c = inventoryCounts(dataset);
  return c.equipment > 0 || c.maintenance > 0;
}

function inventoryLocalAheadOfRemote(local: InventoryDataset, remote: InventoryDataset): boolean {
  const lc = inventoryCounts(local);
  const rc = inventoryCounts(remote);
  if (lc.equipment > rc.equipment) return true;
  if (lc.maintenance > rc.maintenance) return true;
  return false;
}

/** Evita que Realtime/poll SQL pise datos locales recién guardados. */
export function shouldApplyInventoryRemoteSnapshot(
  local: InventoryDataset,
  remote: InventoryDataset,
  cooldownUntilMs: number
): boolean {
  if (Date.now() < cooldownUntilMs) return false;
  const normalizedLocal = normalizeInventoryDataset(local);
  const normalizedRemote = normalizeInventoryDataset(remote);
  if (kvPayloadsEqual(normalizedLocal, normalizedRemote)) return false;
  if (!hasInventoryData(normalizedLocal) && hasInventoryData(normalizedRemote)) {
    return true;
  }
  if (hasInventoryData(normalizedLocal) && !hasInventoryData(normalizedRemote)) {
    return false;
  }
  if (inventoryLocalAheadOfRemote(normalizedLocal, normalizedRemote)) return false;
  return true;
}

export const INVENTORY_REMOTE_COOLDOWN_MS = 30_000;
