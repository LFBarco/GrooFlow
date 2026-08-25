import type { ReconciliationDataset } from '../domain/types';
import { createEmptyDataset } from '../domain/dataset';

type RemoteApply = (value: unknown) => void;

let latest: ReconciliationDataset = createEmptyDataset();
let remoteApply: RemoteApply | null = null;

export function setReconciliationRetrySnapshot(dataset: ReconciliationDataset): void {
  latest = dataset;
}

export function getReconciliationRetrySnapshot(): ReconciliationDataset {
  return latest;
}

export function setReconciliationRemoteApply(fn: RemoteApply | null): void {
  remoteApply = fn;
}

export function applyReconciliationRemote(value: unknown): void {
  remoteApply?.(value);
}
