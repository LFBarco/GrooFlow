import { Transaction } from "../types";

export type PnLGroup = 'revenue' | 'cogs' | 'expenses' | 'other_income' | 'other_expenses';

export interface PnLLineItem {
  id: string; // unique key for rendering
  name: string;
  amount: number;
  transactions: Transaction[];
}

export interface PnLSection {
  total: number;
  items: PnLLineItem[];
}

export interface PnLReport {
  revenue: PnLSection;
  cogs: PnLSection;
  grossProfit: number;
  expenses: PnLSection;
  netOperatingIncome: number;
  netIncome: number;
}

const normalizeCategory = (cat: string | undefined): string => {
    return cat ? cat.trim() : 'Sin Categoría';
};

const mapCategoryToPnL = (category: string, type: 'income' | 'expense', subcategory?: string): { group: PnLGroup, name: string } => {
    const cat = normalizeCategory(category);
    const sub = normalizeCategory(subcategory);

    if (type === 'income') {
        if (['Consultas', 'Cirugías', 'Farmacia', 'Alimentos', 'Área Médica', 'Área Grooming', 'Área Operativa', 'Hospitalización', 'Vacunación'].includes(cat)) {
            return { group: 'revenue', name: cat };
        }
        if (cat === 'Ingresos') {
             // Try to use subcategory for better granularity if available
             if (sub && sub !== 'Sin Categoría') return { group: 'revenue', name: sub };
             return { group: 'revenue', name: 'Ventas Generales' };
        }
        return { group: 'revenue', name: cat };
    }

    // EXPENSES
    // Costos Directos (COGS)
    if (['Proveedores', 'Farmacia', 'Alimentos'].includes(cat)) {
        return { group: 'cogs', name: 'Costo de Mercadería (Insumos/Fármacos)' };
    }
    if (['Área Médica', 'Área Grooming'].includes(cat)) {
         return { group: 'cogs', name: `Insumos ${cat}` };
    }

    // Gastos Operativos (OPEX)
    if (['Planilla', 'Sueldos'].includes(cat)) {
        return { group: 'expenses', name: 'Nómina y Salarios' };
    }
    if (['Alquiler'].includes(cat)) {
        return { group: 'expenses', name: 'Alquiler de Sedes' };
    }
    if (['Servicios Básicos', 'Servicios'].includes(cat)) {
        return { group: 'expenses', name: 'Servicios Públicos (Luz/Agua/Internet)' };
    }
    if (['Mantenimiento', 'Obras Sedes'].includes(cat)) {
        return { group: 'expenses', name: 'Mantenimiento e Infraestructura' };
    }
    if (['Impuestos', 'Seguros', 'Comisiones Bancarias', 'Regalías'].includes(cat)) {
        return { group: 'expenses', name: 'Gastos Admin. y Financieros' };
    }
    if (cat === 'Otros') {
        return { group: 'expenses', name: 'Otros Gastos Generales' };
    }

    return { group: 'expenses', name: cat };
};

export const generatePnLReport = (transactions: Transaction[]): PnLReport => {
    const report: PnLReport = {
        revenue: { total: 0, items: [] },
        cogs: { total: 0, items: [] },
        grossProfit: 0,
        expenses: { total: 0, items: [] },
        netOperatingIncome: 0,
        netIncome: 0
    };

    const groupedData: Record<PnLGroup, Record<string, { amount: number, transactions: Transaction[] }>> = {
        revenue: {},
        cogs: {},
        expenses: {},
        other_income: {},
        other_expenses: {}
    };

    transactions.forEach(t => {
        const mapping = mapCategoryToPnL(t.category as string, t.type, t.subcategory);
        const group = mapping.group;
        const name = mapping.name;

        // Skip other_income/expenses for simplified view or merge them?
        // Let's merge other_income into revenue and other_expenses into expenses for now, 
        // or just handle the groups defined in mapCategoryToPnL.
        // Currently mapCategoryToPnL only returns revenue, cogs, expenses.
        
        if (!groupedData[group]) groupedData[group] = {};
        if (!groupedData[group][name]) {
            groupedData[group][name] = { amount: 0, transactions: [] };
        }

        groupedData[group][name].amount += t.amount;
        groupedData[group][name].transactions.push(t);
    });

    // Convert to arrays
    const processSection = (group: PnLGroup): PnLSection => {
        const items = Object.entries(groupedData[group] || {}).map(([name, data]) => ({
            id: name,
            name,
            amount: data.amount,
            transactions: data.transactions
        })).sort((a, b) => b.amount - a.amount); // Sort by amount descending

        const total = items.reduce((sum, item) => sum + item.amount, 0);
        return { total, items };
    };

    report.revenue = processSection('revenue');
    report.cogs = processSection('cogs');
    report.expenses = processSection('expenses');
    
    // Note: If mapCategoryToPnL returns 'other_income' or 'other_expenses', handle them. 
    // Currently strictly returning revenue, cogs, expenses based on logic above.

    report.grossProfit = report.revenue.total - report.cogs.total;
    report.netOperatingIncome = report.grossProfit - report.expenses.total;
    report.netIncome = report.netOperatingIncome; // + Other Income - Other Expenses

    return report;
};