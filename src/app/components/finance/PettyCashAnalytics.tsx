import React, { useMemo, useState, useEffect } from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
    PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';
import { PettyCashTransaction } from '../../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { format, subMonths, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowUpRight, TrendingUp, DollarSign, PieChart as PieIcon } from 'lucide-react';
import { formatCurrencyEs, formatNumberEs } from '../../utils/numberFormat';
import { useModuleSurfaces } from '../../utils/moduleSurfaces';
import { ChartEmptyState, seriesHasValues } from '../ui/ChartEmptyState';

interface PettyCashAnalyticsProps {
    transactions: PettyCashTransaction[];
    /** Sedes permitidas para el filtro (vacío = sin restricción explícita en UI). */
    visibleSedes?: string[];
}

export function PettyCashAnalytics({ transactions, visibleSedes }: PettyCashAnalyticsProps) {
    const s = useModuleSurfaces();
    const COLORS = s.chart.colors;
    const CARD_STYLE = { background: s.chartCard.background, border: s.chartCard.border, boxShadow: s.chartCard.boxShadow };
    const now = useMemo(() => new Date(), []);
    const [dateFrom, setDateFrom] = useState<string>(format(startOfMonth(subMonths(now, 5)), 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState<string>(format(now, 'yyyy-MM-dd'));
    const [selectedLocation, setSelectedLocation] = useState<string>('all');

    const locationOptions = useMemo(() => {
        if (visibleSedes === undefined) return ['Principal', 'Norte', 'Sur'];
        if (visibleSedes.length === 0) return [];
        return visibleSedes;
    }, [visibleSedes]);

    useEffect(() => {
        if (locationOptions.length === 0) {
            setSelectedLocation('all');
            return;
        }
        if (selectedLocation === 'all') return;
        if (!locationOptions.includes(selectedLocation)) {
            setSelectedLocation(locationOptions.length <= 1 ? locationOptions[0]! : 'all');
        }
    }, [locationOptions, selectedLocation]);

    const normalizedDateRange = useMemo(() => {
        const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : startOfMonth(subMonths(now, 5));
        const toRaw = dateTo ? new Date(`${dateTo}T23:59:59`) : new Date();
        if (Number.isNaN(from.getTime()) || Number.isNaN(toRaw.getTime())) {
            return { from: startOfMonth(subMonths(now, 5)), to: new Date() };
        }
        if (from <= toRaw) return { from, to: toRaw };
        return { from: toRaw, to: from };
    }, [dateFrom, dateTo, now]);

    // Filter Logic
    const filteredData = useMemo(() => {
        const startDate = normalizedDateRange.from;
        const endDate = normalizedDateRange.to;
        return transactions.filter(t => {
            if (t.status === 'voided' || t.status === 'rejected') return false;
            const tDate = new Date(t.date);
            
            const dateMatch = tDate >= startDate && tDate <= endDate;
            const loc = (t.location || 'Principal').trim();
            const locationMatch =
                selectedLocation === 'all'
                    ? visibleSedes === undefined
                        ? true
                        : visibleSedes.length === 0
                          ? false
                          : visibleSedes.includes(loc)
                    : loc === selectedLocation;

            return dateMatch && locationMatch;
        });
    }, [transactions, selectedLocation, visibleSedes, normalizedDateRange]);

    // KPI Calculations
    const totalExpense = useMemo(() => 
        filteredData
            .filter(t => t.type === 'expense' || !t.type)
            .reduce((sum, t) => sum + t.amount, 0)
    , [filteredData]);

    const totalIncome = useMemo(() => 
        filteredData
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0)
    , [filteredData]);

    const monthlyAverage = useMemo(() => {
        if (filteredData.length === 0) return 0;
        const months = new Set(filteredData.map(t => format(new Date(t.date), 'yyyy-MM'))).size;
        return months > 0 ? totalExpense / months : 0;
    }, [filteredData, totalExpense]);

    // Charts Data Preparation

    // 1. Expenses by Month (Bar Chart)
    const expensesByMonth = useMemo(() => {
        const timeline = [];
        let d = startOfMonth(normalizedDateRange.from);
        const endMonth = endOfMonth(normalizedDateRange.to);
        while (d <= endMonth) {
            const label = format(d, 'MMM yy', { locale: es });
            const monthKey = format(d, 'yyyy-MM');
            
            const val = filteredData
                .filter(t => 
                    (t.type === 'expense' || !t.type) && 
                    format(new Date(t.date), 'yyyy-MM') === monthKey
                )
                .reduce((sum, t) => sum + t.amount, 0);

            timeline.push({ name: label, value: val });
            d = addMonths(d, 1);
        }
        return timeline;
    }, [filteredData, normalizedDateRange]);

    // 2. Expenses by Category (Pie Chart)
    const expensesByCategory = useMemo(() => {
        const grouped: Record<string, number> = {};
        filteredData.filter(t => t.type === 'expense' || !t.type).forEach(t => {
            grouped[t.category] = (grouped[t.category] || 0) + t.amount;
        });
        
        return Object.entries(grouped)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredData]);

    // 3. Expenses by Location (Bar/Donut)
    const expensesByLocation = useMemo(() => {
        const grouped: Record<string, number> = {};
        filteredData.filter(t => t.type === 'expense' || !t.type).forEach(t => {
            const loc = t.location || 'Principal';
            grouped[loc] = (grouped[loc] || 0) + t.amount;
        });

        return Object.entries(grouped)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredData]);

    // 4. Expenses by Area
    const expensesByArea = useMemo(() => {
        const grouped: Record<string, number> = {};
        filteredData
            .filter(t => t.type === 'expense' || !t.type)
            .forEach(t => {
                const areaName = (t.area || 'Sin área').trim();
                grouped[areaName] = (grouped[areaName] || 0) + t.amount;
            });

        return Object.entries(grouped)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredData]);

    // 5. Top Providers
    const topProviders = useMemo(() => {
        const grouped: Record<string, { amount: number; count: number }> = {};
        filteredData
            .filter(t => t.type === 'expense' || !t.type)
            .forEach(t => {
                const key = (t.providerName || 'Proveedor no identificado').trim();
                if (!grouped[key]) grouped[key] = { amount: 0, count: 0 };
                grouped[key].amount += t.amount;
                grouped[key].count += 1;
            });

        return Object.entries(grouped)
            .map(([name, agg]) => ({ name, amount: agg.amount, count: agg.count }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5);
    }, [filteredData]);

    // 6. Smart recommendations and alerts for admins
    const optimizationAlerts = useMemo(() => {
        const expenseData = filteredData.filter(t => t.type === 'expense' || !t.type);
        if (expenseData.length === 0) {
            return [{
                level: 'info' as const,
                title: 'Sin datos suficientes',
                message: 'Aún no hay movimientos para generar alertas de optimización de fondo.'
            }];
        }

        const alerts: Array<{ level: 'warning' | 'info' | 'success'; title: string; message: string }> = [];
        const recurringThreshold = Math.max(2, Math.ceil(expenseData.length * 0.2));
        const recurringByDescription = expenseData.reduce((acc, tx) => {
            const key = (tx.description || '').trim().toLowerCase();
            if (!key) return acc;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const recurringItems = Object.entries(recurringByDescription)
            .filter(([, count]) => count >= recurringThreshold)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2);

        if (recurringItems.length > 0) {
            alerts.push({
                level: 'warning',
                title: 'Gastos recurrentes detectados',
                message: `Conceptos repetidos: ${recurringItems.map(([desc]) => `"${desc.slice(0, 26)}"`).join(', ')}. Evalúe compra programada o convenio mensual.`
            });
        }

        const topArea = expensesByArea[0];
        if (topArea && totalExpense > 0) {
            const concentration = (topArea.value / totalExpense) * 100;
            if (concentration >= 45) {
                alerts.push({
                    level: 'warning',
                    title: 'Concentración por área',
                    message: `${topArea.name} concentra ${formatNumberEs(concentration, 0)}% del gasto. Defina tope semanal y autorización adicional para esa área.`
                });
            }
        }

        const topProvider = topProviders[0];
        if (topProvider && totalExpense > 0) {
            const providerShare = (topProvider.amount / totalExpense) * 100;
            if (providerShare >= 35) {
                alerts.push({
                    level: 'info',
                    title: 'Dependencia de proveedor',
                    message: `${topProvider.name} representa ${formatNumberEs(providerShare, 0)}% del gasto total. Compare precios con al menos 2 alternativas.`
                });
            }
        }

        if (alerts.length === 0) {
            alerts.push({
                level: 'success',
                title: 'Uso equilibrado del fondo',
                message: 'No se observan concentraciones críticas. Mantenga control semanal y conciliación con comprobantes.'
            });
        }

        return alerts;
    }, [filteredData, expensesByArea, topProviders, totalExpense]);

    if (locationOptions.length === 0) {
        return (
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-6 text-sm text-amber-100">
                No tiene sedes asignadas; la analítica de caja chica no muestra datos hasta que un administrador configure sus sedes.
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-150">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-end items-start md:items-center gap-4">
                <div className="flex items-center gap-2 p-1 rounded-xl border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(139,92,246,0.2)' }}>
                    <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                        <SelectTrigger className="w-[150px] border-none shadow-none">
                            <SelectValue placeholder="Todas las Sedes" />
                        </SelectTrigger>
                        <SelectContent>
                            {locationOptions.length > 1 && (
                                <SelectItem value="all">Todas (mis sedes)</SelectItem>
                            )}
                            {locationOptions.map((loc) => (
                                <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="h-6 w-px" style={{ background: 'rgba(139,92,246,0.2)' }} />
                    <div className="flex items-center gap-2 px-2">
                        <span className="text-xs text-muted-foreground">Desde</span>
                        <Input
                            type="date"
                            className="h-8 w-[150px] border-none shadow-none bg-transparent px-1"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                        />
                        <span className="text-xs text-muted-foreground">Hasta</span>
                        <Input
                            type="date"
                            className="h-8 w-[150px] border-none shadow-none bg-transparent px-1"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {([
                  { kind: 'expense' as const, label: 'Gasto Total', value: formatCurrencyEs(totalExpense), sub: 'En el periodo', icon: DollarSign },
                  { kind: 'projection' as const, label: 'Promedio Mensual', value: formatCurrencyEs(monthlyAverage), sub: 'Gasto medio', icon: TrendingUp },
                  { kind: 'income' as const, label: 'Reposiciones', value: formatCurrencyEs(totalIncome), sub: 'Ingresos al fondo', icon: ArrowUpRight },
                  { kind: 'violet' as const, label: 'Top Categoría', value: expensesByCategory[0]?.name || '-', sub: expensesByCategory[0] ? formatCurrencyEs(expensesByCategory[0].value) : 'Sin datos', icon: PieIcon },
                ]).map((card, i) => {
                  const kpi = s.kpi[card.kind];
                  return (
                  <div key={i} className={`rounded-2xl p-4 relative overflow-hidden ${kpi.className ?? ''}`} style={{
                    background: kpi.background,
                    border: kpi.border,
                    boxShadow: kpi.boxShadow,
                  }}>
                    <div className="flex items-center justify-between mb-3 relative z-10">
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: kpi.labelColor, letterSpacing: '0.1em' }}>{card.label}</p>
                      <div className="p-1.5 rounded-lg" style={{ background: kpi.iconBg, border: `1px solid ${kpi.iconBorder}` }}>
                        <card.icon className="w-3.5 h-3.5" style={{ color: kpi.accent }} />
                      </div>
                    </div>
                    <p className="text-xl font-bold truncate mb-1 relative z-10" style={{ color: kpi.valueColor, fontFamily: "'JetBrains Mono', monospace" }} title={card.value}>{card.value}</p>
                    <p className="text-xs relative z-10" style={{ color: s.axisTick }}>{card.sub}</p>
                  </div>
                  );
                })}
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className={`rounded-2xl p-5 ${s.isDark ? '' : 'gf-glass-card'}`} style={CARD_STYLE}>
                    <div className="mb-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <p className="font-bold text-sm" style={{ color: s.pageTitle }}>Evolución de Gastos</p>
                      <p className="text-xs" style={{ color: s.axisTick }}>Comportamiento mensual del egreso de caja chica</p>
                    </div>
                    <div style={{ height: '260px' }}>
                        {!seriesHasValues(expensesByMonth as unknown as Array<Record<string, unknown>>, ['value']) ? (
                          <ChartEmptyState message="Sin gastos de caja chica en el período." />
                        ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={expensesByMonth} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 6" vertical={false} stroke={s.gridStroke} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: s.axisTick }} dy={6} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: s.axisTick }} tickFormatter={(v) => `S/${v}`} width={44} />
                                <Tooltip contentStyle={s.tooltip} itemStyle={s.tooltipItem} formatter={(value: number) => [formatCurrencyEs(value), 'Gasto']} cursor={{ fill: 'rgba(139,92,246,0.06)' }} />
                                <Bar dataKey="value" fill="#22d3ee" radius={[4, 4, 0, 0]} opacity={0.85} />
                            </BarChart>
                        </ResponsiveContainer>
                        )}
                    </div>
                </div>

                <div className={`rounded-2xl p-5 ${s.isDark ? '' : 'gf-glass-card'}`} style={CARD_STYLE}>
                    <div className="mb-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <p className="font-bold text-sm" style={{ color: s.pageTitle }}>Distribución por Categoría</p>
                      <p className="text-xs" style={{ color: s.axisTick }}>¿En qué se gasta más dinero?</p>
                    </div>
                    <div style={{ height: '260px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={expensesByCategory}
                                    cx="50%" cy="50%"
                                    labelLine={false}
                                    outerRadius={100}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${formatNumberEs(percent * 100, 0)}%`}
                                    style={{ fontSize: '10px', fill: s.axisTick }}
                                >
                                    {expensesByCategory.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} opacity={0.9} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={s.tooltip} itemStyle={s.tooltipItem} formatter={(value: number) => [formatCurrencyEs(value), 'Monto']} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

             {/* Charts Row 2 */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className={`rounded-2xl p-5 ${s.isDark ? '' : 'gf-glass-card'}`} style={CARD_STYLE}>
                    <div className="mb-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <p className="font-bold text-sm" style={{ color: s.pageTitle }}>Gastos por Sede</p>
                      <p className="text-xs" style={{ color: s.axisTick }}>Comparativa de consumo por ubicación</p>
                    </div>
                    <div style={{ height: '260px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={expensesByLocation} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 6" horizontal={false} stroke={s.gridStroke} />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: s.axisTick }} tickFormatter={(v) => `S/${v}`} />
                                <YAxis dataKey="name" type="category" width={90} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: s.axisTick }} />
                                <Tooltip contentStyle={s.tooltip} itemStyle={s.tooltipItem} formatter={(value: number) => [formatCurrencyEs(value), 'Gasto']} cursor={{ fill: 'rgba(139,92,246,0.06)' }} />
                                <Bar dataKey="value" fill="#c084fc" radius={[0, 4, 4, 0]} barSize={28} opacity={0.85} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Expenses by Area */}
                <div className={`rounded-2xl p-5 ${s.isDark ? '' : 'gf-glass-card'}`} style={CARD_STYLE}>
                    <div className="mb-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <p className="font-bold text-sm" style={{ color: s.pageTitle }}>Gastos por Área</p>
                      <p className="text-xs" style={{ color: s.axisTick }}>Distribución del fondo según área solicitante</p>
                    </div>
                    <div style={{ height: '260px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={expensesByArea.slice(0, 8)} layout="vertical" margin={{ top: 5, right: 10, left: 5, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 6" horizontal={false} stroke={s.gridStroke} />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: s.axisTick }} tickFormatter={(v) => `S/${v}`} />
                                <YAxis dataKey="name" type="category" width={110} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: s.axisTick }} />
                                <Tooltip contentStyle={s.tooltip} itemStyle={s.tooltipItem} formatter={(value: number) => [formatCurrencyEs(value), 'Área']} cursor={{ fill: 'rgba(139,92,246,0.06)' }} />
                                <Bar dataKey="value" fill="#34d399" radius={[0, 4, 4, 0]} barSize={24} opacity={0.85} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Charts Row 3 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Top Providers */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Top 5 Proveedores</CardTitle>
                        <CardDescription>Ranking por monto acumulado en el periodo</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {topProviders.map((provider, i) => (
                                    <div key={`${provider.name}-${i}`} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold text-xs">
                                                {i + 1}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium leading-none">{provider.name}</p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {provider.count} gasto(s) registrado(s)
                                                </p>
                                            </div>
                                        </div>
                                        <div className="font-bold text-sm">
                                            {formatCurrencyEs(provider.amount)}
                                        </div>
                                    </div>
                                ))
                            }
                            {topProviders.length === 0 && (
                                <p className="text-center text-muted-foreground text-sm py-8">No hay datos en este periodo</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Recommendations / Alerts */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Alertas y Recomendaciones</CardTitle>
                        <CardDescription>Acciones para optimizar el uso del fondo de sede</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {optimizationAlerts.map((alert, idx) => {
                                const tone =
                                    alert.level === 'warning'
                                        ? 'border-amber-500/30 bg-amber-950/20 text-amber-100'
                                        : alert.level === 'success'
                                          ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-100'
                                          : 'border-cyan-500/30 bg-cyan-950/20 text-cyan-100';
                                return (
                                    <div key={`${alert.title}-${idx}`} className={`rounded-lg border p-3 ${tone}`}>
                                        <p className="text-sm font-semibold">{alert.title}</p>
                                        <p className="text-xs mt-1 opacity-90">{alert.message}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}