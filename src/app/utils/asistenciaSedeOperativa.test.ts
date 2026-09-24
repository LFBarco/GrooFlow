import { describe, expect, it } from 'vitest';

import type { AsistenciaSettings, AsistenciaStaffMember, BukAsistenciaRecord } from '../types/asistencia';
import {
  resolveEffectiveSedeForLive,
  resolveSedeFromCostCenterCode,
  resolveSedeFromDispositivo,
  staffSedeBase,
} from './asistenciaSedeOperativa';

const baseSettings: AsistenciaSettings = {
  requirements: [],
  staff: [],
  sedeProfiles: [
    { sedeName: 'Magdalena', bukRecintoCode: 'MAG' },
    { sedeName: 'Benavides', bukRecintoCode: 'BEN' },
    { sedeName: 'San Borja', bukRecintoCode: '4040' },
    { sedeName: 'Memorial', bukRecintoCode: '7070' },
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

  it('Memorial desambigua dispositivo compartido con San Borja', () => {
    expect(resolveSedeFromDispositivo('UDP3244800556', baseSettings, undefined, 'Memorial')).toBe(
      'Memorial'
    );
    expect(resolveSedeFromDispositivo('UDP3244800556', baseSettings, undefined, 'San Borja')).toBe(
      'San Borja'
    );
    expect(resolveSedeFromDispositivo('UDP3244800556', baseSettings, undefined, 'La Molina')).toBe(
      'San Borja'
    );

    const memorial = staff({
      id: 'm1',
      sedeName: 'Memorial',
      sedeBase: 'Memorial',
      homeCostCenterCode: '707070',
      rut: '33333333',
    });
    const records: BukAsistenciaRecord[] = [
      {
        id: 2,
        trab_id: 2,
        rut_trabajador: '33333333',
        nombre: 'Memo',
        dia_entrada: '19/09/2026',
        entrada: '2026-09-19T08:00:00',
        entrada_format: '08:00',
        dispositivo: 'UDP3244800556',
      },
    ];
    const eff = resolveEffectiveSedeForLive(
      memorial,
      records,
      new Date(2026, 8, 19),
      baseSettings,
      ['San Borja', 'Memorial']
    );
    expect(eff.effectiveSede).toBe('Memorial');
    expect(eff.coveringFromBase).toBe(false);
  });

  it('Petmovil permanece en base aunque marque en otro dispositivo', () => {
    const member = staff({
      id: 'p1',
      sedeName: 'Petmovil',
      sedeBase: 'Petmovil',
      homeCostCenterCode: '303030',
      rut: '44444444',
    });
    const records: BukAsistenciaRecord[] = [
      {
        id: 3,
        trab_id: 3,
        rut_trabajador: '44444444',
        nombre: 'Pet',
        dia_entrada: '19/09/2026',
        entrada: '2026-09-19T08:00:00',
        entrada_format: '08:00',
        dispositivo: 'UDP3244900226',
      },
    ];
    const eff = resolveEffectiveSedeForLive(
      member,
      records,
      new Date(2026, 8, 19),
      baseSettings,
      ['Petmovil', 'La Molina']
    );
    expect(eff.effectiveSede).toBe('Petmovil');
    expect(eff.punchedAwayFromBase).toBe(true);
    expect(eff.sedeOperativaHoy).toBe('La Molina');
  });

  it('modo base siempre lista en sede Buk.pe', () => {
    const member = staff({
      id: '1',
      sedeName: 'Magdalena',
      sedeBase: 'Magdalena',
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
        dispositivo: 'SPK7245000121',
      },
    ];
    const eff = resolveEffectiveSedeForLive(
      member,
      records,
      new Date(2026, 8, 19),
      baseSettings,
      ['Magdalena', 'Benavides'],
      undefined,
      'base'
    );
    expect(eff.effectiveSede).toBe('Magdalena');
    expect(eff.sedeOperativaHoy).toBe('Benavides');
    expect(eff.punchedAwayFromBase).toBe(true);
  });
});
