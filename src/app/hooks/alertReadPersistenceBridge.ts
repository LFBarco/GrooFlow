export type AlertReadState = {
  readIds: string[];
  updatedAt: string;
};

type RemoteApply = (value: unknown) => void;

let latest: AlertReadState = { readIds: [], updatedAt: '' };
let remoteApply: RemoteApply | null = null;

export function setAlertReadRetrySnapshot(state: AlertReadState): void {
  latest = state;
}

export function getAlertReadRetrySnapshot(): AlertReadState {
  return latest;
}

export function setAlertReadRemoteApply(fn: RemoteApply | null): void {
  remoteApply = fn;
}

export function applyAlertReadRemote(value: unknown): void {
  remoteApply?.(value);
}
