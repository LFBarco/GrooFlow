import type { PettyCashFundDelivery, PettyCashWeekClosure } from '../types';
import type { OpeningCarryUserState } from './pettyCashOpeningCarry';
import { getPreviousWeekKey, weekKeyMatches } from './pettyCashWeekKey';

export type WeekOpeningBreakdown = {
  /** Arrastre del cierre anterior o de apertura de periodo (config). */
  carryFromPrevious: number;
  /** Dotación confirmada por auditoría para esta semana. */
  fundDeliveryAmount: number;
  /** Límite configurado del responsable (referencia / monto sugerido al entregar). */
  configuredFundAmount: number;
  /** carryFromPrevious + fundDeliveryAmount (base antes de gastos/ingresos). */
  openingTotal: number;
  /** Semana anterior cerrada o apertura de periodo sin dotación confirmada. */
  deliveryPending: boolean;
  /** Requiere confirmación de auditoría (dotación y/o apertura). */
  requiresFundDelivery: boolean;
  /** Primera semana en calendario legado (sin semana anterior numérica). */
  isFirstWeek: boolean;
  /** Primera semana operativa sin cierre previo (inicio de periodo / año). */
  isPeriodOpeningWeek: boolean;
};

function findPreviousClosure(
  custodianId: string,
  weekStr: string,
  closures: PettyCashWeekClosure[] | undefined
): PettyCashWeekClosure | undefined {
  const prevWeek = getPreviousWeekKey(String(weekStr));
  if (!prevWeek) return undefined;
  return (closures ?? []).find(
    (x) => x.custodianId === custodianId && weekKeyMatches(x.weekNumber, prevWeek)
  );
}

export function findFundDeliveryForWeek(
  custodianId: string,
  weekStr: string,
  deliveries: PettyCashFundDelivery[] | undefined
): PettyCashFundDelivery | undefined {
  return (deliveries ?? []).find(
    (d) => d.custodianId === custodianId && weekKeyMatches(d.weekNumber, weekStr)
  );
}

export function getWeekOpeningBreakdown(
  custodianId: string,
  weekStr: string,
  closures: PettyCashWeekClosure[] | undefined,
  deliveries: PettyCashFundDelivery[] | undefined,
  defaultLimit: number,
  openingCarry?: OpeningCarryUserState
): WeekOpeningBreakdown {
  const prevWeek = getPreviousWeekKey(String(weekStr));
  const delivery = findFundDeliveryForWeek(custodianId, weekStr, deliveries);
  const fundDeliveryAmount = delivery ? Math.max(0, Number(delivery.deliveredAmount) || 0) : 0;

  if (!prevWeek) {
    return {
      carryFromPrevious: 0,
      fundDeliveryAmount,
      configuredFundAmount: defaultLimit,
      openingTotal: fundDeliveryAmount,
      deliveryPending: !delivery,
      requiresFundDelivery: !delivery,
      isFirstWeek: true,
      isPeriodOpeningWeek: false,
    };
  }

  const prevClosure = findPreviousClosure(custodianId, weekStr, closures);

  if (!prevClosure) {
    /** Apertura de periodo: sin cierre de semana anterior (ej. 2026-W01 sin cierre 2025-W52). */
    const carryFromConfig = openingCarry?.availableSuggested ?? 0;
    const carryFromDelivery =
      delivery?.openingCarryAmount != null
        ? Math.max(0, Number(delivery.openingCarryAmount) || 0)
        : carryFromConfig;
    return {
      carryFromPrevious: carryFromDelivery,
      fundDeliveryAmount,
      configuredFundAmount: defaultLimit,
      openingTotal: carryFromDelivery + fundDeliveryAmount,
      deliveryPending: !delivery,
      requiresFundDelivery: true,
      isFirstWeek: false,
      isPeriodOpeningWeek: true,
    };
  }

  const carry = Math.max(0, Number(prevClosure.carriedForward) || 0);

  return {
    carryFromPrevious: carry,
    fundDeliveryAmount,
    configuredFundAmount: defaultLimit,
    openingTotal: carry + fundDeliveryAmount,
    deliveryPending: !delivery,
    requiresFundDelivery: true,
    isFirstWeek: false,
    isPeriodOpeningWeek: false,
  };
}

/**
 * Fondo con el que abre la semana (arrastre + dotación confirmada).
 */
export function getOpeningFundForWeek(
  custodianId: string,
  weekStr: string,
  closures: PettyCashWeekClosure[] | undefined,
  defaultLimit: number,
  deliveries?: PettyCashFundDelivery[] | undefined,
  openingCarry?: OpeningCarryUserState
): number {
  return getWeekOpeningBreakdown(
    custodianId,
    weekStr,
    closures,
    deliveries,
    defaultLimit,
    openingCarry
  ).openingTotal;
}

export function isWeekClosed(
  custodianId: string,
  weekStr: string,
  closures: PettyCashWeekClosure[] | undefined
): boolean {
  return (closures ?? []).some(
    (c) => c.custodianId === custodianId && weekKeyMatches(c.weekNumber, weekStr)
  );
}

/** Dotación de fondo fijo aún pendiente de confirmación por auditoría. */
export function isFundDeliveryPendingForWeek(
  custodianId: string,
  weekStr: string,
  closures: PettyCashWeekClosure[] | undefined,
  deliveries: PettyCashFundDelivery[] | undefined,
  openingCarry?: OpeningCarryUserState
): boolean {
  const b = getWeekOpeningBreakdown(
    custodianId,
    weekStr,
    closures,
    deliveries,
    0,
    openingCarry
  );
  return b.requiresFundDelivery && b.deliveryPending;
}
