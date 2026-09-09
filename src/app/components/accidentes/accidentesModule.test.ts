import { describe, expect, it } from 'vitest';

interface WorkplaceAccident {
  id: string;
  employeeName: string;
  incidentDate: string;
  severity: 'minor' | 'moderate' | 'severe';
  medicalLeaveDays: number;
  description: string;
}

function classifyAccidentRisk(accident: WorkplaceAccident): { requiresSstReport: boolean; categoryLabel: string } {
  if (accident.severity === 'severe' || accident.medicalLeaveDays > 3) {
    return { requiresSstReport: true, categoryLabel: 'Accidente de Trabajo Notificable SST' };
  }
  return { requiresSstReport: false, categoryLabel: 'Incidente Leve / Primeros Auxilios' };
}

describe('Accidentes de Trabajo Module', () => {
  it('clasifica accidente severo o con mas de 3 días de descanso como Notificable SST', () => {
    const acc: WorkplaceAccident = {
      id: 'acc-1',
      employeeName: 'Roberto Gómez',
      incidentDate: '2026-09-08',
      severity: 'moderate',
      medicalLeaveDays: 5,
      description: 'Caída de escaleras en almacén',
    };
    const risk = classifyAccidentRisk(acc);
    expect(risk.requiresSstReport).toBe(true);
    expect(risk.categoryLabel).toContain('SST');
  });

  it('clasifica accidente leve de primeros auxilios', () => {
    const acc: WorkplaceAccident = {
      id: 'acc-2',
      employeeName: 'Laura Silva',
      incidentDate: '2026-09-08',
      severity: 'minor',
      medicalLeaveDays: 0,
      description: 'Rasguño leve manipulando felino',
    };
    const risk = classifyAccidentRisk(acc);
    expect(risk.requiresSstReport).toBe(false);
  });
});
