import { describe, expect, it } from 'vitest';

interface AttendanceRecord {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  scheduledEntryTime: string; // e.g. "08:30"
  actualEntryTime: string; // e.g. "08:45"
  actualExitTime: string; // e.g. "18:30"
}

function calculateTardinessMinutes(scheduledEntry: string, actualEntry: string): number {
  const [schH, schM] = scheduledEntry.split(':').map(Number);
  const [actH, actM] = actualEntry.split(':').map(Number);
  if (schH === undefined || schM === undefined || actH === undefined || actM === undefined) return 0;

  const scheduledTotal = schH * 60 + schM;
  const actualTotal = actH * 60 + actM;

  return Math.max(0, actualTotal - scheduledTotal);
}

function calculateHoursWorked(actualEntry: string, actualExit: string): number {
  const [inH, inM] = actualEntry.split(':').map(Number);
  const [outH, outM] = actualExit.split(':').map(Number);
  if (inH === undefined || inM === undefined || outH === undefined || outM === undefined) return 0;

  const totalMinutes = outH * 60 + outM - (inH * 60 + inM);
  return Math.max(0, Number((totalMinutes / 60).toFixed(2)));
}

describe('Asistencia Module', () => {
  it('calcula los minutos de tardanza sobre el horario programado', () => {
    const tardiness = calculateTardinessMinutes('08:30', '08:45');
    expect(tardiness).toBe(15);
  });

  it('retorna 0 tardanza si el colaborador ingresa a tiempo o antes', () => {
    const tardiness = calculateTardinessMinutes('08:30', '08:25');
    expect(tardiness).toBe(0);
  });

  it('calcula el total de horas trabajadas en la jornada', () => {
    const hours = calculateHoursWorked('08:30', '18:30');
    expect(hours).toBe(10);
  });
});
