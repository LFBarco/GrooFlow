import { useState, useMemo } from "react";
import { Transaction } from "../../types";
import { generatePnLReport } from "../../utils/pnlHelpers";
import { format, startOfMonth, endOfMonth, startOfYear, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    Cell,
    ReferenceLine
} from "recharts";
import { 
    TrendingUp, 
    TrendingDown, 
    DollarSign, 
    PieChart, 
    Activity,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";

import { formatNumberEs, formatPercentEs } from "../../utils/numberFormat";
import { labelsMatch } from "../../utils/labelMatch";
import { parseTransactionDate } from "../../utils/transactionDate";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useModuleSurfaces } from "../../utils/moduleSurfaces";

const formatMoney = (value: number | string, decimals = 2) => formatNumberEs(value, decimals);
const formatAxisThousands = (value: number) =>
    Math.abs(value) >= 1000 ? `${formatNumberEs(value / 1000, 0)}k` : formatNumberEs(value, 0);
// ───────────────────────────────────────────────────────────────────────────

interface PnLViewProps {
    transactions: Transaction[];
    currentDate: Date;
    onNextMonth?: () => void;
    onPrevMonth?: () => void;
}

export function PnLView({ transactions, currentDate, onNextMonth, onPrevMonth }: PnLViewProps) {
    const s = useModuleSurfaces();
    const CARD_STYLE = { background: s.chartCard.background, border: s.chartCard.border, boxShadow: s.chartCard.boxShadow };
    const [viewMode, setViewMode] = useState<'month' | 'ytd'>('month');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [conceptFilter, setConceptFilter] = useState('all');

    const categoryOptions = useMemo(
        () =>
            Array.from(new Set(transactions.map((t) => String(t.category || '').trim()).filter(Boolean)))
                .sort((a, b) => a.localeCompare(b)),
        [transactions]
    );

    const conceptOptions = useMemo(
        () =>
            Array.from(new Set(
                transactions
                    .filter((t) => categoryFilter === 'all' || labelsMatch(t.category, categoryFilter))
                    .map((t) => String(t.concept || t.subcategory || '').trim())
                    .filter(Boolean)
            )).sort((a, b) => a.localeCompare(b)),
        [categoryFilter, transactions]
    );

    const filteredTransactions = useMemo(() => {
        const dateFiltered = (() => {
        if (viewMode === 'month') {
            const start = startOfMonth(currentDate);
            const end = endOfMonth(currentDate);
            return transactions.filter(t => isWithinInterval(parseTransactionDate(t.date), { start, end }));
        } else {
            const start = startOfYear(currentDate);
            const end = endOfMonth(currentDate);
            return transactions.filter(t => isWithinInterval(parseTransactionDate(t.date), { start, end }));
        }
        })();

        return dateFiltered.filter((t) => {
            const categoryMatch = categoryFilter === 'all' || labelsMatch(t.category, categoryFilter);
            const conceptValue = t.concept || t.subcategory || '';
            const conceptMatch = conceptFilter === 'all' || labelsMatch(conceptValue, conceptFilter);
            return categoryMatch && conceptMatch;
        });
    }, [transactions, currentDate, viewMode, categoryFilter, conceptFilter]);

    const report = useMemo(() => generatePnLReport(filteredTransactions), [filteredTransactions]);

    const waterfallData = [
        { name: 'Ingresos', value: report.revenue.total, fill: s.chart.income },
        { name: 'COGS', value: -report.cogs.total, fill: s.chart.expense },
        { name: 'Ut. Bruta', value: report.grossProfit, fill: s.chart.profit, isTotal: true },
        { name: 'Gastos Op.', value: -report.expenses.total, fill: s.chart.expense },
        { name: 'Ut. Neta', value: report.netIncome, fill: report.netIncome >= 0 ? s.chart.profit : s.chart.expense, isTotal: true }
    ];

    const PercentBadge = ({ value, total }: { value: number, total: number }) => {
        if (!total || total === 0) return <span>-</span>;
        const percent = (value / total) * 100;
        return (
            <span className="text-xs ml-2" style={{ color: s.axisTick }}>
                ({formatPercentEs(percent, 1)})
            </span>
        );
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-150 -mt-2">
            {/* ── Header ───────────────────────────────────────────────── */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3"
              style={{ borderBottom: '1px solid rgba(139,92,246,0.15)' }}
            >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(192,132,252,0.1)', border: '1px solid rgba(192,132,252,0.2)' }}>
                        <TrendingUp className="w-8 h-8" style={{ color: '#c084fc', filter: 'drop-shadow(0 0 8px rgba(192,132,252,0.5))' }} />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-2xl font-bold tracking-tight" style={{ color: s.pageTitle }}>Estado de Resultados (P&L)</h2>
                        <p style={{ color: s.axisTick }}>
                            {viewMode === 'month' 
                                ? `Reporte Mensual: ${format(currentDate, 'MMMM yyyy', { locale: es })}`
                                : `Acumulado Anual: Enero - ${format(currentDate, 'MMMM yyyy', { locale: es })}`
                            }
                        </p>
                    </div>

                    {/* Date Controls */}
                    {viewMode === 'month' && onPrevMonth && onNextMonth && (
                        <div className="flex items-center rounded-xl h-9 self-start sm:self-center ml-0 sm:ml-4 overflow-hidden"
                          style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}
                        >
                            <button onClick={onPrevMonth} className="p-2 h-full flex items-center transition-colors hover:bg-white/5" style={{ color: '#8b7cf8' }}>
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <span className="px-3 text-sm font-medium min-w-[140px] text-center capitalize" style={{ color: s.pageTitle }}>
                                {format(currentDate, 'MMMM yyyy', { locale: es })}
                            </span>
                            <button onClick={onNextMonth} className="p-2 h-full flex items-center transition-colors hover:bg-white/5" style={{ color: '#8b7cf8' }}>
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 self-start xl:self-center">
                    <Select
                        value={categoryFilter}
                        onValueChange={(value) => {
                            setCategoryFilter(value);
                            setConceptFilter('all');
                        }}
                    >
                        <SelectTrigger className="h-9 w-full sm:w-[190px] bg-white/5 border-white/10 text-xs">
                            <SelectValue placeholder="Todas las categorías" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las categorías</SelectItem>
                            {categoryOptions.map((category) => (
                                <SelectItem key={category} value={category}>{category}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={conceptFilter} onValueChange={setConceptFilter}>
                        <SelectTrigger className="h-9 w-full sm:w-[190px] bg-white/5 border-white/10 text-xs">
                            <SelectValue placeholder="Todos los conceptos" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los conceptos</SelectItem>
                            {conceptOptions.map((concept) => (
                                <SelectItem key={concept} value={concept}>{concept}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* View Toggle */}
                    <div className="flex items-center gap-1 p-1 rounded-lg"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                        {(['month', 'ytd'] as const).map(mode => (
                          <button key={mode}
                            onClick={() => setViewMode(mode)}
                            className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200"
                            style={{
                              background: viewMode === mode ? 'rgba(192,132,252,0.15)' : 'transparent',
                              color: viewMode === mode ? '#c084fc' : s.axisTick,
                              border: viewMode === mode ? '1px solid rgba(192,132,252,0.25)' : '1px solid transparent',
                            }}
                          >
                            {mode === 'month' ? 'Mes Actual' : 'Acumulado Año'}
                          </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── KPI Cards ────────────────────────────────────────────── */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {([
                  { kind: 'income' as const, label: 'Ingresos Totales', value: formatMoney(report.revenue.total), sub: 'Ventas y Servicios', icon: DollarSign },
                  { kind: 'profit' as const, label: 'Utilidad Bruta', value: formatMoney(report.grossProfit), sub: `Margen: ${report.revenue.total ? formatPercentEs((report.grossProfit / report.revenue.total) * 100, 1) : '0%'}`, icon: Activity },
                  { kind: 'expense' as const, label: 'Gastos Operativos', value: formatMoney(report.expenses.total), sub: `${report.revenue.total ? formatPercentEs((report.expenses.total / report.revenue.total) * 100, 1) : '0%'} de ingresos`, icon: TrendingDown },
                  { kind: (report.netIncome >= 0 ? 'profit' : 'expense') as 'profit' | 'expense', label: 'Utilidad Neta', value: formatMoney(report.netIncome), sub: `Margen Neto: ${report.revenue.total ? formatPercentEs((report.netIncome / report.revenue.total) * 100, 1) : '0%'}`, icon: PieChart },
                ]).map((card, i) => {
                  const kpi = s.kpi[card.kind];
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
                      <card.icon className="w-14 h-14" style={{ color: kpi.accent }} />
                    </div>
                    <div className="flex items-center justify-between mb-3 relative z-10">
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: kpi.labelColor, letterSpacing: '0.1em' }}>{card.label}</p>
                      <card.icon className="h-4 w-4" style={{ color: kpi.accent, filter: s.isDark ? `drop-shadow(0 0 5px ${kpi.accent}70)` : undefined }} />
                    </div>
                    <p className="text-2xl font-bold mb-1 relative z-10" style={{ color: kpi.valueColor, fontFamily: "'JetBrains Mono', monospace" }}>{card.value}</p>
                    <p className="text-xs relative z-10" style={{ color: s.axisTick }}>{card.sub}</p>
                  </div>
                  );
                })}
            </div>

            <div className="grid gap-5 md:grid-cols-3">
                {/* ── Financial Statement Table ─────────────────────── */}
                <div className={`md:col-span-2 rounded-2xl overflow-hidden ${s.isDark ? '' : 'gf-glass-card'}`} style={CARD_STYLE}>
                    {/* Card header */}
                    <div className="p-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl" style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)' }}>
                                <Activity className="w-4 h-4" style={{ color: s.chart.income, filter: 'drop-shadow(0 0 5px rgba(34,211,238,0.6))' }} />
                            </div>
                            <div>
                                <h3 className="font-bold" style={{ color: s.pageTitle }}>Detalle Financiero</h3>
                                <p className="text-xs" style={{ color: s.axisTick }}>Desglose por categorías contables</p>
                            </div>
                        </div>
                    </div>
                    <div className="overflow-auto">
                        <table className="w-full text-sm">
                            {/* Table Header */}
                            <thead>
                                <tr style={{ background: 'rgba(139,92,246,0.08)', borderBottom: '1px solid rgba(139,92,246,0.12)' }}>
                                    <th className="p-3 text-left w-[300px] text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Concepto</th>
                                    <th className="p-3 text-right text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Monto</th>
                                    <th className="p-3 text-right text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>%</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Revenue Section */}
                                <tr style={{ background: 'rgba(34,211,238,0.04)', borderBottom: '1px solid rgba(34,211,238,0.1)' }}>
                                    <td className="p-3 font-bold text-xs uppercase tracking-wider" style={{ color: s.chart.income }}>INGRESOS</td>
                                    <td className="p-3 text-right font-bold" style={{ color: s.chart.income, fontFamily: "'JetBrains Mono', monospace" }}>{formatMoney(report.revenue.total)}</td>
                                    <td className="p-3 text-right" style={{ color: s.axisTick }}>100%</td>
                                </tr>
                                {report.revenue.items.map(item => (
                                    <tr key={item.id} className="transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(34,211,238,0.03)'}
                                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                    >
                                        <td className="p-3 pl-7 text-xs" style={{ color: '#8b7cf8' }}>{item.name}</td>
                                        <td className="p-3 text-right text-xs font-mono" style={{ color: s.pageTitle }}>{formatMoney(item.amount)}</td>
                                        <td className="p-3 text-right"><PercentBadge value={item.amount} total={report.revenue.total} /></td>
                                    </tr>
                                ))}

                                {/* COGS Section */}
                                <tr style={{ background: 'rgba(251,113,133,0.04)', borderBottom: '1px solid rgba(251,113,133,0.1)' }}>
                                    <td className="p-3 font-bold text-xs uppercase tracking-wider" style={{ color: s.chart.expense }}>COSTOS DIRECTOS (COGS)</td>
                                    <td className="p-3 text-right font-bold font-mono" style={{ color: s.chart.expense }}>({formatMoney(report.cogs.total)})</td>
                                    <td className="p-3 text-right"><PercentBadge value={report.cogs.total} total={report.revenue.total} /></td>
                                </tr>
                                {report.cogs.items.map(item => (
                                    <tr key={item.id} className="transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(251,113,133,0.03)'}
                                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                    >
                                        <td className="p-3 pl-7 text-xs" style={{ color: '#8b7cf8' }}>{item.name}</td>
                                        <td className="p-3 text-right text-xs font-mono" style={{ color: s.pageTitle }}>({formatMoney(item.amount)})</td>
                                        <td className="p-3 text-right"><PercentBadge value={item.amount} total={report.revenue.total} /></td>
                                    </tr>
                                ))}

                                {/* Gross Profit Line */}
                                <tr style={{ background: 'rgba(34,211,238,0.08)', borderTop: '2px solid rgba(34,211,238,0.2)', borderBottom: '1px solid rgba(34,211,238,0.12)' }}>
                                    <td className="p-3 font-bold uppercase" style={{ color: s.pageTitle }}>UTILIDAD BRUTA</td>
                                    <td className="p-3 text-right font-bold font-mono" style={{ color: s.chart.income }}>{formatMoney(report.grossProfit)}</td>
                                    <td className="p-3 text-right font-bold" style={{ color: s.chart.income }}>
                                        {report.revenue.total ? formatPercentEs((report.grossProfit / report.revenue.total) * 100, 1) : '0%'}
                                    </td>
                                </tr>

                                {/* Expenses Section */}
                                <tr style={{ background: 'rgba(251,113,133,0.04)', borderBottom: '1px solid rgba(251,113,133,0.1)' }}>
                                    <td className="p-3 font-bold text-xs uppercase tracking-wider" style={{ color: s.chart.expense }}>GASTOS OPERATIVOS</td>
                                    <td className="p-3 text-right font-bold font-mono" style={{ color: s.chart.expense }}>({formatMoney(report.expenses.total)})</td>
                                    <td className="p-3 text-right"><PercentBadge value={report.expenses.total} total={report.revenue.total} /></td>
                                </tr>
                                {report.expenses.items.map(item => (
                                    <tr key={item.id} className="transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(251,113,133,0.03)'}
                                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                    >
                                        <td className="p-3 pl-7 text-xs" style={{ color: '#8b7cf8' }}>{item.name}</td>
                                        <td className="p-3 text-right text-xs font-mono" style={{ color: s.pageTitle }}>({formatMoney(item.amount)})</td>
                                        <td className="p-3 text-right"><PercentBadge value={item.amount} total={report.revenue.total} /></td>
                                    </tr>
                                ))}

                                {/* Net Income Line */}
                                <tr style={{
                                    background: report.netIncome >= 0 ? 'rgba(52,211,153,0.08)' : 'rgba(251,113,133,0.08)',
                                    borderTop: `2px solid ${report.netIncome >= 0 ? 'rgba(52,211,153,0.25)' : 'rgba(251,113,133,0.25)'}`,
                                }}>
                                    <td className="p-3 font-bold uppercase" style={{ color: s.pageTitle }}>UTILIDAD NETA</td>
                                    <td className="p-3 text-right font-bold text-lg font-mono"
                                      style={{ color: report.netIncome >= 0 ? s.chart.profit : s.chart.expense }}
                                    >{formatMoney(report.netIncome)}</td>
                                    <td className="p-3 text-right font-bold"
                                      style={{ color: report.netIncome >= 0 ? s.chart.profit : s.chart.expense }}
                                    >
                                        {report.revenue.total ? formatPercentEs((report.netIncome / report.revenue.total) * 100, 1) : '0%'}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ── Chart & Ratios ──────────────────────────────────── */}
                <div className={`rounded-2xl overflow-hidden ${s.isDark ? '' : 'gf-glass-card'}`} style={CARD_STYLE}>
                    {/* Card header */}
                    <div className="p-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl" style={{ background: 'rgba(192,132,252,0.1)', border: '1px solid rgba(192,132,252,0.2)' }}>
                                <PieChart className="w-4 h-4" style={{ color: '#c084fc', filter: 'drop-shadow(0 0 5px rgba(192,132,252,0.6))' }} />
                            </div>
                            <div>
                                <h3 className="font-bold" style={{ color: s.pageTitle }}>Análisis de Rentabilidad</h3>
                                <p className="text-xs" style={{ color: s.axisTick }}>Estructura de Costos vs Ingresos</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-5">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                                <BarChart data={waterfallData} margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 6" vertical={false} stroke={s.gridStroke} />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false} tickLine={false}
                                        tick={{ fontSize: 11, fill: s.axisTick, fontFamily: "'Inter', sans-serif" }}
                                    />
                                    <YAxis
                                        axisLine={false} tickLine={false}
                                        tick={{ fontSize: 10, fill: s.axisTick, fontFamily: "'Inter', sans-serif" }}
                                        tickFormatter={(v) => formatAxisThousands(v)}
                                        width={50}
                                    />
                                    <Tooltip
                                        formatter={(value: number) => [formatMoney(Math.abs(value)), 'Monto']}
                                        cursor={{ fill: 'rgba(139,92,246,0.06)' }}
                                        contentStyle={s.tooltip}
                                        itemStyle={s.tooltipItem}
                                    />
                                    <ReferenceLine y={0} stroke="rgba(139,92,246,0.35)" strokeDasharray="4 4" />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={36}>
                                        {waterfallData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} opacity={0.88} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Ratios */}
                        <div className="mt-4 space-y-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                            {[
                              {
                                label: 'Rentabilidad Operativa',
                                value: report.revenue.total
                                  ? formatPercentEs((report.netOperatingIncome / report.revenue.total) * 100, 1)
                                  : '0%',
                                color: s.chart.profit,
                              },
                              {
                                label: 'Ratio Costos Directos',
                                value: report.revenue.total
                                  ? formatPercentEs((report.cogs.total / report.revenue.total) * 100, 1)
                                  : '0%',
                                color: s.chart.expense,
                              },
                              {
                                label: 'Ratio Gastos Operativos',
                                value: report.revenue.total
                                  ? formatPercentEs((report.expenses.total / report.revenue.total) * 100, 1)
                                  : '0%',
                                color: '#fbbf24',
                              },
                            ].map(({ label, value, color }) => (
                              <div key={label} className="flex justify-between items-center py-2"
                                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                              >
                                <span className="text-xs" style={{ color: s.axisTick }}>{label}:</span>
                                <span className="text-xs font-bold font-mono" style={{ color }}>{value}</span>
                              </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}