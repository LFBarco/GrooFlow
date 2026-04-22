import type { PettyCashWeekClosure } from '../types';

/**
 * Fondo con el que "abre" la semana `weekStr` para un responsable:
 * - Si la semana anterior (número − 1) está cerrada y dejó saldo > 0, ese monto es el fondo inicial.
 * - Si no hay cierre previo o el arrastre fue 0, se usa el límite configurado (`defaultLimit`).
 */
export function getOpeningFundForWeek(
  custodianId: string,
  weekStr: string,
  closures: PettyCashWeekClosure[] | undefined,
  defaultLimit: number
): number {
  const wn = parseInt(String(weekStr), 10);
  if (!Number.isFinite(wn) || wn <= 1) return defaultLimit;
  const prevWeek = String(wn - 1);
  const c = (closures ?? []).find(
    (x) => x.custodianId === custodianId && String(x.weekNumber) === prevWeek
  );
  if (!c) return defaultLimit;
  return c.carriedForward > 0 ? c.carriedForward : defaultLimit;
}

export function isWeekClosed(
  custodianId: string,
  weekStr: string,
  closures: PettyCashWeekClosure[] | undefined
): boolean {
  return (closures ?? []).some(
    (c) => c.custodianId === custodianId && String(c.weekNumber) === String(weekStr)
  );
}
