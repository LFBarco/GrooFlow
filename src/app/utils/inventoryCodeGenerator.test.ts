import { describe, expect, it } from 'vitest';

import { abbrevSede, formatFloorRoomSegment, generateEquipmentCode } from './inventoryCodeGenerator';

describe('inventoryCodeGenerator', () => {
  it('abbrevSede acorta nombres de sede', () => {
    expect(abbrevSede('Miraflores')).toBe('MIR');
    expect(abbrevSede('San Juan de Lurigancho')).toBe('SJL');
  });

  it('formatFloorRoomSegment combina piso y consultorio', () => {
    expect(formatFloorRoomSegment('2', '03')).toBe('P2C03');
    expect(formatFloorRoomSegment('', '5')).toBe('C05');
  });

  it('generateEquipmentCode incrementa secuencia', () => {
    const code1 = generateEquipmentCode({
      categoryPrefix: 'IMG',
      sede: 'Miraflores',
      floor: '2',
      room: '3',
      existingEquipment: [],
    });
    expect(code1).toBe('IMG-MIR-P2C03-001');

    const code2 = generateEquipmentCode({
      categoryPrefix: 'IMG',
      sede: 'Miraflores',
      floor: '2',
      room: '3',
      existingEquipment: [{ id: '1', code: code1 } as never],
    });
    expect(code2).toBe('IMG-MIR-P2C03-002');
  });
});
