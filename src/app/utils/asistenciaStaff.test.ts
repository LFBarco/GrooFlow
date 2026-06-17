import { describe, expect, it } from 'vitest';

import type { AsistenciaStaffMember, BukAsistenciaRecord } from '../types/asistencia';
import { mergeAsistenciaSettings } from './asistenciaData';
import { buildLiveSedeSummary, diagnoseStaffBukMatch } from './asistenciaStaff';

describe('asistenciaStaff', () => {
  it('marca ausente si no hay cruce Buk y trabajando si sigue en sede', () => {
    const staff: AsistenciaStaffMember = {
      id: 's1',
      sedeName: 'SAN ISIDRO',
      fullName: 'Luis Barco',
      cargoLabel: 'Recepcionista',
      area: 'administracion',
      expectedTime: '08:00',
      isCritical: true,
      matchArea: 'COUNTER',
      rut: '111',
    };
    const settings = mergeAsistenciaSettings({
      staff: [staff],
      sedeProfiles: [{ sedeName: 'SAN ISIDRO', bukRecintoCode: 'SANISIDRO' }],
    });

    const absent = buildLiveSedeSummary({
      sedeName: 'SAN ISIDRO',
      settings,
      records: [],
      date: new Date('2026-06-10T12:00:00'),
    });
    expect(absent.absentCount).toBe(1);
    expect(absent.isOperational).toBe(false);

    const records: BukAsistenciaRecord[] = [
      {
        id: 1,
        trab_id: 1,
        rut_trabajador: '111',
        nombre: 'Luis',
        apellido_paterno: 'Barco',
        codigo_recinto: 'SANISIDRO',
        area: 'COUNTER',
        dia_entrada: '10/06/2026',
        entrada: '2026-06-10T08:05:00Z',
        entrada_format: '08:05',
        salida: null,
      },
    ];
    const live = buildLiveSedeSummary({
      sedeName: 'SAN ISIDRO',
      settings,
      records,
      date: new Date('2026-06-10T12:00:00'),
    });
    expect(live.workingCount).toBe(1);
    expect(live.isOperational).toBe(true);
    expect(live.areas[0].staff[0]?.status).toBe('trabajando');
  });

  it('cruza sede La Molina por nombre de recinto Buk', () => {
    const settings = mergeAsistenciaSettings({
      staff: [
        {
          id: 's1',
          sedeName: 'La Molina',
          fullName: 'Ana Pérez',
          cargoLabel: 'Recepcionista',
          area: 'administracion',
          expectedTime: '08:00',
          isCritical: false,
          rut: '11111111-1',
        },
      ],
      sedeProfiles: [{ sedeName: 'La Molina', scheduleStart: '08:00', scheduleEnd: '18:00' }],
    });
    const records: BukAsistenciaRecord[] = [
      {
        id: 1,
        trab_id: 1,
        rut_trabajador: '11111111-1',
        nombre: 'Ana',
        apellido_paterno: 'Pérez',
        codigo_recinto: 'MOLINA01',
        nombre_recinto: 'Clínica La Molina',
        dia_entrada: '10/06/2026',
        entrada_format: '08:15',
        entrada: '2026-06-10T08:15:00Z',
        salida: null,
      },
    ];
    const live = buildLiveSedeSummary({
      sedeName: 'La Molina',
      settings,
      records,
      date: new Date('2026-06-10T12:00:00'),
    });
    expect(live.workingCount).toBe(1);
    expect(live.absentCount).toBe(0);
  });

  it('cruza por RUT y sede con etiqueta Petmax · Petmax Principal', () => {
    const staff: AsistenciaStaffMember = {
      id: 's1',
      sedeName: '50.- La Molina',
      fullName: 'Farah del Rio',
      cargoLabel: 'Recepcionista',
      area: 'administracion',
      expectedTime: '08:00',
      isCritical: false,
      rut: '22222222-2',
    };
    const settings = mergeAsistenciaSettings({
      staff: [staff],
      sedeProfiles: [
        {
          sedeName: '50.- La Molina',
          bukRecintoCode: 'Petmax · Petmax Principal',
        },
      ],
    });
    const records: BukAsistenciaRecord[] = [
      {
        id: 1,
        trab_id: 1,
        rut_trabajador: '22222222-2',
        nombre: 'Farah',
        apellido_paterno: 'del Rio',
        codigo_recinto: 'Petmax',
        nombre_recinto: 'Petmax Principal',
        dia_entrada: '15/06/2026',
        entrada_format: '08:10',
        salida: null,
      },
    ];
    const live = buildLiveSedeSummary({
      sedeName: '50.- La Molina',
      settings,
      records,
      date: new Date('2026-06-15T12:00:00'),
    });
    expect(live.workingCount).toBe(1);
    expect(live.absentCount).toBe(0);
    expect(live.areas[0].staff[0]?.matchHint).toBeUndefined();
  });

  it('no asigna asistencia de otro recepcionista por area sin coincidir RUT', () => {
    const staff: AsistenciaStaffMember = {
      id: 's1',
      sedeName: '50.- La Molina',
      fullName: 'Luis Barco',
      cargoLabel: 'Recepcionista',
      area: 'administracion',
      expectedTime: '08:00',
      isCritical: true,
      matchArea: 'COUNTER',
      rut: '11111111-1',
    };
    const settings = mergeAsistenciaSettings({
      staff: [staff],
      sedeProfiles: [
        { sedeName: '50.- La Molina', bukRecintoCode: 'Petmax · Petmax Principal' },
      ],
    });
    const records: BukAsistenciaRecord[] = [
      {
        id: 1,
        trab_id: 99,
        rut_trabajador: '99999999-9',
        nombre: 'Farah',
        apellido_paterno: 'Test',
        codigo_recinto: 'Petmax',
        nombre_recinto: 'Petmax Principal',
        area: 'COUNTER',
        dia_entrada: '15/06/2026',
        entrada_format: '08:10',
        salida: null,
      },
    ];
    const live = buildLiveSedeSummary({
      sedeName: '50.- La Molina',
      settings,
      records,
      date: new Date('2026-06-15T12:00:00'),
    });
    expect(live.workingCount).toBe(0);
    expect(live.absentCount).toBe(1);
    expect(live.areas[0].staff[0]?.status).toBe('ausente');
  });

  it('marca trabajando con entrada_format aunque entrada sea null', () => {
    const staff: AsistenciaStaffMember = {
      id: 's1',
      sedeName: 'SAN ISIDRO',
      fullName: 'Luis Barco',
      cargoLabel: 'Recepcionista',
      area: 'administracion',
      expectedTime: '08:00',
      isCritical: false,
      rut: '11111111-1',
    };
    const settings = mergeAsistenciaSettings({
      staff: [staff],
      sedeProfiles: [{ sedeName: 'SAN ISIDRO', bukRecintoCode: 'SANISIDRO' }],
    });
    const records: BukAsistenciaRecord[] = [
      {
        id: 1,
        trab_id: 1,
        rut_trabajador: '11111111-1',
        nombre: 'Luis',
        apellido_paterno: 'Barco',
        codigo_recinto: 'SANISIDRO',
        dia_entrada: '10/06/2026',
        entrada_format: '08:05',
        entrada: null,
      },
    ];
    const live = buildLiveSedeSummary({
      sedeName: 'SAN ISIDRO',
      settings,
      records,
      date: new Date('2026-06-10T12:00:00'),
    });
    expect(live.workingCount).toBe(1);
    expect(live.absentCount).toBe(0);
  });

  it('marca ausente si RUT coincide pero entrada_format está vacío', () => {
    const staff: AsistenciaStaffMember = {
      id: 's1',
      sedeName: 'SAN ISIDRO',
      fullName: 'Luis Barco',
      cargoLabel: 'Recepcionista',
      area: 'administracion',
      expectedTime: '08:00',
      isCritical: false,
      rut: '11111111-1',
    };
    const settings = mergeAsistenciaSettings({
      staff: [staff],
      sedeProfiles: [{ sedeName: 'SAN ISIDRO', bukRecintoCode: 'SANISIDRO' }],
    });
    const records: BukAsistenciaRecord[] = [
      {
        id: 1,
        trab_id: 1,
        rut_trabajador: '11111111-1',
        nombre: 'Luis',
        apellido_paterno: 'Barco',
        codigo_recinto: 'SANISIDRO',
        dia_entrada: '10/06/2026',
        entrada_format: '',
        entrada: null,
      },
    ];
    const live = buildLiveSedeSummary({
      sedeName: 'SAN ISIDRO',
      settings,
      records,
      date: new Date('2026-06-10T12:00:00'),
    });
    expect(live.absentCount).toBe(1);
    expect(live.areas[0].staff[0]?.matchHint).toMatch(/entrada_format|entrada válida/);
  });

  it('cruza Andrea: RUT Buk sin DV y entrada_format 2026/06/15 08:06:00', () => {
    const staff: AsistenciaStaffMember = {
      id: 's1',
      sedeName: '50.- La Molina',
      fullName: 'Andrea Ramirez',
      cargoLabel: 'Asistente Veterinario',
      area: 'medica',
      expectedTime: '08:00',
      isCritical: false,
      rut: '76362592-9',
    };
    const settings = mergeAsistenciaSettings({
      staff: [staff],
      sedeProfiles: [
        {
          sedeName: '50.- La Molina',
          bukRecintoCode: 'Petmax · Petmax Principal',
        },
      ],
    });
    const records: BukAsistenciaRecord[] = [
      {
        id: 541382193,
        trab_id: 955600,
        rut_trabajador: '76362592',
        nombre: 'ANDREA ANGELICA',
        apellido_paterno: 'CERVAN',
        apellido_materno: 'RAMIREZ',
        codigo_recinto: 'Petmax',
        nombre_recinto: 'Petmax Principal',
        area: 'ASISTENTES VETERINARIOS',
        dia_entrada: '15/06/2026',
        entrada: '2026-06-15T12:06:00Z',
        entrada_format: '2026/06/15 08:06:00',
        salida: null,
        salida_format: '-',
      },
    ];
    const live = buildLiveSedeSummary({
      sedeName: '50.- La Molina',
      settings,
      records,
      date: new Date('2026-06-15T12:00:00'),
    });
    expect(live.workingCount).toBe(1);
    expect(live.areas.find((a) => a.area === 'medica')?.staff[0]?.entradaFormat).toBe('08:06');
    expect(live.areas.find((a) => a.area === 'medica')?.staff[0]?.status).toBe('trabajando');
  });

  it('cruza Farah con entrada_format Buk yyyy/MM/dd HH:mm:ss', () => {
    const staff: AsistenciaStaffMember = {
      id: 's1',
      sedeName: '50.- La Molina',
      fullName: 'Farah del Rio',
      cargoLabel: 'Recepcionista',
      area: 'administracion',
      expectedTime: '08:00',
      isCritical: false,
      rut: '44784524',
    };
    const settings = mergeAsistenciaSettings({
      staff: [staff],
      sedeProfiles: [
        {
          sedeName: '50.- La Molina',
          bukRecintoCode: 'Petmax · Petmax Principal',
        },
      ],
    });
    const records: BukAsistenciaRecord[] = [
      {
        id: 1,
        trab_id: 1,
        rut_trabajador: '44784524',
        nombre: 'FARAH FABIOLA',
        apellido_paterno: 'DEL RÍO',
        apellido_materno: 'VÁSQUEZ',
        codigo_recinto: 'Petmax',
        nombre_recinto: 'Petmax Principal',
        area: 'COUNTER',
        dia_entrada: '15/06/2026',
        entrada: '2026-06-15T12:02:00Z',
        entrada_format: '2026/06/15 08:02:00',
        salida: null,
        salida_format: '-',
      },
    ];
    const live = buildLiveSedeSummary({
      sedeName: '50.- La Molina',
      settings,
      records,
      date: new Date('2026-06-15T12:00:00'),
    });
    expect(live.workingCount).toBe(1);
    expect(live.areas[0]?.staff[0]?.entradaFormat).toBe('08:02');
    expect(live.areas[0]?.staff[0]?.status).toBe('trabajando');
  });

  it('marca ausente si salida_format indica salida el mismo día', () => {
    const staff: AsistenciaStaffMember = {
      id: 's1',
      sedeName: '50.- La Molina',
      fullName: 'Farah del Rio',
      cargoLabel: 'Recepcionista',
      area: 'administracion',
      expectedTime: '08:00',
      isCritical: false,
      rut: '44784524',
    };
    const settings = mergeAsistenciaSettings({
      staff: [staff],
      sedeProfiles: [{ sedeName: '50.- La Molina', bukRecintoCode: 'Petmax · Petmax Principal' }],
    });
    const records: BukAsistenciaRecord[] = [
      {
        id: 1,
        trab_id: 1,
        rut_trabajador: '44784524',
        nombre: 'FARAH',
        apellido_paterno: 'DEL RIO',
        codigo_recinto: 'Petmax',
        nombre_recinto: 'Petmax Principal',
        dia_entrada: '15/06/2026',
        entrada_format: '2026/06/15 08:02:00',
        salida_format: '2026/06/15 17:30:00',
      },
    ];
    const live = buildLiveSedeSummary({
      sedeName: '50.- La Molina',
      settings,
      records,
      date: new Date('2026-06-15T12:00:00'),
    });
    expect(live.workingCount).toBe(0);
    expect(live.absentCount).toBe(1);
    expect(live.areas[0]?.staff[0]?.status).toBe('ausente');
    expect(live.areas[0]?.staff[0]?.statusNote).toMatch(/17:30/);
  });

  it('usa etiquetas y orden personalizados de áreas', () => {
    const staff: AsistenciaStaffMember = {
      id: 's1',
      sedeName: 'La Molina',
      fullName: 'Ana',
      cargoLabel: 'Recepcionista',
      area: 'peluqueria',
      expectedTime: '08:00',
      isCritical: false,
    };
    const settings = mergeAsistenciaSettings({
      staff: [staff],
      sedeProfiles: [
        {
          sedeName: 'La Molina',
          areaOrder: ['peluqueria', 'medica', 'administracion'],
          areaLabels: { peluqueria: 'Spa & Baño' },
        },
      ],
    });
    const live = buildLiveSedeSummary({
      sedeName: 'La Molina',
      settings,
      records: [],
      date: new Date('2026-06-10T12:00:00'),
    });
    expect(live.areas[0]?.area).toBe('peluqueria');
    expect(live.areas[0]?.label).toBe('Spa & Baño');
  });

  it('diagnostica si falta RUT configurado', () => {
    const staff: AsistenciaStaffMember = {
      id: 's1',
      sedeName: 'La Molina',
      fullName: 'Ana',
      cargoLabel: 'Recepcionista',
      area: 'administracion',
      expectedTime: '08:00',
      isCritical: false,
    };
    const settings = mergeAsistenciaSettings({
      staff: [staff],
      sedeProfiles: [{ sedeName: 'La Molina', bukRecintoCode: 'MOLINA' }],
    });
    const records: BukAsistenciaRecord[] = [
      {
        id: 1,
        trab_id: 1,
        rut_trabajador: '111',
        nombre: 'Ana',
        apellido_paterno: 'X',
        codigo_recinto: 'MOLINA',
        dia_entrada: '10/06/2026',
        entrada_format: '08:00',
      },
    ];
    const hint = diagnoseStaffBukMatch({
      staff,
      records,
      sedeName: 'La Molina',
      settings,
      date: new Date('2026-06-10T12:00:00'),
    });
    expect(hint).toMatch(/RUT/);
  });
});
