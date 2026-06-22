import { describe, expect, it } from 'vitest';

import type { FleetVehicle } from '../types/fleet';
import {
  getFleetFuelImportCell,
  normalizeFleetPlate,
  parseFleetFuelImportNumber,
  parseFleetFuelImportRows,
} from './fleetFuelImport';

const vehicles: FleetVehicle[] = [
  {
    id: 'v1',
    plate: 'ABC-123',
    brand: 'Toyota',
    model: 'Hilux',
    year: 2022,
    fuelType: 'diesel',
    status: 'available',
    homeBase: 'Principal',
    currentOdometerKm: 10000,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('fleetFuelImport', () => {
  it('normaliza placas', () => {
    expect(normalizeFleetPlate(' abc 123 ')).toBe('ABC123');
  });

  it('lee celdas con alias', () => {
    expect(getFleetFuelImportCell({ Placa: 'X', 'Odómetro km': 100 }, 'Odometro km')).toBe(100);
  });

  it('parsea números con coma decimal', () => {
    expect(parseFleetFuelImportNumber('42,5')).toBe(42.5);
  });

  it('importa fila válida', () => {
    const result = parseFleetFuelImportRows(
      [
        {
          Placa: 'ABC-123',
          Fecha: '2026-06-10',
          'Odómetro km': 10500,
          Litros: 40,
          'Costo total S/': 180,
        },
      ],
      vehicles
    );
    expect(result.errors).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.vehicleId).toBe('v1');
    expect(result.entries[0]?.date).toBe('2026-06-10');
    expect(result.vehicleMaxOdometer.get('v1')).toBe(10500);
  });

  it('reporta placa desconocida', () => {
    const result = parseFleetFuelImportRows(
      [
        {
          Placa: 'ZZZ-999',
          Fecha: '2026-06-10',
          'Odómetro km': 100,
          Litros: 10,
          'Costo total S/': 50,
        },
      ],
      vehicles
    );
    expect(result.entries).toHaveLength(0);
    expect(result.errors.some((e) => e.includes('ZZZ-999'))).toBe(true);
  });
});
