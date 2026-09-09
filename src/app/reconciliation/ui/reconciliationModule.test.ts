import { describe, expect, it } from 'vitest';

interface ReconciliationMatch {
  statementId: string;
  systemSaleId: string;
  statementAmount: number;
  systemAmount: number;
  matchScore: number; // 0 to 100
  isDiscrepancy: boolean;
}

function calculateMatchScore(statementAmount: number, systemAmount: number, daysDiff: number): { score: number; isDiscrepancy: boolean } {
  const diffAmount = Math.abs(statementAmount - systemAmount);
  if (diffAmount === 0 && daysDiff === 0) {
    return { score: 100, isDiscrepancy: false };
  }
  if (diffAmount === 0 && daysDiff <= 2) {
    return { score: 90, isDiscrepancy: false };
  }
  if (diffAmount > 0 && diffAmount <= 5) {
    return { score: 70, isDiscrepancy: true };
  }
  return { score: 0, isDiscrepancy: true };
}

describe('Reconciliation Engine Module', () => {
  it('retorna score 100% para coincidencia exacta de monto y fecha', () => {
    const res = calculateMatchScore(150.50, 150.50, 0);
    expect(res.score).toBe(100);
    expect(res.isDiscrepancy).toBe(false);
  });

  it('retorna score 90% para coincidencia de monto con desfasaje de 2 días', () => {
    const res = calculateMatchScore(200.00, 200.00, 2);
    expect(res.score).toBe(90);
    expect(res.isDiscrepancy).toBe(false);
  });

  it('marca discrepancia para montos con diferencia', () => {
    const res = calculateMatchScore(200.00, 198.00, 0);
    expect(res.isDiscrepancy).toBe(true);
    expect(res.score).toBe(70);
  });
});
