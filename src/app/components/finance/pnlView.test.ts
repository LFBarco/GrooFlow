import { describe, expect, it } from 'vitest';

interface PnLStatement {
  revenue: number;
  costOfSales: number;
  operatingExpenses: number;
  taxAmount: number;
}

function calculatePnLMetrics(pnl: PnLStatement) {
  const grossProfit = pnl.revenue - pnl.costOfSales;
  const grossMarginPercent = pnl.revenue > 0 ? (grossProfit / pnl.revenue) * 100 : 0;
  const operatingProfit = grossProfit - pnl.operatingExpenses;
  const netProfit = operatingProfit - pnl.taxAmount;
  const netMarginPercent = pnl.revenue > 0 ? (netProfit / pnl.revenue) * 100 : 0;

  return {
    grossProfit,
    grossMarginPercent,
    operatingProfit,
    netProfit,
    netMarginPercent,
  };
}

describe('PnL Financial View', () => {
  it('calcula utilidad bruta, operativa y neta correctamente', () => {
    const data: PnLStatement = {
      revenue: 100000,
      costOfSales: 40000,
      operatingExpenses: 30000,
      taxAmount: 8400,
    };
    const metrics = calculatePnLMetrics(data);

    expect(metrics.grossProfit).toBe(60000);
    expect(metrics.grossMarginPercent).toBe(60);
    expect(metrics.operatingProfit).toBe(30000);
    expect(metrics.netProfit).toBe(21600);
    expect(metrics.netMarginPercent).toBeCloseTo(21.6, 1);
  });

  it('maneja ingresos cero sin division por cero', () => {
    const data: PnLStatement = {
      revenue: 0,
      costOfSales: 0,
      operatingExpenses: 1000,
      taxAmount: 0,
    };
    const metrics = calculatePnLMetrics(data);

    expect(metrics.grossProfit).toBe(0);
    expect(metrics.grossMarginPercent).toBe(0);
    expect(metrics.operatingProfit).toBe(-1000);
    expect(metrics.netProfit).toBe(-1000);
    expect(metrics.netMarginPercent).toBe(0);
  });
});
