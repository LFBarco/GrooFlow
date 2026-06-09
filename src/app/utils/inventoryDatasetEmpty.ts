import type { InventoryDataset } from '../types/inventory';

export function isInventoryDatasetEmpty(dataset: InventoryDataset): boolean {
  return dataset.equipment.length === 0 && dataset.maintenance.length === 0;
}
