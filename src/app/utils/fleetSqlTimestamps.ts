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

/** Detecta si alguna fila conocida cambió en SQL desde la última carga/guardado. */
export function detectFleetSqlConflicts(
  known: FleetSqlTimestamps | undefined,
  current: FleetSqlTimestamps,
  upsertKeys: string[]
): string[] {
  if (!known || known.size === 0) return [];
  const conflicts: string[] = [];
  for (const key of upsertKeys) {
    const expected = known.get(key);
    if (!expected) continue;
    const live = current.get(key);
    if (live && live !== expected) conflicts.push(key);
  }
  return conflicts;
}
