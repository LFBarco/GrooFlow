import { describe, expect, it } from 'vitest';

interface CashFlowCell {
  category: string;
  amount: number;
  period: string; // e.g. "2026-09"
  type: 'inflow' | 'outflow';
}

function aggregateCashFlowByPeriod(cells: CashFlowCell[], period: string) {
  let totalInflow = 0;
  let totalOutflow = 0;
  for (const c of cells) {
    if (c.period === period) {
      if (c.type === 'inflow') totalInflow += c.amount;
      else if (c.type === 'outflow') totalOutflow += c.amount;
    }
  }
  return { totalInflow, totalOutflow, netCashFlow: totalInflow - totalOutflow };
}

function applyScenarioSimulation(
  openingBalance: number,
  inflows: number,
  outflows: number,
  multiplier: number // e.g. 0.8 for conservative, 1.2 for optimistic
) {
  const simulatedInflows = inflows * multiplier;
  const net = simulatedInflows - outflows;
  return {
    simulatedInflows,
    simulatedOutflows: outflows,
    projectedEndingBalance: openingBalance + net,
  };
}

describe('CashFlowGrid & Smart Cash Flow', () => {
  const sampleCells: CashFlowCell[] = [
    { category: 'Consultas', amount: 12000, period: '2026-09', type: 'inflow' },
    { category: 'Farmacia', amount: 8000, period: '2026-09', type: 'inflow' },
    { category: 'Planilla', amount: 9000, period: '2026-09', type: 'outflow' },
    { category: 'Servicios', amount: 2000, period: '2026-09', type: 'outflow' },
  ];

  it('agrega flujos por periodo mensual', () => {
    const agg = aggregateCashFlowByPeriod(sampleCells, '2026-09');
    expect(agg.totalInflow).toBe(20000);
    expect(agg.totalOutflow).toBe(11000);
    expect(agg.netCashFlow).toBe(9000);
  });

  it('simula escenario conservador (-20% ingresos)', () => {
    const sim = applyScenarioSimulation(5000, 20000, 11000, 0.8);
    expect(sim.simulatedInflows).toBe(16000);
    expect(sim.projectedEndingBalance).toBe(10000);
  });

  it('simula escenario optimista (+20% ingresos)', () => {
    const sim = applyScenarioSimulation(5000, 20000, 11000, 1.2);
    expect(sim.simulatedInflows).toBe(24000);
    expect(sim.projectedEndingBalance).toBe(18000);
  });
});
