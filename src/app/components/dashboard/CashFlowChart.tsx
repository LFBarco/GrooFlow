import { useMemo, useState, useEffect } from 'react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine,
  Area,
  ComposedChart
} from 'recharts';
import { Transaction } from '../../types';
import { format, getDaysInMonth, startOfMonth, addDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { formatAxisThousandsPEN, formatCurrencyEs } from '../../utils/numberFormat';
import { useModuleSurfaces } from '../../utils/moduleSurfaces';

interface CashFlowChartProps {
  transactions: Transaction[];
  currentDate: Date;
}

export function CashFlowChart({ transactions, currentDate }: CashFlowChartProps) {
  const s = useModuleSurfaces();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const chartData = useMemo(() => {
    const startDate = startOfMonth(currentDate);
    const daysInMonth = getDaysInMonth(currentDate);
    
    let runningBalance = transactions
      .filter(t => new Date(t.date) < startDate)
      .reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);

    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = addDays(startDate, i);
      const income = transactions
        .filter(t => t.type === 'income' && isSameDay(new Date(t.date), day))
        .reduce((sum, t) => sum + t.amount, 0);
      const expense = transactions
        .filter(t => t.type === 'expense' && isSameDay(new Date(t.date), day))
        .reduce((sum, t) => sum + t.amount, 0);
      runningBalance += income - expense;
      return {
        date: format(day, 'dd'),
        fullDate: format(day, 'ddMMM', { locale: es }),
        balance: runningBalance,
        income,
        expense,
        net: income - expense
      };
    });
  }, [transactions, currentDate]);

  const negativeDays = chartData.filter(d => d.balance < 0).length;
  const formatMoney = (v: number) => formatCurrencyEs(v, 0);
  const neonPurple = s.chart.violet;

  return (
    <div className={`rounded-2xl p-5 ${s.isDark ? '' : 'gf-glass-card light-chart-panel'}`} style={{
      background: s.chartCard.background,
      border: s.chartCard.border,
      boxShadow: s.chartCard.boxShadow,
    }}>
      <div className="flex items-start justify-between mb-5 pb-4" style={{ borderBottom: `1px solid ${s.divider}` }}>
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl" style={{ background: `${neonPurple}18`, border: `1px solid ${neonPurple}35` }}>
            <TrendingUp className="w-4 h-4" style={{ color: neonPurple, filter: s.isDark ? `drop-shadow(0 0 6px ${neonPurple}99)` : undefined }} />
          </div>
          <div>
            <h3 className="font-bold text-sm" style={{ color: s.pageTitle }}>Proyección de Saldo</h3>
            <p className="text-xs" style={{ color: s.pageSubtitle }}>Evolución estimada de la caja este mes</p>
          </div>
        </div>
        {negativeDays > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold" style={{
            background: s.isDark ? 'rgba(251,113,133,0.1)' : 'rgba(220,38,38,0.12)',
            border: s.isDark ? '1px solid rgba(251,113,133,0.25)' : '1px solid rgba(220,38,38,0.3)',
            color: s.chart.expense,
          }}>
            <AlertTriangle className="w-3.5 h-3.5" />
            {negativeDays} días en rojo
          </div>
        )}
      </div>

      {isMounted ? (
        <div style={{ height: '280px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={neonPurple} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={neonPurple} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={s.gridStroke} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: s.axisTick, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatAxisThousandsPEN} tick={{ fill: s.axisTick, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={s.tooltip}
                itemStyle={s.tooltipItem}
                labelStyle={s.tooltipLabel}
                formatter={(value: number) => [formatMoney(value), 'Saldo']}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ''}
              />
              <ReferenceLine y={0} stroke={s.chart.expense} strokeDasharray="4 4" strokeOpacity={0.5} />
              <Area
                type="monotone"
                dataKey="balance"
                stroke={neonPurple}
                strokeWidth={2.5}
                fill="url(#balanceGradient)"
                activeDot={{ r: 5, fill: neonPurple, stroke: s.isDark ? '#1A1826' : '#FFFFFF', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[280px] animate-pulse rounded-xl" style={{ background: s.isDark ? 'rgba(139,92,246,0.05)' : 'rgba(99,102,241,0.08)' }} />
      )}
    </div>
  );
}
