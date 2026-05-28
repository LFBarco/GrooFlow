import type { PettyCashFundDelivery, PettyCashTransaction, PettyCashWeekClosure } from '../types';
import { getPettyCashRowType, isFundDeliveryIncome } from './pettyCashAudit';
import { getOpeningFundForWeek, isWeekClosed } from './pettyCashWeekOpening';
import { weekKeyMatches } from './pettyCashWeekKey';

/** Egresos e ingresos que cuentan para saldo (excluye anulados/rechazados). */
export function isPettyCashMovementActive(t: PettyCashTransaction): boolean {
    return t.status !== 'voided' && t.status !== 'rejected';
}

export function sumCustodianWeekExpenses(
    transactions: PettyCashTransaction[],
    custodianId: string,
    weekStr: string
): number {
    return transactions
        .filter(
            (t) =>
                t.custodianId === custodianId &&
                weekKeyMatches(t.weekNumber, weekStr) &&
                isPettyCashMovementActive(t) &&
                getPettyCashRowType(t) === 'expense'
        )
        .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
}

export function sumCustodianWeekIncome(
    transactions: PettyCashTransaction[],
    custodianId: string,
    weekStr: string
): number {
    return transactions
        .filter(
            (t) =>
                t.custodianId === custodianId &&
                weekKeyMatches(t.weekNumber, weekStr) &&
                isPettyCashMovementActive(t) &&
                getPettyCashRowType(t) === 'income' &&
                !isFundDeliveryIncome(t)
        )
        .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
}

/** Saldo = fondo apertura (arrastre + dotación) − gastos + ingresos (sin dotación). */
export function getPettyCashWeekBalance(
    transactions: PettyCashTransaction[],
    custodianId: string,
    weekStr: string,
    weekClosures: PettyCashWeekClosure[] | undefined,
    defaultLimit: number,
    fundDeliveries?: PettyCashFundDelivery[] | undefined,
    openingCarry?: OpeningCarryUserState
): number {
    const opening = getOpeningFundForWeek(
        custodianId,
        weekStr,
        weekClosures,
        defaultLimit,
        fundDeliveries,
        openingCarry
    );
    const expenses = sumCustodianWeekExpenses(transactions, custodianId, weekStr);
    const income = sumCustodianWeekIncome(transactions, custodianId, weekStr);
    return opening - expenses + income;
}

export function isPettyCashWeekClosedForCustodian(
    custodianId: string,
    weekStr: string,
    weekClosures: PettyCashWeekClosure[] | undefined
): boolean {
    return isWeekClosed(custodianId, weekStr, weekClosures);
}
