import type { PettyCashTransaction, User } from '../types';
import type { Role } from '../components/users/types';
import { getSuperAdminEmails } from '../config/superAdmins';

/** Categoría reservada para ingresos de refuerzo de fondo (administración). */
export const ADMIN_FUND_TOPUP_CATEGORY = 'Asignación extraordinaria de fondo';

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
    if (t.incomeSubtype === 'admin_topup' || t.incomeSubtype === 'replenishment') return 'income';
    if (t.category === ADMIN_FUND_TOPUP_CATEGORY) return 'income';
    return 'expense';
}

/**
 * Puede aprobar o rechazar movimientos de caja chica en auditoría.
 * Incluye super_admin por id de rol, correos privilegiados en config y roles
 * personalizados con permisos de Auditoría + Caja Chica (mismo criterio que el módulo global).
 */
export function canApprovePettyCashMovements(user: User | null | undefined, roles?: Role[] | null): boolean {
    if (!user?.role) return false;
    const roleId = String(user.role).trim();
    if (['auditoria', 'admin', 'super_admin'].includes(roleId)) return true;

    const email = (user.email || '').trim().toLowerCase();
    if (email && getSuperAdminEmails().has(email)) return true;

    const norm = roleId.toLowerCase().replace(/\s+/g, '_');
    if (norm === 'super_admin' || norm === 'superadministrador' || norm === 'superadmin') return true;

    if (roles?.length) {
        const row = roles.find((r) => r.id === roleId);
        const p = row?.permissions;
        if (p?.['Auditoría'] === true && p?.['Caja Chica'] === true) return true;
        /** Rol tipo “acceso total” (todos los módulos en true). */
        if (row && p && Object.keys(p).length > 0 && Object.values(p).every((v) => v === true)) return true;
    }

    return false;
}

/** Puede registrar refuerzos excepcionales de fondo a un responsable. */
export function canAdminFundTopUp(user: User): boolean {
    return ['admin', 'super_admin', 'manager'].includes(user.role);
}

export function isAdminTopUpIncome(t: PettyCashTransaction): boolean {
    if (getPettyCashRowType(t) !== 'income') return false;
    return t.incomeSubtype === 'admin_topup' || t.category === ADMIN_FUND_TOPUP_CATEGORY;
}

/** Ingresos que no son refuerzo admin (reposiciones o legado sin subtype). */
export function isReplenishmentIncome(t: PettyCashTransaction): boolean {
    return getPettyCashRowType(t) === 'income' && !isAdminTopUpIncome(t);
}

/** Todos los movimientos que cuentan (no anulados ni rechazados) deben estar aprobados para cierre definitivo. */
export function allPettyCashWeekMovementsApproved(weekTransactions: PettyCashTransaction[]): boolean {
    const relevant = weekTransactions.filter(
        (t) => t.status !== 'voided' && t.status !== 'rejected'
    );
    if (relevant.length === 0) return true;
    return relevant.every((t) => t.status === 'approved');
}
