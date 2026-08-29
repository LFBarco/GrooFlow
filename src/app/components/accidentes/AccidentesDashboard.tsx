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
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  CalendarCheck,
  DollarSign,
  ShieldAlert,
  TrendingDown,
} from 'lucide-react';

import type { AccidentesKpiSnapshot } from '../../types/accidentes';
import { ACCIDENT_SEVERITY_LABELS } from '../../types/accidentes';
import { Card, CardContent } from '../ui/card';
import { ChartEmptyState } from '../ui/ChartEmptyState';
import { BodyHeatMap } from './BodyHeatMap';

const SEVERITY_COLORS: Record<string, string> = {
  leve: '#fbbf24',
  grave: '#fb923c',
  muy_grave: '#f87171',
  mortal: '#dc2626',
};

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
};

function ChartTooltip({ active, payload, label }: TooltipProps) {
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
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: typeof Activity;
  accent: string;
}) {
  return (
    <Card className="border-border dark:border-slate-700">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p>
          </div>
          <div
            className="rounded-xl p-2"
            style={{ background: `${accent}18`, color: accent }}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type Props = {
  kpis: AccidentesKpiSnapshot;
};

export function AccidentesDashboard({ kpis }: Props) {
  const severityData = kpis.bySeverity.map((s) => ({
    name: ACCIDENT_SEVERITY_LABELS[s.severity],
    value: s.count,
    fill: SEVERITY_COLORS[s.severity],
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          title="Índice de Frecuencia (IF)"
          value={kpis.frequencyIndex.toFixed(2)}
          subtitle="Accidentes c/baja × 10⁶ / HH"
          icon={Activity}
          accent="#8b5cf6"
        />
        <KpiCard
          title="Índice de Gravedad (IG)"
          value={kpis.gravityIndex.toFixed(2)}
          subtitle="Días perdidos × 10³ / HH"
          icon={TrendingDown}
          accent="#f97316"
        />
        <KpiCard
          title="Tasa de siniestralidad"
          value={`${kpis.sinistralityRate}%`}
          subtitle={`${kpis.accidentsWithLostTime} trabajadores / ${kpis.activeWorkers}`}
          icon={ShieldAlert}
          accent="#ef4444"
        />
        <KpiCard
          title="Días sin accidentes"
          value={String(kpis.daysWithoutAccident)}
          subtitle={
            kpis.lastAccidentDate
              ? `Último: ${kpis.lastAccidentDate}`
              : 'Sin registros con baja'
          }
          icon={CalendarCheck}
          accent="#22c55e"
        />
        <KpiCard
          title="Costo total SST"
          value={`S/ ${kpis.totalCost.toLocaleString('es-PE')}`}
          subtitle={`Médico S/ ${kpis.medicalCost.toLocaleString('es-PE')}`}
          icon={DollarSign}
          accent="#0ea5e9"
        />
        <KpiCard
          title="Horas hombre (est.)"
          value={kpis.manHours.toLocaleString('es-PE')}
          subtitle={`${kpis.totalAccidents} incidentes · ${kpis.totalLostDays} días perdidos`}
          icon={AlertTriangle}
          accent="#64748b"
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
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="count" name="Accidentes" stroke="#8b5cf6" strokeWidth={2} />
                    <Line type="monotone" dataKey="lostDays" name="Días perdidos" stroke="#f97316" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border dark:border-slate-700">
          <CardContent className="pt-4">
            <h3 className="mb-3 text-sm font-semibold">Por gravedad</h3>
            {severityData.length === 0 ? (
              <ChartEmptyState message="Sin datos en el periodo" />
            ) : (
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={severityData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                      {severityData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border dark:border-slate-700">
          <CardContent className="pt-4">
            <h3 className="mb-3 text-sm font-semibold">Por área de trabajo</h3>
            {kpis.byArea.length === 0 ? (
              <ChartEmptyState message="Sin datos en el periodo" />
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={kpis.byArea} layout="vertical" margin={{ left: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="area" width={110} tick={{ fontSize: 10 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Accidentes" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <BodyHeatMap data={kpis.byBodyPart} />
      </div>
    </div>
  );
}
