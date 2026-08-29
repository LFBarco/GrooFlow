import { Package, Shirt, Users, AlertCircle } from 'lucide-react';

import type { UniformesKpiSnapshot } from '../../types/uniformes';
import { UNIFORM_ITEM_LABELS, UNIFORM_REASON_LABELS } from '../../types/uniformes';
import { Card, CardContent } from '../ui/card';

type Props = {
  kpis: UniformesKpiSnapshot;
};

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
  icon: typeof Package;
  accent: string;
}) {
  return (
    <Card className="border-border dark:border-slate-700">
      <CardContent className="flex items-start gap-3 p-4">
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
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Entregas registradas"
          value={String(kpis.totalDeliveries)}
          subtitle="En el periodo filtrado"
          icon={Package}
          accent="bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"
        />
        <KpiCard
          title="Prendas entregadas"
          value={String(kpis.totalItems)}
          subtitle="Unidades totales"
          icon={Shirt}
          accent="bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
        />
        <KpiCard
          title="Colaboradores"
          value={String(kpis.uniqueStaff)}
          subtitle="Con al menos una entrega"
          icon={Users}
          accent="bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
        />
        <KpiCard
          title="Pendientes de firma"
          value={String(kpis.pendingSignature)}
          subtitle="Requieren confirmación"
          icon={AlertCircle}
          accent="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border dark:border-slate-700">
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Por tipo de prenda</h3>
            {kpis.byItemType.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos en el periodo.</p>
            ) : (
              <ul className="space-y-2">
                {kpis.byItemType
                  .sort((a, b) => b.items - a.items)
                  .map((row) => (
                    <li key={row.type} className="flex items-center justify-between text-sm">
                      <span>{UNIFORM_ITEM_LABELS[row.type]}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {row.items} uds · {row.count} entregas
                      </span>
                    </li>
                  ))}
              </ul>
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
                    className="rounded-full border border-border bg-muted/30 px-3 py-1 text-xs dark:border-slate-700"
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
