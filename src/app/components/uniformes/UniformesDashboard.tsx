import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertCircle, CircleHelp, Package, Shirt, Users } from 'lucide-react';

import type { UniformesKpiSnapshot } from '../../types/uniformes';
import { UNIFORM_ITEM_LABELS, UNIFORM_REASON_LABELS } from '../../types/uniformes';
import { Card, CardContent } from '../ui/card';
import { ChartEmptyState } from '../ui/ChartEmptyState';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

const ITEM_COLORS = ['#6366f1', '#0ea5e9', '#ec4899', '#f97316', '#10b981', '#8b5cf6', '#14b8a6', '#f59e0b'];

type Props = {
  kpis: UniformesKpiSnapshot;
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
};

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl dark:border-slate-700">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((e) => (
        <p key={e.name} style={{ color: e.color }} className="tabular-nums">
          {e.name}: {e.value ?? 0}
        </p>
      ))}
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  help,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  subtitle: string;
  help: string;
  icon: typeof Package;
  accent: string;
}) {
  return (
    <Card className="relative border-border dark:border-slate-700">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="absolute right-2.5 top-2.5 z-10 rounded-full text-muted-foreground/70 hover:text-foreground"
            aria-label={`Qué significa: ${title}`}
          >
            <CircleHelp className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] text-xs">
          {help}
        </TooltipContent>
      </Tooltip>
      <CardContent className="flex items-start gap-3 p-4 pr-8">
        <div className={`rounded-lg p-2 ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function UniformesDashboard({ kpis }: Props) {
  const itemChartData = [...kpis.byItemType]
    .sort((a, b) => b.items - a.items)
    .map((row) => ({
      name: UNIFORM_ITEM_LABELS[row.type],
      items: row.items,
      entregas: row.count,
    }));

  const pieData = itemChartData.map((row, i) => ({
    name: row.name,
    value: row.items,
    fill: ITEM_COLORS[i % ITEM_COLORS.length],
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Entregas registradas"
          value={String(kpis.totalDeliveries)}
          subtitle="En el periodo filtrado"
          help="Cantidad de actas o registros de entrega en el rango de fechas activo."
          icon={Package}
          accent="bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"
        />
        <KpiCard
          title="Prendas entregadas"
          value={String(kpis.totalItems)}
          subtitle="Unidades totales"
          help="Suma de todas las unidades (cantidad por ítem) en las entregas del periodo."
          icon={Shirt}
          accent="bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
        />
        <KpiCard
          title="Colaboradores"
          value={String(kpis.uniqueStaff)}
          subtitle="Con al menos una entrega"
          help="Personas distintas que recibieron uniformes en el periodo filtrado."
          icon={Users}
          accent="bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
        />
        <KpiCard
          title="Pendientes de firma"
          value={String(kpis.pendingSignature)}
          subtitle={
            kpis.renewalsOverdue + kpis.renewalsDueSoon > 0
              ? `${kpis.renewalsOverdue} renov. vencida(s) · ${kpis.renewalsDueSoon} próxima(s)`
              : 'Requieren confirmación'
          }
          help="Entregas con firma pendiente. También se muestran renovaciones anuales vencidas o próximas (12 meses desde la última entrega)."
          icon={AlertCircle}
          accent="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border dark:border-slate-700">
          <CardContent className="pt-4">
            <h3 className="mb-3 text-sm font-semibold">Tendencia mensual</h3>
            {kpis.byMonth.length === 0 ? (
              <ChartEmptyState message="Sin datos en el periodo" />
            ) : (
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={kpis.byMonth}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <RechartsTooltip content={<ChartTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="deliveries"
                      name="Entregas"
                      stroke="#6366f1"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="items"
                      name="Prendas"
                      stroke="#0ea5e9"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border dark:border-slate-700">
          <CardContent className="pt-4">
            <h3 className="mb-3 text-sm font-semibold">Por tipo de prenda</h3>
            {pieData.length === 0 ? (
              <ChartEmptyState message="Sin datos en el periodo" />
            ) : (
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border dark:border-slate-700">
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Unidades por prenda</h3>
            {itemChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos en el periodo.</p>
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={itemChartData} layout="vertical" margin={{ left: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                    <RechartsTooltip content={<ChartTooltip />} />
                    <Bar dataKey="items" name="Unidades" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border dark:border-slate-700">
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Por sede</h3>
            {kpis.bySede.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos en el periodo.</p>
            ) : (
              <ul className="space-y-2">
                {kpis.bySede.map((row) => (
                  <li key={row.sede} className="flex items-center justify-between text-sm">
                    <span>{row.sede}</span>
                    <span className="tabular-nums text-muted-foreground">{row.count} entregas</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border dark:border-slate-700 lg:col-span-2">
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Por motivo de entrega</h3>
            {kpis.byReason.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos en el periodo.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {kpis.byReason.map((row) => (
                  <span
                    key={row.reason}
                    className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100"
                  >
                    {UNIFORM_REASON_LABELS[row.reason]}: <strong>{row.count}</strong>
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
