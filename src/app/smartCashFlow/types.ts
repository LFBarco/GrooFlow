/**
 * Tipos del motor Smart Cash Flow (proyección con gastos fijos / flexibles).
 * Fase 1: sólo modelo + cálculo; la UI usará estos tipos después.
 */

/** Fecha en formato ISO yyyy-MM-dd (comparable lexicográficamente). */
export type IsoDate = string;

export type ProjectionFlexibility = 'fixed' | 'flexible';

/** Ingreso programado para un día concreto. */
export interface ScheduledInflow {
  id: string;
  label?: string;
  amount: number;
  date: IsoDate;
}

/**
 * Egreso programado en un día de vencimiento.
 * Para recurrencias, el llamador debe expandir a múltiples filas antes del motor.
 */
export interface ScheduledOutflow {
  id: string;
  label?: string;
  amount: number;
  /** Fecha objetivo del pago / vencimiento. */
  dueDate: IsoDate;
  flexibility: ProjectionFlexibility;
  /**
   * Prioridad sólo para `flexible`. Menor número = más prioritario (se intenta pagar antes).
   * Si no se informa se usa el valor por defecto del motor.
   */
  priorityRank?: number;
}

/** Entrada principal del motor de proyección. */
export interface ProjectionHorizonInput {
  startDate: IsoDate;
  endDate: IsoDate;
  /** Saldo al inicio de `startDate` (antes de inflows/outs de ese día). */
  openingBalance: number;
  inflows: ScheduledInflow[];
  outflows: ScheduledOutflow[];
}

export type ProjectionAlertKind =
  | 'NEGATIVE_AFTER_FIXED'
  | 'NEGATIVE_AFTER_FLEX_PAID'
  | 'FLEX_DEFERRED'
  | 'SHORTFALL_PENDING_FLEX_END';

export interface ProjectionAlert {
  kind: ProjectionAlertKind;
  date: IsoDate;
  /** Identificadores de egreso afectados (si aplica). */
  relatedOutflowIds?: string[];
  message: string;
  /** Déficit tras intentar cumplir obligaciones (opcional). */
  shortfallAmount?: number;
}

export type ProjectionLedgerKind =
  | 'open'
  | 'inflow'
  | 'fixed_out'
  | 'flex_paid'
  | 'flex_deferred';

/** Línea de detalle por día para auditoría / simulación. */
export interface ProjectionLedgerLine {
  kind: ProjectionLedgerKind;
  /** Referencia ligada al ítem (`ScheduledInflow` / `ScheduledOutflow`). */
  sourceId?: string;
  label: string;
  amount: number;
  /** Fecha original de vencimiento si se difiere un gasto flexible. */
  deferredFromDueDate?: IsoDate;
}

export interface ProjectionDayResult {
  date: IsoDate;
  openingBalance: number;
  inflowTotal: number;
  fixedOutflowTotal: number;
  flexiblePaidTotal: number;
  closingBalance: number;
  ledger: ProjectionLedgerLine[];
}

/** Un flexible pendiente tras un día (sigue disponible para días siguientes). */
export interface PendingFlexible {
  outflow: ScheduledOutflow;
  /** Primer día en que este ítem apareció como vencido. */
  originalDueDate: IsoDate;
}

export interface ProjectionEngineResult {
  days: ProjectionDayResult[];
  alerts: ProjectionAlert[];
  /** Flexible que no pudieron cubrirse dentro del horizonte. */
  unresolvedFlex: PendingFlexible[];
}
