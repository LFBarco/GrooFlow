import { useState, useEffect, useMemo } from 'react';
import { Transaction } from '../../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { Brain, TrendingUp, TrendingDown, AlertCircle, Target, Wallet } from 'lucide-react';
import { format, subMonths, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  formatCurrencyEs,
  formatNumberEs,
  formatPercentEs,
  formatAxisThousandsPEN,
} from '../../utils/numberFormat';
import { useDashboardChartTheme } from '../../utils/dashboardChartTheme';
import type { KpiSurfaceKind } from '../../utils/moduleSurfaces';

interface AnalyticsDashboardProps {
  transactions: Transaction[];
  /** Sedes habilitadas visibles para el usuario; si `seesAllSedesCatalog`, se ignoran. */
  visibleSedes?: string[];
  /** true = super_admin / todas las sedes: sin filtrar por sede. */
  seesAllSedesCatalog?: boolean;
}

export function AnalyticsDashboard({
  transactions,
  visibleSedes = [],
  seesAllSedesCatalog = true,
}: AnalyticsDashboardProps) {
  const chartTheme = useDashboardChartTheme();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const NeonCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div
      className={`rounded-2xl p-5 ${chartTheme.isDark ? '' : 'gf-glass-card light-chart-panel'} ${className}`}
      style={{
        background: chartTheme.chartCard.background,
        border: chartTheme.chartCard.border,
        boxShadow: chartTheme.chartCard.boxShadow,
      }}
    >
      {children}
    </div>
  );

  const CardHeader = ({
    icon: Icon,
    iconColor,
    title,
    subtitle,
  }: {
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    iconColor: string;
    title: string;
    subtitle?: string;
  }) => (
    <div className="flex items-center gap-2.5 mb-4 pb-4" style={{ borderBottom: `1px solid ${chartTheme.divider}` }}>
      <div
        className="p-2 rounded-xl shrink-0"
        style={{ background: `${iconColor}18`, border: `1px solid ${iconColor}30` }}
      >
        <Icon
          className="w-4 h-4"
          style={{
            color: iconColor,
            filter: chartTheme.isDark ? `drop-shadow(0 0 6px ${iconColor}80)` : undefined,
          }}
        />
      </div>
      <div>
        <h3 className="font-bold text-sm" style={{ color: chartTheme.title }}>{title}</h3>
        {subtitle && <p className="text-xs" style={{ color: chartTheme.subtitle }}>{subtitle}</p>}
      </div>
    </div>
  );

  const scopedTransactions = useMemo(() => {
    if (seesAllSedesCatalog) return transactions;
    if (!visibleSedes.length) return [];
    return transactions.filter((t) => {
      const loc = (t.location || 'Principal').trim();
      return visibleSedes.includes(loc);
    });
  }, [transactions, visibleSedes, seesAllSedesCatalog]);

  const categoryData = useMemo(() => {
    const expenses = scopedTransactions.filter(t => t.type === 'expense');
    const grouped = expenses.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(grouped).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [scopedTransactions]);

  const monthlyTrend = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(new Date(), 5 - i);
      const monthTxs = scopedTransactions.filter(t => isSameMonth(new Date(t.date), date));
      const income = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      return { name: format(date, 'MMM', { locale: es }), ingresos: income, egresos: expense, neto: income - expense };
    });
  }, [scopedTransactions]);

  const currentMonth = new Date();
  const prevMonth = subMonths(currentMonth, 1);
  const currentMonthTxs = scopedTransactions.filter(t => isSameMonth(new Date(t.date), currentMonth));
  const prevMonthTxs = scopedTransactions.filter(t => isSameMonth(new Date(t.date), prevMonth));
  const calcTotal = (txs: Transaction[], type: 'income' | 'expense') =>
    txs.filter(t => t.type === type).reduce((s, t) => s + t.amount, 0);

  const currIncome = calcTotal(currentMonthTxs, 'income');
  const prevIncome = calcTotal(prevMonthTxs, 'income');
  const currExpense = calcTotal(currentMonthTxs, 'expense');
  const incomeGrowth = prevIncome > 0 ? ((currIncome - prevIncome) / prevIncome) * 100 : 0;
  const burnRate = categoryData.reduce((s, i) => s + i.value, 0) / 6;
  const healthScore = currIncome > 0 ? Math.max(0, Math.min(100, ((currIncome - currExpense) / currIncome) * 100)) : 0;

  const aiInsights = useMemo(() => {
    const insights: Array<{ type: string; title: string; message: string; icon: typeof AlertCircle; color: string; glow: string }> = [];
    if (currExpense > currIncome) {
      insights.push({
        type: 'warning',
        title: 'Alerta de Flujo',
        icon: AlertCircle,
        color: chartTheme.EXPENSE,
        glow: chartTheme.EXPENSE,
        message: `Egresos superan ingresos por ${formatCurrencyEs(currExpense - currIncome)}.`,
      });
    }
    if (incomeGrowth > 10) {
      insights.push({
        type: 'positive',
        title: 'Crecimiento Sólido',
        icon: TrendingUp,
        color: chartTheme.INCOME,
        glow: chartTheme.INCOME,
        message: `Ingresos crecieron ${formatNumberEs(incomeGrowth, 1)}% respecto al mes anterior.`,
      });
    }
    if (categoryData.length > 0) {
      const topCat = categoryData[0];
      const totalExp = categoryData.reduce((a, b) => a + b.value, 0);
      const percent = (topCat.value / totalExp) * 100;
      if (percent > 40) {
        insights.push({
          type: 'neutral',
          title: 'Concentración de Gastos',
          icon: Target,
          color: chartTheme.PROJECTION,
          glow: chartTheme.PROJECTION,
          message: `${formatNumberEs(percent, 0)}% de gastos en "${topCat.name}". Considera negociar con proveedores.`,
        });
      }
    }
    if (insights.length === 0) {
      insights.push({
        type: 'neutral',
        title: 'Estabilidad Detectada',
        icon: Brain,
        color: chartTheme.PROFIT,
        glow: chartTheme.PROFIT,
        message: 'Finanzas con comportamiento estable. Sin anomalías detectadas.',
      });
    }
    return insights;
  }, [currExpense, currIncome, incomeGrowth, categoryData, chartTheme]);

  const formatMoney = (val: number) => formatCurrencyEs(val);

  const kpiCards: Array<{
    kind: KpiSurfaceKind;
    label: string;
    value: string;
    sub: string;
    subColor: string;
    icon: typeof TrendingUp;
    accent: string;
  }> = [
    { kind: 'income', label: 'Ingreso Mensual', value: formatMoney(currIncome), sub: `${incomeGrowth >= 0 ? '+' : ''}${formatNumberEs(incomeGrowth, 1)}% vs mes ant.`, subColor: incomeGrowth >= 0 ? chartTheme.INCOME : chartTheme.EXPENSE, icon: TrendingUp, accent: chartTheme.INCOME },
    { kind: 'expense', label: 'Gasto Mensual', value: formatMoney(currExpense), sub: `Burn rate: ${formatMoney(burnRate)}/mes`, subColor: chartTheme.subtitle, icon: TrendingDown, accent: chartTheme.EXPENSE },
    { kind: 'profit', label: 'Margen Operativo', value: `${currIncome > 0 ? formatPercentEs(((currIncome - currExpense) / currIncome) * 100, 1) : '0%'}`, sub: 'Objetivo ideal: > 20%', subColor: chartTheme.subtitle, icon: Wallet, accent: chartTheme.PROFIT },
    { kind: 'projection', label: 'Proyección Fin Mes', value: formatMoney(currIncome * 1.1), sub: 'Basado en tendencia', subColor: chartTheme.subtitle, icon: Brain, accent: chartTheme.PROJECTION },
  ];

  return (
    <div className="space-y-6">
      {!seesAllSedesCatalog && visibleSedes.length > 0 && (
        <p className="text-xs mb-2" style={{ color: chartTheme.isDark ? '#22d3ee' : '#0891b2' }}>
          Alcance: sedes asignadas ({visibleSedes.join(', ')}).
        </p>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, i) => {
          const kpi = chartTheme.kpi[card.kind];
          return (
          <div key={i} className={`rounded-2xl p-5 group cursor-default relative overflow-hidden ${kpi.className ?? ''}`}
            style={{
              background: kpi.background,
              border: kpi.border,
              boxShadow: kpi.boxShadow,
              transition: 'transform 300ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 300ms ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-6px) scale(1.01)';
              (e.currentTarget as HTMLElement).style.boxShadow = kpi.hoverShadow;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)';
              (e.currentTarget as HTMLElement).style.boxShadow = kpi.boxShadow;
            }}
          >
            <div className="absolute top-2 right-2 opacity-[0.1]">
              <card.icon className="w-16 h-16" style={{ color: kpi.accent }} />
            </div>
            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className="p-2 rounded-xl" style={{ background: kpi.iconBg, border: `1px solid ${kpi.iconBorder}` }}>
                <card.icon className="w-4 h-4" style={{ color: kpi.accent, filter: chartTheme.isDark ? `drop-shadow(0 0 5px ${card.accent}70)` : undefined }} />
              </div>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider mb-1 relative z-10" style={{ color: kpi.labelColor, letterSpacing: '0.1em' }}>{card.label}</p>
            <p className="text-xl font-bold mb-1 relative z-10" style={{ color: kpi.valueColor, fontFamily: "'JetBrains Mono', monospace" }}>{card.value}</p>
            <p className="text-xs relative z-10" style={{ color: card.subColor }}>{card.sub}</p>
          </div>
          );
        })}
      </div>

      {/* Charts + AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left: Charts */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* Area Chart */}
          <NeonCard>
            <CardHeader icon={TrendingUp} iconColor={chartTheme.INCOME} title="Tendencia de Flujo de Caja (6M)" subtitle="Comparativa histórica ingresos vs egresos" />
            {isMounted ? (
              <div style={{ height: '260px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartTheme.INCOME} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={chartTheme.INCOME} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="areaExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartTheme.EXPENSE} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={chartTheme.EXPENSE} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" vertical={false} stroke={chartTheme.gridStroke} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false}
                      tick={{ fontSize: 11, fill: chartTheme.axisTick }} dy={8} />
                    <YAxis axisLine={false} tickLine={false}
                      tick={{ fontSize: 10, fill: chartTheme.axisTick }}
                      tickFormatter={(v) => formatAxisThousandsPEN(v)} dx={-5} width={48} />
                    <Tooltip contentStyle={chartTheme.tooltipStyle} itemStyle={chartTheme.tooltipItemStyle}
                      formatter={(v: number) => formatMoney(v)}
                      cursor={{ stroke: chartTheme.isDark ? 'rgba(139,92,246,0.3)' : 'rgba(79,70,229,0.25)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                    <Area type="monotone" dataKey="ingresos" stroke={chartTheme.INCOME} strokeWidth={2}
                      fill="url(#areaIncome)" dot={false} activeDot={{ r: 4, fill: chartTheme.INCOME, stroke: chartTheme.activeDotStroke, strokeWidth: 2 }} />
                    <Area type="monotone" dataKey="egresos" stroke={chartTheme.EXPENSE} strokeWidth={2}
                      fill="url(#areaExpense)" dot={false} activeDot={{ r: 4, fill: chartTheme.EXPENSE, stroke: chartTheme.activeDotStroke, strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : <div style={{ height: '260px', background: chartTheme.isDark ? 'rgba(139,92,246,0.05)' : 'rgba(203,213,225,0.45)', borderRadius: '12px' }} className="animate-pulse" />}
            <div className="flex items-center gap-4 mt-3">
              {[{ c: chartTheme.INCOME, l: 'Ingresos' }, { c: chartTheme.EXPENSE, l: 'Egresos' }].map(({ c, l }) => (
                <div key={l} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-0.5 rounded" style={{ background: c, boxShadow: `0 0 4px ${c}80` }} />
                  <span className="text-xs" style={{ color: chartTheme.axisTick }}>{l}</span>
                </div>
              ))}
            </div>
          </NeonCard>

          {/* Bar + Pie Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Pie */}
            <NeonCard>
              <CardHeader icon={Target} iconColor={chartTheme.AMBER} title="Distribución de Gastos" subtitle="Por categoría histórica" />
              {isMounted ? (
                <div style={{ height: '200px', position: 'relative' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryData.length ? categoryData : [{ name: 'N/A', value: 1 }]}
                        cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={4}
                        dataKey="value" stroke="none">
                        {(categoryData.length ? categoryData : [{ name: 'N/A', value: 1 }]).map((_, i) => (
                          <Cell key={i} fill={chartTheme.chartColors[i % chartTheme.chartColors.length]} opacity={0.92} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={chartTheme.tooltipStyle} itemStyle={chartTheme.tooltipItemStyle}
                        formatter={(v: number) => [formatMoney(v), 'Gasto']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <div style={{ height: '200px', background: 'rgba(139,92,246,0.05)', borderRadius: '12px' }} className="animate-pulse" />}
              <div className="flex flex-wrap gap-2 mt-2">
                {categoryData.slice(0, 4).map((e, i) => (
                  <div key={e.name} className="flex items-center gap-1 text-xs" style={{ color: chartTheme.axisTick }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: chartTheme.chartColors[i % chartTheme.chartColors.length] }} />
                    <span className="truncate max-w-[70px]">{e.name}</span>
                  </div>
                ))}
              </div>
            </NeonCard>

            {/* Health Score */}
            <NeonCard>
              <CardHeader icon={Wallet} iconColor={chartTheme.PROFIT} title="Salud Financiera" subtitle="Ratio de eficiencia operativa" />
              <div className="flex flex-col items-center justify-center py-4 space-y-3">
                <div className="relative w-28 h-28">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke={chartTheme.isDark ? 'rgba(139,92,246,0.15)' : '#E2E8F0'} strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none"
                      stroke={healthScore > 50 ? chartTheme.PROFIT : healthScore > 20 ? chartTheme.AMBER : chartTheme.EXPENSE}
                      strokeWidth="3" strokeLinecap="round"
                      strokeDasharray={`${Math.min(healthScore, 100)}, 100`}
                      style={{ filter: `drop-shadow(0 0 4px ${healthScore > 50 ? chartTheme.PROFIT : healthScore > 20 ? chartTheme.AMBER : chartTheme.EXPENSE}80)` }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold" style={{ color: chartTheme.value, fontFamily: "'JetBrains Mono', monospace" }}>{formatPercentEs(healthScore, 0)}</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: chartTheme.axisTick }}>Score</span>
                  </div>
                </div>
                <p className="text-xs text-center leading-relaxed px-2" style={{ color: chartTheme.axisTick }}>
                  Por cada S/100 ingresados, quedan{' '}
                  <span className="font-bold" style={{ color: chartTheme.value }}>
                    {formatCurrencyEs(currIncome > 0 ? (100 * (currIncome - currExpense)) / currIncome : 0)}
                  </span>{' '}
                  de ganancia neta.
                </p>
              </div>
            </NeonCard>
          </div>
        </div>

        {/* Right: AI Insights */}
        <NeonCard className="flex flex-col">
          <CardHeader icon={Brain} iconColor={chartTheme.PURPLE} title="GrooFlow AI Insights" subtitle="Análisis automático de movimientos" />
          <div className="space-y-3 flex-1">
            {aiInsights.map((insight, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-xl"
                style={{
                  background: `${insight.glow}08`,
                  border: `1px solid ${insight.glow}18`,
                  animationDelay: `${i * 100}ms`
                }}
              >
                <div className="p-2 rounded-lg h-fit shrink-0" style={{
                  background: `${insight.glow}15`,
                  border: `1px solid ${insight.glow}25`,
                }}>
                  <insight.icon className="w-3.5 h-3.5" style={{ color: insight.color, filter: `drop-shadow(0 0 4px ${insight.color}80)` }} />
                </div>
                <div>
                  <h4 className="font-bold text-xs mb-1" style={{ color: insight.color }}>{insight.title}</h4>
                  <p className="text-xs leading-relaxed" style={{ color: chartTheme.secondaryLabel }}>{insight.message}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${chartTheme.divider}` }}>
            <h4 className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: chartTheme.labelMuted, letterSpacing: '0.15em' }}>Recomendaciones</h4>
            <ul className="space-y-2">
              {[
                { dot: chartTheme.PROFIT, text: 'Revisar contratos con proveedores de Servicios Básicos.' },
                { dot: chartTheme.AMBER, text: 'Programar pagos de alquiler antes del día 5.' },
                { dot: chartTheme.INCOME, text: 'Incentivar pagos efectivo para reducir comisiones POS.' },
              ].map(({ dot, text }, i) => (
                <li key={i} className="flex items-start gap-2 text-xs" style={{ color: chartTheme.subtitle }}>
                  <div className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ background: dot, boxShadow: `0 0 4px ${dot}80` }} />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </NeonCard>
      </div>
    </div>
  );
}
