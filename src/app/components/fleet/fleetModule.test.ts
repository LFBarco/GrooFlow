import { describe, expect, it } from 'vitest';

interface FleetFuelLog {
  id: string;
  vehiclePlate: string;
  odometerKm: number;
  previousOdometerKm: number;
  gallonsFilled: number;
  costPen: number;
}

function calculateFleetFuelMetrics(log: FleetFuelLog) {
  const kmTraveled = log.odometerKm - log.previousOdometerKm;
  if (kmTraveled <= 0 || log.gallonsFilled <= 0) {
    return { kmTraveled: 0, kmPerGallon: 0, costPerKm: 0 };
  }
  const kmPerGallon = Number((kmTraveled / log.gallonsFilled).toFixed(2));
  const costPerKm = Number((log.costPen / kmTraveled).toFixed(2));

  return { kmTraveled, kmPerGallon, costPerKm };
}

describe('Fleet Module', () => {
  it('calcula kilometraje recorrido, km/galón y costo por km', () => {
    const log: FleetFuelLog = {
      id: 'fuel-10',
      vehiclePlate: 'ABC-123',
      previousOdometerKm: 50000,
      odometerKm: 50350,
      gallonsFilled: 10,
      costPen: 180,
    };
    const metrics = calculateFleetFuelMetrics(log);

    expect(metrics.kmTraveled).toBe(350);
    expect(metrics.kmPerGallon).toBe(35); // 350 km / 10 gal
    expect(metrics.costPerKm).toBe(0.51); // 180 S/ / 350 km
  });

  it('retorna 0 si el cuentakilómetros es inconsistente', () => {
    const invalidLog: FleetFuelLog = {
      id: 'fuel-11',
      vehiclePlate: 'ABC-123',
      previousOdometerKm: 50000,
      odometerKm: 49900,
      gallonsFilled: 10,
      costPen: 180,
    };
    const metrics = calculateFleetFuelMetrics(invalidLog);

    expect(metrics.kmTraveled).toBe(0);
    expect(metrics.kmPerGallon).toBe(0);
    expect(metrics.costPerKm).toBe(0);
  });
});
