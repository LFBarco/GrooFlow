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
        entrada_format: '08:05',
        entrada: '2026-06-10T08:05:00Z',
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

  it('marca presente (asistió) si ya tiene salida el mismo día', () => {
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
        entrada: '2026-06-15T08:02:00',
        entrada_format: '2026/06/15 08:02:00',
        salida: '2026-06-15T17:30:00',
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
    expect(live.absentCount).toBe(0);
    expect(live.areas[0]?.staff[0]?.status).toBe('presente');
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

  it('ubica en sede operativa B cuando la base es A (cubre desde)', () => {
    const staff: AsistenciaStaffMember = {
      id: 's-cover',
      sedeName: 'Magdalena',
      sedeBase: 'Magdalena',
      homeCostCenterCode: '606060',
      fullName: 'Carla Cover',
      cargoLabel: 'Asistente',
      area: 'medica',
      expectedTime: '08:00',
      isCritical: false,
      rut: '22222222',
    };
    const settings = mergeAsistenciaSettings({
      staff: [staff],
      sedeProfiles: [
        { sedeName: 'Magdalena', bukRecintoCode: 'MAG' },
        { sedeName: 'Benavides', bukRecintoCode: 'BEN' },
      ],
    });
    const records: BukAsistenciaRecord[] = [
      {
        id: 9,
        trab_id: 9,
        rut_trabajador: '22222222',
        nombre: 'Carla',
        codigo_recinto: 'BEN',
        nombre_recinto: 'Benavides',
        dia_entrada: '19/09/2026',
        entrada: '2026-09-19T08:10:00',
        entrada_format: '08:10',
        salida: null,
      },
    ];
    const date = new Date(2026, 8, 19, 12, 0, 0);
    const atBase = buildLiveSedeSummary({
      sedeName: 'Magdalena',
      settings,
      records,
      date,
      visibleSedes: ['Magdalena', 'Benavides'],
    });
    expect(atBase.areas.flatMap((a) => a.staff).map((s) => s.staff.id)).not.toContain('s-cover');

    const atOps = buildLiveSedeSummary({
      sedeName: 'Benavides',
      settings,
      records,
      date,
      visibleSedes: ['Magdalena', 'Benavides'],
    });
    const live = atOps.areas.flatMap((a) => a.staff).find((s) => s.staff.id === 's-cover');
    expect(live).toBeTruthy();
    expect(live?.coveringFromBase).toBe(true);
    expect(live?.sedeBase).toBe('Magdalena');
    expect(live?.sedeOperativaHoy).toBe('Benavides');
    expect(live?.statusNote).toMatch(/Base: Magdalena/i);
  });

  it('modo base lista en sede Buk.pe aunque marque en otra', () => {
    const staff: AsistenciaStaffMember = {
      id: 's-cover',
      sedeName: 'Magdalena',
      sedeBase: 'Magdalena',
      homeCostCenterCode: '606060',
      fullName: 'Carla Cover',
      cargoLabel: 'Asistente',
      area: 'medica',
      expectedTime: '08:00',
      isCritical: false,
      rut: '22222222',
    };
    const settings = mergeAsistenciaSettings({
      staff: [staff],
      sedeProfiles: [
        { sedeName: 'Magdalena', bukRecintoCode: 'MAG' },
        { sedeName: 'Benavides', bukRecintoCode: 'BEN' },
      ],
    });
    const records: BukAsistenciaRecord[] = [
      {
        id: 9,
        trab_id: 9,
        rut_trabajador: '22222222',
        nombre: 'Carla',
        codigo_recinto: 'BEN',
        nombre_recinto: 'Benavides',
        dia_entrada: '19/09/2026',
        entrada: '2026-09-19T08:10:00',
        entrada_format: '08:10',
        salida: null,
      },
    ];
    const date = new Date(2026, 8, 19, 12, 0, 0);
    const atBase = buildLiveSedeSummary({
      sedeName: 'Magdalena',
      settings,
      records,
      date,
      visibleSedes: ['Magdalena', 'Benavides'],
      orgMode: 'base',
    });
    expect(atBase.areas.flatMap((a) => a.staff).map((s) => s.staff.id)).toContain('s-cover');
    const live = atBase.areas.flatMap((a) => a.staff).find((s) => s.staff.id === 's-cover');
    expect(live?.statusNote).toMatch(/Hoy en Benavides/i);
  });

  it('cruza Iris Quintero por nombre si el RUT de ficha falta', () => {
    const staff: AsistenciaStaffMember = {
      id: 'iris',
      sedeName: 'La Molina',
      sedeBase: 'Magdalena',
      fullName: 'Iris Quintero',
      cargoLabel: 'Encargado de sede',
      area: 'administracion',
      expectedTime: '08:00',
      isCritical: true,
    };
    const settings = mergeAsistenciaSettings({
      staff: [staff],
      dispositivoSedeMappings: [{ dispositivoId: 'UDP3244900226', sedeName: 'La Molina' }],
    });
    const records: BukAsistenciaRecord[] = [
      {
        id: 1,
        trab_id: 1,
        rut_trabajador: '74619638',
        nombre: 'IRIS',
        apellido_paterno: 'QUINTERO',
        dispositivo: 'UDP3244900226',
        dia_entrada: '24/09/2026',
        entrada: '2026-09-24T08:10:00',
        entrada_format: '08:10',
        salida: null,
      },
    ];
    const liveSummary = buildLiveSedeSummary({
      sedeName: 'La Molina',
      settings,
      records,
      date: new Date(2026, 8, 24, 12, 0, 0),
      visibleSedes: ['La Molina', 'Magdalena'],
      orgMode: 'operativo',
    });
    const iris = liveSummary.areas.flatMap((a) => a.staff).find((s) => s.staff.id === 'iris');
    expect(iris?.status).toBe('trabajando');
    expect(iris?.entradaFormat).toBe('08:10');
  });

  it('cruza DNI con dígito verificador en ficha vs cuerpo en Buk', () => {
    const staff: AsistenciaStaffMember = {
      id: 'iris2',
      sedeName: 'La Molina',
      sedeBase: 'La Molina',
      fullName: 'Iris Quintero',
      cargoLabel: 'Encargado',
      area: 'administracion',
      expectedTime: '08:00',
      isCritical: true,
      rut: '74619638-5',
    };
    const settings = mergeAsistenciaSettings({
      staff: [staff],
      dispositivoSedeMappings: [{ dispositivoId: 'UDP3244900226', sedeName: 'La Molina' }],
    });
    const records: BukAsistenciaRecord[] = [
      {
        id: 1,
        trab_id: 1,
        rut_trabajador: '74619638',
        nombre: 'IRIS',
        apellido_paterno: 'QUINTERO',
        dispositivo: 'UDP3244900226',
        dia_entrada: '24/09/2026',
        entrada: '2026-09-24T08:10:00',
        entrada_format: '08:10',
      },
    ];
    const liveSummary = buildLiveSedeSummary({
      sedeName: 'La Molina',
      settings,
      records,
      date: new Date(2026, 8, 24, 12, 0, 0),
      visibleSedes: ['La Molina'],
      orgMode: 'operativo',
    });
    expect(liveSummary.areas.flatMap((a) => a.staff).find((s) => s.staff.id === 'iris2')?.status).toBe(
      'trabajando'
    );
  });

  it('marca tarde cuando la entrada supera horario + tolerancia', () => {
    const staff: AsistenciaStaffMember = {
      id: 's-late',
      sedeName: 'SAN ISIDRO',
      fullName: 'Pedro Tarde',
      cargoLabel: 'Recepcionista',
      area: 'administracion',
      expectedTime: '08:00',
      isCritical: false,
      rut: '222',
    };
    const settings = mergeAsistenciaSettings({
      staff: [staff],
      sedeProfiles: [
        {
          sedeName: 'SAN ISIDRO',
          bukRecintoCode: 'SANISIDRO',
          scheduleStart: '08:00',
          scheduleToleranceMinutes: 10,
        },
      ],
    });
    const records: BukAsistenciaRecord[] = [
      {
        id: 1,
        trab_id: 1,
        rut_trabajador: '222',
        nombre: 'Pedro',
        apellido_paterno: 'Tarde',
        codigo_recinto: 'SANISIDRO',
        dia_entrada: '10/06/2026',
        entrada: '2026-06-10T09:00:00',
        entrada_format: '09:00',
        salida: null,
      },
    ];
    const live = buildLiveSedeSummary({
      sedeName: 'SAN ISIDRO',
      settings,
      records,
      date: new Date('2026-06-10T12:00:00'),
    });
    expect(live.lateCount).toBe(1);
    expect(live.workingCount).toBe(0);
    expect(live.areas[0].staff[0]?.status).toBe('tarde');
  });
});
