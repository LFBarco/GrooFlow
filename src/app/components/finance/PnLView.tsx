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

// ─── NEON PALETTE ──────────────────────────────────────────────────────────
const NEON_INCOME  = '#22d3ee';
const NEON_EXPENSE = '#fb7185';
const NEON_PROFIT  = '#34d399';
const AXIS_COLOR   = '#6b5fa5';
const GRID_COLOR   = 'rgba(139,92,246,0.1)';
const TOOLTIP_STYLE = {
  backgroundColor: '#22203A', border: '1px solid #3D3B5C',
  borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', padding: '12px 16px',
};
const TOOLTIP_ITEM = { color: '#E4E0FF', fontSize: '12px' };
const CARD_STYLE = {
  background: 'linear-gradient(145deg, #1A1826 0%, #161424 100%)',
  border: '1px solid rgba(255,255,255,0.06)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
};
// ───────────────────────────────────────────────────────────────────────────

interface PnLViewProps {
    transactions: Transaction[];
    currentDate: Date;
    onNextMonth?: () => void;
    onPrevMonth?: () => void;
}

export function PnLView({ transactions, currentDate, onNextMonth, onPrevMonth }: PnLViewProps) {
    const [viewMode, setViewMode] = useState<'month' | 'ytd'>('month');

    const filteredTransactions = useMemo(() => {
        if (viewMode === 'month') {
            const start = startOfMonth(currentDate);
            const end = endOfMonth(currentDate);
            return transactions.filter(t => isWithinInterval(new Date(t.date), { start, end }));
        } else {
            const start = startOfYear(currentDate);
            const end = endOfMonth(currentDate);
            return transactions.filter(t => isWithinInterval(new Date(t.date), { start, end }));
        }
    }, [transactions, currentDate, viewMode]);

    const report = useMemo(() => generatePnLReport(filteredTransactions), [filteredTransactions]);

    const waterfallData = [
        { name: 'Ingresos', value: report.revenue.total, fill: NEON_INCOME },
        { name: 'COGS', value: -report.cogs.total, fill: NEON_EXPENSE },
        { name: 'Ut. Bruta', value: report.grossProfit, fill: NEON_PROFIT, isTotal: true },
        { name: 'Gastos Op.', value: -report.expenses.total, fill: NEON_EXPENSE },
        { name: 'Ut. Neta', value: report.netIncome, fill: report.netIncome >= 0 ? NEON_PROFIT : NEON_EXPENSE, isTotal: true }
    ];

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount);
    };

    const PercentBadge = ({ value, total }: { value: number, total: number }) => {
        if (!total || total === 0) return <span>-</span>;
        const percent = (value / total) * 100;
        return (
            <span className="text-xs ml-2" style={{ color: AXIS_COLOR }}>
                ({percent.toFixed(1)}%)
            </span>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* ── Header ───────────────────────────────────────────────── */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4"
              style={{ borderBottom: '1px solid rgba(139,92,246,0.15)' }}
            >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(192,132,252,0.1)', border: '1px solid rgba(192,132,252,0.2)' }}>
                        <TrendingUp className="w-8 h-8" style={{ color: '#c084fc', filter: 'drop-shadow(0 0 8px rgba(192,132,252,0.5))' }} />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-2xl font-bold tracking-tight" style={{ color: '#F0EEFF' }}>Estado de Resultados (P&L)</h2>
                        <p style={{ color: AXIS_COLOR }}>
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
                            <span className="px-3 text-sm font-medium min-w-[140px] text-center capitalize" style={{ color: '#F0EEFF' }}>
                                {format(currentDate, 'MMMM yyyy', { locale: es })}
                            </span>
                            <button onClick={onNextMonth} className="p-2 h-full flex items-center transition-colors hover:bg-white/5" style={{ color: '#8b7cf8' }}>
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>
                
                {/* View Toggle */}
                <div className="flex items-center gap-1 p-1 rounded-lg self-start xl:self-center"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                    {(['month', 'ytd'] as const).map(mode => (
                      <button key={mode}
                        onClick={() => setViewMode(mode)}
                        className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200"
                        style={{
                          background: viewMode === mode ? 'rgba(192,132,252,0.15)' : 'transparent',
                          color: viewMode === mode ? '#c084fc' : AXIS_COLOR,
                          border: viewMode === mode ? '1px solid rgba(192,132,252,0.25)' : '1px solid transparent',
                        }}
                      >
                        {mode === 'month' ? 'Mes Actual' : 'Acumulado Año'}
                      </button>
                    ))}
                </div>
            </div>

            {/* ── KPI Cards ────────────────────────────────────────────── */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: 'Ingresos Totales', value: formatCurrency(report.revenue.total), sub: 'Ventas y Servicios', icon: DollarSign, color: NEON_INCOME },
                  { label: 'Utilidad Bruta', value: formatCurrency(report.grossProfit), sub: `Margen: ${report.revenue.total ? ((report.grossProfit / report.revenue.total) * 100).toFixed(1) : 0}%`, icon: Activity, color: NEON_PROFIT },
                  { label: 'Gastos Operativos', value: formatCurrency(report.expenses.total), sub: `${report.revenue.total ? ((report.expenses.total / report.revenue.total) * 100).toFixed(1) : 0}% de ingresos`, icon: TrendingDown, color: NEON_EXPENSE },
                  { label: 'Utilidad Neta', value: formatCurrency(report.netIncome), sub: `Margen Neto: ${report.revenue.total ? ((report.netIncome / report.revenue.total) * 100).toFixed(1) : 0}%`, icon: PieChart, color: report.netIncome >= 0 ? NEON_PROFIT : NEON_EXPENSE },
                ].map((card, i) => (
                  <div key={i} className="rounded-2xl p-5 group cursor-default"
                    style={{
                      ...CARD_STYLE,
                      border: `1px solid ${card.color}20`,
                      transition: 'transform 300ms cubic-bezier(0.34,1.56,0.64,1), border-color 300ms ease, box-shadow 300ms ease',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
                      (e.currentTarget as HTMLElement).style.borderColor = `${card.color}35`;
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 40px rgba(0,0,0,0.5), 0 0 20px ${card.color}15`;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                      (e.currentTarget as HTMLElement).style.borderColor = `${card.color}20`;
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(0,0,0,0.4)';
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>{card.label}</p>
                      <card.icon className="h-4 w-4" style={{ color: card.color, filter: `drop-shadow(0 0 5px ${card.color}70)` }} />
                    </div>
                    <p className="text-2xl font-bold mb-1" style={{ color: card.color, fontFamily: "'JetBrains Mono', monospace" }}>{card.value}</p>
                    <p className="text-xs" style={{ color: AXIS_COLOR }}>{card.sub}</p>
                  </div>
                ))}
            </div>

            <div className="grid gap-5 md:grid-cols-3">
                {/* ── Financial Statement Table ─────────────────────── */}
                <div className="md:col-span-2 rounded-2xl overflow-hidden" style={CARD_STYLE}>
                    {/* Card header */}
                    <div className="p-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl" style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)' }}>
                                <Activity className="w-4 h-4" style={{ color: NEON_INCOME, filter: 'drop-shadow(0 0 5px rgba(34,211,238,0.6))' }} />
                            </div>
                            <div>
                                <h3 className="font-bold" style={{ color: '#F0EEFF' }}>Detalle Financiero</h3>
                                <p className="text-xs" style={{ color: AXIS_COLOR }}>Desglose por categorías contables</p>
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
                                    <td className="p-3 font-bold text-xs uppercase tracking-wider" style={{ color: NEON_INCOME }}>INGRESOS</td>
                                    <td className="p-3 text-right font-bold" style={{ color: NEON_INCOME, fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(report.revenue.total)}</td>
                                    <td className="p-3 text-right" style={{ color: AXIS_COLOR }}>100%</td>
                                </tr>
                                {report.revenue.items.map(item => (
                                    <tr key={item.id} className="transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(34,211,238,0.03)'}
                                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                    >
                                        <td className="p-3 pl-7 text-xs" style={{ color: '#8b7cf8' }}>{item.name}</td>
                                        <td className="p-3 text-right text-xs font-mono" style={{ color: '#F0EEFF' }}>{formatCurrency(item.amount)}</td>
                                        <td className="p-3 text-right"><PercentBadge value={item.amount} total={report.revenue.total} /></td>
                                    </tr>
                                ))}

                                {/* COGS Section */}
                                <tr style={{ background: 'rgba(251,113,133,0.04)', borderBottom: '1px solid rgba(251,113,133,0.1)' }}>
                                    <td className="p-3 font-bold text-xs uppercase tracking-wider" style={{ color: NEON_EXPENSE }}>COSTOS DIRECTOS (COGS)</td>
                                    <td className="p-3 text-right font-bold font-mono" style={{ color: NEON_EXPENSE }}>({formatCurrency(report.cogs.total)})</td>
                                    <td className="p-3 text-right"><PercentBadge value={report.cogs.total} total={report.revenue.total} /></td>
                                </tr>
                                {report.cogs.items.map(item => (
                                    <tr key={item.id} className="transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(251,113,133,0.03)'}
                                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                    >
                                        <td className="p-3 pl-7 text-xs" style={{ color: '#8b7cf8' }}>{item.name}</td>
                                        <td className="p-3 text-right text-xs font-mono" style={{ color: '#F0EEFF' }}>({formatCurrency(item.amount)})</td>
                                        <td className="p-3 text-right"><PercentBadge value={item.amount} total={report.revenue.total} /></td>
                                    </tr>
                                ))}

                                {/* Gross Profit Line */}
                                <tr style={{ background: 'rgba(34,211,238,0.08)', borderTop: '2px solid rgba(34,211,238,0.2)', borderBottom: '1px solid rgba(34,211,238,0.12)' }}>
                                    <td className="p-3 font-bold uppercase" style={{ color: '#F0EEFF' }}>UTILIDAD BRUTA</td>
                                    <td className="p-3 text-right font-bold font-mono" style={{ color: NEON_INCOME }}>{formatCurrency(report.grossProfit)}</td>
                                    <td className="p-3 text-right font-bold" style={{ color: NEON_INCOME }}>
                                        {report.revenue.total ? ((report.grossProfit / report.revenue.total) * 100).toFixed(1) : 0}%
                                    </td>
                                </tr>

                                {/* Expenses Section */}
                                <tr style={{ background: 'rgba(251,113,133,0.04)', borderBottom: '1px solid rgba(251,113,133,0.1)' }}>
                                    <td className="p-3 font-bold text-xs uppercase tracking-wider" style={{ color: NEON_EXPENSE }}>GASTOS OPERATIVOS</td>
                                    <td className="p-3 text-right font-bold font-mono" style={{ color: NEON_EXPENSE }}>({formatCurrency(report.expenses.total)})</td>
                                    <td className="p-3 text-right"><PercentBadge value={report.expenses.total} total={report.revenue.total} /></td>
                                </tr>
                                {report.expenses.items.map(item => (
                                    <tr key={item.id} className="transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(251,113,133,0.03)'}
                                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                    >
                                        <td className="p-3 pl-7 text-xs" style={{ color: '#8b7cf8' }}>{item.name}</td>
                                        <td className="p-3 text-right text-xs font-mono" style={{ color: '#F0EEFF' }}>({formatCurrency(item.amount)})</td>
                                        <td className="p-3 text-right"><PercentBadge value={item.amount} total={report.revenue.total} /></td>
                                    </tr>
                                ))}

                                {/* Net Income Line */}
                                <tr style={{
                                    background: report.netIncome >= 0 ? 'rgba(52,211,153,0.08)' : 'rgba(251,113,133,0.08)',
                                    borderTop: `2px solid ${report.netIncome >= 0 ? 'rgba(52,211,153,0.25)' : 'rgba(251,113,133,0.25)'}`,
                                }}>
                                    <td className="p-3 font-bold uppercase" style={{ color: '#F0EEFF' }}>UTILIDAD NETA</td>
                                    <td className="p-3 text-right font-bold text-lg font-mono"
                                      style={{ color: report.netIncome >= 0 ? NEON_PROFIT : NEON_EXPENSE }}
                                    >{formatCurrency(report.netIncome)}</td>
                                    <td className="p-3 text-right font-bold"
                                      style={{ color: report.netIncome >= 0 ? NEON_PROFIT : NEON_EXPENSE }}
                                    >
                                        {report.revenue.total ? ((report.netIncome / report.revenue.total) * 100).toFixed(1) : 0}%
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ── Chart & Ratios ──────────────────────────────────── */}
                <div className="rounded-2xl overflow-hidden" style={CARD_STYLE}>
                    {/* Card header */}
                    <div className="p-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl" style={{ background: 'rgba(192,132,252,0.1)', border: '1px solid rgba(192,132,252,0.2)' }}>
                                <PieChart className="w-4 h-4" style={{ color: '#c084fc', filter: 'drop-shadow(0 0 5px rgba(192,132,252,0.6))' }} />
                            </div>
                            <div>
                                <h3 className="font-bold" style={{ color: '#F0EEFF' }}>Análisis de Rentabilidad</h3>
                                <p className="text-xs" style={{ color: AXIS_COLOR }}>Estructura de Costos vs Ingresos</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-5">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                                <BarChart data={waterfallData} margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 6" vertical={false} stroke={GRID_COLOR} />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false} tickLine={false}
                                        tick={{ fontSize: 11, fill: AXIS_COLOR, fontFamily: "'Inter', sans-serif" }}
                                    />
                                    <YAxis
                                        axisLine={false} tickLine={false}
                                        tick={{ fontSize: 10, fill: AXIS_COLOR, fontFamily: "'Inter', sans-serif" }}
                                        tickFormatter={(v) => `S/${(v/1000).toFixed(0)}k`}
                                        width={50}
                                    />
                                    <Tooltip
                                        formatter={(value: number) => [formatCurrency(Math.abs(value)), 'Monto']}
                                        cursor={{ fill: 'rgba(139,92,246,0.06)' }}
                                        contentStyle={TOOLTIP_STYLE}
                                        itemStyle={TOOLTIP_ITEM}
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
                              { label: 'Rentabilidad Operativa', value: `${((report.netOperatingIncome / report.revenue.total) * 100).toFixed(1)}%`, color: NEON_PROFIT },
                              { label: 'Ratio Costos Directos', value: `${((report.cogs.total / report.revenue.total) * 100).toFixed(1)}%`, color: NEON_EXPENSE },
                              { label: 'Ratio Gastos Operativos', value: `${((report.expenses.total / report.revenue.total) * 100).toFixed(1)}%`, color: '#fbbf24' },
                            ].map(({ label, value, color }) => (
                              <div key={label} className="flex justify-between items-center py-2"
                                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                              >
                                <span className="text-xs" style={{ color: AXIS_COLOR }}>{label}:</span>
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