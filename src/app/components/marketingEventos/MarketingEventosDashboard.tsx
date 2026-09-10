import { CalendarDays, CircleHelp, PartyPopper, PiggyBank, TrendingDown, TrendingUp } from 'lucide-react';

import type { MarketingEventosKpis } from '../../types/marketingEventos';
import { formatCurrencyEs, formatPercentEs } from '../../utils/numberFormat';
import { marginPlainMessage, outcomePlainMessage } from '../../utils/marketingEventosData';
import { Card, CardContent } from '../ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../ui/utils';

type Props = {
  kpis: MarketingEventosKpis;
};

function KpiCard({
  title,
  value,
  subtitle,
  help,
  icon: Icon,
  accent,
  valueClass,
}: {
  title: string;
  value: string;
  subtitle: string;
  help: string;
  icon: typeof PartyPopper;
  accent: string;
  valueClass?: string;
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
        <TooltipContent side="top" className="max-w-[260px] text-xs">
          {help}
        </TooltipContent>
      </Tooltip>
      <CardContent className="flex items-start gap-3 p-4 pr-8">
        <div className={`rounded-lg p-2 ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className={cn('text-2xl font-bold tabular-nums', valueClass)}>{value}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function MarketingEventosDashboard({ kpis }: Props) {
  const pnl = kpis.consolidated;
  const profitColor =
    pnl.outcomeLabel === 'ganancia'
      ? 'text-emerald-600 dark:text-emerald-400'
      : pnl.outcomeLabel === 'perdida'
        ? 'text-rose-600 dark:text-rose-400'
        : undefined;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Eventos / cursos"
          value={String(kpis.eventsCount)}
          subtitle={`${kpis.activeCount} activos · ${kpis.closedCount} cerrados`}
          help="Cantidad de eventos o cursos registrados en el filtro actual."
          icon={CalendarDays}
          accent="bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300"
        />
        <KpiCard
          title="Resultado real"
          value={formatCurrencyEs(pnl.profitActual)}
          subtitle={
            pnl.outcomeLabel === 'ganancia'
              ? 'Ganancia consolidada'
              : pnl.outcomeLabel === 'perdida'
                ? 'Pérdida consolidada'
                : 'Sin datos reales aún'
          }
          help="Suma de todos los ingresos reales menos todos los gastos reales. No es contabilidad: es el control del área de Marketing."
          icon={pnl.profitActual >= 0 ? TrendingUp : TrendingDown}
          accent={
            pnl.profitActual >= 0
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
              : 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
          }
          valueClass={profitColor}
        />
        <KpiCard
          title="Rentabilidad"
          value={pnl.marginActualPct == null ? '—' : formatPercentEs(pnl.marginActualPct)}
          subtitle={pnl.marginActualPct == null ? 'Faltan ingresos reales' : 'Sobre ingresos reales'}
          help="Porcentaje de ganancia respecto a lo cobrado. Ejemplo: 20% significa que de cada S/ 100 ingresados quedan S/ 20."
          icon={PiggyBank}
          accent="bg-violet-500/15 text-violet-600 dark:text-violet-300"
        />
        <KpiCard
          title="Ganaron / perdieron"
          value={`${kpis.winners} / ${kpis.losers}`}
          subtitle="Eventos con resultado real"
          help="Cuántos eventos individuales cerraron con ganancia o con pérdida según montos reales (se excluyen cancelados)."
          icon={PartyPopper}
          accent="bg-pink-500/15 text-pink-600 dark:text-pink-300"
        />
      </div>

      <Card className="border-border dark:border-slate-700">
        <CardContent className="space-y-4 p-5">
          <div>
            <h3 className="text-base font-semibold text-foreground">Estado de resultados (resumen)</h3>
            <p className="text-sm text-muted-foreground">
              Vista simple: presupuesto vs real. Sin cuentas contables.
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border dark:border-slate-700">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Concepto</th>
                  <th className="px-3 py-2 text-right font-medium">Presupuesto</th>
                  <th className="px-3 py-2 text-right font-medium">Real</th>
                  <th className="px-3 py-2 text-right font-medium">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border dark:border-slate-700">
                  <td className="px-3 py-2.5">Ingresos (lo que se cobró)</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrencyEs(pnl.incomeBudget)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatCurrencyEs(pnl.incomeActual)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatCurrencyEs(pnl.incomeActual - pnl.incomeBudget)}
                  </td>
                </tr>
                <tr className="border-t border-border dark:border-slate-700">
                  <td className="px-3 py-2.5">Egresos (lo que se gastó)</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrencyEs(pnl.expenseBudget)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-rose-600 dark:text-rose-400">
                    {formatCurrencyEs(pnl.expenseActual)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatCurrencyEs(pnl.expenseActual - pnl.expenseBudget)}
                  </td>
                </tr>
                <tr className="border-t border-border bg-muted/30 dark:border-slate-700">
                  <td className="px-3 py-2.5 font-semibold">Resultado (¿ganamos o perdimos?)</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                    {formatCurrencyEs(pnl.profitBudget)}
                  </td>
                  <td className={cn('px-3 py-2.5 text-right font-semibold tabular-nums', profitColor)}>
                    {formatCurrencyEs(pnl.profitActual)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                    {formatCurrencyEs(pnl.varianceVsBudget)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-sm dark:border-slate-700">
            <p className="font-medium text-foreground">{outcomePlainMessage(pnl)}</p>
            <p className="mt-1 text-muted-foreground">{marginPlainMessage(pnl)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
