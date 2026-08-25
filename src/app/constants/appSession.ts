import type { Transaction, User } from '../types';

export const TRANSACTION_HISTORY_CLEAR_MARK = '2026-05-11-clear-transaction-history-v1';

export const EMPTY_INITIAL_TRANSACTIONS: Transaction[] = [];

export const GUEST_USER: User = {
  id: 'guest',
  name: 'Invitado',
  initials: 'IN',
  role: 'manager',
  status: 'active',
  allSedes: true,
};

export type TransactionDatePreset =
  | 'all'
  | 'last7'
  | 'currentMonth'
  | 'previousMonth'
  | 'year'
  | 'custom';

import { getGrooflowBackend, isLocalBackend as isLocalBackendFn } from '../config/backend';

export const APP_BACKEND = getGrooflowBackend();

export function isLocalBackend(): boolean {
  return isLocalBackendFn();
}
