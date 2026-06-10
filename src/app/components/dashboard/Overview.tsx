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
import type { FleetDataset } from "../../types/fleet";
import { FleetDecisionAssistant } from "../fleet/FleetDecisionAssistant";
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
import { formatAxisThousandsPEN, formatCurrencyEs, formatNumberEs } from "../../utils/numberFormat";
import { useDashboardChartTheme } from "../../utils/dashboardChartTheme";

interface OverviewProps {
  transactions?: Transaction[];
  alerts?: SystemAlert[];
  onOpenAlerts?: () => void;
  fleetDataset?: FleetDataset;
  onOpenFleet?: () => void;
}

export function Overview({
  transactions = [],
  alerts = [],
  onOpenAlerts,
  fleetDataset,
  onOpenFleet,
}: OverviewProps) {
  const chartTheme = useDashboardChartTheme();
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

  const formatMoney = (val: number) => formatCurrencyEs(val, 0);
  const formatPercent = (val: number) => `${val > 0 ? '+' : ''}${formatNumberEs(val, 1)}%`;
  const activeAlerts = useMemo(() => alerts.filter(a => !a.read).slice(0, 3), [alerts]);
  const unreadCount = alerts.filter(a => !a.read).length;

  if (!isMounted) {
    return (
      <div
        className="w-full h-[400px] animate-pulse rounded-xl"
        style={{
          background: chartTheme.isDark ? 'rgba(139,92,246,0.05)' : 'rgba(203,213,225,0.5)',
        }}
      />
    );
  }

  const positiveBadgeBg = chartTheme.isDark ? 'rgba(52,211,153,0.1)' : 'rgba(5,150,105,0.1)';
  const positiveBadgeBorder = chartTheme.isDark ? 'rgba(52,211,153,0.25)' : 'rgba(5,150,105,0.28)';
  const negativeBadgeBg = chartTheme.isDark ? 'rgba(251,113,133,0.1)' : 'rgba(220,38,38,0.1)';
  const negativeBadgeBorder = chartTheme.isDark ? 'rgba(251,113,133,0.25)' : 'rgba(220,38,38,0.28)';

  // KPI card factory
  const KpiCard = ({
    label, value, badge, badgePositive, icon: Icon, gradient, accentColor
  }: {
    label: string; value: string; badge?: string; badgePositive?: boolean;
    icon: any; gradient: string; accentColor: string;
  }) => (
    <div className="relative overflow-hidden rounded-2xl p-5 group cursor-default"
      style={{
        background: chartTheme.card.background,
        border: chartTheme.card.border,
        boxShadow: chartTheme.card.boxShadow,
        transition: 'transform 300ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 300ms ease, border-color 300ms ease',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
        (e.currentTarget as HTMLElement).style.boxShadow = chartTheme.isDark
          ? `0 12px 40px rgba(0,0,0,0.5), 0 0 20px ${accentColor}22`
          : chartTheme.card.hoverShadow;
        (e.currentTarget as HTMLElement).style.borderColor = chartTheme.isDark
          ? `${accentColor}30`
          : chartTheme.card.hoverBorder;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLElement).style.boxShadow = chartTheme.card.boxShadow;
        (e.currentTarget as HTMLElement).style.borderColor = chartTheme.isDark
          ? 'rgba(255,255,255,0.06)'
          : '#CBD5E1';
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
                background: badgePositive ? positiveBadgeBg : negativeBadgeBg,
                border: `1px solid ${badgePositive ? positiveBadgeBorder : negativeBadgeBorder}`,
                color: badgePositive ? chartTheme.INCOME : chartTheme.EXPENSE,
                fontSize: '11px', fontWeight: '700'
              }}
            >
              {badgePositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {badge}
            </div>
          )}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: chartTheme.labelMuted, letterSpacing: '0.12em' }}>{label}</p>
          <p className="text-2xl font-bold tracking-tight" style={{ color: chartTheme.value, fontFamily: "'JetBrains Mono', monospace" }}>{value}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {fleetDataset && (
        <FleetDecisionAssistant dataset={fleetDataset} onOpenFleet={onOpenFleet} />
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Ingresos del Mes"
          value={formatMoney(currentMonthStats.income)}
          badge={formatPercent(currentMonthStats.incomeGrowth)}
          badgePositive={currentMonthStats.incomeGrowth >= 0}
          icon={TrendingUp}
          accentColor={chartTheme.INCOME}
          gradient={`linear-gradient(90deg, ${chartTheme.INCOME}, ${chartTheme.BLUE})`}
        />
        <KpiCard
          label="Gastos del Mes"
          value={formatMoney(currentMonthStats.expense)}
          badge={formatPercent(currentMonthStats.expenseGrowth)}
          badgePositive={currentMonthStats.expenseGrowth <= 0}
          icon={TrendingDown}
          accentColor={chartTheme.EXPENSE}
          gradient={`linear-gradient(90deg, ${chartTheme.EXPENSE}, #f43f5e)`}
        />
        <KpiCard
          label="Utilidad Neta"
          value={formatMoney(currentMonthStats.net)}
          badge={`${formatNumberEs(currentMonthStats.margin, 1)}% Margen`}
          badgePositive={currentMonthStats.net >= 0}
          icon={Wallet}
          accentColor={chartTheme.PROFIT}
          gradient={`linear-gradient(90deg, ${chartTheme.PROFIT}, ${chartTheme.INCOME})`}
        />
        <KpiCard
          label="Proyección Cierre"
          value={formatMoney(currentMonthStats.income * 1.1)}
          badge="+10% Est."
          badgePositive={true}
          icon={Target}
          accentColor={chartTheme.PROJECTION}
          gradient={`linear-gradient(90deg, ${chartTheme.PROJECTION}, ${chartTheme.BLUE})`}
        />
      </div>

      {/* Main Chart + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Main Chart */}
        <div className="lg:col-span-2 rounded-2xl p-5 flex flex-col"
          style={{
            background: chartTheme.card.background,
            border: chartTheme.card.border,
            boxShadow: chartTheme.card.boxShadow,
          }}
        >
          <div className="flex items-center justify-between mb-5 pb-4" style={{ borderBottom: `1px solid ${chartTheme.divider}` }}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-lg" style={{ background: `${chartTheme.INCOME}18`, border: `1px solid ${chartTheme.INCOME}35` }}>
                  <TrendingUp className="w-4 h-4" style={{ color: chartTheme.INCOME, filter: chartTheme.isDark ? `drop-shadow(0 0 6px ${chartTheme.INCOME}99)` : undefined }} />
                </div>
                <h3 className="font-bold" style={{ color: chartTheme.title }}>Rendimiento Financiero</h3>
              </div>
              <p className="text-xs" style={{ color: chartTheme.subtitle }}>Comparativa mensual de Ingresos · Egresos · Utilidad</p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg" style={{
              background: chartTheme.isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
              border: chartTheme.isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #CBD5E1',
            }}>
              {(['6m', '12m'] as const).map(r => (
                <button key={r}
                  onClick={() => setViewRange(r)}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200"
                  style={{
                    background: viewRange === r ? `${chartTheme.PROFIT}18` : 'transparent',
                    color: viewRange === r ? chartTheme.PROFIT : chartTheme.subtitle,
                    border: viewRange === r ? `1px solid ${chartTheme.PROFIT}40` : '1px solid transparent',
                  }}
                >{r === '6m' ? '6 Meses' : '12 Meses'}</button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5 mb-4">
            {[
              { color: chartTheme.INCOME, label: 'Ingresos' },
              { color: chartTheme.EXPENSE, label: 'Egresos' },
              { color: chartTheme.PROFIT, label: 'Utilidad Neta' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: color, boxShadow: chartTheme.isDark ? `0 0 6px ${color}80` : undefined }} />
                <span className="text-xs font-medium" style={{ color: chartTheme.secondaryLabel }}>{label}</span>
              </div>
            ))}
          </div>

          <div className="flex-1" style={{ height: '320px', minHeight: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradientNeto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartTheme.PROFIT} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={chartTheme.PROFIT} stopOpacity={0} />
                  </linearGradient>
                  <filter id="barGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 6" vertical={false} stroke={chartTheme.gridStroke} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: chartTheme.axisTick, fontFamily: "'Inter', sans-serif" }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: chartTheme.axisTick, fontFamily: "'Inter', sans-serif" }}
                  tickFormatter={(v) => formatAxisThousandsPEN(v)}
                  dx={-5}
                  width={52}
                />
                <Tooltip
                  contentStyle={chartTheme.tooltipStyle}
                  itemStyle={chartTheme.tooltipItemStyle}
                  labelStyle={chartTheme.tooltipLabelStyle}
                  cursor={{ fill: chartTheme.cursorFill, stroke: chartTheme.isDark ? 'rgba(139,92,246,0.2)' : 'rgba(79,70,229,0.2)', strokeWidth: 1 }}
                  formatter={(value: number, name: string) => [
                    formatMoney(value),
                    name === 'ingresos' ? 'Ingresos' : name === 'egresos' ? 'Egresos' : 'Utilidad Neta'
                  ]}
                  labelFormatter={(label) => label}
                />
                <Bar dataKey="ingresos" fill={chartTheme.INCOME} radius={[4, 4, 0, 0]} barSize={16} opacity={0.9} />
                <Bar dataKey="egresos" fill={chartTheme.EXPENSE} radius={[4, 4, 0, 0]} barSize={16} opacity={0.9} />
                <Area
                  type="monotone"
                  dataKey="neto"
                  stroke={chartTheme.PROFIT}
                  strokeWidth={2.5}
                  fill="url(#gradientNeto)"
                  dot={false}
                  activeDot={{ r: 5, fill: chartTheme.PROFIT, stroke: chartTheme.activeDotStroke, strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          
          {/* Pie Chart Card */}
          <div className="rounded-2xl p-4" style={{
            background: chartTheme.card.background,
            border: chartTheme.card.border,
            boxShadow: chartTheme.card.boxShadow,
          }}>
            <div className="flex items-center gap-2 mb-3 pb-3" style={{ borderBottom: `1px solid ${chartTheme.divider}` }}>
              <div className="p-1.5 rounded-lg" style={{ background: `${chartTheme.EXPENSE}15`, border: `1px solid ${chartTheme.EXPENSE}30` }}>
                <PieIcon className="w-4 h-4" style={{ color: chartTheme.EXPENSE }} />
              </div>
              <div>
                <h4 className="text-sm font-bold" style={{ color: chartTheme.title }}>Top Gastos</h4>
                <p className="text-xs" style={{ color: chartTheme.subtitle }}>Este mes</p>
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
                      <Cell key={`cell-${index}`} fill={chartTheme.chartColors[index % chartTheme.chartColors.length]} opacity={0.92} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [formatMoney(val), 'Total']}
                    contentStyle={chartTheme.tooltipStyle}
                    itemStyle={chartTheme.tooltipItemStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold" style={{ color: chartTheme.value, fontFamily: "'JetBrains Mono', monospace" }}>{categoryData.length}</span>
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: chartTheme.subtitle }}>categ.</span>
              </div>
            </div>
            
            <div className="mt-3 space-y-2">
              {categoryData.slice(0, 4).map((cat, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg group"
                  style={{
                    background: chartTheme.isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                    border: chartTheme.isDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid #E2E8F0',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: chartTheme.chartColors[i % chartTheme.chartColors.length] }} />
                    <span className="text-xs truncate max-w-[100px]" style={{ color: chartTheme.secondaryLabel }} title={cat.name}>{cat.name}</span>
                  </div>
                  <span className="text-xs font-bold font-mono" style={{ color: chartTheme.value }}>{formatMoney(cat.value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts Widget */}
          <div className="rounded-2xl p-4" style={{
            background: chartTheme.card.background,
            border: activeAlerts.length > 0
              ? `1px solid ${chartTheme.isDark ? 'rgba(251,191,36,0.2)' : 'rgba(217,119,6,0.35)'}`
              : `1px solid ${chartTheme.isDark ? 'rgba(52,211,153,0.15)' : 'rgba(5,150,105,0.3)'}`,
            boxShadow: chartTheme.card.boxShadow,
          }}>
            <div className="flex items-center gap-2 mb-3 pb-3" style={{ borderBottom: `1px solid ${chartTheme.divider}` }}>
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
                <h4 className="text-sm font-bold" style={{ color: activeAlerts.length > 0 ? chartTheme.WARNING : chartTheme.INCOME }}>
                  {activeAlerts.length > 0 ? `Alertas (${unreadCount})` : 'Sistema OK'}
                </h4>
                <p className="text-xs" style={{ color: chartTheme.subtitle }}>
                  {activeAlerts.length > 0 ? 'Requieren atención' : 'Sin anomalías'}
                </p>
              </div>
            </div>
            
            {activeAlerts.length > 0 ? (
              <ul className="space-y-2 mb-3">
                {activeAlerts.map(alert => (
                  <li key={alert.id} className="flex items-start gap-2.5 p-2.5 rounded-xl"
                    style={{
                      background: chartTheme.isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                      border: chartTheme.isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #E2E8F0',
                    }}
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
                    <span className="text-xs font-medium line-clamp-2" style={{ color: chartTheme.isDark ? '#C4BCEC' : '#334155' }}>{alert.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-5 text-center">
                <CheckCircle2 className="w-10 h-10 mb-2" style={{ color: 'rgba(52,211,153,0.25)' }} />
                <p className="text-xs font-medium" style={{ color: chartTheme.INCOME }}>Todo bajo control</p>
              </div>
            )}
            
            <button
              onClick={onOpenAlerts}
              className="w-full py-2 rounded-xl text-xs font-bold transition-all duration-200"
              style={{
                background: activeAlerts.length > 0
                  ? (chartTheme.isDark ? 'rgba(251,191,36,0.08)' : 'rgba(217,119,6,0.1)')
                  : (chartTheme.isDark ? 'rgba(52,211,153,0.08)' : 'rgba(5,150,105,0.1)'),
                border: `1px solid ${activeAlerts.length > 0
                  ? (chartTheme.isDark ? 'rgba(251,191,36,0.2)' : 'rgba(217,119,6,0.28)')
                  : (chartTheme.isDark ? 'rgba(52,211,153,0.2)' : 'rgba(5,150,105,0.28)')}`,
                color: activeAlerts.length > 0 ? chartTheme.WARNING : chartTheme.INCOME,
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
