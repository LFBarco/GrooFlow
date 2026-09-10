import type {
  MarketingEventKind,
  MarketingEventPnl,
  MarketingEventRecord,
  MarketingEventStatus,
  MarketingEventosFilters,
  MarketingEventosKpis,
  MarketingEventosSettings,
  MarketingMoneyLine,
} from '../types/marketingEventos';
import { generateEntityId } from './generateEntityId';

export const MARKETING_EVENTOS_SETTINGS_KV_KEY = 'settings:marketing-eventos';

export function defaultMarketingEventosFilters(): MarketingEventosFilters {
  return {
    search: '',
    status: 'all',
    kind: 'all',
    year: 'all',
  };
}

export function defaultMarketingEventosSettings(): MarketingEventosSettings {
  return { version: 1, events: [] };
}

function normalizeLine(raw: Partial<MarketingMoneyLine> | null | undefined): MarketingMoneyLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const concept = String(raw.concept ?? '').trim();
  if (!concept) return null;
  return {
    id: String(raw.id ?? generateEntityId('mel')),
    concept,
    budget: Math.max(0, Number(raw.budget) || 0),
    actual: Math.max(0, Number(raw.actual) || 0),
    notes: raw.notes ? String(raw.notes) : undefined,
  };
}

export function normalizeMarketingEvent(
  raw: Partial<MarketingEventRecord> | null | undefined
): MarketingEventRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name ?? '').trim();
  if (!name) return null;
  const now = new Date().toISOString();
  const incomeLines = Array.isArray(raw.incomeLines)
    ? raw.incomeLines.map(normalizeLine).filter((x): x is MarketingMoneyLine => !!x)
    : [];
  const expenseLines = Array.isArray(raw.expenseLines)
    ? raw.expenseLines.map(normalizeLine).filter((x): x is MarketingMoneyLine => !!x)
    : [];
  return {
    id: String(raw.id ?? generateEntityId('mev')),
    name,
    kind: (raw.kind as MarketingEventKind) || 'curso',
    status: (raw.status as MarketingEventStatus) || 'borrador',
    startDate: String(raw.startDate ?? now.slice(0, 10)),
    endDate: raw.endDate ? String(raw.endDate) : undefined,
    location: raw.location ? String(raw.location) : undefined,
    responsible: raw.responsible ? String(raw.responsible) : undefined,
    expectedAttendees:
      raw.expectedAttendees != null && Number.isFinite(Number(raw.expectedAttendees))
        ? Math.max(0, Math.round(Number(raw.expectedAttendees)))
        : undefined,
    notes: raw.notes ? String(raw.notes) : undefined,
    incomeLines,
    expenseLines,
    createdAt: String(raw.createdAt ?? now),
    updatedAt: String(raw.updatedAt ?? now),
  };
}

export function mergeMarketingEventosSettings(
  partial?: Partial<MarketingEventosSettings> | null
): MarketingEventosSettings {
  const base = defaultMarketingEventosSettings();
  if (!partial || typeof partial !== 'object') return base;
  const events = Array.isArray(partial.events)
    ? partial.events.map(normalizeMarketingEvent).filter((x): x is MarketingEventRecord => !!x)
    : [];
  return { version: 1, events };
}

export function sumLines(lines: MarketingMoneyLine[], field: 'budget' | 'actual'): number {
  return lines.reduce((s, l) => s + (Number(l[field]) || 0), 0);
}

export function computeEventPnl(event: MarketingEventRecord): MarketingEventPnl {
  const incomeBudget = sumLines(event.incomeLines, 'budget');
  const incomeActual = sumLines(event.incomeLines, 'actual');
  const expenseBudget = sumLines(event.expenseLines, 'budget');
  const expenseActual = sumLines(event.expenseLines, 'actual');
  const profitActual = incomeActual - expenseActual;
  const profitBudget = incomeBudget - expenseBudget;
  const marginActualPct =
    incomeActual > 1e-9 ? (profitActual / incomeActual) * 100 : null;
  const marginBudgetPct =
    incomeBudget > 1e-9 ? (profitBudget / incomeBudget) * 100 : null;
  const varianceVsBudget = profitActual - profitBudget;

  let outcomeLabel: MarketingEventPnl['outcomeLabel'] = 'sin_datos';
  if (incomeActual > 1e-9 || expenseActual > 1e-9) {
    if (Math.abs(profitActual) < 0.005) outcomeLabel = 'empatado';
    else outcomeLabel = profitActual > 0 ? 'ganancia' : 'perdida';
  }

  return {
    incomeBudget,
    incomeActual,
    expenseBudget,
    expenseActual,
    profitActual,
    profitBudget,
    marginActualPct,
    marginBudgetPct,
    varianceVsBudget,
    outcomeLabel,
  };
}

export function computeConsolidatedPnl(events: MarketingEventRecord[]): MarketingEventPnl {
  const fake: MarketingEventRecord = {
    id: '_',
    name: '_',
    kind: 'otro',
    status: 'borrador',
    startDate: '2000-01-01',
    incomeLines: events.flatMap((e) => e.incomeLines),
    expenseLines: events.flatMap((e) => e.expenseLines),
    createdAt: '',
    updatedAt: '',
  };
  return computeEventPnl(fake);
}

export function computeMarketingEventosKpis(events: MarketingEventRecord[]): MarketingEventosKpis {
  const consolidated = computeConsolidatedPnl(events);
  let winners = 0;
  let losers = 0;
  for (const e of events) {
    if (e.status === 'cancelado') continue;
    const pnl = computeEventPnl(e);
    if (pnl.outcomeLabel === 'ganancia') winners += 1;
    if (pnl.outcomeLabel === 'perdida') losers += 1;
  }
  return {
    eventsCount: events.length,
    activeCount: events.filter((e) => e.status === 'planificado' || e.status === 'en_curso').length,
    closedCount: events.filter((e) => e.status === 'cerrado').length,
    consolidated,
    winners,
    losers,
  };
}

export function filterMarketingEvents(
  events: MarketingEventRecord[],
  filters: MarketingEventosFilters
): MarketingEventRecord[] {
  const q = filters.search.trim().toLowerCase();
  return events
    .filter((e) => {
      if (filters.status !== 'all' && e.status !== filters.status) return false;
      if (filters.kind !== 'all' && e.kind !== filters.kind) return false;
      if (filters.year !== 'all' && !e.startDate.startsWith(filters.year)) return false;
      if (!q) return true;
      const hay = `${e.name} ${e.location ?? ''} ${e.responsible ?? ''} ${e.notes ?? ''}`.toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate) || a.name.localeCompare(b.name, 'es'));
}

export function upsertMarketingEvent(
  settings: MarketingEventosSettings,
  record: Omit<MarketingEventRecord, 'createdAt' | 'updatedAt'> & {
    id?: string;
    createdAt?: string;
  }
): { settings: MarketingEventosSettings; event: MarketingEventRecord | null } {
  const now = new Date().toISOString();
  const id = record.id ?? generateEntityId('mev');
  const existing = settings.events.find((e) => e.id === id);
  const next = normalizeMarketingEvent({
    ...record,
    id,
    createdAt: existing?.createdAt ?? record.createdAt ?? now,
    updatedAt: now,
  });
  if (!next) return { settings, event: null };
  const rest = settings.events.filter((e) => e.id !== id);
  return { settings: { ...settings, events: [next, ...rest] }, event: next };
}

export function removeMarketingEvent(
  settings: MarketingEventosSettings,
  eventId: string
): MarketingEventosSettings {
  return { ...settings, events: settings.events.filter((e) => e.id !== eventId) };
}

/** Plantillas listas para un curso típico de marketing. */
export function courseTemplateLines(): {
  incomeLines: MarketingMoneyLine[];
  expenseLines: MarketingMoneyLine[];
} {
  const mk = (concept: string): MarketingMoneyLine => ({
    id: generateEntityId('mel'),
    concept,
    budget: 0,
    actual: 0,
  });
  return {
    incomeLines: [
      mk('Inscripciones / matrículas'),
      mk('Patrocinios'),
      mk('Venta de materiales'),
    ],
    expenseLines: [
      mk('Local / alquiler'),
      mk('Publicidad y difusión'),
      mk('Materiales didácticos'),
      mk('Coffee break / catering'),
      mk('Honorarios expositores'),
      mk('Otros gastos'),
    ],
  };
}

export function outcomePlainMessage(pnl: MarketingEventPnl): string {
  switch (pnl.outcomeLabel) {
    case 'ganancia':
      return 'Este evento generó ganancia (los ingresos reales superaron los gastos).';
    case 'perdida':
      return 'Este evento cerró en pérdida (los gastos reales superaron los ingresos).';
    case 'empatado':
      return 'Quedó casi empatado: ingresos y gastos reales se equilibran.';
    default:
      return 'Aún no hay montos reales cargados. Completa la columna «Real» para ver el resultado.';
  }
}

/** Explica rentabilidad en lenguaje simple. */
export function marginPlainMessage(pnl: MarketingEventPnl): string {
  if (pnl.marginActualPct == null) {
    return 'Sin ingresos reales no se puede calcular la rentabilidad.';
  }
  const m = pnl.marginActualPct;
  if (m >= 0) {
    return `De cada S/ 100 de ingresos reales, quedan aproximadamente S/ ${m.toFixed(1)} de ganancia.`;
  }
  return `De cada S/ 100 de ingresos reales, se pierden aproximadamente S/ ${Math.abs(m).toFixed(1)}.`;
}
