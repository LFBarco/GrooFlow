import type {
  CanonicalMovement,
  ReconciliationDataset,
  ReconciliationSession,
} from '../domain/types';
import { RECONCILIATION_DATASET_VERSION } from '../domain/types';
import { normalizeOperationNumber } from './normalize';

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function renormalizeMovementOperation(m: CanonicalMovement): CanonicalMovement {
  const source = m.operationNumberRaw || m.operationNumber;
  if (!source) return m;
  const { normalized, raw } = normalizeOperationNumber(source);
  if (m.operationNumber === normalized && m.operationNumberRaw === raw) return m;
  return { ...m, operationNumber: normalized, operationNumberRaw: raw };
}

export function todaySessionLabel(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createEmptyDataset(): ReconciliationDataset {
  const sessionId = newId('rs');
  const session: ReconciliationSession = {
    id: sessionId,
    label: todaySessionLabel(),
    createdAt: new Date().toISOString(),
  };
  return {
    version: RECONCILIATION_DATASET_VERSION,
    activeSessionId: sessionId,
    sessions: [session],
    batches: [],
    movements: [],
    matches: [],
    alerts: [],
    reconciledOperationKeys: [],
  };
}

export function normalizeDataset(raw: unknown): ReconciliationDataset {
  if (!raw || typeof raw !== 'object') return createEmptyDataset();
  const d = raw as Partial<ReconciliationDataset>;
  if (d.version !== RECONCILIATION_DATASET_VERSION) return createEmptyDataset();
  const sessions = Array.isArray(d.sessions) && d.sessions.length > 0 ? d.sessions : createEmptyDataset().sessions;
  const activeSessionId =
    d.activeSessionId && sessions.some((s) => s.id === d.activeSessionId)
      ? d.activeSessionId
      : sessions[0]!.id;
  return {
    version: RECONCILIATION_DATASET_VERSION,
    activeSessionId,
    sessions,
    batches: Array.isArray(d.batches) ? d.batches : [],
    movements: Array.isArray(d.movements) ? d.movements.map(renormalizeMovementOperation) : [],
    matches: Array.isArray(d.matches) ? d.matches : [],
    alerts: Array.isArray(d.alerts) ? d.alerts : [],
    reconciledOperationKeys: Array.isArray(d.reconciledOperationKeys) ? d.reconciledOperationKeys : [],
  };
}

export function getActiveSession(dataset: ReconciliationDataset): ReconciliationSession {
  return dataset.sessions.find((s) => s.id === dataset.activeSessionId) ?? dataset.sessions[0]!;
}

export function sessionMovements(dataset: ReconciliationDataset, sessionId?: string): CanonicalMovement[] {
  const sid = sessionId ?? dataset.activeSessionId;
  return dataset.movements.filter((m) => m.sessionId === sid);
}

export function countMovementsBySession(dataset: ReconciliationDataset): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of dataset.movements) {
    counts.set(m.sessionId, (counts.get(m.sessionId) ?? 0) + 1);
  }
  return counts;
}

/** Sesión con más movimientos (útil si la activa quedó vacía tras «Nueva sesión»). */
export function sessionWithMostMovements(
  dataset: ReconciliationDataset
): { sessionId: string; count: number } | null {
  const counts = countMovementsBySession(dataset);
  let bestId: string | null = null;
  let bestCount = 0;
  for (const [sid, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestId = sid;
    }
  }
  return bestId ? { sessionId: bestId, count: bestCount } : null;
}

export function setActiveSession(
  dataset: ReconciliationDataset,
  sessionId: string
): ReconciliationDataset {
  if (!dataset.sessions.some((s) => s.id === sessionId)) return dataset;
  return { ...dataset, activeSessionId: sessionId };
}

export function startNewSession(dataset: ReconciliationDataset, label?: string): ReconciliationDataset {
  const session: ReconciliationSession = {
    id: newId('rs'),
    label: label ?? todaySessionLabel(),
    createdAt: new Date().toISOString(),
  };
  return {
    ...dataset,
    activeSessionId: session.id,
    sessions: [session, ...dataset.sessions],
  };
}
