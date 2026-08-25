export type AlertReadState = {
  readIds: string[];
  updatedAt: string;
};

type RemoteApply = (value: unknown) => void;

let latest: AlertReadState = { readIds: [], updatedAt: '' };
let remoteApply: RemoteApply | null = null;
let forceApply: RemoteApply | null = null;

export function setAlertReadRetrySnapshot(state: AlertReadState): void {
  latest = state;
}

export function getAlertReadRetrySnapshot(): AlertReadState {
  return latest;
}

export function setAlertReadRemoteApply(fn: RemoteApply | null): void {
  remoteApply = fn;
}

export function setAlertReadForceApply(fn: RemoteApply | null): void {
  forceApply = fn;
}

export function applyAlertReadRemote(value: unknown): void {
  remoteApply?.(value);
}

export function resetAlertReadForOperationalClear(): void {
  const empty: AlertReadState = { readIds: [], updatedAt: new Date().toISOString() };
  latest = empty;
  if (forceApply) forceApply(empty);
  else remoteApply?.(empty);
}
