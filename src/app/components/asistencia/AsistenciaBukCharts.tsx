import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { BukDashboardAreaGroup, BukDashboardSummary } from '../../utils/asistenciaBukDashboard';

const COLORS = {
  onTime: '#34d399',
  late: '#fb923c',
  absent: '#f87171',
  arrived: '#22d3ee',
  left: '#fbbf24',
};

function truncateLabel(label: string, max = 22): string {
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1)}…`;
}

type ChartTooltipProps = {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
};

function DarkTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover dark:border-slate-700 dark:bg-slate-950/95 px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }} className="tabular-nums">
          {entry.name}: {entry.value ?? 0}
        </p>
      ))}
    </div>
  );
}

export type BukAreaChartDatum = {
  area: string;
  label: string;
  total: number;
  llegaron: number;
  aTiempo: number;
  tarde: number;
  sinEntrada: number;
  conSalida: number;
  puntualidadPct: number;
  asistenciaPct: number;
};

export function buildBukAreaChartData(groups: BukDashboardAreaGroup[]): BukAreaChartDatum[] {
  return groups.map((g) => ({
    area: g.area,
    label: truncateLabel(g.area),
    total: g.total,
    llegaron: g.arrived,
    aTiempo: g.onTime,
    tarde: g.late,
    sinEntrada: g.absent,
    conSalida: g.leftSameDay,
    puntualidadPct: g.arrived > 0 ? Math.round((g.onTime / g.arrived) * 100) : 0,
    asistenciaPct: g.total > 0 ? Math.round((g.arrived / g.total) * 100) : 0,
  }));
}

type Props = {
  summary: BukDashboardSummary;
  areaGroups: BukDashboardAreaGroup[];
};

export function AsistenciaBukCharts({ summary, areaGroups }: Props) {
  const chartData = buildBukAreaChartData(areaGroups);

  const globalPie = [
    { name: 'A tiempo', value: summary.onTime, color: COLORS.onTime },
    { name: 'Tardanza', value: summary.late, color: COLORS.late },
    { name: 'Sin entrada', value: summary.absent, color: COLORS.absent },
  ].filter((d) => d.value > 0);

  if (chartData.length === 0) {
    return (
      <p className="text-center text-slate-500 py-8 text-sm">
        Sin datos por área para los filtros aplicados.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-xl border border-border dark:border-slate-800 bg-slate-900/40 p-4">
          <p className="text-sm font-semibold text-foreground mb-1">Asistencia por área</p>
          <p className="text-xs text-muted-foreground mb-4">
            Personas con entrada marcada, a tiempo, con tardanza y sin entrada.
          </p>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  angle={-28}
                  textAnchor="end"
                  height={64}
                  interval={0}
                />
                <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip content={<DarkTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
                <Bar dataKey="aTiempo" name="A tiempo" fill={COLORS.onTime} radius={[4, 4, 0, 0]} />
                <Bar dataKey="tarde" name="Tardanza" fill={COLORS.late} radius={[4, 4, 0, 0]} />
                <Bar dataKey="sinEntrada" name="Sin entrada" fill={COLORS.absent} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border dark:border-slate-800 bg-slate-900/40 p-4">
          <p className="text-sm font-semibold text-foreground mb-1">Distribución global</p>
          <p className="text-xs text-muted-foreground mb-4">Puntualidad del personal con entrada ese día.</p>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={globalPie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  {globalPie.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<DarkTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border dark:border-slate-800 bg-slate-900/40 p-4">
          <p className="text-sm font-semibold text-foreground mb-1">% puntualidad por área</p>
          <p className="text-xs text-muted-foreground mb-4">
            A tiempo ÷ llegaron (solo quienes marcaron entrada).
          </p>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[...chartData].sort((a, b) => b.puntualidadPct - a.puntualidadPct)}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={120}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="puntualidadPct" name="% puntualidad" fill="#818cf8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border dark:border-slate-800 bg-slate-900/40 p-4">
          <p className="text-sm font-semibold text-foreground mb-1">Llegadas y salidas por área</p>
          <p className="text-xs text-muted-foreground mb-4">
            Total registrados en Buk, con entrada y con salida el mismo día.
          </p>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  angle={-28}
                  textAnchor="end"
                  height={64}
                  interval={0}
                />
                <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip content={<DarkTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
                <Bar dataKey="total" name="En sede" fill="#64748b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="llegaron" name="Llegaron" fill={COLORS.arrived} radius={[4, 4, 0, 0]} />
                <Bar dataKey="conSalida" name="Con salida" fill={COLORS.left} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden dark:border-slate-800">
        <div className="border-b border-border bg-muted/50 dark:border-slate-800 dark:bg-slate-900/80 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Resumen numérico por área</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground dark:border-slate-800 text-left">
                <th className="px-4 py-2 font-medium">Área</th>
                <th className="px-4 py-2 font-medium text-right">Total</th>
                <th className="px-4 py-2 font-medium text-right">Llegaron</th>
                <th className="px-4 py-2 font-medium text-right">A tiempo</th>
                <th className="px-4 py-2 font-medium text-right">Tarde</th>
                <th className="px-4 py-2 font-medium text-right">Sin entrada</th>
                <th className="px-4 py-2 font-medium text-right">% asistencia</th>
                <th className="px-4 py-2 font-medium text-right">% puntualidad</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((row) => (
                <tr key={row.area} className="border-b border-border/60 hover:bg-muted/30 dark:border-slate-800/60 dark:hover:bg-slate-900/40">
                  <td className="px-4 py-2 text-foreground max-w-[200px] truncate" title={row.area}>
                    {row.area}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-300 tabular-nums">{row.total}</td>
                  <td className="px-4 py-2 text-right text-cyan-300 tabular-nums">{row.llegaron}</td>
                  <td className="px-4 py-2 text-right text-emerald-300 tabular-nums">{row.aTiempo}</td>
                  <td className="px-4 py-2 text-right text-orange-300 tabular-nums">{row.tarde}</td>
                  <td className="px-4 py-2 text-right text-red-300 tabular-nums">{row.sinEntrada}</td>
                  <td className="px-4 py-2 text-right text-slate-300 tabular-nums">{row.asistenciaPct}%</td>
                  <td className="px-4 py-2 text-right text-indigo-300 tabular-nums">
                    {row.llegaron > 0 ? `${row.puntualidadPct}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
