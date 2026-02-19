import { useState, useEffect, useMemo } from "react";
import { 
    Bar, 
    BarChart, 
    ResponsiveContainer, 
    XAxis, 
    YAxis, 
    Tooltip, 
    Legend, 
    Area, 
    ComposedChart, 
    CartesianGrid,
    PieChart, 
    Pie, 
    Cell,
} from "recharts";
import { Transaction, SystemAlert } from "../../types";
import { format, subMonths, isSameMonth } from "date-fns";
import { es } from "date-fns/locale";
import { 
    TrendingUp, 
    TrendingDown, 
    Wallet, 
    Target, 
    AlertTriangle,
    PieChart as PieIcon,
    CheckCircle2,
    ArrowUpRight,
    ArrowDownRight,
    Activity,
    DollarSign
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";

// ─── GLOBAL NEON PALETTE ───────────────────────────────────────────────────
// These are THE canonical hardcoded colors for all charts in the system.
// Using hex directly because CSS vars don't always resolve inside Recharts SVG.
const NEON = {
  INCOME:   '#22d3ee',  // Cyan     — Ingresos
  EXPENSE:  '#fb7185',  // Rose     — Egresos
  PROFIT:   '#34d399',  // Emerald  — Utilidad
  WARNING:  '#fbbf24',  // Amber    — Alertas
  PURPLE:   '#c084fc',  // Violet   — Analytics
  BLUE:     '#818cf8',  // Indigo   — Secondary
} as const;

const CHART_COLORS = [NEON.INCOME, NEON.PROFIT, NEON.WARNING, NEON.EXPENSE, NEON.PURPLE];

// Chart Styling Constants
const AXIS_TICK_COLOR = '#6b5fa5';
const GRID_STROKE = 'rgba(139,92,246,0.12)';
const TOOLTIP_STYLE = {
  backgroundColor: '#22203A',
  borderColor: '#3D3B5C',
  borderRadius: '12px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  padding: '12px 16px',
  border: '1px solid #3D3B5C',
};
const TOOLTIP_ITEM_STYLE = { color: '#E4E0FF', fontSize: '12px' };
const TOOLTIP_LABEL_STYLE = { color: '#8b7cf8', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '0.08em' };

interface OverviewProps {
  transactions?: Transaction[];
  alerts?: SystemAlert[];
  onOpenAlerts?: () => void;
}

export function Overview({ transactions = [], alerts = [], onOpenAlerts }: OverviewProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [viewRange, setViewRange] = useState<'6m' | '12m'>('6m');

  useEffect(() => { setIsMounted(true); }, []);

  // --- DATA PROCESSING ---
  const currentMonthStats = useMemo(() => {
    const now = new Date();
    const currentMonthTxs = transactions.filter(t => isSameMonth(new Date(t.date), now));
    const lastMonthTxs = transactions.filter(t => isSameMonth(new Date(t.date), subMonths(now, 1)));

    const calcTotal = (txs: Transaction[], type: 'income' | 'expense') =>
        txs.filter(t => t.type === type).reduce((sum, t) => sum + t.amount, 0);

    const income = calcTotal(currentMonthTxs, 'income');
    const expense = calcTotal(currentMonthTxs, 'expense');
    const lastIncome = calcTotal(lastMonthTxs, 'income');
    const lastExpense = calcTotal(lastMonthTxs, 'expense');

    return {
        income, expense,
        net: income - expense,
        incomeGrowth: lastIncome > 0 ? ((income - lastIncome) / lastIncome) * 100 : 0,
        expenseGrowth: lastExpense > 0 ? ((expense - lastExpense) / lastExpense) * 100 : 0,
        margin: income > 0 ? ((income - expense) / income) * 100 : 0
    };
  }, [transactions]);

  const chartData = useMemo(() => {
    const months = viewRange === '6m' ? 6 : 12;
    const now = new Date();
    return Array.from({ length: months }, (_, i) => {
        const d = subMonths(now, months - 1 - i);
        const monthTxs = transactions.filter(t => isSameMonth(new Date(t.date), d));
        const income = monthTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
        const expense = monthTxs.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
        return {
            name: format(d, 'MMM', { locale: es }),
            fullDate: format(d, 'MMMM yyyy', { locale: es }),
            ingresos: income,
            egresos: expense,
            neto: income - expense,
            margin: income > 0 ? (income - expense) / income : 0
        };
    });
  }, [transactions, viewRange]);

  const categoryData = useMemo(() => {
    const now = new Date();
    const currentMonthExpenses = transactions.filter(t =>
        t.type === 'expense' && isSameMonth(new Date(t.date), now)
    );
    const grouped = currentMonthExpenses.reduce((acc, curr) => {
        acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
        return acc;
    }, {} as Record<string, number>);
    return Object.entries(grouped)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
  }, [transactions]);

  const formatMoney = (val: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(val);
  const formatPercent = (val: number) => `${val > 0 ? '+' : ''}${val.toFixed(1)}%`;
  const activeAlerts = useMemo(() => alerts.filter(a => !a.read).slice(0, 3), [alerts]);
  const unreadCount = alerts.filter(a => !a.read).length;

  if (!isMounted) {
    return <div className="w-full h-[400px] animate-pulse rounded-xl" style={{ background: 'rgba(139,92,246,0.05)' }} />;
  }

  // KPI card factory
  const KpiCard = ({
    label, value, badge, badgePositive, icon: Icon, color, gradient, accentColor
  }: {
    label: string; value: string; badge?: string; badgePositive?: boolean;
    icon: any; color: string; gradient: string; accentColor: string;
  }) => (
    <div className="relative overflow-hidden rounded-2xl p-5 group cursor-default"
      style={{
        background: 'linear-gradient(145deg, #1A1826 0%, #161424 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        transition: 'transform 300ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 300ms ease, border-color 300ms ease',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
        (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 40px rgba(0,0,0,0.5), 0 0 20px ${accentColor}22`;
        (e.currentTarget as HTMLElement).style.borderColor = `${accentColor}30`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(0,0,0,0.4)';
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
      }}
    >
      {/* Background icon watermark */}
      <div className="absolute top-2 right-2 opacity-[0.04]">
        <Icon className="w-20 h-20" style={{ color: accentColor }} />
      </div>
      {/* Bottom accent bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: gradient }} />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="p-2.5 rounded-xl" style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}25` }}>
            <Icon className="w-5 h-5" style={{ color: accentColor, filter: `drop-shadow(0 0 6px ${accentColor}80)` }} />
          </div>
          {badge && (
            <div className="px-2.5 py-1 rounded-full flex items-center gap-1"
              style={{
                background: badgePositive ? 'rgba(52,211,153,0.1)' : 'rgba(251,113,133,0.1)',
                border: `1px solid ${badgePositive ? 'rgba(52,211,153,0.25)' : 'rgba(251,113,133,0.25)'}`,
                color: badgePositive ? '#34d399' : '#fb7185',
                fontSize: '11px', fontWeight: '700'
              }}
            >
              {badgePositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {badge}
            </div>
          )}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em' }}>{label}</p>
          <p className="text-2xl font-bold tracking-tight" style={{ color: '#F0EEFF', fontFamily: "'JetBrains Mono', monospace" }}>{value}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
        
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Ingresos del Mes"
          value={formatMoney(currentMonthStats.income)}
          badge={formatPercent(currentMonthStats.incomeGrowth)}
          badgePositive={currentMonthStats.incomeGrowth >= 0}
          icon={TrendingUp}
          color={NEON.INCOME}
          accentColor={NEON.INCOME}
          gradient={`linear-gradient(90deg, ${NEON.INCOME}, #818cf8)`}
        />
        <KpiCard
          label="Gastos del Mes"
          value={formatMoney(currentMonthStats.expense)}
          badge={formatPercent(currentMonthStats.expenseGrowth)}
          badgePositive={currentMonthStats.expenseGrowth <= 0}
          icon={TrendingDown}
          color={NEON.EXPENSE}
          accentColor={NEON.EXPENSE}
          gradient={`linear-gradient(90deg, ${NEON.EXPENSE}, #f43f5e)`}
        />
        <KpiCard
          label="Utilidad Neta"
          value={formatMoney(currentMonthStats.net)}
          badge={`${currentMonthStats.margin.toFixed(1)}% Margen`}
          badgePositive={currentMonthStats.net >= 0}
          icon={Wallet}
          color={NEON.PROFIT}
          accentColor={NEON.PROFIT}
          gradient={`linear-gradient(90deg, ${NEON.PROFIT}, #10b981)`}
        />
        <KpiCard
          label="Proyección Cierre"
          value={formatMoney(currentMonthStats.income * 1.1)}
          badge="+10% Est."
          badgePositive={true}
          icon={Target}
          color={NEON.PURPLE}
          accentColor={NEON.PURPLE}
          gradient={`linear-gradient(90deg, ${NEON.PURPLE}, #818cf8)`}
        />
      </div>

      {/* Main Chart + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Main Chart */}
        <div className="lg:col-span-2 rounded-2xl p-5 flex flex-col"
          style={{
            background: 'linear-gradient(145deg, #1A1826 0%, #161424 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}
        >
          <div className="flex items-center justify-between mb-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-lg" style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)' }}>
                  <TrendingUp className="w-4 h-4 text-cyan-400" style={{ filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.6))' }} />
                </div>
                <h3 className="font-bold" style={{ color: '#F0EEFF' }}>Rendimiento Financiero</h3>
              </div>
              <p className="text-xs" style={{ color: '#6b5fa5' }}>Comparativa mensual de Ingresos · Egresos · Utilidad</p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {(['6m', '12m'] as const).map(r => (
                <button key={r}
                  onClick={() => setViewRange(r)}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200"
                  style={{
                    background: viewRange === r ? 'rgba(34,211,238,0.15)' : 'transparent',
                    color: viewRange === r ? '#22d3ee' : '#6b5fa5',
                    border: viewRange === r ? '1px solid rgba(34,211,238,0.25)' : '1px solid transparent',
                  }}
                >{r === '6m' ? '6 Meses' : '12 Meses'}</button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5 mb-4">
            {[
              { color: NEON.INCOME, label: 'Ingresos' },
              { color: NEON.EXPENSE, label: 'Egresos' },
              { color: NEON.PROFIT, label: 'Utilidad Neta' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}80` }} />
                <span className="text-xs font-medium" style={{ color: '#8b7cf8' }}>{label}</span>
              </div>
            ))}
          </div>

          <div className="flex-1" style={{ height: '320px', minHeight: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradientNeto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NEON.PROFIT} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={NEON.PROFIT} stopOpacity={0} />
                  </linearGradient>
                  <filter id="barGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 6" vertical={false} stroke={GRID_STROKE} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: AXIS_TICK_COLOR, fontFamily: "'Inter', sans-serif" }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: AXIS_TICK_COLOR, fontFamily: "'Inter', sans-serif" }}
                  tickFormatter={(v) => `S/${(v/1000).toFixed(0)}k`}
                  dx={-5}
                  width={52}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  cursor={{ fill: 'rgba(139,92,246,0.06)', stroke: 'rgba(139,92,246,0.2)', strokeWidth: 1 }}
                  formatter={(value: number, name: string) => [
                    formatMoney(value),
                    name === 'ingresos' ? 'Ingresos' : name === 'egresos' ? 'Egresos' : 'Utilidad Neta'
                  ]}
                  labelFormatter={(label) => label}
                />
                <Bar dataKey="ingresos" fill={NEON.INCOME} radius={[4, 4, 0, 0]} barSize={16} opacity={0.85} />
                <Bar dataKey="egresos" fill={NEON.EXPENSE} radius={[4, 4, 0, 0]} barSize={16} opacity={0.85} />
                <Area
                  type="monotone"
                  dataKey="neto"
                  stroke={NEON.PROFIT}
                  strokeWidth={2.5}
                  fill="url(#gradientNeto)"
                  dot={false}
                  activeDot={{ r: 5, fill: NEON.PROFIT, stroke: '#1A1826', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          
          {/* Pie Chart Card */}
          <div className="rounded-2xl p-4" style={{
            background: 'linear-gradient(145deg, #1A1826 0%, #161424 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}>
            <div className="flex items-center gap-2 mb-3 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="p-1.5 rounded-lg" style={{ background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.2)' }}>
                <PieIcon className="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold" style={{ color: '#F0EEFF' }}>Top Gastos</h4>
                <p className="text-xs" style={{ color: '#6b5fa5' }}>Este mes</p>
              </div>
            </div>
            
            <div style={{ height: '150px', position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData.length ? categoryData : [{ name: 'Sin datos', value: 1 }]}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {(categoryData.length ? categoryData : [{ name: 'Sin datos', value: 1 }]).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} opacity={0.9} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [formatMoney(val), 'Total']}
                    contentStyle={TOOLTIP_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold" style={{ color: '#F0EEFF', fontFamily: "'JetBrains Mono', monospace" }}>{categoryData.length}</span>
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#6b5fa5' }}>categ.</span>
              </div>
            </div>
            
            <div className="mt-3 space-y-2">
              {categoryData.slice(0, 4).map((cat, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg group"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length], boxShadow: `0 0 6px ${CHART_COLORS[i]}60` }} />
                    <span className="text-xs truncate max-w-[100px]" style={{ color: '#8b7cf8' }} title={cat.name}>{cat.name}</span>
                  </div>
                  <span className="text-xs font-bold font-mono" style={{ color: '#F0EEFF' }}>{formatMoney(cat.value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts Widget */}
          <div className="rounded-2xl p-4" style={{
            background: 'linear-gradient(145deg, #1A1826 0%, #161424 100%)',
            border: `1px solid ${activeAlerts.length > 0 ? 'rgba(251,191,36,0.2)' : 'rgba(52,211,153,0.15)'}`,
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}>
            <div className="flex items-center gap-2 mb-3 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="p-1.5 rounded-lg" style={{
                background: activeAlerts.length > 0 ? 'rgba(251,191,36,0.1)' : 'rgba(52,211,153,0.1)',
                border: `1px solid ${activeAlerts.length > 0 ? 'rgba(251,191,36,0.25)' : 'rgba(52,211,153,0.25)'}`
              }}>
                {activeAlerts.length > 0
                  ? <AlertTriangle className="w-4 h-4 text-amber-400" />
                  : <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                }
              </div>
              <div>
                <h4 className="text-sm font-bold" style={{ color: activeAlerts.length > 0 ? '#fbbf24' : '#34d399' }}>
                  {activeAlerts.length > 0 ? `Alertas (${unreadCount})` : 'Sistema OK'}
                </h4>
                <p className="text-xs" style={{ color: '#6b5fa5' }}>
                  {activeAlerts.length > 0 ? 'Requieren atención' : 'Sin anomalías'}
                </p>
              </div>
            </div>
            
            {activeAlerts.length > 0 ? (
              <ul className="space-y-2 mb-3">
                {activeAlerts.map(alert => (
                  <li key={alert.id} className="flex items-start gap-2.5 p-2.5 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                      alert.severity === 'critical' ? 'bg-rose-500' :
                      alert.severity === 'warning' ? 'bg-amber-500' : 'bg-cyan-500'
                    }`} style={{
                      boxShadow: `0 0 8px ${
                        alert.severity === 'critical' ? '#fb7185' :
                        alert.severity === 'warning' ? '#fbbf24' : '#22d3ee'
                      }80`
                    }} />
                    <span className="text-xs font-medium line-clamp-2" style={{ color: '#C4BCEC' }}>{alert.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-5 text-center">
                <CheckCircle2 className="w-10 h-10 mb-2" style={{ color: 'rgba(52,211,153,0.25)' }} />
                <p className="text-xs font-medium" style={{ color: '#34d399' }}>Todo bajo control</p>
              </div>
            )}
            
            <button
              onClick={onOpenAlerts}
              className="w-full py-2 rounded-xl text-xs font-bold transition-all duration-200"
              style={{
                background: activeAlerts.length > 0 ? 'rgba(251,191,36,0.08)' : 'rgba(52,211,153,0.08)',
                border: `1px solid ${activeAlerts.length > 0 ? 'rgba(251,191,36,0.2)' : 'rgba(52,211,153,0.2)'}`,
                color: activeAlerts.length > 0 ? '#fbbf24' : '#34d399',
              }}
            >
              Ver Centro de Alertas →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
