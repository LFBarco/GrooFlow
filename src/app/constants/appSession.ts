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

export const APP_BACKEND = import.meta.env.VITE_BACKEND ?? 'supabase';

export function isLocalBackend(): boolean {
  return APP_BACKEND === 'local';
}
