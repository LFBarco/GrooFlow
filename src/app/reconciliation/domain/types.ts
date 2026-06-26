/** Tipos del motor de conciliación (desacoplados del ERP). */

export type ReconciliationSourceType =
  | 'bcp_bank'
  | 'mercado_pago'
  | 'niubiz'
  | 'sales_erp';

export type MovementSide = 'bank_or_gateway' | 'sales_application';

export type PaymentMethodHint =
  | 'yape'
  | 'transfer_bcp'
  | 'transfer_interbank'
  | 'cash'
  | 'pos'
  | 'mercado_pago'
  | 'niubiz'
  | 'unknown';

export type ReconciliationWorkflowStatus =
  | 'imported'
  | 'normalized'
  | 'pending'
  | 'reconciled'
  | 'observed'
  | 'in_review'
  | 'difference'
  | 'resolved'
  | 'closed';

export type ReconciliationRuleCode =
  | 'RULE-001'
  | 'RULE-002'
  | 'RULE-003'
  | 'RULE-004'
  | 'RULE-005'
  | 'RULE-006'
  | 'RULE-007'
  | 'RULE-008';

export type MatchStrategy = 'operation_number' | 'amount_date' | 'manual';

export interface CanonicalMovement {
  id: string;
  batchId: string;
  sessionId: string;
  sourceType: ReconciliationSourceType;
  side: MovementSide;
  transactionDate: string;
  amount: number;
  currency: 'PEN' | 'USD';
  operationNumber: string;
  operationNumberRaw: string;
  paymentMethod: PaymentMethodHint;
  documentNumber?: string;
  saleAmount?: number;
  branch?: string;
  customerName?: string;
  registeredBy?: string;
  description?: string;
  workflowStatus: ReconciliationWorkflowStatus;
  matchedMovementId?: string;
  matchId?: string;
  ruleCodes: ReconciliationRuleCode[];
  metadata: Record<string, unknown>;
}

export interface ReconciliationBatch {
  id: string;
  sessionId: string;
  sourceType: ReconciliationSourceType;
  fileName: string;
  importedAt: string;
  importedBy?: string;
  recordCount: number;
  status: 'processing' | 'completed' | 'failed';
  errors: string[];
}

export interface ReconciliationMatch {
  id: string;
  sessionId: string;
  bankMovementId: string;
  salesMovementId: string;
  confidence: number;
  matchStrategy: MatchStrategy;
  ruleCode: ReconciliationRuleCode;
  createdAt: string;
}

export interface ReconciliationAlert {
  id: string;
  sessionId: string;
  ruleCode: ReconciliationRuleCode;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  movementIds: string[];
  resolved: boolean;
  createdAt: string;
}

export interface ReconciliationSession {
  id: string;
  label: string;
  createdAt: string;
  closedAt?: string;
}

export interface ReconciliationHealthBreakdown {
  sourceType: ReconciliationSourceType | 'sales_erp';
  label: string;
  total: number;
  reconciled: number;
  percent: number;
}

export interface ReconciliationHealth {
  overallPercent: number;
  riskLevel: 'low' | 'medium' | 'high';
  reliabilityPercent: number;
  bySource: ReconciliationHealthBreakdown[];
}

export interface ReconciliationDataset {
  version: 1;
  activeSessionId: string;
  sessions: ReconciliationSession[];
  batches: ReconciliationBatch[];
  movements: CanonicalMovement[];
  matches: ReconciliationMatch[];
  alerts: ReconciliationAlert[];
  /** N° operación ya conciliados (histórico para alertas de reutilización). */
  reconciledOperationKeys: string[];
}

export const RECONCILIATION_DATASET_VERSION = 1 as const;

export const RULE_LABELS: Record<ReconciliationRuleCode, string> = {
  'RULE-001': 'Conciliado',
  'RULE-002': 'Sin venta (banco sin registro)',
  'RULE-003': 'Sin banco (venta sin movimiento)',
  'RULE-004': 'Código de operación duplicado',
  'RULE-005': 'Importe distinto',
  'RULE-006': 'Medio de pago probablemente incorrecto',
  'RULE-007': 'Pago parcial',
  'RULE-008': 'Sobrepago / sobrante',
};

export const WORKFLOW_STATUS_LABELS: Record<ReconciliationWorkflowStatus, string> = {
  imported: 'Importado',
  normalized: 'Normalizado',
  pending: 'Pendiente',
  reconciled: 'Conciliado',
  observed: 'Observado',
  in_review: 'En revisión',
  difference: 'Diferencia',
  resolved: 'Resuelto',
  closed: 'Cerrado',
};
