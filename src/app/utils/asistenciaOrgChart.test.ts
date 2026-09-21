import { describe, expect, it } from 'vitest';

import type { AsistenciaStaffLiveState, AsistenciaStaffMember } from '../types/asistencia';
import {
  groupStaffByCargoHierarchy,
  orgChildrenLayoutClass,
  resolveOrgNodeStyle,
} from './asistenciaOrgChart';

function live(cargo: string, id = cargo): AsistenciaStaffLiveState {
  return {
    staff: {
      id,
      fullName: id,
      cargoLabel: cargo,
      area: 'ops',
      sedeName: 'S1',
    } as AsistenciaStaffMember,
    status: 'presente',
    stillOnSite: true,
  };
}

describe('orgChildrenLayoutClass', () => {
  it('usa flex-col en vertical', () => {
    expect(orgChildrenLayoutClass('vertical', 3)).toContain('flex-col');
  });

  it('arma grilla de 2 / 3 / 4 columnas en horizontal', () => {
    expect(orgChildrenLayoutClass('horizontal', 2)).toContain('sm:grid-cols-2');
    expect(orgChildrenLayoutClass('horizontal', 3)).toContain('lg:grid-cols-3');
    expect(orgChildrenLayoutClass('horizontal', 4)).toContain('lg:grid-cols-4');
  });
});

describe('resolveOrgNodeStyle childrenPerRow', () => {
  it('default 3 y respeta override en orgNodeStyles', () => {
    const base = resolveOrgNodeStyle({ sedeName: 'S1' }, 'medica');
    expect(base.childrenPerRow).toBe(3);
    const styled = resolveOrgNodeStyle(
      { sedeName: 'S1', orgNodeStyles: { medica: { childrenPerRow: 2 } } },
      'medica'
    );
    expect(styled.childrenPerRow).toBe(2);
  });
});

describe('groupStaffByCargoHierarchy', () => {
  it('ordena por cargoOrder y deja el resto al final', () => {
    const groups = groupStaffByCargoHierarchy(
      [live('Counter'), live('Admin'), live('Peluquero'), live('Admin', 'a2')],
      ['Admin', 'Peluquero']
    );
    expect(groups.map((g) => g.cargo)).toEqual(['Admin', 'Peluquero', 'Counter']);
    expect(groups[0].staff).toHaveLength(2);
  });

  it('agrupa Sin cargo cuando falta etiqueta', () => {
    const groups = groupStaffByCargoHierarchy([live('')], []);
    expect(groups).toEqual([{ cargo: 'Sin cargo', staff: expect.any(Array) }]);
  });
});
