import { describe, expect, it } from 'vitest';

import type { WorkplaceAccidentRecord } from '../types/accidentes';
import {
  buildStaffOptions,
  defaultAccidentesSettings,
  medicalLeaveDays,
  previousAccidentsFor,
  seniorityMonthsAt,
  shiftFromHours,
  toTitleCase,
} from './accidentesData';
import { computeAccidentesKpis } from './accidentesKpi';
import { defaultAccidentesFilters } from '../components/accidentes/AccidentesFilters';

const rec = (p: Partial<WorkplaceAccidentRecord>): WorkplaceAccidentRecord => ({
  id: p.id ?? Math.random().toString(36),
  sede: 'Benavides',
  affectedName: 'Ana',
  jobTitle: 'Counter',
  workArea: 'Atención al Cliente',
  seniorityMonths: 3,
  contractType: 'Planta',
  eventDate: '2026-09-10',
  eventTime: '10:00',
  exactLocation: 'Counter',
  workShift: 'day',
  severity: 'leve',
  injuryNature: 'Corte / laceración',
  bodyPart: 'Mano derecha',
  causingAgent: 'Herramienta manual',
  immediateCare: 'atencion_sitio',
  estimatedLostDays: 0,
  medicalCost: 0,
  indemnizationCost: 0,
  createdAt: '2026-09-10T10:00:00Z',
  ...p,
});

describe('buildStaffOptions con Colaboradores', () => {
  it('con Buk cargado no suma usuarios de Gestión ni staff de Asistencia sin ficha', () => {
    const options = buildStaffOptions({
      users: [
        { id: '1', name: 'Cuenta sistema', initials: 'CS', role: 'admin', status: 'active' } as never,
      ],
      asistencia: {
        staff: [
          {
            id: 's9',
            sedeName: 'Benavides',
            fullName: 'Cesado Antiguo',
            cargoLabel: 'groomer',
            area: 'grooming',
            expectedTime: '08:00',
            isCritical: false,
          },
        ],
      } as never,
      employees: [
        {
          bukId: 1,
          fullName: 'María Pérez',
          cargo: 'Counter',
          orgAreaParentName: 'Atención al Cliente',
          contractType: 'Contrato a Plazo Indeterminado',
          activeSince: '2024-09-02',
          supervisor: 'ENRIQUE LUIS ALVAREZ COSSIO',
          shiftHours: '08:00-17:00',
        },
      ],
    });
    expect(options).toHaveLength(1);
    expect(options[0]?.supervisorName).toBe('Enrique Luis Alvarez Cossio');
    expect(options[0]?.shiftHours).toBe('08:00-17:00');
  });
});

describe('helpers del formulario', () => {
  it('antigüedad a la fecha del evento', () => {
    expect(seniorityMonthsAt('2024-09-02', '2026-09-10')).toBe(24);
    expect(seniorityMonthsAt(undefined, '2026-09-10')).toBe(0);
  });
  it('turno desde horario Buk', () => {
    expect(shiftFromHours('08:00-17:00')).toBe('day');
    expect(shiftFromHours('20:00-08:00')).toBe('night');
    expect(shiftFromHours('14:00-23:00')).toBe('mixed');
    expect(shiftFromHours('')).toBeNull();
  });
  it('días de descanso médico inclusivos', () => {
    expect(medicalLeaveDays('2026-09-10', '2026-09-12')).toBe(3);
    expect(medicalLeaveDays('2026-09-10', undefined)).toBe(0);
  });
  it('title case con tildes', () => {
    expect(toTitleCase('JOSÉ ÁLVAREZ  ñUÑEZ')).toBe('José Álvarez Ñuñez');
  });
  it('reincidencia por bukId', () => {
    const records = [rec({ id: 'a', bukEmployeeId: 5 }), rec({ id: 'b', bukEmployeeId: 6 })];
    expect(previousAccidentsFor(records, { bukEmployeeId: 5, affectedName: 'X' })).toHaveLength(1);
  });
});

describe('computeAccidentesKpis', () => {
  const filters = { ...defaultAccidentesFilters(), dateFrom: '2026-09-01', dateTo: '2026-09-30' };

  it('IF/IG solo con accidentes de trabajo y headcount de Colaboradores', () => {
    const settings = {
      ...defaultAccidentesSettings(),
      records: [
        rec({ id: '1', estimatedLostDays: 2, bukEmployeeId: 1 }),
        rec({ id: '2', eventType: 'incidente', estimatedLostDays: 5, bukEmployeeId: 2 }),
        rec({ id: '3', eventType: 'casi_accidente' }),
      ],
    };
    const k = computeAccidentesKpis({
      settings,
      filters,
      users: [],
      collaboratorHeadcount: 166,
      today: '2026-09-30',
    });
    expect(k.activeWorkers).toBe(166);
    expect(k.totalAccidents).toBe(1);
    expect(k.accidentsWithLostTime).toBe(1);
    expect(k.totalLostDays).toBe(2);
    expect(k.affectedWorkers).toBe(1);
    expect(k.manHours).toBe(166 * 208);
  });

  it('cuenta acciones vencidas y mortales sin notificar', () => {
    const settings = {
      ...defaultAccidentesSettings(),
      records: [
        rec({
          severity: 'mortal',
          correctiveActions: [
            { id: 'x', description: 'Señalizar', status: 'pendiente', dueDate: '2026-09-15' },
            { id: 'y', description: 'Capacitar', status: 'completada', dueDate: '2026-09-15' },
          ],
        }),
      ],
    };
    const k = computeAccidentesKpis({ settings, filters, users: [], today: '2026-09-30' });
    expect(k.overdueCorrectiveActions).toBe(1);
    expect(k.pendingMtpeNotifications).toBe(1);
  });
});
