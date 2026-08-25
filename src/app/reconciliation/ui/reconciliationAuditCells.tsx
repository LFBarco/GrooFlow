import type { CanonicalMovement } from '../domain/types';
import { sourceLabel } from '../domain/auditLabels';
import { PAYMENT_METHOD_LABELS } from '../domain/auditLabels';
import { salesGroupTotal } from '../domain/reconciliationGrouping';

export function formatReconciliationMoney(n: number): string {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type MovementCellProps = {
  side: 'bank' | 'sales';
  m?: CanonicalMovement;
  salesGroup?: CanonicalMovement[];
};

export function ReconciliationMovementCell({ side, m, salesGroup }: MovementCellProps) {
  if (side === 'sales' && salesGroup && salesGroup.length > 1) {
    const total = salesGroupTotal(salesGroup);
    return (
      <td className="p-2 align-top">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Ventas (ERP) · {salesGroup.length} documentos · mismo pago
          </p>
          {salesGroup.map((line) => (
            <div
              key={line.id}
              className="rounded border border-border/60 bg-muted/20 p-2 space-y-0.5"
            >
              <p className="font-mono text-xs font-semibold">{line.operationNumber || '—'}</p>
              {line.operationNumberRaw &&
                line.operationNumberRaw.replace(/\D/g, '') !== line.operationNumber && (
                  <p className="font-mono text-[10px] text-muted-foreground">
                    orig: {line.operationNumberRaw}
                  </p>
                )}
              <p className="font-semibold">{formatReconciliationMoney(line.amount)}</p>
              <p className="text-xs">{line.transactionDate}</p>
              {line.documentNumber && (
                <p className="text-xs text-muted-foreground">Doc: {line.documentNumber}</p>
              )}
              {line.customerName && (
                <p className="text-xs text-muted-foreground">{line.customerName}</p>
              )}
              {line.registeredBy && (
                <p className="text-xs text-muted-foreground">{line.registeredBy}</p>
              )}
            </div>
          ))}
          <p className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Total ERP: {formatReconciliationMoney(total)}
          </p>
        </div>
      </td>
    );
  }

  if (!m) return <td className="p-2 text-muted-foreground">—</td>;

  return (
    <td className="p-2 align-top">
      <div className="space-y-0.5">
        <p className="text-xs font-medium text-muted-foreground">{sourceLabel(m.sourceType)}</p>
        <p className="font-mono text-xs font-semibold">{m.operationNumber || '—'}</p>
        {m.operationNumberRaw && m.operationNumberRaw.replace(/\D/g, '') !== m.operationNumber && (
          <p className="font-mono text-[10px] text-muted-foreground">orig: {m.operationNumberRaw}</p>
        )}
        <p className="font-semibold">{formatReconciliationMoney(m.amount)}</p>
        <p className="text-xs">{m.transactionDate}</p>
        {side === 'sales' && m.documentNumber && (
          <p className="text-xs text-muted-foreground">Doc: {m.documentNumber}</p>
        )}
        {m.customerName && <p className="text-xs text-muted-foreground">{m.customerName}</p>}
        {m.registeredBy && <p className="text-xs text-muted-foreground">{m.registeredBy}</p>}
        <p className="text-xs">{PAYMENT_METHOD_LABELS[m.paymentMethod]}</p>
      </div>
    </td>
  );
}
