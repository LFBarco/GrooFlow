import type { FleetDataset } from '../types/fleet';
import { isDefaultFleetChecklist, normalizeFleetDataset } from './fleetData';
import { kvPayloadsEqual } from './kvCrossTabSync';
export function fleetOperationalCounts(dataset: FleetDataset) {
  return {
    vehicles: dataset.vehicles.length,
    maintenance: dataset.maintenance.length,
    fuelEntries: dataset.fuelEntries.length,
    inspections: dataset.inspections.length,
  };
}

function hasFleetOperationalData(dataset: FleetDataset): boolean {
  const c = fleetOperationalCounts(dataset);
  return c.vehicles > 0 || c.maintenance > 0 || c.fuelEntries > 0 || c.inspections > 0;
}

export function checklistSectionsSignature(dataset: FleetDataset): string {
  try {
    return JSON.stringify(normalizeFleetDataset(dataset).checklistSections);
  } catch {
    return '';
  }
}

/** Marca de tiempo más reciente en el dataset (vehículos, mantenimiento, etc.). */
export function maxFleetDatasetTimestamp(dataset: FleetDataset): number {
  let max = 0;
  const bump = (raw?: string) => {
    if (!raw) return;
    const t = Date.parse(raw);
    if (!Number.isNaN(t) && t > max) max = t;
  };
  for (const v of dataset.vehicles) {
    bump(v.updatedAt);
    bump(v.createdAt);
  }
  for (const m of dataset.maintenance) bump(m.createdAt);
  for (const f of dataset.fuelEntries) bump(f.createdAt);
  for (const i of dataset.inspections) bump(i.createdAt);
  return max;
}

/** Local tiene más registros o timestamps más recientes que SQL desactualizado. */
export function fleetLocalAheadOfRemote(local: FleetDataset, remote: FleetDataset): boolean {
  const normalizedLocal = normalizeFleetDataset(local);
  const lc = fleetOperationalCounts(normalizedLocal);
  const rc = fleetOperationalCounts(remote);
  if (lc.vehicles > rc.vehicles) return true;
  if (lc.maintenance > rc.maintenance) return true;
  if (lc.fuelEntries > rc.fuelEntries) return true;
  if (lc.inspections > rc.inspections) return true;
  const localTs = maxFleetDatasetTimestamp(normalizedLocal);
  const remoteTs = maxFleetDatasetTimestamp(remote);
  if (localTs > remoteTs + 1000) return true;
  if (
    checklistSectionsSignature(normalizedLocal) !== checklistSectionsSignature(remote) &&
    !isDefaultFleetChecklist(normalizedLocal.checklistSections)
  ) {
    return true;
  }
  return false;
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
  if (!hasFleetOperationalData(normalizedLocal) && hasFleetOperationalData(normalizedRemote)) {
    return true;
  }
  if (hasFleetOperationalData(normalizedLocal) && !hasFleetOperationalData(normalizedRemote)) {
    return false;
  }
  if (fleetLocalAheadOfRemote(normalizedLocal, normalizedRemote)) return false;
  return true;
}

/** Tras guardar flota, ignorar SQL remoto unos segundos (réplica + Realtime). */
export const FLEET_REMOTE_COOLDOWN_MS = 8_000;
