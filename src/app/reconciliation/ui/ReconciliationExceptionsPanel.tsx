import { Check } from 'lucide-react';

import { Button } from '../../components/ui/button';
import { sessionMovements } from '../domain/dataset';
import { RULE_LABELS, WORKFLOW_STATUS_LABELS, type ReconciliationDataset } from '../domain/types';
import { resolveAlert } from '../engines/reconciliationRunner';

type Props = {
  dataset: ReconciliationDataset;
  onDatasetChange: (next: ReconciliationDataset) => void;
};

export function ReconciliationExceptionsPanel({ dataset, onDatasetChange }: Props) {
  const openAlerts = dataset.alerts.filter((a) => !a.resolved && a.sessionId === dataset.activeSessionId);
  const movements = sessionMovements(dataset);
  const exceptions = movements.filter(
    (m) =>
      m.workflowStatus !== 'reconciled' ||
      m.ruleCodes.some((r) => r !== 'RULE-001')
  );

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Alertas resumidas ({openAlerts.length})
        </h3>
        {openAlerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin alertas abiertas en esta sesión.</p>
        ) : (
          <ul className="space-y-2">
            {openAlerts.map((alert) => (
              <li
                key={alert.id}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {RULE_LABELS[alert.ruleCode]} · {alert.severity}
                  </p>
                  <p className="text-sm">{alert.message}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onDatasetChange(resolveAlert(dataset, alert.id))}
                >
                  <Check className="mr-1 h-3 w-3" />
                  Resolver
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Movimientos con excepción ({exceptions.length})
        </h3>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2">Fecha</th>
                <th className="p-2">Fuente</th>
                <th className="p-2">N° Op.</th>
                <th className="p-2">Monto</th>
                <th className="p-2">Estado</th>
                <th className="p-2">Reglas</th>
              </tr>
            </thead>
            <tbody>
              {exceptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
                    Todo conciliado sin excepciones.
                  </td>
                </tr>
              ) : (
                exceptions.slice(0, 200).map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="p-2 whitespace-nowrap">{m.transactionDate}</td>
                    <td className="p-2">{m.sourceType}</td>
                    <td className="p-2 font-mono text-xs">{m.operationNumberRaw || m.operationNumber || '—'}</td>
                    <td className="p-2">S/ {m.amount.toFixed(2)}</td>
                    <td className="p-2">{WORKFLOW_STATUS_LABELS[m.workflowStatus]}</td>
                    <td className="p-2 text-xs">
                      {m.ruleCodes.map((r) => RULE_LABELS[r]).join(', ') || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
