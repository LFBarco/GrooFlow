import { addMonths, differenceInCalendarDays, format, parseISO } from 'date-fns';

import type { User } from '../types';
import type { UniformDeliveryRecord } from '../types/uniformes';

export const UNIFORM_RENEWAL_MONTHS = 12;
export const UNIFORM_RENEWAL_WARN_DAYS = 30;

export type UniformRenewalStatus = 'ok' | 'due_soon' | 'overdue' | 'unknown';

export interface StaffUniformRenewal {
  userId?: string;
  staffName: string;
  jobTitle?: string;
  workArea?: string;
  sede?: string;
  lastDeliveryDate?: string;
  nextDueDate?: string;
  status: UniformRenewalStatus;
  daysUntilDue?: number;
}

function staffKey(record: { userId?: string; staffName: string }): string {
  return record.userId ?? record.staffName.trim().toLowerCase();
}

function matchesStaff(
  record: UniformDeliveryRecord,
  userId?: string,
  staffName?: string
): boolean {
  if (userId && record.userId === userId) return true;
  if (staffName && record.staffName.trim().toLowerCase() === staffName.trim().toLowerCase()) {
    return true;
  }
  return false;
}

export function computeStaffUniformRenewal(input: {
  records: UniformDeliveryRecord[];
  userId?: string;
  staffName: string;
}): StaffUniformRenewal {
  const { records, userId, staffName } = input;
  const relevant = records
    .filter((r) => matchesStaff(r, userId, staffName))
    .filter((r) => r.status !== 'devuelto')
    .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate));

  if (relevant.length === 0) {
    return { userId, staffName, status: 'unknown' };
  }

  const last = relevant[0]!;
  const nextDue = addMonths(parseISO(`${last.deliveryDate}T12:00:00`), UNIFORM_RENEWAL_MONTHS);
  const nextDueDate = format(nextDue, 'yyyy-MM-dd');
  const daysUntilDue = differenceInCalendarDays(nextDue, new Date());

  let status: UniformRenewalStatus = 'ok';
  if (daysUntilDue < 0) status = 'overdue';
  else if (daysUntilDue <= UNIFORM_RENEWAL_WARN_DAYS) status = 'due_soon';

  return {
    userId: last.userId ?? userId,
    staffName: last.staffName || staffName,
    jobTitle: last.jobTitle,
    workArea: last.workArea,
    sede: last.sede,
    lastDeliveryDate: last.deliveryDate,
    nextDueDate,
    status,
    daysUntilDue,
  };
}

export function listUniformRenewals(
  records: UniformDeliveryRecord[],
  users: User[] = []
): StaffUniformRenewal[] {
  const keys = new Map<string, { userId?: string; staffName: string }>();

  for (const u of users) {
    if (u.status === 'inactive') continue;
    keys.set(staffKey({ userId: u.id, staffName: u.name }), {
      userId: u.id,
      staffName: u.name,
    });
  }

  for (const r of records) {
    if (r.status === 'devuelto') continue;
    const key = staffKey(r);
    if (!keys.has(key)) {
      keys.set(key, { userId: r.userId, staffName: r.staffName });
    }
  }

  return [...keys.values()]
    .map((staff) =>
      computeStaffUniformRenewal({ records, userId: staff.userId, staffName: staff.staffName })
    )
    .filter((r) => r.status === 'due_soon' || r.status === 'overdue')
    .sort((a, b) => (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0));
}

export function countUniformRenewals(records: UniformDeliveryRecord[], users: User[] = []) {
  const list = listUniformRenewals(records, users);
  return {
    renewalsDueSoon: list.filter((r) => r.status === 'due_soon').length,
    renewalsOverdue: list.filter((r) => r.status === 'overdue').length,
    renewals: list,
  };
}
