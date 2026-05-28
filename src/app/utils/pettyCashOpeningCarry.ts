import type { User } from '../types';

/** Estado del saldo arrastrado de apertura (ej. cierre 2025 → inicio 2026). */
export type OpeningCarryUserState = {
  suggested: number;
  consumed: boolean;
  /** Monto sugerido aún disponible (0 si ya se consumió al confirmar apertura). */
  availableSuggested: number;
};

export function getUserOpeningCarryState(user: User | null | undefined): OpeningCarryUserState {
  const suggested = Math.max(0, Number(user?.pettyCashOpeningCarrySuggested) || 0);
  const consumed = Boolean(user?.pettyCashOpeningCarryConsumedAt?.trim());
  return {
    suggested,
    consumed,
    availableSuggested: consumed ? 0 : suggested,
  };
}
