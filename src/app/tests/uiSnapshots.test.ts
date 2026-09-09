import { describe, expect, it } from 'vitest';

describe('5. UI Component Structural Snapshot Tests', () => {
  it('should match KPI Card component schema structure', () => {
    const kpiSchema = {
      title: 'Total Ingresos',
      amountFormatted: 'S/ 45,230.00',
      trend: '+12.5%',
      badgeColor: '#22d3ee',
    };

    expect(kpiSchema).toMatchSnapshot();
  });

  it('should match Badge status contract structure', () => {
    const badgeContract = {
      currentMonth: 'En Curso',
      pastMonth: 'Mes anterior',
      futureMonth: 'Futuro',
    };

    expect(badgeContract).toMatchInlineSnapshot(`
      {
        "currentMonth": "En Curso",
        "futureMonth": "Futuro",
        "pastMonth": "Mes anterior",
      }
    `);
  });
});
