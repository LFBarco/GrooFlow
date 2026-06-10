import { describe, expect, it } from 'vitest';
import type { FleetDataset } from '../types/fleet';
import { normalizeFleetDataset } from './fleetData';
import {
  fleetLocalAheadOfRemote,
  shouldApplyFleetRemoteSnapshot,
} from './fleetRemoteSyncGuard';

const vehicle = (
  id: string,
  plate: string,
  updatedAt: string
): FleetDataset['vehicles'][number] => ({
  id,
  plate,
  brand: 'Toyota',
  model: 'Hilux',
  year: 2024,
  fuelType: 'gasoline',
  status: 'available',
  currentOdometerKm: 0,
  createdAt: updatedAt,
  updatedAt,
});

const withVehicle: FleetDataset = normalizeFleetDataset({
  vehicles: [vehicle('fv1', 'ABC-123', '2026-01-01T00:00:00.000Z')],
});

describe('shouldApplyFleetRemoteSnapshot', () => {
  it('rechaza durante cooldown post-guardado', () => {
    expect(
      shouldApplyFleetRemoteSnapshot(withVehicle, normalizeFleetDataset({}), Date.now() + 5000)
    ).toBe(false);
  });

  it('rechaza SQL vacío si local tiene datos', () => {
    expect(
      shouldApplyFleetRemoteSnapshot(withVehicle, normalizeFleetDataset({}), 0)
    ).toBe(false);
  });

  it('rechaza SQL con menos vehículos que local (réplica vieja)', () => {
    const local = normalizeFleetDataset({
      vehicles: [
        vehicle('fv1', 'A', '2026-06-10T12:00:00.000Z'),
        vehicle('fv2', 'B', '2026-06-10T12:00:00.000Z'),
      ],
    });
    const remote = normalizeFleetDataset({
      vehicles: [vehicle('fv1', 'A', '2026-01-01T00:00:00.000Z')],
    });
    expect(fleetLocalAheadOfRemote(local, remote)).toBe(true);
    expect(shouldApplyFleetRemoteSnapshot(local, remote, 0)).toBe(false);
  });

  it('acepta snapshot remoto con más datos que local', () => {
    const remote = normalizeFleetDataset({
      vehicles: [
        vehicle('fv2', 'XYZ-999', '2026-06-11T00:00:00.000Z'),
        vehicle('fv3', 'ZZZ-001', '2026-06-11T00:00:00.000Z'),
      ],
    });
    expect(shouldApplyFleetRemoteSnapshot(withVehicle, remote, 0)).toBe(true);
  });
});
