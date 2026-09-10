/** Marketing Eventos / Cursos — control presupuesto vs real (sin contabilidad). */

export type MarketingEventKind = 'curso' | 'evento' | 'taller' | 'otro';
export type MarketingEventStatus = 'borrador' | 'planificado' | 'en_curso' | 'cerrado' | 'cancelado';

export const MARKETING_EVENT_KIND_LABELS: Record<MarketingEventKind, string> = {
  curso: 'Curso',
  evento: 'Evento',
  taller: 'Taller',
  otro: 'Otro',
};

export const MARKETING_EVENT_STATUS_LABELS: Record<MarketingEventStatus, string> = {
  borrador: 'Borrador',
  planificado: 'Planificado',
  en_curso: 'En curso',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado',
};

/** Línea de ingreso o gasto: presupuesto (plan) y real (lo que pasó). */
export type MarketingMoneyLine = {
  id: string;
  concept: string;
  /** Lo que se planificó gastar/cobrar */
  budget: number;
  /** Lo que realmente se cobró/gastó */
  actual: number;
  notes?: string;
};

export type MarketingEventRecord = {
  id: string;
  name: string;
  kind: MarketingEventKind;
  status: MarketingEventStatus;
  /** Fecha de inicio (yyyy-MM-dd) */
  startDate: string;
  endDate?: string;
  location?: string;
  responsible?: string;
  /** Meta de participantes (informativo) */
  expectedAttendees?: number;
  notes?: string;
  incomeLines: MarketingMoneyLine[];
  expenseLines: MarketingMoneyLine[];
  createdAt: string;
  updatedAt: string;
};

export type MarketingEventosSettings = {
  version: 1;
  events: MarketingEventRecord[];
};

export type MarketingEventosFilters = {
  search: string;
  status: MarketingEventStatus | 'all';
  kind: MarketingEventKind | 'all';
  year: string | 'all';
};

export type MarketingEventPnl = {
  incomeBudget: number;
  incomeActual: number;
  expenseBudget: number;
  expenseActual: number;
  /** Resultado real: ingresos reales − egresos reales */
  profitActual: number;
  /** Resultado presupuestado */
  profitBudget: number;
  /** Rentabilidad real % sobre ingresos reales (0–100 scale as percent number) */
  marginActualPct: number | null;
  marginBudgetPct: number | null;
  /** Diferencia vs plan (profitActual − profitBudget) */
  varianceVsBudget: number;
  /** Lectura simple para no contadores */
  outcomeLabel: 'ganancia' | 'perdida' | 'empatado' | 'sin_datos';
};

export type MarketingEventosKpis = {
  eventsCount: number;
  activeCount: number;
  closedCount: number;
  consolidated: MarketingEventPnl;
  winners: number;
  losers: number;
};
