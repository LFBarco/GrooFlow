import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import type { MarketingEventRecord, MarketingMoneyLine } from '../../types/marketingEventos';
import {
  MARKETING_EVENT_KIND_LABELS,
  MARKETING_EVENT_STATUS_LABELS,
} from '../../types/marketingEventos';
import {
  computeEventPnl,
  marginPlainMessage,
  outcomePlainMessage,
} from '../../utils/marketingEventosData';
import { generateEntityId } from '../../utils/generateEntityId';
import { formatCurrencyEs, formatPercentEs } from '../../utils/numberFormat';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { cn } from '../ui/utils';
import { appAlert } from '../ui/app-dialog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: MarketingEventRecord | null;
  canEdit: boolean;
  onSaveLines: (next: {
    id: string;
    incomeLines: MarketingMoneyLine[];
    expenseLines: MarketingMoneyLine[];
  }) => void;
};

function emptyLine(): MarketingMoneyLine {
  return { id: generateEntityId('mel'), concept: '', budget: 0, actual: 0 };
}

function MoneyLinesEditor({
  title,
  hint,
  lines,
  canEdit,
  accent,
  onChange,
}: {
  title: string;
  hint: string;
  lines: MarketingMoneyLine[];
  canEdit: boolean;
  accent: 'income' | 'expense';
  onChange: (lines: MarketingMoneyLine[]) => void;
}) {
  const update = (id: string, patch: Partial<MarketingMoneyLine>) => {
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const remove = (id: string) => {
    onChange(lines.filter((l) => l.id !== id));
  };

  const budgetTotal = lines.reduce((s, l) => s + (Number(l.budget) || 0), 0);
  const actualTotal = lines.reduce((s, l) => s + (Number(l.actual) || 0), 0);

  return (
    <div className="space-y-3">
      <div>
        <h4 className="font-medium text-foreground">{title}</h4>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border dark:border-slate-700">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-2 py-2 font-medium">Concepto</th>
              <th className="w-32 px-2 py-2 text-right font-medium">Presupuesto</th>
              <th className="w-32 px-2 py-2 text-right font-medium">Real</th>
              {canEdit ? <th className="w-10 px-1 py-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td
                  colSpan={canEdit ? 4 : 3}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  Sin líneas. Agrega conceptos con el botón de abajo.
                </td>
              </tr>
            ) : (
              lines.map((line) => (
                <tr key={line.id} className="border-t border-border dark:border-slate-700">
                  <td className="px-2 py-1.5">
                    <Input
                      className="h-8"
                      value={line.concept}
                      disabled={!canEdit}
                      placeholder="Ej. Inscripciones"
                      onChange={(e) => update(line.id, { concept: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      className="h-8 text-right tabular-nums"
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.budget || ''}
                      disabled={!canEdit}
                      onChange={(e) =>
                        update(line.id, { budget: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      className={cn(
                        'h-8 text-right tabular-nums',
                        accent === 'income'
                          ? 'focus-visible:ring-emerald-500/40'
                          : 'focus-visible:ring-rose-500/40'
                      )}
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.actual || ''}
                      disabled={!canEdit}
                      onChange={(e) =>
                        update(line.id, { actual: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />
                  </td>
                  {canEdit ? (
                    <td className="px-1 py-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-rose-600"
                        onClick={() => remove(line.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/30 dark:border-slate-700">
              <td className="px-2 py-2 text-xs font-semibold">Total</td>
              <td className="px-2 py-2 text-right text-xs font-semibold tabular-nums">
                {formatCurrencyEs(budgetTotal)}
              </td>
              <td
                className={cn(
                  'px-2 py-2 text-right text-xs font-semibold tabular-nums',
                  accent === 'income'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                )}
              >
                {formatCurrencyEs(actualTotal)}
              </td>
              {canEdit ? <td /> : null}
            </tr>
          </tfoot>
        </table>
      </div>

      {canEdit ? (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...lines, emptyLine()])}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Agregar línea
        </Button>
      ) : null}
    </div>
  );
}

export function MarketingEventoWorkspaceDialog({
  open,
  onOpenChange,
  record,
  canEdit,
  onSaveLines,
}: Props) {
  const [incomeLines, setIncomeLines] = useState<MarketingMoneyLine[]>([]);
  const [expenseLines, setExpenseLines] = useState<MarketingMoneyLine[]>([]);

  useEffect(() => {
    if (!open || !record) return;
    setIncomeLines(record.incomeLines.map((l) => ({ ...l })));
    setExpenseLines(record.expenseLines.map((l) => ({ ...l })));
  }, [open, record]);

  const draft = useMemo(() => {
    if (!record) return null;
    return { ...record, incomeLines, expenseLines };
  }, [record, incomeLines, expenseLines]);

  const pnl = useMemo(() => (draft ? computeEventPnl(draft) : null), [draft]);

  const handleSave = () => {
    if (!record || !canEdit) return;
    const cleanIncome = incomeLines.filter((l) => l.concept.trim());
    const cleanExpense = expenseLines.filter((l) => l.concept.trim());
    if (incomeLines.some((l) => !l.concept.trim() && (l.budget > 0 || l.actual > 0))) {
      void appAlert('Hay líneas de ingreso con monto pero sin concepto.');
      return;
    }
    if (expenseLines.some((l) => !l.concept.trim() && (l.budget > 0 || l.actual > 0))) {
      void appAlert('Hay líneas de gasto con monto pero sin concepto.');
      return;
    }
    onSaveLines({
      id: record.id,
      incomeLines: cleanIncome.map((l) => ({ ...l, concept: l.concept.trim() })),
      expenseLines: cleanExpense.map((l) => ({ ...l, concept: l.concept.trim() })),
    });
    onOpenChange(false);
  };

  if (!record || !pnl) return null;

  const profitClass =
    pnl.outcomeLabel === 'ganancia'
      ? 'text-emerald-600 dark:text-emerald-400'
      : pnl.outcomeLabel === 'perdida'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-foreground';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4 dark:border-slate-700">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-left">{record.name}</DialogTitle>
            <Badge variant="secondary">{MARKETING_EVENT_KIND_LABELS[record.kind]}</Badge>
            <Badge variant="outline">{MARKETING_EVENT_STATUS_LABELS[record.status]}</Badge>
          </div>
          <DialogDescription className="text-left">
            Carga el <strong>presupuesto</strong> (lo planeado) y el <strong>real</strong> (lo que
            pasó). El resultado se calcula solo aquí; no afecta la contabilidad.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-muted/20 p-3 dark:border-slate-700">
              <p className="text-xs text-muted-foreground">Ingresos reales</p>
              <p className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCurrencyEs(pnl.incomeActual)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-3 dark:border-slate-700">
              <p className="text-xs text-muted-foreground">Gastos reales</p>
              <p className="text-lg font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                {formatCurrencyEs(pnl.expenseActual)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-3 dark:border-slate-700">
              <p className="text-xs text-muted-foreground">Resultado · rentabilidad</p>
              <p className={cn('text-lg font-semibold tabular-nums', profitClass)}>
                {formatCurrencyEs(pnl.profitActual)}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {pnl.marginActualPct == null ? '—' : formatPercentEs(pnl.marginActualPct)}
                </span>
              </p>
            </div>
          </div>

          <Tabs defaultValue="lines">
            <TabsList>
              <TabsTrigger value="lines">Ingresos y egresos</TabsTrigger>
              <TabsTrigger value="pnl">Estado de resultados</TabsTrigger>
            </TabsList>

            <TabsContent value="lines" className="mt-4 space-y-6">
              <MoneyLinesEditor
                title="Ingresos"
                hint="Lo que se espera cobrar (presupuesto) y lo que realmente se cobró (real)."
                lines={incomeLines}
                canEdit={canEdit}
                accent="income"
                onChange={setIncomeLines}
              />
              <MoneyLinesEditor
                title="Egresos (gastos)"
                hint="Lo que se planeó gastar (presupuesto) y lo que realmente se gastó (real)."
                lines={expenseLines}
                canEdit={canEdit}
                accent="expense"
                onChange={setExpenseLines}
              />
            </TabsContent>

            <TabsContent value="pnl" className="mt-4 space-y-4">
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
                      <td className="px-3 py-2.5">(+) Ingresos</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatCurrencyEs(pnl.incomeBudget)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatCurrencyEs(pnl.incomeActual)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatCurrencyEs(pnl.incomeActual - pnl.incomeBudget)}
                      </td>
                    </tr>
                    <tr className="border-t border-border dark:border-slate-700">
                      <td className="px-3 py-2.5">(−) Egresos</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatCurrencyEs(pnl.expenseBudget)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-rose-600 dark:text-rose-400">
                        {formatCurrencyEs(pnl.expenseActual)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatCurrencyEs(pnl.expenseActual - pnl.expenseBudget)}
                      </td>
                    </tr>
                    <tr className="border-t border-border bg-muted/30 dark:border-slate-700">
                      <td className="px-3 py-2.5 font-semibold">(=) Resultado</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                        {formatCurrencyEs(pnl.profitBudget)}
                      </td>
                      <td className={cn('px-3 py-2.5 text-right font-semibold tabular-nums', profitClass)}>
                        {formatCurrencyEs(pnl.profitActual)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                        {formatCurrencyEs(pnl.varianceVsBudget)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="space-y-1 rounded-lg border border-dashed border-border bg-muted/20 p-3 text-sm dark:border-slate-700">
                <p className="font-medium">{outcomePlainMessage(pnl)}</p>
                <p className="text-muted-foreground">{marginPlainMessage(pnl)}</p>
                <p className="text-xs text-muted-foreground">
                  Diferencia vs presupuesto del resultado:{' '}
                  <span className="font-medium tabular-nums text-foreground">
                    {formatCurrencyEs(pnl.varianceVsBudget)}
                  </span>
                </p>
              </div>

              {(record.location || record.responsible || record.expectedAttendees != null) && (
                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                  {record.location ? (
                    <div>
                      <Label className="text-xs">Lugar</Label>
                      <p className="text-foreground">{record.location}</p>
                    </div>
                  ) : null}
                  {record.responsible ? (
                    <div>
                      <Label className="text-xs">Responsable</Label>
                      <p className="text-foreground">{record.responsible}</p>
                    </div>
                  ) : null}
                  {record.expectedAttendees != null ? (
                    <div>
                      <Label className="text-xs">Participantes esperados</Label>
                      <p className="text-foreground">{record.expectedAttendees}</p>
                    </div>
                  ) : null}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="shrink-0 border-t border-border px-6 py-3 dark:border-slate-700">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {canEdit ? 'Cancelar' : 'Cerrar'}
          </Button>
          {canEdit ? (
            <Button type="button" onClick={handleSave}>
              Guardar montos
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
