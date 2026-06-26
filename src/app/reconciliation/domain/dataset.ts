import type {
  CanonicalMovement,
  ReconciliationDataset,
  ReconciliationSession,
} from '../domain/types';
import { RECONCILIATION_DATASET_VERSION } from '../domain/types';

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
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
    movements: Array.isArray(d.movements) ? d.movements : [],
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
