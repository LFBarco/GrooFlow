import { describe, expect, it } from 'vitest';

interface EquipmentItem {
  id: string;
  code: string;
  name: string;
  purchaseDate: string; // YYYY-MM-DD
  purchaseValue: number;
  expectedLifespanYears: number;
  nextMaintenanceDate: string; // YYYY-MM-DD
}

function calculateCurrentBookValue(equipment: EquipmentItem, currentDateStr: string): number {
  const purchaseYear = new Date(equipment.purchaseDate).getFullYear();
  const currentYear = new Date(currentDateStr).getFullYear();
  const yearsInUse = Math.max(0, currentYear - purchaseYear);

  if (equipment.expectedLifespanYears <= 0) return equipment.purchaseValue;

  const annualDepreciation = equipment.purchaseValue / equipment.expectedLifespanYears;
  const totalDepreciation = annualDepreciation * yearsInUse;
  const currentVal = equipment.purchaseValue - totalDepreciation;

  return Math.max(0, Number(currentVal.toFixed(2)));
}

function isMaintenanceDueOrOverdue(nextMaintenanceDate: string, currentDateStr: string): 'overdue' | 'due_soon' | 'ok' {
  const nextDate = new Date(nextMaintenanceDate).getTime();
  const currDate = new Date(currentDateStr).getTime();
  const diffDays = Math.ceil((nextDate - currDate) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'overdue';
  if (diffDays <= 15) return 'due_soon';
  return 'ok';
}

describe('Inventory Module', () => {
  const sampleEquipment: EquipmentItem = {
    id: 'eq-201',
    code: 'ECO-01',
    name: 'Ecógrafo Ultrasonido',
    purchaseDate: '2024-01-01',
    purchaseValue: 20000,
    expectedLifespanYears: 5,
    nextMaintenanceDate: '2026-09-15',
  };

  it('calcula la depreciación lineal y el valor libro residual', () => {
    const bookValue2026 = calculateCurrentBookValue(sampleEquipment, '2026-01-01');
    // 2 años en uso (2024 -> 2026), depreciación = 4000/año -> total = 8000 -> valor residual = 12000
    expect(bookValue2026).toBe(12000);
  });

  it('alerta mantenimiento próx a vencer (due_soon) a 7 días de vencer', () => {
    const status = isMaintenanceDueOrOverdue('2026-09-15', '2026-09-08');
    expect(status).toBe('due_soon');
  });

  it('alerta mantenimiento vencido (overdue) cuando la fecha pasó', () => {
    const status = isMaintenanceDueOrOverdue('2026-08-01', '2026-09-08');
    expect(status).toBe('overdue');
  });
});
