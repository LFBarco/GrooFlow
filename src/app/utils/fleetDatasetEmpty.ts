import type { FleetDataset } from '../types/fleet';

/** Dataset sin datos operativos (KV vacío `{}` no debe pisar SQL con vehículos). */
export function isFleetDatasetEmpty(dataset: FleetDataset): boolean {
  return (
    dataset.vehicles.length === 0 &&
    dataset.maintenance.length === 0 &&
    dataset.fuelEntries.length === 0 &&
    dataset.inspections.length === 0 &&
    (dataset.checklistSections?.length ?? 0) === 0
  );
}
