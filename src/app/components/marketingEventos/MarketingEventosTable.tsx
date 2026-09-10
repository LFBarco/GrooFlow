import { Eye, Pencil, Trash2 } from 'lucide-react';

import type { MarketingEventRecord } from '../../types/marketingEventos';
import {
  MARKETING_EVENT_KIND_LABELS,
  MARKETING_EVENT_STATUS_LABELS,
} from '../../types/marketingEventos';
import { computeEventPnl } from '../../utils/marketingEventosData';
import { formatCurrencyEs, formatPercentEs } from '../../utils/numberFormat';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';

type Props = {
  records: MarketingEventRecord[];
  canEdit: boolean;
  onOpen: (record: MarketingEventRecord) => void;
  onEdit: (record: MarketingEventRecord) => void;
  onDelete: (id: string) => void;
};

function statusBadgeClass(status: MarketingEventRecord['status']): string {
  switch (status) {
    case 'en_curso':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    case 'planificado':
      return 'bg-sky-500/15 text-sky-700 dark:text-sky-300';
    case 'cerrado':
      return 'bg-slate-500/15 text-slate-700 dark:text-slate-300';
    case 'cancelado':
      return 'bg-rose-500/15 text-rose-700 dark:text-rose-300';
    default:
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
  }
}

export function MarketingEventosTable({ records, canEdit, onOpen, onEdit, onDelete }: Props) {
  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center dark:border-slate-700">
        <p className="text-sm font-medium text-foreground">Aún no hay eventos o cursos</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Crea el primero con «Nuevo evento / curso» y carga presupuesto e ingresos/gastos reales.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card dark:border-slate-700">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2.5 font-medium">Evento / curso</th>
            <th className="px-3 py-2.5 font-medium">Tipo</th>
            <th className="px-3 py-2.5 font-medium">Estado</th>
            <th className="px-3 py-2.5 font-medium">Fecha</th>
            <th className="px-3 py-2.5 text-right font-medium">Ingresos real</th>
            <th className="px-3 py-2.5 text-right font-medium">Gastos real</th>
            <th className="px-3 py-2.5 text-right font-medium">Resultado</th>
            <th className="px-3 py-2.5 text-right font-medium">Rentab.</th>
            <th className="px-3 py-2.5 text-right font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const pnl = computeEventPnl(r);
            const profitClass =
              pnl.outcomeLabel === 'ganancia'
                ? 'text-emerald-600 dark:text-emerald-400'
                : pnl.outcomeLabel === 'perdida'
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-muted-foreground';
            return (
              <tr
                key={r.id}
                className="border-t border-border hover:bg-muted/30 dark:border-slate-700"
              >
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    className="text-left font-medium text-foreground hover:underline"
                    onClick={() => onOpen(r)}
                  >
                    {r.name}
                  </button>
                  {r.location ? (
                    <p className="text-xs text-muted-foreground">{r.location}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {MARKETING_EVENT_KIND_LABELS[r.kind]}
                </td>
                <td className="px-3 py-2.5">
                  <Badge variant="secondary" className={cn('font-normal', statusBadgeClass(r.status))}>
                    {MARKETING_EVENT_STATUS_LABELS[r.status]}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{r.startDate}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {formatCurrencyEs(pnl.incomeActual)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {formatCurrencyEs(pnl.expenseActual)}
                </td>
                <td className={cn('px-3 py-2.5 text-right font-medium tabular-nums', profitClass)}>
                  {formatCurrencyEs(pnl.profitActual)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                  {pnl.marginActualPct == null ? '—' : formatPercentEs(pnl.marginActualPct)}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end gap-1">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpen(r)}>
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">Abrir</span>
                    </Button>
                    {canEdit ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onEdit(r)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Editar datos</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-rose-600"
                          onClick={() => onDelete(r.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Eliminar</span>
                        </Button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
