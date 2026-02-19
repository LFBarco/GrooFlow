import { useState, useEffect, useMemo } from 'react';
import { Transaction } from '../../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { Brain, TrendingUp, TrendingDown, AlertCircle, Target, Wallet } from 'lucide-react';
import { format, subMonths, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── NEON PALETTE ──────────────────────────────────────────────────────
const NEON = {
  INCOME:  '#22d3ee',
  EXPENSE: '#fb7185',
  PROFIT:  '#34d399',
  PURPLE:  '#c084fc',
  AMBER:   '#fbbf24',
  BLUE:    '#818cf8',
} as const;
const CHART_COLORS = [NEON.INCOME, NEON.PROFIT, NEON.AMBER, NEON.EXPENSE, NEON.PURPLE];
const AXIS_COLOR = '#6b5fa5';
const GRID_COLOR = 'rgba(139,92,246,0.1)';
const TOOLTIP_STYLE = {
  backgroundColor: '#22203A',
  border: '1px solid #3D3B5C',
  borderRadius: '12px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  padding: '12px 16px',
};
const TOOLTIP_ITEM = { color: '#E4E0FF', fontSize: '12px' };

interface AnalyticsDashboardProps {
  transactions: Transaction[];
}

const NeonCard = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
  <div className={`rounded-2xl p-5 ${className}`} style={{
    background: 'linear-gradient(145deg, #1A1826 0%, #161424 100%)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
  }}>
    {children}
  </div>
);

const CardHeader = ({ icon: Icon, iconColor, title, subtitle }: { icon: any, iconColor: string, title: string, subtitle?: string }) => (
  <div className="flex items-center gap-2.5 mb-4 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
    <div className="p-2 rounded-xl shrink-0" style={{
      background: `${iconColor}18`,
      border: `1px solid ${iconColor}25`,
    }}>
      <Icon className="w-4 h-4" style={{ color: iconColor, filter: `drop-shadow(0 0 6px ${iconColor}80)` }} />
    </div>
    <div>
      <h3 className="font-bold text-sm" style={{ color: '#F0EEFF' }}>{title}</h3>
      {subtitle && <p className="text-xs" style={{ color: '#6b5fa5' }}>{subtitle}</p>}
    </div>
  </div>
);

export function AnalyticsDashboard({ transactions }: AnalyticsDashboardProps) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const categoryData = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense');
    const grouped = expenses.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(grouped).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [transactions]);

  const monthlyTrend = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(new Date(), 5 - i);
      const monthTxs = transactions.filter(t => isSameMonth(new Date(t.date), date));
      const income = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      return { name: format(date, 'MMM', { locale: es }), ingresos: income, egresos: expense, neto: income - expense };
    });
  }, [transactions]);

  const currentMonth = new Date();
  const prevMonth = subMonths(currentMonth, 1);
  const currentMonthTxs = transactions.filter(t => isSameMonth(new Date(t.date), currentMonth));
  const prevMonthTxs = transactions.filter(t => isSameMonth(new Date(t.date), prevMonth));
  const calcTotal = (txs: Transaction[], type: 'income' | 'expense') =>
    txs.filter(t => t.type === type).reduce((s, t) => s + t.amount, 0);

  const currIncome = calcTotal(currentMonthTxs, 'income');
  const prevIncome = calcTotal(prevMonthTxs, 'income');
  const currExpense = calcTotal(currentMonthTxs, 'expense');
  const incomeGrowth = prevIncome > 0 ? ((currIncome - prevIncome) / prevIncome) * 100 : 0;
  const burnRate = categoryData.reduce((s, i) => s + i.value, 0) / 6;
  const healthScore = currIncome > 0 ? Math.max(0, Math.min(100, ((currIncome - currExpense) / currIncome) * 100)) : 0;

  const aiInsights = useMemo(() => {
    const insights: Array<{ type: string; title: string; message: string; icon: any; color: string; glow: string }> = [];
    if (currExpense > currIncome) {
      insights.push({ type: 'warning', title: 'Alerta de Flujo', icon: AlertCircle, color: '#fb7185', glow: '#fb7185',
        message: `Egresos superan ingresos por ${new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(currExpense - currIncome)}.` });
    }
    if (incomeGrowth > 10) {
      insights.push({ type: 'positive', title: 'Crecimiento Sólido', icon: TrendingUp, color: '#34d399', glow: '#34d399',
        message: `Ingresos crecieron ${incomeGrowth.toFixed(1)}% respecto al mes anterior.` });
    }
    if (categoryData.length > 0) {
      const topCat = categoryData[0];
      const totalExp = categoryData.reduce((a, b) => a + b.value, 0);
      const percent = (topCat.value / totalExp) * 100;
      if (percent > 40) {
        insights.push({ type: 'neutral', title: 'Concentración de Gastos', icon: Target, color: '#22d3ee', glow: '#22d3ee',
          message: `${percent.toFixed(0)}% de gastos en "${topCat.name}". Considera negociar con proveedores.` });
      }
    }
    if (insights.length === 0) {
      insights.push({ type: 'neutral', title: 'Estabilidad Detectada', icon: Brain, color: '#c084fc', glow: '#c084fc',
        message: 'Finanzas con comportamiento estable. Sin anomalías detectadas.' });
    }
    return insights;
  }, [currExpense, currIncome, incomeGrowth, categoryData]);

  const formatMoney = (val: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 0 }).format(val);

  const kpiCards = [
    { label: 'Ingreso Mensual', value: formatMoney(currIncome), sub: `${incomeGrowth >= 0 ? '+' : ''}${incomeGrowth.toFixed(1)}% vs mes ant.`, subColor: incomeGrowth >= 0 ? NEON.PROFIT : NEON.EXPENSE, icon: TrendingUp, accent: NEON.INCOME },
    { label: 'Gasto Mensual', value: formatMoney(currExpense), sub: `Burn rate: ${formatMoney(burnRate)}/mes`, subColor: AXIS_COLOR, icon: TrendingDown, accent: NEON.EXPENSE },
    { label: 'Margen Operativo', value: `${currIncome > 0 ? ((currIncome - currExpense) / currIncome * 100).toFixed(1) : 0}%`, sub: 'Objetivo ideal: > 20%', subColor: AXIS_COLOR, icon: Wallet, accent: NEON.BLUE },
    { label: 'Proyección Fin Mes', value: formatMoney(currIncome * 1.1), sub: 'Basado en tendencia', subColor: AXIS_COLOR, icon: Brain, accent: NEON.PURPLE },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4" style={{ borderBottom: '1px solid rgba(139,92,246,0.15)' }}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl" style={{ background: 'rgba(192,132,252,0.12)', border: '1px solid rgba(192,132,252,0.25)' }}>
            <Brain className="w-6 h-6" style={{ color: NEON.PURPLE, filter: `drop-shadow(0 0 8px ${NEON.PURPLE}80)` }} />
          </div>
          <div>
            <h2 className="text-2xl font-bold" style={{ color: '#F0EEFF' }}>Inteligencia Financiera</h2>
            <p className="text-sm" style={{ color: AXIS_COLOR }}>Análisis profundo y KPIs impulsados por datos históricos</p>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, i) => (
          <div key={i} className="rounded-2xl p-5 group cursor-default"
            style={{
              background: 'linear-gradient(145deg, #1A1826 0%, #161424 100%)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
              transition: 'transform 300ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 300ms ease, border-color 300ms ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
              (e.currentTarget as HTMLElement).style.borderColor = `${card.accent}30`;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl" style={{ background: `${card.accent}15`, border: `1px solid ${card.accent}25` }}>
                <card.icon className="w-4 h-4" style={{ color: card.accent, filter: `drop-shadow(0 0 5px ${card.accent}70)` }} />
              </div>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>{card.label}</p>
            <p className="text-xl font-bold mb-1" style={{ color: '#F0EEFF', fontFamily: "'JetBrains Mono', monospace" }}>{card.value}</p>
            <p className="text-xs" style={{ color: card.subColor }}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts + AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left: Charts */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* Area Chart */}
          <NeonCard>
            <CardHeader icon={TrendingUp} iconColor={NEON.INCOME} title="Tendencia de Flujo de Caja (6M)" subtitle="Comparativa histórica ingresos vs egresos" />
            {isMounted ? (
              <div style={{ height: '260px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={NEON.INCOME} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={NEON.INCOME} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="areaExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={NEON.EXPENSE} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={NEON.EXPENSE} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" vertical={false} stroke={GRID_COLOR} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false}
                      tick={{ fontSize: 11, fill: AXIS_COLOR }} dy={8} />
                    <YAxis axisLine={false} tickLine={false}
                      tick={{ fontSize: 10, fill: AXIS_COLOR }}
                      tickFormatter={(v) => `S/${(v/1000).toFixed(0)}k`} dx={-5} width={48} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM}
                      formatter={(v: number) => formatMoney(v)}
                      cursor={{ stroke: 'rgba(139,92,246,0.3)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                    <Area type="monotone" dataKey="ingresos" stroke={NEON.INCOME} strokeWidth={2}
                      fill="url(#areaIncome)" dot={false} activeDot={{ r: 4, fill: NEON.INCOME, stroke: '#1A1826', strokeWidth: 2 }} />
                    <Area type="monotone" dataKey="egresos" stroke={NEON.EXPENSE} strokeWidth={2}
                      fill="url(#areaExpense)" dot={false} activeDot={{ r: 4, fill: NEON.EXPENSE, stroke: '#1A1826', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : <div style={{ height: '260px', background: 'rgba(139,92,246,0.05)', borderRadius: '12px' }} className="animate-pulse" />}
            <div className="flex items-center gap-4 mt-3">
              {[{ c: NEON.INCOME, l: 'Ingresos' }, { c: NEON.EXPENSE, l: 'Egresos' }].map(({ c, l }) => (
                <div key={l} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-0.5 rounded" style={{ background: c, boxShadow: `0 0 4px ${c}80` }} />
                  <span className="text-xs" style={{ color: AXIS_COLOR }}>{l}</span>
                </div>
              ))}
            </div>
          </NeonCard>

          {/* Bar + Pie Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Pie */}
            <NeonCard>
              <CardHeader icon={Target} iconColor={NEON.AMBER} title="Distribución de Gastos" subtitle="Por categoría histórica" />
              {isMounted ? (
                <div style={{ height: '200px', position: 'relative' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryData.length ? categoryData : [{ name: 'N/A', value: 1 }]}
                        cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={4}
                        dataKey="value" stroke="none">
                        {(categoryData.length ? categoryData : [{ name: 'N/A', value: 1 }]).map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} opacity={0.9} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM}
                        formatter={(v: number) => [formatMoney(v), 'Gasto']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <div style={{ height: '200px', background: 'rgba(139,92,246,0.05)', borderRadius: '12px' }} className="animate-pulse" />}
              <div className="flex flex-wrap gap-2 mt-2">
                {categoryData.slice(0, 4).map((e, i) => (
                  <div key={e.name} className="flex items-center gap-1 text-xs" style={{ color: AXIS_COLOR }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="truncate max-w-[70px]">{e.name}</span>
                  </div>
                ))}
              </div>
            </NeonCard>

            {/* Health Score */}
            <NeonCard>
              <CardHeader icon={Wallet} iconColor={NEON.PROFIT} title="Salud Financiera" subtitle="Ratio de eficiencia operativa" />
              <div className="flex flex-col items-center justify-center py-4 space-y-3">
                <div className="relative w-28 h-28">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none"
                      stroke={healthScore > 50 ? NEON.PROFIT : healthScore > 20 ? NEON.AMBER : NEON.EXPENSE}
                      strokeWidth="3" strokeLinecap="round"
                      strokeDasharray={`${Math.min(healthScore, 100)}, 100`}
                      style={{ filter: `drop-shadow(0 0 4px ${healthScore > 50 ? NEON.PROFIT : healthScore > 20 ? NEON.AMBER : NEON.EXPENSE}80)` }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold" style={{ color: '#F0EEFF', fontFamily: "'JetBrains Mono', monospace" }}>{healthScore.toFixed(0)}%</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: AXIS_COLOR }}>Score</span>
                  </div>
                </div>
                <p className="text-xs text-center leading-relaxed px-2" style={{ color: AXIS_COLOR }}>
                  Por cada S/100 ingresados, quedan <span className="font-bold" style={{ color: '#F0EEFF' }}>S/{currIncome > 0 ? ((currIncome - currExpense) / currIncome * 100).toFixed(0) : '0'}</span> de ganancia neta.
                </p>
              </div>
            </NeonCard>
          </div>
        </div>

        {/* Right: AI Insights */}
        <NeonCard className="flex flex-col">
          <CardHeader icon={Brain} iconColor={NEON.PURPLE} title="GrooFlow AI Insights" subtitle="Análisis automático de movimientos" />
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
                  <p className="text-xs leading-relaxed" style={{ color: '#8b7cf8' }}>{insight.message}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <h4 className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em' }}>Recomendaciones</h4>
            <ul className="space-y-2">
              {[
                { dot: NEON.PROFIT, text: 'Revisar contratos con proveedores de Servicios Básicos.' },
                { dot: NEON.AMBER, text: 'Programar pagos de alquiler antes del día 5.' },
                { dot: NEON.INCOME, text: 'Incentivar pagos efectivo para reducir comisiones POS.' },
              ].map(({ dot, text }, i) => (
                <li key={i} className="flex items-start gap-2 text-xs" style={{ color: '#6b5fa5' }}>
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
