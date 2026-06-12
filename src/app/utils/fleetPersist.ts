import type { Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';
import type { FleetChecklistSection, FleetDataset } from '../types/fleet';

export type FleetPersistFn = (next: FleetDataset, successMessage?: string) => Promise<boolean>;

export type FleetChecklistPersistFn = (
  sections: FleetChecklistSection[],
  options?: { silent?: boolean }
) => Promise<boolean>;

/** Aplica cambio local o persistencia inmediata en nube si está disponible. */
export async function applyFleetDatasetChange(
  setDataset: Dispatch<SetStateAction<FleetDataset>>,
  onPersistDataset: FleetPersistFn | undefined,
  next: FleetDataset,
  successMessage?: string
): Promise<boolean> {
  if (onPersistDataset) {
    return onPersistDataset(next, successMessage);
  }
  setDataset(next);
  if (successMessage) toast.success(successMessage);
  return true;
}
