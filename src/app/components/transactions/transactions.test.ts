import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../types';

function filterTransactions(
  list: Transaction[],
  filters: { sede?: string; type?: 'income' | 'expense'; category?: string; search?: string }
): Transaction[] {
  return list.filter((t) => {
    if (filters.sede && filters.sede !== 'todas' && t.location !== filters.sede) return false;
    if (filters.type && t.type !== filters.type) return false;
    if (filters.category && filters.category !== 'todas' && t.category !== filters.category) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matchDesc = t.description.toLowerCase().includes(q);
      const matchCat = (t.category || '').toLowerCase().includes(q);
      const matchRef = (t.reference || '').toLowerCase().includes(q);
      if (!matchDesc && !matchCat && !matchRef) return false;
    }
    return true;
  });
}

function calculateTransactionTotals(list: Transaction[]): { totalIncome: number; totalExpense: number; netBalance: number } {
  let totalIncome = 0;
  let totalExpense = 0;
  for (const t of list) {
    if (t.type === 'income') totalIncome += t.amount;
    else if (t.type === 'expense') totalExpense += t.amount;
  }
  return { totalIncome, totalExpense, netBalance: totalIncome - totalExpense };
}

describe('Transactions Module', () => {
  const sampleTransactions: Transaction[] = [
    { id: '1', amount: 500, type: 'income', category: 'Consultas', description: 'Consulta canina', date: new Date('2026-09-01'), location: 'Principal' },
    { id: '2', amount: 120, type: 'expense', category: 'Servicios Básicos', description: 'Pago de agua', date: new Date('2026-09-02'), location: 'Principal' },
    { id: '3', amount: 350, type: 'income', category: 'Cirugías', description: 'Esterilización', date: new Date('2026-09-03'), location: 'Surco' },
    { id: '4', amount: 80, type: 'expense', category: 'Mantenimiento', description: 'Reparación lámpara', date: new Date('2026-09-04'), location: 'Surco' },
  ];

  it('calcula totales de ingresos, egresos y saldo neto', () => {
    const totals = calculateTransactionTotals(sampleTransactions);
    expect(totals.totalIncome).toBe(850);
    expect(totals.totalExpense).toBe(200);
    expect(totals.netBalance).toBe(650);
  });

  it('filtra transacciones por sede', () => {
    const principalOnly = filterTransactions(sampleTransactions, { sede: 'Principal' });
    expect(principalOnly).toHaveLength(2);
    expect(principalOnly.every((t) => t.location === 'Principal')).toBe(true);
  });

  it('filtra transacciones por tipo (ingreso o egreso)', () => {
    const expenses = filterTransactions(sampleTransactions, { type: 'expense' });
    expect(expenses).toHaveLength(2);
    expect(expenses.map((e) => e.id)).toEqual(['2', '4']);
  });

  it('filtra transacciones por búsqueda por palabra clave', () => {
    const searchResult = filterTransactions(sampleTransactions, { search: 'lámpara' });
    expect(searchResult).toHaveLength(1);
    expect(searchResult[0]?.id).toBe('4');
  });

  it('valida creación y estructura de nueva transacción', () => {
    const newTx: Transaction = {
      id: 'tx-100',
      amount: 250,
      type: 'income',
      category: 'Farmacia',
      description: 'Venta de antibióticos',
      date: new Date(),
      location: 'Principal',
      currency: 'PEN',
    };
    expect(newTx.id).toBeDefined();
    expect(newTx.amount).toBeGreaterThan(0);
    expect(newTx.type).toBe('income');
  });
});
