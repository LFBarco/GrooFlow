import type { PettyCashFundDelivery, PettyCashWeekClosure, User } from '../types';
import { getSuperAdminEmails } from '../config/superAdmins';
import { comparePettyCashWeekKeys, getNextWeekKey, weekKeyMatches } from './pettyCashWeekKey';
import { findFundDeliveryForWeek } from './pettyCashWeekOpening';

/** Administrador de sistema (admin / super_admin / correo privilegiado). */
export function canReopenPettyCashWeekClosure(user: User | null | undefined): boolean {
  if (!user) return false;
  const email = (user.email || '').trim().toLowerCase();
  if (email && getSuperAdminEmails().has(email)) return true;
  const roleId = String(user.role || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  return roleId === 'admin' || roleId === 'super_admin' || roleId === 'superadministrador';
}

/** Cierres del mismo responsable en semanas posteriores a `weekKey` (orden ascendente). */
export function listLaterWeekClosures(
  custodianId: string,
  weekKey: string,
  closures: PettyCashWeekClosure[] | undefined
): PettyCashWeekClosure[] {
  return (closures ?? [])
    .filter(
      (c) =>
        c.custodianId === custodianId &&
        !weekKeyMatches(c.weekNumber, weekKey) &&
        comparePettyCashWeekKeys(String(c.weekNumber), String(weekKey)) > 0
    )
    .slice()
    .sort((a, b) => comparePettyCashWeekKeys(String(a.weekNumber), String(b.weekNumber)));
}

export type PettyCashWeekReopenEvaluation =
  | {
      ok: false;
      code: 'not_closed' | 'later_closed' | 'forbidden';
      message: string;
      laterWeeks?: string[];
    }
  | {
      ok: true;
      nextWeekKey: string | null;
      nextWeekHasDelivery: boolean;
      warning?: string;
    };

export function evaluatePettyCashWeekReopen(params: {
  user: User | null | undefined;
  custodianId: string;
  weekKey: string;
  closures: PettyCashWeekClosure[] | undefined;
  deliveries?: PettyCashFundDelivery[] | undefined;
}): PettyCashWeekReopenEvaluation {
  const { user, custodianId, weekKey, closures, deliveries } = params;
  if (!canReopenPettyCashWeekClosure(user)) {
    return {
      ok: false,
      code: 'forbidden',
      message: 'Solo el administrador de sistema puede revertir un cierre de semana.',
    };
  }
  const closed = (closures ?? []).some(
    (c) => c.custodianId === custodianId && weekKeyMatches(c.weekNumber, weekKey)
  );
  if (!closed) {
    return {
      ok: false,
      code: 'not_closed',
      message: 'Esta semana no está cerrada.',
    };
  }
  const later = listLaterWeekClosures(custodianId, weekKey, closures);
  if (later.length > 0) {
    const laterWeeks = later.map((c) => String(c.weekNumber));
    return {
      ok: false,
      code: 'later_closed',
      laterWeeks,
      message:
        `Hay semanas posteriores ya cerradas (${laterWeeks.join(', ')}). ` +
        'Revierta primero la más reciente y continúe hacia atrás.',
    };
  }
  const nextWeekKey = getNextWeekKey(String(weekKey));
  const nextWeekHasDelivery = !!(
    nextWeekKey && findFundDeliveryForWeek(custodianId, nextWeekKey, deliveries)
  );
  return {
    ok: true,
    nextWeekKey,
    nextWeekHasDelivery,
    warning: nextWeekHasDelivery
      ? `La semana siguiente (${nextWeekKey}) ya tiene dotación confirmada. Al reabrir, el arrastre de apertura puede cambiar hasta que vuelva a cerrar esta semana.`
      : undefined,
  };
}

export function removePettyCashWeekClosure(
  closures: PettyCashWeekClosure[] | undefined,
  custodianId: string,
  weekKey: string
): PettyCashWeekClosure[] {
  return (closures ?? []).filter(
    (c) => !(c.custodianId === custodianId && weekKeyMatches(c.weekNumber, weekKey))
  );
}
