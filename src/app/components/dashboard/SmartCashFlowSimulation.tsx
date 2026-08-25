import { useCallback, useEffect, useMemo, useState } from 'react';
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { BrainCircuit, Plus, Trash2, Save, Sparkles, AlertTriangle, History, BarChart3 } from 'lucide-react';
import type { InvoiceDraft, SmartCashFlowScheduleLine, SystemSettings, Transaction } from '../../types';
import type { ConfigStructure } from '../../data/initialData';
import { mergeSmartCashFlowSettings } from '../../data/initialData';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { formatCurrencyEs } from '../../utils/numberFormat';
import { toast } from 'sonner';
import {
  runCashFlowProjection,
  type ProjectionAlert,
  type ProjectionHorizonInput,
} from '../../smartCashFlow';
import type { IsoDate } from '../../smartCashFlow/types';
import { suggestScheduleLinesFromConfig } from '../../smartCashFlow/fromConfigSuggestions';
import {
  scheduleLinesFromHistoricalTransactions,
  realizedTotalsInHorizon,
  type HistoricalDistribution,
  type HistoricalKindFilter,
} from '../../smartCashFlow/fromTransactions';

export interface SmartCashFlowSimulationProps {
  config: ConfigStructure;
  systemSettings: SystemSettings;
  transactions: Transaction[];
  invoices: InvoiceDraft[];
  /** Fecha contextual (ej. mes mostrado en el sistema). */
  currentDate?: Date;
  onUpdateSystemSettings: (next: SystemSettings) => void;
}

function newLineId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? `scf-${crypto.randomUUID()}`
    : `scf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultHorizon(reference: Date): { start: IsoDate; end: IsoDate } {
  const y = reference.getFullYear();
  const m = reference.getMonth() + 1;
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const last = new Date(y, reference.getMonth() + 1, 0).getDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { start, end };
}

function buildProjectionInput(params: {
  start: IsoDate;
  end: IsoDate;
  opening: number;
  lines: SmartCashFlowScheduleLine[];
  includeInvoices: boolean;
  invoices: InvoiceDraft[];
}): ProjectionHorizonInput {
  const inflows: ProjectionHorizonInput['inflows'] = [];
  const outflows: ProjectionHorizonInput['outflows'] = [];

  for (const line of params.lines) {
    if (line.date < params.start || line.date > params.end) continue;
    if (line.kind === 'inflow') {
      inflows.push({
        id: line.id,
        label: line.label,
        amount: Number(line.amount) || 0,
        date: line.date,
      });
    } else {
      outflows.push({
        id: line.id,
        label: line.label,
        amount: Number(line.amount) || 0,
        dueDate: line.date,
        flexibility: line.flexibility,
        priorityRank:
          line.flexibility === 'flexible' ? line.priorityRank ?? undefined : undefined,
      });
    }
  }

  if (params.includeInvoices) {
    for (const inv of params.invoices) {
      if (inv.status === 'rejected' || inv.status === 'paid') continue;
      if (inv.dueDate < params.start || inv.dueDate > params.end) continue;
      outflows.push({
        id: `scf-inv-${inv.id}`,
        label: `Factura ${inv.invoiceNumber} — ${inv.provider}`,
        amount: Number(inv.total) || 0,
        dueDate: inv.dueDate,
        flexibility: 'flexible',
        priorityRank: 120,
      });
    }
  }

  return {
    startDate: params.start,
    endDate: params.end,
    openingBalance: params.opening,
    inflows,
    outflows,
  };
}

function alertBadgeVariant(kind: ProjectionAlert['kind']): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (kind) {
    case 'NEGATIVE_AFTER_FIXED':
    case 'NEGATIVE_AFTER_FLEX_PAID':
    case 'SHORTFALL_PENDING_FLEX_END':
      return 'destructive';
    case 'FLEX_DEFERRED':
      return 'secondary';
    default:
      return 'outline';
  }
}

function defaultHistRangeIso(ref: Date): { from: string; to: string } {
  const prev = subMonths(ref, 1);
  return {
    from: format(startOfMonth(prev), 'yyyy-MM-dd'),
    to: format(endOfMonth(prev), 'yyyy-MM-dd'),
  };
}

export function SmartCashFlowSimulation({
  config,
  systemSettings,
  transactions,
  invoices,
  currentDate = new Date(),
  onUpdateSystemSettings,
}: SmartCashFlowSimulationProps) {
  const dh = defaultHorizon(currentDate);
  const [draft, setDraft] = useState(() =>
    mergeSmartCashFlowSettings(systemSettings.smartCashFlow)
  );

  useEffect(() => {
    setDraft(mergeSmartCashFlowSettings(systemSettings.smartCashFlow));
  }, [systemSettings.smartCashFlow]);

  const histDefaults = defaultHistRangeIso(currentDate);
  const [histFrom, setHistFrom] = useState(histDefaults.from);
  const [histTo, setHistTo] = useState(histDefaults.to);
  const [histKind, setHistKind] = useState<HistoricalKindFilter>('all');
  const [histDistribution, setHistDistribution] =
    useState<HistoricalDistribution>('month_avg_per_horizon_month');

  useEffect(() => {
    const d = defaultHistRangeIso(currentDate);
    setHistFrom(d.from);
    setHistTo(d.to);
  }, [format(currentDate, 'yyyy-MM')]);

  const horizonStart =
    draft.horizonStart && draft.horizonStart.length >= 10 ? draft.horizonStart : dh.start;
  const horizonEnd = draft.horizonEnd && draft.horizonEnd.length >= 10 ? draft.horizonEnd : dh.end;

  const openingSim =
    draft.simulationOpeningBalance != null && draft.simulationOpeningBalance !== ''
      ? Number(draft.simulationOpeningBalance)
      : Number(systemSettings.initialBalance ?? 0);

  const projectionInput = useMemo(
    () =>
      buildProjectionInput({
        start: horizonStart,
        end: horizonEnd,
        opening: Number.isFinite(openingSim) ? openingSim : 0,
        lines: draft.scheduleLines ?? [],
        includeInvoices: !!draft.includeInvoiceDueDates,
        invoices,
      }),
    [
      horizonStart,
      horizonEnd,
      openingSim,
      draft.scheduleLines,
      draft.includeInvoiceDueDates,
      invoices,
    ]
  );

  const result = useMemo(() => runCashFlowProjection(projectionInput), [projectionInput]);

  const realizedHorizon = useMemo(
    () => realizedTotalsInHorizon(transactions, horizonStart, horizonEnd),
    [transactions, horizonStart, horizonEnd]
  );

  const programTotalsInHorizon = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const l of draft.scheduleLines ?? []) {
      if (l.date < horizonStart || l.date > horizonEnd) continue;
      const a = Number(l.amount) || 0;
      if (l.kind === 'inflow') income += a;
      else expense += a;
    }
    return {
      income,
      expense,
      net: income - expense,
      count: (draft.scheduleLines ?? []).filter(
        (l) => l.date >= horizonStart && l.date <= horizonEnd
      ).length,
    };
  }, [draft.scheduleLines, horizonStart, horizonEnd]);

  const chartData = useMemo(
    () =>
      result.days.map((d) => ({
        date: d.date,
        cerrado: Number(d.closingBalance.toFixed(2)),
      })),
    [result.days]
  );

  const saveDraftToSettings = useCallback(() => {
    onUpdateSystemSettings({
      ...systemSettings,
      smartCashFlow: draft,
    });
    toast.success('Programa Smart Cash Flow guardado');
  }, [draft, onUpdateSystemSettings, systemSettings]);

  const patchDraft = useCallback((patch: Partial<typeof draft>) => {
    setDraft((prev) => ({ ...mergeSmartCashFlowSettings(prev), ...patch }));
  }, []);

  const addRow = () => {
    patchDraft({
      scheduleLines: [
        ...(draft.scheduleLines ?? []),
        {
          id: newLineId(),
          kind: 'outflow',
          label: 'Nuevo ítem',
          amount: 0,
          date: horizonStart,
          flexibility: 'flexible',
          priorityRank: 100,
        },
      ],
    });
  };

  const removeRow = (id: string) => {
    patchDraft({
      scheduleLines: (draft.scheduleLines ?? []).filter((x) => x.id !== id),
    });
  };

  const updateRow = (id: string, patch: Partial<SmartCashFlowScheduleLine>) => {
    patchDraft({
      scheduleLines: (draft.scheduleLines ?? []).map((row) =>
        row.id === id ? { ...row, ...patch } : row
      ),
    });
  };

  const importFromTransactions = () => {
    const rows = scheduleLinesFromHistoricalTransactions({
      transactions,
      config,
      histStart: histFrom,
      histEnd: histTo,
      horizonStart,
      horizonEnd,
      kindFilter: histKind,
      distribution: histDistribution,
    });
    if (rows.length === 0) {
      toast.message('Sin datos que importar', {
        description: 'No hay transacciones en el período y filtro seleccionados.',
      });
      return;
    }
    patchDraft({ scheduleLines: [...(draft.scheduleLines ?? []), ...rows] });
    toast.success(`Se agregaron ${rows.length} línea(s) desde el historial (revisalas y Guardar programa)`);
  };

  const fillFromConfig = () => {
    const suggested = suggestScheduleLinesFromConfig(config, horizonStart, horizonEnd);
    if (suggested.length === 0) {
      toast.message('Sin sugerencias', {
        description:
          'En Configuración → Operaciones definí montos estimados (`estimatedAmount`) en los conceptos del flujo.',
      });
      return;
    }
    const existing = new Set((draft.scheduleLines ?? []).map((l) => l.id));
    const merged = [...(draft.scheduleLines ?? [])];
    for (const s of suggested) {
      if (!existing.has(s.id)) merged.push(s);
    }
    patchDraft({ scheduleLines: merged });
    toast.success(`Se agregaron ${suggested.length} línea(s) sugeridas`);
  };

  const minBal = chartData.length ? Math.min(...chartData.map((d) => d.cerrado)) : 0;
  const hasGap = minBal < 0 || result.unresolvedFlex.length > 0;

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-120px)] min-h-[480px] text-foreground">
      <div className="flex flex-wrap items-start justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-500/10"
            style={{ boxShadow: '0 0 24px rgba(34,211,238,0.12)' }}
          >
            <BrainCircuit className="h-6 w-6 text-cyan-300" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight" style={{ color: '#22d3ee' }}>
              Proyección inteligente
            </h2>
            <p className="text-xs text-muted-foreground max-w-xl">
              Simula cobros y pagos programados con reglas de prioridad en gastos flexibles. Los datos se
              guardan en configuración del sistema (KV).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={fillFromConfig}>
            <Sparkles className="h-4 w-4 mr-1 text-amber-300" /> Llenar desde estructura
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={importFromTransactions}>
            <History className="h-4 w-4 mr-1 text-sky-300" /> Importar desde transacciones
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={saveDraftToSettings}
            className="bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-400/30"
          >
            <Save className="h-4 w-4 mr-1" /> Guardar programa
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-12 shrink-0">
        <Card className="border-cyan-500/15 bg-[rgba(13,11,30,0.65)] xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-cyan-200">Horizonte</CardTitle>
            <CardDescription className="text-xs">Rango inclusivo yyyy-MM-dd</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Desde</Label>
                <Input
                  type="date"
                  value={horizonStart}
                  onChange={(e) => patchDraft({ horizonStart: e.target.value })}
                  className="mt-1 h-9 bg-slate-950/60 border-cyan-500/20"
                />
              </div>
              <div>
                <Label className="text-xs">Hasta</Label>
                <Input
                  type="date"
                  value={horizonEnd}
                  onChange={(e) => patchDraft({ horizonEnd: e.target.value })}
                  className="mt-1 h-9 bg-slate-950/60 border-cyan-500/20"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Saldo inicial simulación (S/) </Label>
              <Input
                type="number"
                step="0.01"
                value={
                  draft.simulationOpeningBalance != null
                    ? String(draft.simulationOpeningBalance)
                    : ''
                }
                placeholder={String(systemSettings.initialBalance ?? 0)}
                onChange={(e) =>
                  patchDraft({
                    simulationOpeningBalance:
                      e.target.value === '' ? null : Number(e.target.value.replace(',', '.')),
                  })
                }
                className="mt-1 h-9 bg-slate-950/60 border-cyan-500/20 font-mono"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Vacío = saldo inicial de{' '}
                <span className="text-cyan-300">{formatCurrencyEs(systemSettings.initialBalance ?? 0)}</span>{' '}
                (Operaciones → Flujo de caja).
              </p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-cyan-500/10 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Facturas pendientes</p>
                <p className="text-[11px] text-muted-foreground">
                  Suma pagos proyectados por fecha de vencimiento.
                </p>
              </div>
              <Switch
                checked={!!draft.includeInvoiceDueDates}
                onCheckedChange={(v) => patchDraft({ includeInvoiceDueDates: v })}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/15 bg-[rgba(13,11,30,0.65)] xl:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-cyan-200 flex items-center gap-2">
              <History className="h-4 w-4" /> Historial → programa (Fase 3)
            </CardTitle>
            <CardDescription className="text-xs">
              Usa tus transacciones reales agrupadas; la rigidez fijo/flexible se infiere del plan operativo cuando
              coincide el concepto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Hist. desde</Label>
                <Input
                  type="date"
                  value={histFrom}
                  onChange={(e) => setHistFrom(e.target.value)}
                  className="mt-1 h-9 bg-slate-950/60 border-cyan-500/20 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Hist. hasta</Label>
                <Input
                  type="date"
                  value={histTo}
                  onChange={(e) => setHistTo(e.target.value)}
                  className="mt-1 h-9 bg-slate-950/60 border-cyan-500/20 text-xs"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[140px]">
                <Label className="text-xs">Filtro</Label>
                <Select
                  value={histKind}
                  onValueChange={(v) => setHistKind(v as HistoricalKindFilter)}
                >
                  <SelectTrigger className="mt-1 h-9 text-xs bg-slate-950/60 border-cyan-500/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="income">Solo ingresos</SelectItem>
                    <SelectItem value="expense">Solo egresos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-xs"
                onClick={() => setHistDistribution('lump_at_start')}
                title="Resumen único sobre la fecha inicial del horizonte"
              >
                Consolidar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-xs"
                onClick={() =>
                  setHistDistribution('month_avg_per_horizon_month')
                }
                title="Mes típico = total período histórico / meses de ese período; repite cada mes natural del horizonte"
              >
                Por mes proyectado
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground rounded bg-black/25 px-2 py-1 border border-white/10">
              Modo activo:{' '}
              <strong className="text-cyan-200">
                {histDistribution === 'lump_at_start'
                  ? 'Consolidado al inicio del horizonte'
                  : 'Mensual (promedio del período histórico repetido cada mes natural)'}
              </strong>
              . Las líneas llevan etiqueta{' '}
              <code className="text-emerald-300/90">
                {'[Hist yyyy-MM-dd→…]'}
              </code>
              .
            </p>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/15 bg-[rgba(13,11,30,0.65)] xl:col-span-5">
          <CardHeader className="pb-0 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                Saldo proyectado{' '}
                {hasGap && (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <AlertTriangle className="h-3 w-3" /> Brecha detectada
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Cierra día a día después de cobros → fijos → flexibles prioritarios.
              </CardDescription>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              {projectionInput.startDate} → {projectionInput.endDate}
            </span>
          </CardHeader>
          <CardContent className="h-[200px] pt-3">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickFormatter={(v) => {
                      try {
                        return format(new Date(v + 'T12:00:00'), 'dd/MM', { locale: es });
                      } catch {
                        return String(v).slice(5);
                      }
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickFormatter={(n) => {
                      const v = Number(n);
                      return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v));
                    }}
                  />
                  <Tooltip
                    formatter={(val: number) => [formatCurrencyEs(Number(val)), 'Saldo']}
                    labelFormatter={(l) =>
                      `${l}${result.alerts.some((a) => a.date === l) ? ' · Revisar alertas' : ''}`
                    }
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(34,211,238,0.2)' }}
                  />
                  <ReferenceLine y={0} stroke="#fb7185" strokeDasharray="4 4" />
                  <Line
                    type="monotone"
                    dataKey="cerrado"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, fill: '#22d3ee' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Sin días en el horizonte.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-cyan-500/15 bg-[rgba(13,11,30,0.65)] shrink-0">
        <CardHeader className="py-3 pb-2 flex flex-row items-start gap-2">
          <BarChart3 className="h-4 w-4 text-cyan-300 mt-1 shrink-0" />
          <div>
            <CardTitle className="text-sm text-cyan-100">Comparativa en el horizonte (Fase 3)</CardTitle>
            <CardDescription className="text-xs">
              <strong className="text-slate-200">Programa:</strong> sólo líneas de la tabla editable con fecha
              dentro del rango (no incluye el extra de facturas si activaste el interruptor arriba — eso sí va al
              motor y al gráfico). <strong className="text-slate-200">Realizado:</strong> transacciones
              registradas en el mismo rango; referencia contextual.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Programa · ingresos
              </p>
              <p className="font-mono text-emerald-300">{formatCurrencyEs(programTotalsInHorizon.income)}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Programa · egresos
              </p>
              <p className="font-mono text-rose-300">{formatCurrencyEs(programTotalsInHorizon.expense)}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Realizado · ingreso − egreso
              </p>
              <p className={`font-mono ${realizedHorizon.net >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {formatCurrencyEs(realizedHorizon.net)}{' '}
                <span className="text-[11px] text-muted-foreground">
                  (Ing. {formatCurrencyEs(realizedHorizon.income)} · Egr.{' '}
                  {formatCurrencyEs(realizedHorizon.expense)})
                </span>
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Líneas en programa ({horizonStart} … {horizonEnd})
              </p>
              <p className="font-mono text-cyan-200">{programTotalsInHorizon.count}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-12 flex-1 min-h-[220px]">
        <Card className="border-cyan-500/15 bg-[rgba(13,11,30,0.65)] lg:col-span-7 flex flex-col min-h-[200px]">
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Programa (ingresos / egresos)</CardTitle>
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-4 w-4 mr-1" /> Nueva línea
            </Button>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
            <ScrollArea className="h-[260px] lg:h-[min(42vh,360px)]">
              <Table>
                <TableHeader>
                  <TableRow className="border-cyan-500/15 hover:bg-transparent">
                    <TableHead className="w-[84px]">Tipo</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="w-[110px]">Fecha</TableHead>
                    <TableHead className="w-[120px] text-right">Monto</TableHead>
                    <TableHead className="w-[100px]">Rigidez</TableHead>
                    <TableHead className="w-[72px]">Pri.</TableHead>
                    <TableHead className="w-[48px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(draft.scheduleLines ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                        Sin líneas. Usá «Nueva línea» o «Llenar desde estructura», luego Guardar programa.
                      </TableCell>
                    </TableRow>
                  ) : (
                    [...(draft.scheduleLines ?? [])]
                      .sort((a, b) => (a.date === b.date ? a.label.localeCompare(b.label) : a.date.localeCompare(b.date)))
                      .map((row) => (
                        <TableRow key={row.id} className="border-cyan-500/10 hover:bg-white/5">
                          <TableCell>
                            <Select
                              value={row.kind}
                              onValueChange={(v) =>
                                updateRow(row.id, {
                                  kind: v as SmartCashFlowScheduleLine['kind'],
                                  flexibility:
                                    v === 'inflow' ? row.flexibility : row.flexibility ?? 'flexible',
                                })
                              }
                            >
                              <SelectTrigger className="h-8 text-[11px] bg-slate-950/60 border-cyan-500/15">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="inflow">Ingreso</SelectItem>
                                <SelectItem value="outflow">Egreso</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 text-xs bg-slate-950/60 border-cyan-500/15"
                              value={row.label}
                              onChange={(e) => updateRow(row.id, { label: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              className="h-8 text-xs bg-slate-950/60 border-cyan-500/15"
                              value={row.date.slice(0, 10)}
                              onChange={(e) => updateRow(row.id, { date: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              className="h-8 text-xs text-right font-mono bg-slate-950/60 border-cyan-500/15"
                              value={row.amount}
                              onChange={(e) =>
                                updateRow(row.id, { amount: Number(e.target.value.replace(',', '.')) })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            {row.kind === 'inflow' ? (
                              <span className="text-[11px] text-muted-foreground">—</span>
                            ) : (
                              <Select
                                value={row.flexibility}
                                onValueChange={(v) =>
                                  updateRow(row.id, {
                                    flexibility: v as 'fixed' | 'flexible',
                                  })
                                }
                              >
                                <SelectTrigger className="h-8 text-[11px] bg-slate-950/60 border-cyan-500/15">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="fixed">Fijo</SelectItem>
                                  <SelectItem value="flexible">Flexible</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.kind === 'outflow' && row.flexibility === 'flexible' ? (
                              <Input
                                type="number"
                                step={1}
                                className="h-8 px-2 text-xs text-center bg-slate-950/60 border-cyan-500/15"
                                value={row.priorityRank ?? ''}
                                onChange={(e) =>
                                  updateRow(row.id, {
                                    priorityRank: e.target.value ? Number(e.target.value) : 100,
                                  })
                                }
                              />
                            ) : (
                              <span className="text-[11px] text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-rose-400 hover:text-rose-300"
                              aria-label="Eliminar"
                              onClick={() => removeRow(row.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="lg:col-span-5 flex flex-col gap-3 min-h-[200px]">
          <Card className="border-cyan-500/15 bg-[rgba(13,11,30,0.65)] flex-1 flex flex-col">
            <CardHeader className="py-2">
              <CardTitle className="text-sm flex items-center gap-2">
                Alertas{' '}
                <Badge variant="outline" className="text-[10px] font-mono">
                  {result.alerts.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 flex-1 overflow-hidden">
              <ScrollArea className="h-[210px]">
                <ul className="space-y-2 pr-2">
                  {result.alerts.map((a, i) => (
                    <li
                      key={`${a.kind}-${a.date}-${i}`}
                      className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-xs"
                    >
                      <span className="flex flex-wrap items-center gap-1 mb-1">
                        <Badge variant={alertBadgeVariant(a.kind)} className="text-[10px]">
                          {a.kind}
                        </Badge>
                        <span className="text-muted-foreground font-mono">{a.date}</span>
                      </span>
                      <p className="text-slate-200 leading-snug">{a.message}</p>
                    </li>
                  ))}
                  {result.alerts.length === 0 && (
                    <li className="text-sm text-muted-foreground px-2">Sin alertas en este escenario.</li>
                  )}
                </ul>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border-cyan-500/15 bg-[rgba(13,11,30,0.65)] shrink-0">
            <CardHeader className="py-2 pb-1">
              <CardTitle className="text-xs text-muted-foreground">Resumen final</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1 pb-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saldo inicial</span>
                <span className="font-mono">{formatCurrencyEs(projectionInput.openingBalance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saldo al {projectionInput.endDate}</span>
                <span
                  className={`font-mono ${
                    ((result.days.at(-1)?.closingBalance ?? projectionInput.openingBalance) ?? 0) < 0
                      ? 'text-rose-400'
                      : 'text-emerald-300'
                  }`}
                >
                  {formatCurrencyEs(result.days.at(-1)?.closingBalance ?? projectionInput.openingBalance)}
                </span>
              </div>
              {result.unresolvedFlex.length > 0 && (
                <p className="text-[11px] text-rose-300 pt-2">
                  {result.unresolvedFlex.length} gasto flexible sin cubrir al cierre del horizonte.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="rounded-md border border-white/10 bg-black/25 p-3 text-[11px] text-muted-foreground leading-snug">
            Los <strong className="text-slate-200">egresos fijos</strong> aplican ese día sí o sí. Los{' '}
            <strong className="text-slate-200">flexibles</strong> pueden aplazarse según disponibilidad y orden
            de prioridad (número más bajo = primero).
          </div>
        </div>
      </div>
    </div>
  );
}
