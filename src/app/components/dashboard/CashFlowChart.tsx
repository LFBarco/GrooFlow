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

// ─── CHART PALETTE ────────────────────────────────────────────────────
const NEON_PURPLE  = '#c084fc';
const AXIS_COLOR   = '#6b5fa5';
const GRID_COLOR   = 'rgba(139,92,246,0.1)';
const TOOLTIP_STYLE = {
  backgroundColor: '#22203A',
  border: '1px solid #3D3B5C',
  borderRadius: '12px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  padding: '12px 16px',
};
const TOOLTIP_ITEM = { color: '#E4E0FF', fontSize: '12px' };
const TOOLTIP_LABEL = { color: '#8b7cf8', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '0.08em' };

interface CashFlowChartProps {
  transactions: Transaction[];
  currentDate: Date;
}

export function CashFlowChart({ transactions, currentDate }: CashFlowChartProps) {
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
  const formatMoney = (v: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 0 }).format(v);

  return (
    <div className="rounded-2xl p-5" style={{
      background: 'linear-gradient(145deg, #1A1826 0%, #161424 100%)',
      border: '1px solid rgba(255,255,255,0.06)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    }}>
      <div className="flex items-start justify-between mb-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl" style={{ background: 'rgba(192,132,252,0.1)', border: '1px solid rgba(192,132,252,0.2)' }}>
            <TrendingUp className="w-4 h-4 text-violet-400" style={{ filter: 'drop-shadow(0 0 6px rgba(192,132,252,0.6))' }} />
          </div>
          <div>
            <h3 className="font-bold text-sm" style={{ color: '#F0EEFF' }}>Proyección de Saldo</h3>
            <p className="text-xs" style={{ color: '#6b5fa5' }}>Evolución estimada de la caja este mes</p>
          </div>
        </div>
        {negativeDays > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold" style={{
            background: 'rgba(251,113,133,0.1)',
            border: '1px solid rgba(251,113,133,0.25)',
            color: '#fb7185',
          }}>
            <AlertTriangle className="w-3.5 h-3.5" />
            {negativeDays} días en rojo
          </div>
        )}
      </div>

      {isMounted ? (
        <div style={{ height: '300px', minHeight: '250px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={NEON_PURPLE} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={NEON_PURPLE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" vertical={false} stroke={GRID_COLOR} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: AXIS_COLOR, fontFamily: "'Inter', sans-serif" }}
                interval={3}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: AXIS_COLOR, fontFamily: "'Inter', sans-serif" }}
                tickFormatter={(v) => `S/${(v/1000).toFixed(0)}k`}
                dx={-5}
                width={48}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                itemStyle={TOOLTIP_ITEM}
                labelStyle={TOOLTIP_LABEL}
                cursor={{ stroke: 'rgba(192,132,252,0.3)', strokeWidth: 1, strokeDasharray: '4 4' }}
                formatter={(value: number) => [formatMoney(value), 'Saldo']}
                labelFormatter={(label) => `Día ${label}`}
              />
              <ReferenceLine y={0} stroke="rgba(251,113,133,0.4)" strokeDasharray="4 4" />
              <Area
                type="monotone"
                dataKey="balance"
                stroke={NEON_PURPLE}
                strokeWidth={2.5}
                fill="url(#gradBalance)"
                dot={false}
                activeDot={{ r: 5, fill: NEON_PURPLE, stroke: '#1A1826', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{ height: '300px', background: 'rgba(139,92,246,0.05)', borderRadius: '12px' }} className="animate-pulse" />
      )}
    </div>
  );
}
