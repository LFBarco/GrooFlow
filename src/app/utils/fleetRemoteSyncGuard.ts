import type { FleetDataset } from '../types/fleet';
import { normalizeFleetDataset } from './fleetData';
import { kvPayloadsEqual } from './kvCrossTabSync';

function hasFleetOperationalData(dataset: FleetDataset): boolean {
  return (
    dataset.vehicles.length > 0 ||
    dataset.maintenance.length > 0 ||
    dataset.fuelEntries.length > 0 ||
    dataset.inspections.length > 0
  );
}

/**
 * Evita que Realtime/poll SQL pise datos locales cuando KV ya guardó y SQL aún no réplica.
 */
export function shouldApplyFleetRemoteSnapshot(
  local: FleetDataset,
  remote: FleetDataset,
  cooldownUntilMs: number
): boolean {
  if (Date.now() < cooldownUntilMs) return false;
  const normalizedLocal = normalizeFleetDataset(local);
  const normalizedRemote = normalizeFleetDataset(remote);
  if (kvPayloadsEqual(normalizedLocal, normalizedRemote)) return false;
  if (hasFleetOperationalData(normalizedLocal) && !hasFleetOperationalData(normalizedRemote)) {
    return false;
  }
  return true;
}
