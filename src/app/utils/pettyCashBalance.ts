import type { PettyCashTransaction, PettyCashWeekClosure } from '../types';
import { getPettyCashRowType } from './pettyCashAudit';
import { getOpeningFundForWeek, isWeekClosed } from './pettyCashWeekOpening';

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
                String(t.weekNumber) === String(weekStr) &&
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
                String(t.weekNumber) === String(weekStr) &&
                isPettyCashMovementActive(t) &&
                getPettyCashRowType(t) === 'income'
        )
        .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
}

/** Saldo = fondo apertura − gastos + reposiciones (ingresos). */
export function getPettyCashWeekBalance(
    transactions: PettyCashTransaction[],
    custodianId: string,
    weekStr: string,
    weekClosures: PettyCashWeekClosure[] | undefined,
    defaultLimit: number
): number {
    const opening = getOpeningFundForWeek(custodianId, weekStr, weekClosures, defaultLimit);
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
