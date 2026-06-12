import { describe, expect, it } from 'vitest';
import { detectFleetSqlConflicts, fleetRowKey } from './fleetSqlTimestamps';

describe('fleetSqlTimestamps', () => {
  it('detecta conflicto cuando updated_at cambió en SQL', () => {
    const known = new Map([[fleetRowKey('fleet_vehicles', 'v1'), '2026-06-10T10:00:00.000Z']]);
    const live = new Map([[fleetRowKey('fleet_vehicles', 'v1'), '2026-06-10T11:00:00.000Z']]);
    const conflicts = detectFleetSqlConflicts(known, live, [fleetRowKey('fleet_vehicles', 'v1')]);
    expect(conflicts).toEqual([fleetRowKey('fleet_vehicles', 'v1')]);
  });

  it('no marca conflicto en filas nuevas o sin timestamp previo', () => {
    const known = new Map<string, string>();
    const live = new Map([[fleetRowKey('fleet_vehicles', 'v2'), '2026-06-10T11:00:00.000Z']]);
    expect(detectFleetSqlConflicts(known, live, [fleetRowKey('fleet_vehicles', 'v2')])).toEqual([]);
  });
});
