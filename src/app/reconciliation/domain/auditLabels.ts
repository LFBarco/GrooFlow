import type {
  MatchStrategy,
  PaymentMethodHint,
  ReconciliationRuleCode,
  ReconciliationSourceType,
  ReconciliationWorkflowStatus,
} from './types';

export const SOURCE_LABELS: Record<ReconciliationSourceType, string> = {
  bcp_bank: 'BCP',
  mercado_pago: 'Mercado Pago',
  niubiz: 'Niubiz',
  sales_erp: 'Ventas (ERP)',
};

export function sourceLabel(sourceType: string | null | undefined): string {
  if (sourceType && Object.prototype.hasOwnProperty.call(SOURCE_LABELS, sourceType)) {
    return SOURCE_LABELS[sourceType as ReconciliationSourceType];
  }
  const raw = (sourceType ?? '').trim();
  return raw !== '' ? raw : 'Fuente';
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodHint, string> = {
  yape: 'Yape',
  transfer_bcp: 'Transferencia BCP',
  transfer_interbank: 'Interbancaria',
  cash: 'Efectivo',
  pos: 'POS / Tarjeta',
  mercado_pago: 'Mercado Pago',
  niubiz: 'Niubiz',
  unknown: 'Desconocido',
};

export const MATCH_STRATEGY_LABELS: Record<MatchStrategy, string> = {
  operation_number: 'N° operación (7 dígitos)',
  operation_number_grouped: 'N° operación (suma ERP)',
  amount_date: 'Monto + fecha (±3 días)',
  manual: 'Manual',
};

export type AuditStatusFilter =
  | 'all'
  | 'reconciled'
  | 'pending'
  | 'difference'
  | 'orphan_bank'
  | 'orphan_sales'
  | 'pairs';

/** Textos para el rol auditoría. */
export const AUDIT_GLOSSARY = {
  healthScore: {
    title: 'Health Score',
    body: 'Porcentaje de movimientos conciliados sobre el total importado en la sesión. Un valor alto indica que la mayoría de registros tiene par banco/pasarela ↔ venta.',
  },
  bySource: {
    title: 'Conciliación por fuente',
    body: 'Por cada fuente (BCP, MP, Niubiz, Ventas ERP): conciliados / total importado. Ejemplo: 71% (2265/3192) = 2265 movimientos de MP emparejados con una venta de 3192 importados de MP.',
  },
  risk: {
    title: 'Riesgo financiero',
    body: 'Estimación según alertas críticas, advertencias y movimientos huérfanos (banco sin venta o venta sin banco). Alto = revisar antes de cerrar el periodo.',
  },
  reconciled: {
    title: 'Conciliados',
    body: 'Pares con el mismo N° de operación (7 dígitos) entre ventas ERP y BCP/MP/Niubiz/Yape. El monto puede diferir (parcial/sobrepago).',
  },
  pending: {
    title: 'Pendientes',
    body: 'Importados pero aún sin par. Pueden faltar datos del otro lado o requerir conciliación manual.',
  },
  difference: {
    title: 'Con diferencia',
    body: 'Hay par pero el importe no cuadra (pago parcial, sobrepago o error de registro).',
  },
  orphanBank: {
    title: 'Banco sin venta (RULE-002)',
    body: 'Abono en BCP/MP/Niubiz que no tiene registro correspondiente en ventas ERP.',
  },
  orphanSales: {
    title: 'Venta sin banco (RULE-003)',
    body: 'Cobro registrado en ERP sin movimiento en extracto bancario o pasarela.',
  },
} as const;

export const STATUS_FILTER_OPTIONS: {
  id: AuditStatusFilter;
  label: string;
  description: string;
}[] = [
  { id: 'all', label: 'Todos', description: 'Todos los movimientos de la sesión.' },
  { id: 'reconciled', label: 'Conciliados', description: 'Emparejados correctamente con la contraparte.' },
  { id: 'pending', label: 'Sin conciliar', description: 'Todo lo que aún no tiene par validado (banco sin venta, venta sin banco, etc.).' },
  { id: 'difference', label: 'Con diferencia', description: 'Par con importe distinto (parcial/sobrepago).' },
  { id: 'orphan_bank', label: 'Banco sin venta', description: 'Extracto/pasarela sin venta ERP.' },
  { id: 'orphan_sales', label: 'Venta sin banco', description: 'Venta ERP sin movimiento bancario.' },
  { id: 'pairs', label: 'Vista de cruces', description: 'Solo pares conciliados lado a lado para validación.' },
];

export type AuditNavRequest = {
  statusFilter?: AuditStatusFilter;
  search?: string;
};

export function statusFilterForRule(ruleCode: ReconciliationRuleCode): AuditStatusFilter {
  switch (ruleCode) {
    case 'RULE-002':
      return 'orphan_bank';
    case 'RULE-003':
      return 'orphan_sales';
    case 'RULE-005':
    case 'RULE-007':
    case 'RULE-008':
      return 'difference';
    case 'RULE-004':
      return 'all';
    default:
      return 'pending';
  }
}

export function ruleCodesForFilter(filter: AuditStatusFilter): ReconciliationRuleCode[] | null {
  if (filter === 'orphan_bank') return ['RULE-002'];
  if (filter === 'orphan_sales') return ['RULE-003'];
  return null;
}

export function statusMatchesFilter(
  status: ReconciliationWorkflowStatus,
  filter: AuditStatusFilter
): boolean {
  if (filter === 'all' || filter === 'pairs') return true;
  if (filter === 'reconciled') return status === 'reconciled';
  if (filter === 'pending') return status === 'pending' || status === 'normalized' || status === 'imported';
  if (filter === 'difference') return status === 'difference';
  return true;
}
