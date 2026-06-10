import { describe, expect, it } from 'vitest';
import type { FleetDataset } from '../types/fleet';
import { normalizeFleetDataset } from './fleetData';
import { shouldApplyFleetRemoteSnapshot } from './fleetRemoteSyncGuard';

const withVehicle: FleetDataset = normalizeFleetDataset({
  vehicles: [
    {
      id: 'fv1',
      plate: 'ABC-123',
      brand: 'Toyota',
      model: 'Hilux',
      year: 2024,
      fuelType: 'gasoline',
      status: 'available',
      currentOdometerKm: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
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

  it('acepta snapshot remoto distinto con datos', () => {
    const remote = normalizeFleetDataset({
      vehicles: [
        {
          id: 'fv2',
          plate: 'XYZ-999',
          brand: 'Nissan',
          model: 'Navara',
          year: 2023,
          fuelType: 'diesel',
          status: 'available',
          currentOdometerKm: 100,
          createdAt: '2026-01-02T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
      ],
    });
    expect(shouldApplyFleetRemoteSnapshot(withVehicle, remote, 0)).toBe(true);
  });
});
