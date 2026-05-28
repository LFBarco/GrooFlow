import type { User } from '../types';

/**
 * Compatibilidad:
 * - Si el flag existe, manda.
 * - Si no existe (datos viejos), inferimos por límite > 0.
 */
export function userHasPettyCashFund(user: User | null | undefined): boolean {
  if (!user) return false;
  if (typeof user.pettyCashFundEnabled === 'boolean') return user.pettyCashFundEnabled;
  return (user.pettyCashLimit ?? 0) > 0;
}

/** Límite operativo para caja chica (0 cuando no aplica fondo fijo). */
export function effectivePettyCashFundLimit(user: User | null | undefined, globalLimit: number): number {
  if (!userHasPettyCashFund(user)) return 0;
  return user && user.pettyCashLimit && user.pettyCashLimit > 0 ? user.pettyCashLimit : globalLimit;
}
