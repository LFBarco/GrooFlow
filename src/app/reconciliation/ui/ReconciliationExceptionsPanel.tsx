import { Check, ExternalLink } from 'lucide-react';
import { useMemo } from 'react';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { sourceLabel, statusFilterForRule, type AuditNavRequest } from '../domain/auditLabels';
import { sessionMovements } from '../domain/dataset';
import {
  RULE_LABELS,
  WORKFLOW_STATUS_LABELS,
  type ReconciliationAlert,
  type ReconciliationDataset,
} from '../domain/types';
import { resolveAlert } from '../engines/reconciliationRunner';

type Props = {
  dataset: ReconciliationDataset;
  onDatasetChange: (next: ReconciliationDataset) => void;
  onNavigateToAudit?: (nav: AuditNavRequest) => void;
};

function searchFromAlert(alert: ReconciliationAlert, movements: ReturnType<typeof sessionMovements>): string {
  const first = alert.movementIds
    .map((id) => movements.find((m) => m.id === id))
    .find((m) => m?.operationNumber || m?.operationNumberRaw);
  if (!first) return '';
  return first.operationNumberRaw || first.operationNumber || '';
}

export function ReconciliationExceptionsPanel({ dataset, onDatasetChange, onNavigateToAudit }: Props) {
  const movements = sessionMovements(dataset);
  const openAlerts = dataset.alerts.filter((a) => !a.resolved && a.sessionId === dataset.activeSessionId);
  const movementById = useMemo(() => new Map(movements.map((m) => [m.id, m])), [movements]);

  const exceptions = movements.filter(
    (m) => m.workflowStatus !== 'reconciled' || m.ruleCodes.some((r) => r !== 'RULE-001')
  );

  const openInCruces = (alert: ReconciliationAlert) => {
    onNavigateToAudit?.({
      statusFilter: statusFilterForRule(alert.ruleCode),
      search: searchFromAlert(alert, movements),
    });
  };

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Alertas resumidas ({openAlerts.length})
        </h3>
        {openAlerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin alertas abiertas en esta sesión.</p>
        ) : (
          <ul className="space-y-3">
            {openAlerts.map((alert) => {
              const sample = alert.movementIds
                .map((id) => movementById.get(id))
                .filter((m): m is NonNullable<typeof m> => Boolean(m))
                .slice(0, 8);

              return (
                <li key={alert.id} className="rounded-lg border p-3 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                        {RULE_LABELS[alert.ruleCode]}
                        <Badge
                          variant={
                            alert.severity === 'critical'
                              ? 'destructive'
                              : alert.severity === 'warning'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {alert.severity}
                        </Badge>
                      </p>
                      <p className="text-sm">{alert.message}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {onNavigateToAudit && (
                        <Button type="button" size="sm" variant="default" onClick={() => openInCruces(alert)}>
                          <ExternalLink className="mr-1 h-3 w-3" />
                          Ver en Cruces
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onDatasetChange(resolveAlert(dataset, alert.id))}
                      >
                        <Check className="mr-1 h-3 w-3" />
                        Resolver
                      </Button>
                    </div>
                  </div>

                  {sample.length > 0 && (
                    <div className="overflow-x-auto rounded-md border bg-muted/20">
                      <table className="w-full text-xs">
                        <thead className="text-left text-muted-foreground">
                          <tr>
                            <th className="p-2">Fecha</th>
                            <th className="p-2">Fuente</th>
                            <th className="p-2">N° Op. (7 díg.)</th>
                            <th className="p-2">Monto</th>
                            <th className="p-2">Detalle</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sample.map((m) => (
                            <tr
                              key={m.id}
                              className="border-t cursor-pointer hover:bg-muted/40"
                              onClick={() =>
                                onNavigateToAudit?.({
                                  statusFilter: statusFilterForRule(alert.ruleCode),
                                  search: m.operationNumberRaw || m.operationNumber,
                                })
                              }
                              title="Clic para abrir en Cruces"
                            >
                              <td className="p-2 whitespace-nowrap">{m.transactionDate}</td>
                              <td className="p-2">{sourceLabel(m.sourceType)}</td>
                              <td className="p-2 font-mono font-semibold">{m.operationNumber || '—'}</td>
                              <td className="p-2">S/ {m.amount.toFixed(2)}</td>
                              <td className="p-2 text-muted-foreground">
                                {m.documentNumber ?? m.description ?? WORKFLOW_STATUS_LABELS[m.workflowStatus]}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {alert.movementIds.length > sample.length && (
                        <p className="border-t p-2 text-xs text-muted-foreground">
                          +{alert.movementIds.length - sample.length} más — use «Ver en Cruces» para explorar todos.
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Movimientos con excepción ({exceptions.length.toLocaleString('es-PE')})
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
                  <tr
                    key={m.id}
                    className="border-t cursor-pointer hover:bg-muted/30"
                    onClick={() =>
                      onNavigateToAudit?.({
                        search: m.operationNumberRaw || m.operationNumber,
                      })
                    }
                    title="Clic para ver en Cruces"
                  >
                    <td className="p-2 whitespace-nowrap">{m.transactionDate}</td>
                    <td className="p-2">{sourceLabel(m.sourceType)}</td>
                    <td className="p-2 font-mono text-xs font-semibold">{m.operationNumber || '—'}</td>
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
