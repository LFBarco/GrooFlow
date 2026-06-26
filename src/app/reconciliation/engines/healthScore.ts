import { sessionMovements } from '../domain/dataset';
import type {
  ReconciliationDataset,
  ReconciliationHealth,
  ReconciliationHealthBreakdown,
  ReconciliationSourceType,
} from '../domain/types';

const SOURCE_LABELS: Record<ReconciliationSourceType, string> = {
  bcp_bank: 'BCP',
  mercado_pago: 'Mercado Pago',
  niubiz: 'Niubiz',
  sales_erp: 'Ventas (ERP)',
};

function breakdownFor(
  movements: ReturnType<typeof sessionMovements>,
  sourceType: ReconciliationSourceType
): ReconciliationHealthBreakdown {
  const subset = movements.filter((m) => m.sourceType === sourceType);
  const total = subset.length;
  const reconciled = subset.filter((m) => m.workflowStatus === 'reconciled').length;
  const percent = total === 0 ? 100 : Math.round((reconciled / total) * 10000) / 100;
  return {
    sourceType,
    label: SOURCE_LABELS[sourceType],
    total,
    reconciled,
    percent,
  };
}

export function computeReconciliationHealth(
  dataset: ReconciliationDataset,
  sessionId?: string
): ReconciliationHealth {
  const movements = sessionMovements(dataset, sessionId);
  const bySource: ReconciliationHealthBreakdown[] = (
    ['bcp_bank', 'mercado_pago', 'niubiz', 'sales_erp'] as ReconciliationSourceType[]
  ).map((s) => breakdownFor(movements, s));

  const bankSide = movements.filter((m) => m.sourceType !== 'sales_erp');
  const salesSide = movements.filter((m) => m.side === 'sales_application');
  const totalPairs = Math.max(bankSide.length, salesSide.length, 1);
  const reconciledCount = movements.filter((m) => m.workflowStatus === 'reconciled').length;
  const overallPercent = Math.round((reconciledCount / (movements.length || 1)) * 10000) / 100;

  const openCritical = dataset.alerts.filter((a) => !a.resolved && a.severity === 'critical').length;
  const openWarnings = dataset.alerts.filter((a) => !a.resolved && a.severity === 'warning').length;
  const orphanBank = bankSide.filter((m) => m.workflowStatus !== 'reconciled').length;
  const orphanSales = salesSide.filter((m) => m.workflowStatus !== 'reconciled').length;
  const riskScore = openCritical * 3 + openWarnings + orphanBank + orphanSales;
  const riskLevel: ReconciliationHealth['riskLevel'] =
    riskScore >= 15 ? 'high' : riskScore >= 5 ? 'medium' : 'low';

  const reliabilityPercent = Math.max(
    0,
    Math.min(100, Math.round((overallPercent - openCritical * 2 - openWarnings * 0.5) * 100) / 100)
  );

  return {
    overallPercent,
    riskLevel,
    reliabilityPercent,
    bySource,
  };
}

export function countByStatus(dataset: ReconciliationDataset, sessionId?: string) {
  const movements = sessionMovements(dataset, sessionId);
  return {
    total: movements.length,
    reconciled: movements.filter((m) => m.workflowStatus === 'reconciled').length,
    pending: movements.filter((m) => m.workflowStatus === 'pending' || m.workflowStatus === 'normalized').length,
    difference: movements.filter((m) => m.workflowStatus === 'difference').length,
    openAlerts: dataset.alerts.filter((a) => !a.resolved).length,
  };
}
