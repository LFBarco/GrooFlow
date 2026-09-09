import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../types';

interface ExecutiveMonthlySummary {
  period: string;
  totalIncome: number;
  totalExpense: number;
  topExpenseCategory: string;
  transactionCount: number;
}

function generateExecutiveSummary(transactions: Transaction[], period: string): ExecutiveMonthlySummary {
  let totalIncome = 0;
  let totalExpense = 0;
  const categoryMap = new Map<string, number>();

  for (const t of transactions) {
    if (t.type === 'income') {
      totalIncome += t.amount;
    } else if (t.type === 'expense') {
      totalExpense += t.amount;
      const cat = t.category || 'Otros';
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + t.amount);
    }
  }

  let topExpenseCategory = 'Ninguna';
  let maxCatAmount = 0;
  for (const [cat, amt] of categoryMap.entries()) {
    if (amt > maxCatAmount) {
      maxCatAmount = amt;
      topExpenseCategory = cat;
    }
  }

  return {
    period,
    totalIncome,
    totalExpense,
    topExpenseCategory,
    transactionCount: transactions.length,
  };
}

describe('Monthly Summary Report', () => {
  const transactions: Transaction[] = [
    { id: '1', amount: 5000, type: 'income', category: 'Consultas', description: 'Venta consultas', date: new Date(), location: 'Principal' },
    { id: '2', amount: 3000, type: 'expense', category: 'Planilla', description: 'Sueldos asistente', date: new Date(), location: 'Principal' },
    { id: '3', amount: 1200, type: 'expense', category: 'Planilla', description: 'Sueldos recepción', date: new Date(), location: 'Principal' },
    { id: '4', amount: 800, type: 'expense', category: 'Servicios Básicos', description: 'Luz y agua', date: new Date(), location: 'Principal' },
  ];

  it('genera resumen ejecutivo identificando la categoría con mayor egreso', () => {
    const summary = generateExecutiveSummary(transactions, '2026-09');
    expect(summary.totalIncome).toBe(5000);
    expect(summary.totalExpense).toBe(5000);
    expect(summary.topExpenseCategory).toBe('Planilla'); // 3000 + 1200 = 4200
    expect(summary.transactionCount).toBe(4);
  });
});
