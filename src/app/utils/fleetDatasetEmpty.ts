import type { FleetDataset } from '../types/fleet';
import { isDefaultFleetChecklist } from './fleetData';

/** Dataset sin datos operativos reales (KV `{}` normalizado no cuenta plantilla por defecto). */
export function isFleetDatasetEmpty(dataset: FleetDataset): boolean {
  const hasCustomChecklist =
    (dataset.checklistSections?.length ?? 0) > 0 &&
    !isDefaultFleetChecklist(dataset.checklistSections);
  return (
    dataset.vehicles.length === 0 &&
    dataset.maintenance.length === 0 &&
    dataset.fuelEntries.length === 0 &&
    dataset.inspections.length === 0 &&
    !hasCustomChecklist
  );
}
