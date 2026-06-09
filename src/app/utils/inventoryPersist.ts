import type { Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';
import type { InventoryDataset } from '../types/inventory';

export type InventoryPersistFn = (next: InventoryDataset, successMessage?: string) => Promise<boolean>;

export async function applyInventoryDatasetChange(
  setDataset: Dispatch<SetStateAction<InventoryDataset>>,
  onPersistDataset: InventoryPersistFn | undefined,
  next: InventoryDataset,
  successMessage?: string
): Promise<boolean> {
  if (onPersistDataset) {
    return onPersistDataset(next, successMessage);
  }
  setDataset(next);
  if (successMessage) toast.success(successMessage);
  return true;
}
