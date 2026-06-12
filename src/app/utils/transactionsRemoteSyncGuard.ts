import type { Transaction } from '../types';
import { kvPayloadsEqual } from './kvCrossTabSync';

function maxTransactionTimestamp(items: Transaction[]): number {
  let max = 0;
  for (const tx of items) {
    const raw = tx.date instanceof Date ? tx.date.toISOString() : String(tx.date ?? '');
    const t = Date.parse(raw);
    if (!Number.isNaN(t) && t > max) max = t;
  }
  return max;
}

function transactionsLocalAheadOfRemote(local: Transaction[], remote: Transaction[]): boolean {
  if (local.length > remote.length) return true;
  const localTs = maxTransactionTimestamp(local);
  const remoteTs = maxTransactionTimestamp(remote);
  return localTs > remoteTs + 1000;
}

/** Evita que Realtime/poll SQL pise transacciones locales recién guardadas. */
export function shouldApplyTransactionsRemoteSnapshot(
  local: Transaction[],
  remote: Transaction[],
  cooldownUntilMs: number
): boolean {
  if (Date.now() < cooldownUntilMs) return false;
  if (kvPayloadsEqual(local, remote)) return false;
  if (local.length === 0 && remote.length > 0) return true;
  if (local.length > 0 && remote.length === 0) return false;
  if (transactionsLocalAheadOfRemote(local, remote)) return false;
  return true;
}

export const TRANSACTIONS_REMOTE_COOLDOWN_MS = 30_000;
