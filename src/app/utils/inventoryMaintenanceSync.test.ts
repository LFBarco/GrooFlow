import { describe, expect, it } from 'vitest';

import type { InventoryDataset, InventoryEquipment } from '../types/inventory';
import {
  applyEquipmentMaintenanceSync,
  autoMaintenanceIdForEquipment,
  normalizeInventoryDataset,
} from './inventoryData';

const baseEquipment: InventoryEquipment = {
  id: 'eq-1',
  code: 'TST-001',
  name: 'Ecógrafo',
  kind: 'medical',
  category: 'medico',
  status: 'active',
  sede: 'Principal',
  purchaseValue: 1000,
  currentValue: 800,
  nextMaintenanceDate: '2026-07-01',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('applyEquipmentMaintenanceSync', () => {
  it('crea mantenimiento programado al guardar fecha en equipo', () => {
    const ds = normalizeInventoryDataset({ equipment: [baseEquipment], maintenance: [] });
    const next = applyEquipmentMaintenanceSync(ds, baseEquipment);
    expect(next.maintenance).toHaveLength(1);
    expect(next.maintenance[0]?.id).toBe(autoMaintenanceIdForEquipment('eq-1'));
    expect(next.maintenance[0]?.equipmentId).toBe('eq-1');
    expect(next.maintenance[0]?.scheduledDate).toBe('2026-07-01');
    expect(next.maintenance[0]?.kind).toBe('preventive');
    expect(next.maintenance[0]?.status).toBe('scheduled');
  });

  it('elimina mantenimiento auto si se borra la fecha del equipo', () => {
    const ds = normalizeInventoryDataset({
      equipment: [{ ...baseEquipment, nextMaintenanceDate: undefined }],
      maintenance: [
        {
          id: autoMaintenanceIdForEquipment('eq-1'),
          equipmentId: 'eq-1',
          kind: 'preventive',
          status: 'scheduled',
          scheduledDate: '2026-07-01',
          description: 'Mantenimiento preventivo — Ecógrafo',
          laborCost: 0,
          partsCost: 0,
          parts: [],
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    const next = applyEquipmentMaintenanceSync(ds, { ...baseEquipment, nextMaintenanceDate: undefined });
    expect(next.maintenance).toHaveLength(0);
  });

  it('no pisa mantenimiento en proceso', () => {
    const inProgress = {
      id: autoMaintenanceIdForEquipment('eq-1'),
      equipmentId: 'eq-1',
      kind: 'preventive' as const,
      status: 'in_progress' as const,
      scheduledDate: '2026-06-01',
      description: 'En taller',
      laborCost: 0,
      partsCost: 0,
      parts: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const ds: InventoryDataset = normalizeInventoryDataset({
      equipment: [baseEquipment],
      maintenance: [inProgress],
    });
    const next = applyEquipmentMaintenanceSync(ds, { ...baseEquipment, nextMaintenanceDate: '2026-08-01' });
    expect(next.maintenance[0]).toEqual(inProgress);
  });
});
