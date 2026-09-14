import type { PettyCashTransaction, User } from '../types';
import type { Role } from '../components/users/types';
import { canAuditPettyCashFunds } from './pettyCashAccess';

/** Categoría reservada para ingresos de refuerzo de fondo (administración). */
export const ADMIN_FUND_TOPUP_CATEGORY = 'Asignación extraordinaria de fondo';

/** Categoría de dotación semanal confirmada por auditoría (ya incluida en fondo de apertura). */
export const FUND_DELIVERY_CATEGORY = 'Dotación semanal de fondo fijo';

/**
 * Normaliza tipo de movimiento (KV/JSON legado o variantes).
 */
export function getPettyCashRowType(t: PettyCashTransaction): 'income' | 'expense' {
    const raw = (t as { type?: unknown }).type;
    if (raw === 'income') return 'income';
    if (raw === 'expense') return 'expense';
    if (typeof raw === 'string') {
        const l = raw.toLowerCase().trim();
        if (l === 'income' || l === 'ingreso') return 'income';
        if (l === 'expense' || l === 'egreso' || l === 'gasto') return 'expense';
    }
    if (
        t.incomeSubtype === 'admin_topup' ||
        t.incomeSubtype === 'replenishment' ||
        t.incomeSubtype === 'fund_delivery'
    ) {
        return 'income';
    }
    if (t.category === ADMIN_FUND_TOPUP_CATEGORY || t.category === FUND_DELIVERY_CATEGORY) return 'income';
    return 'expense';
}

/**
 * Puede aprobar o rechazar movimientos de caja chica en auditoría.
 * Auditoría (+ admin). Contabilidad/Jefes/Gerencia ven fondos pero no aprueban.
 */
export function canApprovePettyCashMovements(user: User | null | undefined, roles?: Role[] | null): boolean {
    return canAuditPettyCashFunds(user, roles);
}

/** Puede registrar refuerzos de fondo (misma regla que aprobación / dotación). */
export function canAdminFundTopUp(user: User, roles?: Role[] | null): boolean {
    return canAuditPettyCashFunds(user, roles);
}

/** Puede confirmar entrega de dotación semanal (auditoría). */
export function canConfirmPettyCashFundDelivery(
    user: User | null | undefined,
    roles?: Role[] | null
): boolean {
    return canAuditPettyCashFunds(user, roles);
}

export function isFundDeliveryIncome(t: PettyCashTransaction): boolean {
    if (getPettyCashRowType(t) !== 'income') return false;
    return t.incomeSubtype === 'fund_delivery' || t.category === FUND_DELIVERY_CATEGORY;
}

export function isAdminTopUpIncome(t: PettyCashTransaction): boolean {
    if (getPettyCashRowType(t) !== 'income') return false;
    return t.incomeSubtype === 'admin_topup' || t.category === ADMIN_FUND_TOPUP_CATEGORY;
}

/** Ingresos que no son refuerzo admin ni dotación semanal (reposiciones o legado sin subtype). */
export function isReplenishmentIncome(t: PettyCashTransaction): boolean {
    return (
        getPettyCashRowType(t) === 'income' &&
        !isAdminTopUpIncome(t) &&
        !isFundDeliveryIncome(t)
    );
}

/** Todos los movimientos que cuentan (no anulados ni rechazados) deben estar aprobados para cierre definitivo. */
export function allPettyCashWeekMovementsApproved(weekTransactions: PettyCashTransaction[]): boolean {
    const relevant = weekTransactions.filter(
        (t) => t.status !== 'voided' && t.status !== 'rejected'
    );
    if (relevant.length === 0) return true;
    return relevant.every((t) => t.status === 'approved');
}
