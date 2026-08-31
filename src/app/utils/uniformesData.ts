import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import type {
  UniformDeliveryRecord,
  UniformesFilters,
  UniformesKpiSnapshot,
  UniformesSettings,
} from '../types/uniformes';
import { countUniformRenewals } from './uniformesRenewal';
import type { User } from '../types';
import { mergeUniformKits } from './uniformesKits';

export const UNIFORMES_SETTINGS_KV_KEY = 'settings:entrega-uniformes';

export function defaultUniformesSettings(): UniformesSettings {
  return { version: 1, records: [], kits: mergeUniformKits() };
}

export function mergeUniformesSettings(
  partial?: Partial<UniformesSettings> | null
): UniformesSettings {
  const base = defaultUniformesSettings();
  if (!partial || typeof partial !== 'object') return { ...base };
  return {
    version: 1,
    records: Array.isArray(partial.records) ? partial.records : base.records,
    kits: mergeUniformKits(partial.kits),
  };
}

export function newUniformDeliveryId(): string {
  return `uni_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function countItemsInRecord(record: UniformDeliveryRecord): number {
  return record.items.reduce((sum, i) => sum + (i.quantity || 1), 0);
}

export function upsertUniformDelivery(
  settings: UniformesSettings,
  record: Omit<UniformDeliveryRecord, 'id' | 'createdAt' | 'updatedAt'> & {
    id?: string;
    createdAt?: string;
  }
): UniformesSettings {
  const id = record.id ?? newUniformDeliveryId();
  const existing = settings.records.find((r) => r.id === id);
  const next: UniformDeliveryRecord = {
    ...record,
    id,
    createdAt: existing?.createdAt ?? record.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const rest = settings.records.filter((r) => r.id !== id);
  return { ...settings, records: [next, ...rest] };
}

export function removeUniformDelivery(
  settings: UniformesSettings,
  recordId: string
): UniformesSettings {
  return { ...settings, records: settings.records.filter((r) => r.id !== recordId) };
}

export function filterUniformDeliveries(
  records: UniformDeliveryRecord[],
  filters: UniformesFilters
): UniformDeliveryRecord[] {
  const q = filters.search?.trim().toLowerCase() ?? '';
  return records.filter((r) => {
    if (filters.dateFrom && r.deliveryDate < filters.dateFrom) return false;
    if (filters.dateTo && r.deliveryDate > filters.dateTo) return false;
    if (filters.sede && filters.sede !== 'Todas' && r.sede !== filters.sede) return false;
    if (filters.workArea && filters.workArea !== 'Todas' && r.workArea !== filters.workArea) {
      return false;
    }
    if (filters.status && filters.status !== 'Todas' && r.status !== filters.status) return false;
    if (filters.reason && filters.reason !== 'Todas' && r.reason !== filters.reason) return false;
    if (filters.itemType && filters.itemType !== 'Todas') {
      const hasItem = r.items.some((i) => i.itemType === filters.itemType);
      if (!hasItem) return false;
    }
    if (q) {
      const haystack = [r.staffName, r.jobTitle, r.workArea, r.notes ?? '', r.deliveredBy ?? '']
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function countUniformesActiveFilters(filters: UniformesFilters): number {
  let n = 0;
  if (filters.search?.trim()) n += 1;
  if (filters.sede !== 'Todas') n += 1;
  if (filters.workArea !== 'Todas') n += 1;
  if (filters.itemType !== 'Todas') n += 1;
  if (filters.status !== 'Todas') n += 1;
  if (filters.reason !== 'Todas') n += 1;
  return n;
}

export function defaultUniformesFilters(): UniformesFilters {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    dateFrom: fmt(from),
    dateTo: fmt(to),
    sede: 'Todas',
    workArea: 'Todas',
    itemType: 'Todas',
    status: 'Todas',
    reason: 'Todas',
    search: '',
  };
}

export function computeUniformesKpis(
  records: UniformDeliveryRecord[],
  context?: { allRecords?: UniformDeliveryRecord[]; users?: User[] }
): UniformesKpiSnapshot {
  const byItemTypeMap = new Map<string, { count: number; items: number }>();
  const bySedeMap = new Map<string, number>();
  const byReasonMap = new Map<string, number>();
  const byMonthMap = new Map<string, { deliveries: number; items: number }>();
  const staffSet = new Set<string>();

  let totalItems = 0;
  let pendingSignature = 0;

  for (const r of records) {
    const itemCount = countItemsInRecord(r);
    totalItems += itemCount;
    if (r.status === 'pendiente_firma') pendingSignature += 1;
    staffSet.add(r.userId ?? r.staffName);

    bySedeMap.set(r.sede, (bySedeMap.get(r.sede) ?? 0) + 1);
    byReasonMap.set(r.reason, (byReasonMap.get(r.reason) ?? 0) + 1);

    const monthKey = r.deliveryDate.slice(0, 7);
    const monthEntry = byMonthMap.get(monthKey) ?? { deliveries: 0, items: 0 };
    monthEntry.deliveries += 1;
    monthEntry.items += itemCount;
    byMonthMap.set(monthKey, monthEntry);

    for (const item of r.items) {
      const entry = byItemTypeMap.get(item.itemType) ?? { count: 0, items: 0 };
      entry.count += 1;
      entry.items += item.quantity || 1;
      byItemTypeMap.set(item.itemType, entry);
    }
  }

  const byMonth = [...byMonthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month: format(parseISO(`${month}-01`), 'MMM yyyy', { locale: es }),
      ...data,
    }));

  const renewalCounts = countUniformRenewals(
    context?.allRecords ?? records,
    context?.users ?? []
  );

  return {
    totalDeliveries: records.length,
    totalItems,
    pendingSignature,
    uniqueStaff: staffSet.size,
    byItemType: [...byItemTypeMap.entries()].map(([type, data]) => ({
      type: type as UniformesKpiSnapshot['byItemType'][number]['type'],
      ...data,
    })),
    bySede: [...bySedeMap.entries()]
      .map(([sede, count]) => ({ sede, count }))
      .sort((a, b) => b.count - a.count),
    byReason: [...byReasonMap.entries()].map(([reason, count]) => ({
      reason: reason as UniformesKpiSnapshot['byReason'][number]['reason'],
      count,
    })),
    byMonth,
    renewalsDueSoon: renewalCounts.renewalsDueSoon,
    renewalsOverdue: renewalCounts.renewalsOverdue,
  };
}
