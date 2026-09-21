import { describe, expect, it } from 'vitest';

import { mergeAsistenciaSettings } from './asistenciaData';
import { applyOrgColumnLabels, resolveOrgColumns } from './asistenciaOrgColumns';
import {
  familyOrgColumnId,
  projectOrgTreeFromCollaborators,
  subAreaOrgColumnId,
} from './asistenciaOrgFromCollaborators';
import { getSedeProfile } from './asistenciaStaff';

describe('applyOrgColumnLabels', () => {
  it('fusiona labels y persiste cargoByColumn aunque venga vacío en alguna clave', () => {
    const settings = mergeAsistenciaSettings({
      sedeProfiles: [
        {
          sedeName: 'Benavides',
          areaLabels: { medica: 'Médica', old: 'Viejo' },
          cargoByColumn: { medica: ['Doctor'] },
          areaOrder: ['medica'],
        },
      ],
    });
    const next = applyOrgColumnLabels(
      settings,
      'Benavides',
      { medica: 'Área médica', fam_ops: 'Operaciones' },
      ['medica', 'fam_ops'],
      false,
      { medica: ['Veterinario'], fam_ops: [] },
      [],
      {
        customOrgColumns: [{ id: 'fam_ops', label: 'Operaciones' }],
      }
    );
    const p = getSedeProfile(next, 'Benavides');
    expect(p.areaLabels?.medica).toBe('Área médica');
    expect(p.areaLabels?.fam_ops).toBe('Operaciones');
    expect(p.areaLabels?.old).toBe('Viejo');
    expect(p.cargoByColumn?.medica).toEqual(['Veterinario']);
    expect(p.cargoByColumn?.fam_ops).toEqual([]);
  });
});

describe('projectOrgTreeFromCollaborators', () => {
  it('arma Familia → Subárea → Cargos y reasigna staff.area', () => {
    const famId = familyOrgColumnId('Operaciones');
    const subId = subAreaOrgColumnId('Operaciones', 'Recepcion');
    const settings = mergeAsistenciaSettings({
      staff: [
        {
          id: 'buk_1',
          sedeName: 'Benavides',
          fullName: 'Ana',
          cargoLabel: 'Recepcionista',
          area: 'administracion',
          expectedTime: '08:00',
          isCritical: false,
          bukEmployeeId: 1,
          rut: '111',
          source: 'buk_pe',
        },
      ],
      costCenterSedeMappings: [{ costCenterCode: '101010', sedeName: 'Benavides' }],
      sedeProfiles: [{ sedeName: 'Benavides' }],
    });

    const result = projectOrgTreeFromCollaborators({
      settings,
      sedeName: 'Benavides',
      visibleSedes: ['Benavides'],
      employees: [
        {
          bukId: 1,
          fullName: 'Ana',
          documentNumber: '111',
          cargo: 'Recepcionista',
          roleFamilyName: 'Operaciones',
          orgAreaParentName: 'Recepcion',
          costCenter: '101010',
        },
        {
          bukId: 2,
          fullName: 'Luis',
          documentNumber: '222',
          cargo: 'Counter',
          roleFamilyName: 'Operaciones',
          orgAreaParentName: 'Recepcion',
          costCenter: '101010',
        },
        {
          bukId: 3,
          fullName: 'Otra',
          roleFamilyName: 'Clínica',
          orgAreaParentName: 'Triaje',
          cargo: 'Asistente',
          costCenter: '505050',
        },
      ],
    });

    expect(result.employeesUsed).toBe(2);
    expect(result.families).toBe(1);
    expect(result.subareas).toBe(1);
    const p = getSedeProfile(result.settings, 'Benavides');
    expect(p.hideBuiltinColumns).toBe(true);
    expect(p.customOrgColumns?.some((c) => c.id === famId)).toBe(true);
    expect(p.subOrgColumns?.some((s) => s.id === subId && s.parentColumnId === famId)).toBe(true);
    expect(p.cargoByColumn?.[subId]).toEqual(expect.arrayContaining(['Recepcionista', 'Counter']));
    const cols = resolveOrgColumns(p);
    expect(cols.every((c) => !c.builtin)).toBe(true);
    expect(result.settings.staff.find((s) => s.id === 'buk_1')?.area).toBe(subId);
  });
});
