import { useMemo } from 'react';
import { Transaction } from '../../types';
import { format, isBefore, startOfMonth, endOfMonth, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Lock, Unlock, TrendingUp, TrendingDown, DollarSign, CalendarDays } from 'lucide-react';

interface MonthlySummaryProps {
  transactions: Transaction[];
  currentDate: Date;
}

export function MonthlySummary({ transactions, currentDate }: MonthlySummaryProps) {
  // Safety check for date
  if (!currentDate || isNaN(currentDate.getTime())) {
    return (
        <div className="p-4 text-red-500 border border-red-200 rounded-md bg-red-50">
            Error: Fecha inválida seleccionada para el reporte mensual.
        </div>
    );
  }

  const isPastMonth = isBefore(endOfMonth(currentDate), startOfMonth(new Date()));
  const isCurrentMonth = isSameMonth(currentDate, new Date());

  const monthTransactions = useMemo(() => {
    return transactions.filter(t => {
        const d = new Date(t.date);
        return !isNaN(d.getTime()) && isSameMonth(d, currentDate);
    });
  }, [transactions, currentDate]);

  const { income, expense, balance } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    monthTransactions.forEach(t => {
      if (t.type === 'income') inc += t.amount;
      else exp += t.amount;
    });
    return { income: inc, expense: exp, balance: inc - exp };
  }, [monthTransactions]);

  const groupedData = useMemo(() => {
    const incomeGroups = new Map<string, { total: number, concepts: Map<string, number> }>();
    const expenseGroups = new Map<string, { total: number, concepts: Map<string, number> }>();

    monthTransactions.forEach(t => {
      const targetMap = t.type === 'income' ? incomeGroups : expenseGroups;
      const category = t.category;
      const concept = t.subcategory || 'General';

      if (!targetMap.has(category)) {
        targetMap.set(category, { total: 0, concepts: new Map() });
      }

      const catData = targetMap.get(category)!;
      catData.total += t.amount;
      
      const currentConceptTotal = catData.concepts.get(concept) || 0;
      catData.concepts.set(concept, currentConceptTotal + t.amount);
    });

    return { incomeGroups, expenseGroups };
  }, [monthTransactions]);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const renderGroup = (groups: Map<string, { total: number, concepts: Map<string, number> }>, type: 'income' | 'expense') => {
    const sortedCategories = Array.from(groups.entries()).sort((a, b) => b[1].total - a[1].total);
    const isInc = type === 'income';

    if (sortedCategories.length === 0) {
      return <div className="text-muted-foreground text-sm italic p-4 text-center border border-dashed border-border rounded-lg">No hay registros registrados en este mes.</div>;
    }

    return (
      <div className="space-y-4">
        {sortedCategories.map(([category, data]) => (
          <div key={category} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${isInc ? 'rgba(34,211,238,0.15)' : 'rgba(251,113,133,0.15)'}` }}>
            <div className="px-4 py-2.5 flex justify-between items-center font-medium"
              style={{ background: isInc ? 'rgba(34,211,238,0.08)' : 'rgba(251,113,133,0.08)', color: isInc ? '#22d3ee' : '#fb7185' }}
            >
              <span className="uppercase text-xs tracking-wider font-bold">{category}</span>
              <span className="font-bold text-sm" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatMoney(data.total)}</span>
            </div>
            <div className="p-2 space-y-1" style={{ background: 'rgba(26,24,38,0.6)' }}>
              {Array.from(data.concepts.entries()).sort((a,b) => b[1] - a[1]).map(([concept, amount]) => (
                <div key={concept} className="flex justify-between text-xs px-2 py-1.5 rounded-lg transition-colors group"
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.08)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <span style={{ color: '#8b7cf8' }}>{concept}</span>
                  <span className="font-mono font-medium" style={{ color: '#E4E0FF' }}>{formatMoney(amount)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
        {/* Header Status */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center p-4 rounded-xl"
          style={{ background: 'rgba(26,24,38,0.8)', border: '1px solid rgba(139,92,246,0.15)' }}
        >
            <div>
                <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: '#F0EEFF' }}>
                    Resumen Mensual: {format(currentDate, 'MMMM yyyy', { locale: es })}
                </h2>
                <p className="text-sm mt-0.5" style={{ color: '#6b5fa5' }}>
                    {monthTransactions.length} transacciones registradas
                </p>
            </div>
            <div className="flex items-center gap-2">
                {isPastMonth ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                      style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', color: '#8b7cf8' }}
                    >
                        <Lock className="w-3 h-3" /> Mes Cerrado
                    </span>
                ) : isCurrentMonth ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold animate-pulse"
                      style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)', color: '#22d3ee' }}
                    >
                        <Unlock className="w-3 h-3" /> En Curso
                    </span>
                ) : (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                      style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}
                    >
                        <CalendarDays className="w-3 h-3" /> Futuro
                    </span>
                )}
            </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Total Ingresos', value: formatMoney(income), icon: TrendingUp, color: '#22d3ee' },
              { label: 'Total Egresos', value: formatMoney(expense), icon: TrendingDown, color: '#fb7185' },
              { label: 'Balance Neto', value: formatMoney(balance), icon: DollarSign, color: balance >= 0 ? '#34d399' : '#fbbf24' },
            ].map((card, i) => (
              <div key={i} className="rounded-2xl p-5 flex items-center justify-between"
                style={{
                  background: 'linear-gradient(145deg, #1A1826 0%, #161424 100%)',
                  border: `1px solid ${card.color}20`,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                }}
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>{card.label}</p>
                  <p className="text-2xl font-bold" style={{ color: card.color, fontFamily: "'JetBrains Mono', monospace" }}>{card.value}</p>
                </div>
                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${card.color}15`, border: `1px solid ${card.color}25` }}
                >
                  <card.icon className="w-5 h-5" style={{ color: card.color, filter: `drop-shadow(0 0 6px ${card.color}80)` }} />
                </div>
              </div>
            ))}
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1 min-h-0">
            <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: 'linear-gradient(145deg, #1A1826 0%, #161424 100%)', border: '1px solid rgba(34,211,238,0.12)' }}>
                <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(34,211,238,0.1)', background: 'rgba(34,211,238,0.05)' }}>
                    <TrendingUp className="w-4 h-4" style={{ color: '#22d3ee' }} />
                    <span className="text-sm font-bold uppercase tracking-wider" style={{ color: '#22d3ee' }}>Detalle de Ingresos</span>
                </div>
                <div className="flex-1 min-h-[400px] overflow-auto p-4">
                    {renderGroup(groupedData.incomeGroups, 'income')}
                </div>
            </div>

            <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: 'linear-gradient(145deg, #1A1826 0%, #161424 100%)', border: '1px solid rgba(251,113,133,0.12)' }}>
                <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(251,113,133,0.1)', background: 'rgba(251,113,133,0.05)' }}>
                    <TrendingDown className="w-4 h-4" style={{ color: '#fb7185' }} />
                    <span className="text-sm font-bold uppercase tracking-wider" style={{ color: '#fb7185' }}>Detalle de Egresos</span>
                </div>
                <div className="flex-1 min-h-[400px] overflow-auto p-4">
                    {renderGroup(groupedData.expenseGroups, 'expense')}
                </div>
            </div>
        </div>
    </div>
  );
}