import { describe, expect, it } from 'vitest';

import type { AsistenciaStaffMember } from '../types/asistencia';
import { mergeAsistenciaSettings } from './asistenciaData';
import { applyAreaLayoutReorder, applyStaffLayoutMove } from './asistenciaLayoutUtils';

const baseStaff: AsistenciaStaffMember[] = [
  {
    id: 'a1',
    sedeName: 'La Molina',
    fullName: 'Ana',
    cargoLabel: 'Recepcionista',
    area: 'administracion',
    expectedTime: '08:00',
    isCritical: false,
    sortOrder: 0,
  },
  {
    id: 'a2',
    sedeName: 'La Molina',
    fullName: 'Luis',
    cargoLabel: 'Médico',
    area: 'medica',
    expectedTime: '08:00',
    isCritical: false,
    sortOrder: 1,
  },
];

describe('applyStaffLayoutMove', () => {
  it('mueve personal entre áreas y actualiza sortOrder', () => {
    const settings = mergeAsistenciaSettings({ staff: baseStaff });
    const next = applyStaffLayoutMove(settings, {
      sedeName: 'La Molina',
      staffId: 'a1',
      toArea: 'medica',
      toIndex: 0,
    });
    const molina = (next.staff ?? []).filter((s) => s.sedeName === 'La Molina' && !s.isManager);
    expect(molina.find((s) => s.id === 'a1')?.area).toBe('medica');
    expect(molina[0]?.id).toBe('a1');
  });
});

describe('applyAreaLayoutReorder', () => {
  it('reordena columnas de área en sedeProfiles', () => {
    const settings = mergeAsistenciaSettings({
      staff: baseStaff,
      sedeProfiles: [{ sedeName: 'La Molina', areaOrder: ['administracion', 'medica', 'peluqueria'] }],
    });
    const next = applyAreaLayoutReorder(settings, 'La Molina', 'peluqueria', 'administracion');
    const profile = next.sedeProfiles?.find((p) => p.sedeName === 'La Molina');
    expect(profile?.areaOrder?.[0]).toBe('peluqueria');
  });
});
