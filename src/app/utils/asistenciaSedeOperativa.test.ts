import { describe, expect, it } from 'vitest';

import type { AsistenciaSettings, AsistenciaStaffMember, BukAsistenciaRecord } from '../types/asistencia';
import {
  resolveEffectiveSedeForLive,
  resolveSedeFromCostCenterCode,
  staffSedeBase,
} from './asistenciaSedeOperativa';

const baseSettings: AsistenciaSettings = {
  requirements: [],
  staff: [],
  sedeProfiles: [
    { sedeName: 'Magdalena', bukRecintoCode: 'MAG' },
    { sedeName: 'Benavides', bukRecintoCode: 'BEN' },
  ],
  costCenterSedeMappings: [{ costCenterCode: '111111', sedeName: 'Central' }],
};

function staff(partial: Partial<AsistenciaStaffMember> & Pick<AsistenciaStaffMember, 'id' | 'sedeName'>): AsistenciaStaffMember {
  return {
    fullName: 'Test',
    cargoLabel: 'Cargo',
    area: 'administracion',
    expectedTime: '08:00',
    isCritical: false,
    rut: '12345678',
    ...partial,
  };
}

describe('asistenciaSedeOperativa', () => {
  it('resuelve sede base desde CC default y override', () => {
    expect(resolveSedeFromCostCenterCode('606060', baseSettings)).toBe('Magdalena');
    expect(resolveSedeFromCostCenterCode('111111', baseSettings)).toBe('Central');
  });

  it('staffSedeBase usa homeCostCenterCode si falta sedeBase', () => {
    const s = staff({ id: '1', sedeName: 'Benavides', homeCostCenterCode: '606060' });
    expect(staffSedeBase(s, baseSettings)).toBe('Magdalena');
  });

  it('cubre en sede operativa cuando marca fuera de base', () => {
    const member = staff({
      id: '1',
      sedeName: 'Magdalena',
      sedeBase: 'Magdalena',
      homeCostCenterCode: '606060',
      rut: '12345678',
    });
    const records: BukAsistenciaRecord[] = [
      {
        id: 1,
        trab_id: 1,
        rut_trabajador: '12345678',
        nombre: 'Test',
        dia_entrada: '19/09/2026',
        entrada: '2026-09-19T08:00:00',
        entrada_format: '08:00',
        codigo_recinto: 'BEN',
        nombre_recinto: 'Benavides',
      },
    ];
    const eff = resolveEffectiveSedeForLive(
      member,
      records,
      new Date(2026, 8, 19),
      baseSettings,
      ['Magdalena', 'Benavides']
    );
    expect(eff.sedeBase).toBe('Magdalena');
    expect(eff.effectiveSede).toBe('Benavides');
    expect(eff.coveringFromBase).toBe(true);
  });
});
