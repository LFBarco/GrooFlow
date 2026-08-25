import type { ReconciliationDataset } from '../domain/types';
import { createEmptyDataset, normalizeDataset } from '../domain/dataset';

type RemoteApply = (value: unknown) => void;

let latest: ReconciliationDataset = createEmptyDataset();
let remoteApply: RemoteApply | null = null;
/** Aplica aunque haya dirty local (p. ej. reinicio operativo). */
let forceApply: RemoteApply | null = null;

export function setReconciliationRetrySnapshot(dataset: ReconciliationDataset): void {
  latest = dataset;
}

export function getReconciliationRetrySnapshot(): ReconciliationDataset {
  return latest;
}

export function setReconciliationRemoteApply(fn: RemoteApply | null): void {
  remoteApply = fn;
}

export function setReconciliationForceApply(fn: RemoteApply | null): void {
  forceApply = fn;
}

export function applyReconciliationRemote(value: unknown): void {
  remoteApply?.(value);
}

/** Aplica un dataset de ejemplo/forzado al módulo de conciliación. */
export function applyExampleReconciliationDataset(dataset: ReconciliationDataset): void {
  latest = normalizeDataset(dataset);
  if (forceApply) {
    forceApply(latest);
  } else {
    remoteApply?.(latest);
  }
}

/** Limpia snapshot + UI del módulo (reinicio operativo). */
export function resetReconciliationForOperationalClear(): void {
  const empty = createEmptyDataset();
  latest = empty;
  if (forceApply) {
    forceApply(empty);
  } else {
    remoteApply?.(empty);
  }
}

export function normalizeReconciliationRemoteValue(value: unknown): ReconciliationDataset {
  return normalizeDataset(value);
}
