import { describe, expect, it } from 'vitest';
import type { User } from '../../types';

function calculateEmployeeSeniorityYears(hireDateStr?: string, currentDateStr = '2026-09-08'): number {
  if (!hireDateStr) return 0;
  const hireYear = new Date(hireDateStr).getFullYear();
  const currentYear = new Date(currentDateStr).getFullYear();
  return Math.max(0, currentYear - hireYear);
}

function filterActiveEmployees(users: User[]): User[] {
  return users.filter((u) => u.status !== 'inactive');
}

describe('RRHH Module', () => {
  const sampleUsers: User[] = [
    { id: 'u1', name: 'Ana Torres', initials: 'AT', role: 'manager', hireDate: '2022-03-15', status: 'active', contractType: 'planta' },
    { id: 'u2', name: 'Carlos Ruiz', initials: 'CR', role: 'analyst', hireDate: '2025-06-01', status: 'inactive', contractType: 'temporal' },
  ];

  it('calcula la antigüedad en años del colaborador', () => {
    const seniority = calculateEmployeeSeniorityYears('2022-03-15', '2026-09-08');
    expect(seniority).toBe(4);
  });

  it('filtra únicamente colaboradores en estado activo', () => {
    const active = filterActiveEmployees(sampleUsers);
    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe('u1');
  });
});
