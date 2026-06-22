import type { FleetDataset } from '../types/fleet';

/** Timestamps SQL por fila (`tabla:id` → ISO updated_at) para locking optimista. */
export type FleetSqlTimestamps = Map<string, string>;

export function fleetRowKey(table: string, id: string): string {
  return `${table}:${id}`;
}

export function mergeFleetSqlTimestamps(
  base: FleetSqlTimestamps,
  patch: FleetSqlTimestamps
): FleetSqlTimestamps {
  const next = new Map(base);
  for (const [k, v] of patch) next.set(k, v);
  return next;
}

/** Deriva timestamps conocidos desde el dataset local (evita recarga SQL tras cada guardado). */
export function fleetTimestampsFromDataset(dataset: FleetDataset): FleetSqlTimestamps {
  const ts: FleetSqlTimestamps = new Map();
  for (const v of dataset.vehicles) {
    if (v.updatedAt) ts.set(fleetRowKey('fleet_vehicles', v.id), v.updatedAt);
  }
  for (const m of dataset.maintenance) {
    if (m.createdAt) ts.set(fleetRowKey('fleet_maintenance', m.id), m.createdAt);
  }
  for (const f of dataset.fuelEntries) {
    if (f.createdAt) ts.set(fleetRowKey('fleet_fuel_entries', f.id), f.createdAt);
  }
  for (const i of dataset.inspections) {
    if (i.createdAt) ts.set(fleetRowKey('fleet_inspections', i.id), i.createdAt);
  }
  return ts;
}

export function mergeFleetTimestampsFromDataset(
  base: FleetSqlTimestamps,
  dataset: FleetDataset
): FleetSqlTimestamps {
  return mergeFleetSqlTimestamps(base, fleetTimestampsFromDataset(dataset));
}

/** Detecta si alguna fila conocida cambió en SQL desde la última carga/guardado. */
export function detectFleetSqlConflicts(
  known: FleetSqlTimestamps | undefined,
  current: FleetSqlTimestamps,
  upsertKeys: string[]
): string[] {
  if (!known) return [];
  const conflicts: string[] = [];
  for (const key of upsertKeys) {
    const expected = known.get(key);
    if (!expected) continue;
    const live = current.get(key);
    if (!live || live !== expected) conflicts.push(key);
  }
  return conflicts;
}
