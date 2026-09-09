import { describe, expect, it } from 'vitest';

interface ShiftAssignment {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  sede: string;
}

function hasShiftOverlap(shiftA: ShiftAssignment, shiftB: ShiftAssignment): boolean {
  if (shiftA.userId !== shiftB.userId || shiftA.date !== shiftB.date) return false;

  const [aStartH, aStartM] = shiftA.startTime.split(':').map(Number);
  const [aEndH, aEndM] = shiftA.endTime.split(':').map(Number);
  const [bStartH, bStartM] = shiftB.startTime.split(':').map(Number);
  const [bEndH, bEndM] = shiftB.endTime.split(':').map(Number);

  if (aStartH === undefined || aStartM === undefined || aEndH === undefined || aEndM === undefined) return false;
  if (bStartH === undefined || bStartM === undefined || bEndH === undefined || bEndM === undefined) return false;

  const aStart = aStartH * 60 + aStartM;
  const aEnd = aEndH * 60 + aEndM;
  const bStart = bStartH * 60 + bStartM;
  const bEnd = bEndH * 60 + bEndM;

  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}

describe('Turnos Module', () => {
  it('detecta solapamiento de turnos para un mismo usuario en el mismo día', () => {
    const s1: ShiftAssignment = { id: 't1', userId: 'u1', date: '2026-09-08', startTime: '08:00', endTime: '14:00', sede: 'Principal' };
    const s2: ShiftAssignment = { id: 't2', userId: 'u1', date: '2026-09-08', startTime: '13:00', endTime: '19:00', sede: 'Principal' };

    expect(hasShiftOverlap(s1, s2)).toBe(true);
  });

  it('permite turnos consecutivos sin solapamiento', () => {
    const s1: ShiftAssignment = { id: 't1', userId: 'u1', date: '2026-09-08', startTime: '08:00', endTime: '14:00', sede: 'Principal' };
    const s2: ShiftAssignment = { id: 't2', userId: 'u1', date: '2026-09-08', startTime: '14:00', endTime: '20:00', sede: 'Principal' };

    expect(hasShiftOverlap(s1, s2)).toBe(false);
  });
});
