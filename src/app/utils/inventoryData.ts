import {
  addMonths,
  differenceInDays,
  endOfMonth,
  format,
  isValid,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type {
  InventoryComputedAlert,
  InventoryConsignmentStatus,
  InventoryDataset,
  InventoryEquipment,
  InventoryEquipmentStatus,
  InventoryKpis,
  InventoryMaintenanceRecord,
  InventoryMaintenanceStatus,
} from '../types/inventory';
import {
  getCategoryLabel,
  normalizeCategoryConfig,
  normalizeCategoryId,
} from './inventoryCategoryConfig';

const nowIso = () => new Date().toISOString();

export const INVENTORY_STATUS_LABELS: Record<InventoryEquipmentStatus, string> = {
  active: 'Activo',
  maintenance: 'En Mantenimiento',
  critical: 'Crítico',
  inactive: 'Inactivo',
};

export const MAINTENANCE_STATUS_LABELS: Record<InventoryMaintenanceStatus, string> = {
  scheduled: 'Programado',
  in_progress: 'En Proceso',
  completed: 'Completado',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
};

export const CONSIGNMENT_STATUS_LABELS: Record<InventoryConsignmentStatus, string> = {
  active: 'Vigente',
  pending_return: 'Por devolver',
  returned: 'Devuelto',
  expired: 'Vencido',
};

export function isEquipmentConsignment(eq: InventoryEquipment): boolean {
  return eq.isConsignment === true;
}

export function clearConsignmentFields(eq: InventoryEquipment): InventoryEquipment {
  const {
    isConsignment: _i,
    consignorProviderId: _p,
    consignorName: _n,
    consignmentAgreementRef: _r,
    consignmentStartDate: _s,
    consignmentEndDate: _e,
    consignmentStatus: _st,
    consignmentTerms: _t,
    consignmentReturnDate: _d,
    ...rest
  } = eq;
  return { ...rest, isConsignment: false };
}

function normalizeConsignmentStatus(raw?: string): InventoryConsignmentStatus {
  const t = (raw || '').toLowerCase();
  if (t.includes('devu') || t === 'returned') return 'returned';
  if (t.includes('venc') || t === 'expired') return 'expired';
  if (t.includes('pend') || t.includes('return')) return 'pending_return';
  return 'active';
}

function safeParseDate(raw?: string): Date | null {
  if (!raw) return null;
  const d = parseISO(raw.length === 10 ? raw : raw.slice(0, 10));
  return isValid(d) ? d : null;
}

export function computeUsefulLifePercent(eq: InventoryEquipment): number {
  if (eq.usefulLifeYears && eq.purchaseDate) {
    const start = safeParseDate(eq.purchaseDate);
    if (!start) return 50;
    const years = differenceInDays(new Date(), start) / 365.25;
    const pct = Math.max(0, Math.min(100, 100 - (years / eq.usefulLifeYears) * 100));
    return Math.round(pct);
  }
  if (eq.purchaseValue > 0 && eq.currentValue > 0) {
    return Math.round((eq.currentValue / eq.purchaseValue) * 100);
  }
  return 50;
}

/** IDs del dataset de demostración retirado — se filtran al cargar datos persistidos. */
const BUILTIN_DEMO_EQUIPMENT_IDS = new Set([
  'inv-eq-001',
  'inv-eq-002',
  'inv-eq-003',
  'inv-eq-004',
  'inv-eq-005',
  'inv-eq-006',
  'inv-eq-007',
  'inv-eq-008',
]);

const BUILTIN_DEMO_MAINTENANCE_IDS = new Set([
  'inv-m-001',
  'inv-m-002',
  'inv-m-003',
  'inv-m-004',
  'inv-m-005',
  'inv-m-006',
]);

export function stripBuiltinDemoInventoryData(ds: InventoryDataset): InventoryDataset {
  const demoEqIds = new Set(
    ds.equipment.filter((e) => BUILTIN_DEMO_EQUIPMENT_IDS.has(e.id)).map((e) => e.id)
  );
  if (demoEqIds.size === 0 && !ds.maintenance.some((m) => BUILTIN_DEMO_MAINTENANCE_IDS.has(m.id))) {
    return ds;
  }
  return {
    ...ds,
    equipment: ds.equipment.filter((e) => !BUILTIN_DEMO_EQUIPMENT_IDS.has(e.id)),
    maintenance: ds.maintenance.filter(
      (m) => !BUILTIN_DEMO_MAINTENANCE_IDS.has(m.id) && !demoEqIds.has(m.equipmentId)
    ),
  };
}

export function normalizeInventoryDataset(raw: unknown): InventoryDataset {
  const obj = raw && typeof raw === 'object' ? (raw as Partial<InventoryDataset>) : {};
  const categoryConfig = normalizeCategoryConfig(obj.categoryConfig);
  const equipment = normalizeEquipmentList(obj.equipment, categoryConfig);
  const maintenance = normalizeMaintenanceList(obj.maintenance);
  return stripBuiltinDemoInventoryData({ equipment, maintenance, categoryConfig });
}

function normalizeEquipmentList(
  raw: unknown,
  categoryConfig = normalizeCategoryConfig(undefined)
): InventoryEquipment[] {
  if (!Array.isArray(raw)) return [];
  const out: InventoryEquipment[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Partial<InventoryEquipment>;
    if (typeof r.id !== 'string' || typeof r.code !== 'string' || typeof r.name !== 'string') continue;
    const t = nowIso();
    const isConsignment = r.isConsignment === true;
    const base: InventoryEquipment = {
      id: r.id,
      code: r.code.trim(),
      name: r.name.trim(),
      brand: r.brand?.trim(),
      model: r.model?.trim(),
      serialNumber: r.serialNumber?.trim(),
      kind: r.kind === 'operational' ? 'operational' : 'medical',
      category: normalizeCategoryId(r.category),
      status: normalizeEquipmentStatus(r.status),
      sede: (r.sede || '').trim() || 'Principal',
      floor: r.floor?.trim(),
      room: r.room?.trim(),
      locationDetail: r.locationDetail?.trim(),
      purchaseDate: r.purchaseDate,
      purchaseValue: Number(r.purchaseValue) || 0,
      currentValue: Number(r.currentValue) || 0,
      usefulLifeYears: r.usefulLifeYears != null ? Number(r.usefulLifeYears) : undefined,
      depreciationAnnualPct: r.depreciationAnnualPct != null ? Number(r.depreciationAnnualPct) : undefined,
      nextMaintenanceDate: r.nextMaintenanceDate,
      warrantyUntil: r.warrantyUntil,
      providerId: r.providerId,
      providerName: r.providerName?.trim(),
      isConsignment,
      notes: r.notes?.trim(),
      createdAt: r.createdAt || t,
      updatedAt: r.updatedAt || t,
    };
    if (isConsignment) {
      base.consignorProviderId = r.consignorProviderId;
      base.consignorName = r.consignorName?.trim();
      base.consignmentAgreementRef = r.consignmentAgreementRef?.trim();
      base.consignmentStartDate = r.consignmentStartDate;
      base.consignmentEndDate = r.consignmentEndDate;
      base.consignmentStatus = normalizeConsignmentStatus(r.consignmentStatus);
      base.consignmentTerms = r.consignmentTerms?.trim();
      base.consignmentReturnDate = r.consignmentReturnDate;
    }
    out.push(base);
  }
  return out;
}

function normalizeMaintenanceList(raw: unknown): InventoryMaintenanceRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: InventoryMaintenanceRecord[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Partial<InventoryMaintenanceRecord>;
    if (
      typeof r.id !== 'string' ||
      typeof r.equipmentId !== 'string' ||
      typeof r.description !== 'string'
    )
      continue;
    const t = nowIso();
    const parts = Array.isArray(r.parts)
      ? r.parts
          .map((p) => {
            if (!p || typeof p !== 'object') return null;
            const x = p as InventoryMaintenanceRecord['parts'][0];
            if (typeof x.name !== 'string') return null;
            return {
              name: x.name.trim(),
              qty: Number(x.qty) || 1,
              unitCost: Number(x.unitCost) || 0,
            };
          })
          .filter(Boolean) as InventoryMaintenanceRecord['parts']
      : [];
    out.push({
      id: r.id,
      equipmentId: r.equipmentId,
      kind: r.kind === 'corrective' ? 'corrective' : 'preventive',
      status: normalizeMaintenanceStatus(r.status),
      scheduledDate: r.scheduledDate || format(new Date(), 'yyyy-MM-dd'),
      completedDate: r.completedDate,
      technicianName: r.technicianName?.trim(),
      companyName: r.companyName?.trim(),
      sede: r.sede?.trim(),
      description: r.description.trim(),
      laborCost: Number(r.laborCost) || 0,
      partsCost: Number(r.partsCost) || 0,
      parts,
      resultNotes: r.resultNotes?.trim(),
      createdAt: r.createdAt || t,
    });
  }
  return out;
}

function normalizeEquipmentStatus(raw?: string): InventoryEquipmentStatus {
  const t = (raw || '').toLowerCase();
  if (t.includes('crit')) return 'critical';
  if (t.includes('mant') || t.includes('maintenance')) return 'maintenance';
  if (t.includes('inact') || t.includes('baja')) return 'inactive';
  return 'active';
}

function normalizeMaintenanceStatus(raw?: string): InventoryMaintenanceStatus {
  const t = (raw || '').toLowerCase();
  if (t.includes('proceso') || t.includes('progress')) return 'in_progress';
  if (t.includes('compl') || t.includes('complet')) return 'completed';
  if (t.includes('venc') || t.includes('overdue')) return 'overdue';
  if (t.includes('cancel')) return 'cancelled';
  return 'scheduled';
}

export function computeInventoryKpis(ds: InventoryDataset): InventoryKpis {
  const byStatus = countEquipmentByStatus(ds.equipment);
  const maintScheduled = ds.maintenance.filter((m) => m.status === 'scheduled').length;
  const maintOverdue = ds.maintenance.filter((m) => m.status === 'overdue').length;
  const inMaintStatus = byStatus.maintenance + byStatus.critical;
  const ownedEquipment = ds.equipment.filter((e) => !isEquipmentConsignment(e));
  const consignmentCount = ds.equipment.length - ownedEquipment.length;
  const totalPurchase = ownedEquipment.reduce((s, e) => s + e.purchaseValue, 0);
  const totalCurrent = ds.equipment.reduce((s, e) => s + e.currentValue, 0);
  const ownedCurrent = ownedEquipment.reduce((s, e) => s + e.currentValue, 0);
  const sedes = new Set(ds.equipment.map((e) => e.sede).filter(Boolean));

  return {
    total: ds.equipment.length,
    active: byStatus.active,
    inMaintenance: inMaintStatus,
    critical: byStatus.critical,
    inactive: byStatus.inactive,
    operationalPct:
      ds.equipment.length > 0
        ? Math.round((byStatus.active / ds.equipment.length) * 100)
        : 0,
    scheduledMaintenance: maintScheduled,
    overdueMaintenance: maintOverdue,
    totalCurrentValue: totalCurrent,
    totalDepreciation: Math.max(0, totalPurchase - ownedCurrent),
    sedeCount: sedes.size,
    consignmentCount,
    ownedCurrentValue: ownedCurrent,
  };
}

export function countEquipmentByStatus(equipment: InventoryEquipment[]) {
  const base = { active: 0, maintenance: 0, critical: 0, inactive: 0 };
  for (const e of equipment) {
    if (e.status in base) base[e.status] += 1;
  }
  return base;
}

export function buildInventoryAlerts(ds: InventoryDataset): InventoryComputedAlert[] {
  const alerts: InventoryComputedAlert[] = [];
  for (const e of ds.equipment) {
    if (e.status === 'critical') {
      alerts.push({
        id: `crit-${e.id}`,
        severity: 'critical',
        equipmentId: e.id,
        equipmentCode: e.code,
        title: 'Equipo en estado crítico',
        detail: `${e.code} — ${e.name} requiere atención inmediata.`,
        kind: 'status',
      });
    }
    const next = safeParseDate(e.nextMaintenanceDate);
    if (next) {
      const days = differenceInDays(next, new Date());
      if (days < 0 || days <= 30) {
        alerts.push({
          id: `maint-${e.id}-${e.nextMaintenanceDate}`,
          severity: days < 0 ? 'critical' : 'warning',
          equipmentId: e.id,
          equipmentCode: e.code,
          title: days < 0 ? 'Mantenimiento vencido' : 'Mantenimiento próximo',
          detail: `${e.code}: ${days < 0 ? `vencido hace ${-days} días` : `en ${days} día(s)`}`,
          kind: 'maintenance',
        });
      }
    }
  }
  for (const e of ds.equipment) {
    if (!isEquipmentConsignment(e)) continue;
    const end = safeParseDate(e.consignmentEndDate);
    if (end && e.consignmentStatus !== 'returned') {
      const days = differenceInDays(end, new Date());
      if (days < 0 || days <= 45) {
        alerts.push({
          id: `consign-${e.id}-${e.consignmentEndDate}`,
          severity: days < 0 ? 'critical' : days <= 15 ? 'warning' : 'info',
          equipmentId: e.id,
          equipmentCode: e.code,
          title: days < 0 ? 'Consignación vencida' : 'Consignación por vencer',
          detail: `${e.code}: ${e.consignorName || 'Consignante'} — ${
            days < 0 ? `venció hace ${-days} día(s)` : `vence en ${days} día(s)`
          }`,
          kind: 'consignment',
        });
      }
    }
    if (e.consignmentStatus === 'pending_return') {
      alerts.push({
        id: `consign-ret-${e.id}`,
        severity: 'warning',
        equipmentId: e.id,
        equipmentCode: e.code,
        title: 'Consignación pendiente de devolución',
        detail: `${e.code} — ${e.name}`,
        kind: 'consignment',
      });
    }
  }
  for (const m of ds.maintenance) {
    if (m.status === 'overdue') {
      const eq = ds.equipment.find((e) => e.id === m.equipmentId);
      alerts.push({
        id: `overdue-m-${m.id}`,
        severity: 'critical',
        equipmentId: m.equipmentId,
        equipmentCode: eq?.code,
        title: 'Mantenimiento programado vencido',
        detail: eq ? `${eq.code}: ${m.description.slice(0, 60)}` : m.description.slice(0, 80),
        kind: 'maintenance',
      });
    }
  }
  alerts.sort((a, b) => {
    const sw = { critical: 0, warning: 1, info: 2 };
    return sw[a.severity] - sw[b.severity];
  });
  return alerts;
}

export function monthlyMaintenanceSeries(ds: InventoryDataset, months = 6) {
  const now = new Date();
  const buckets: { label: string; count: number; cost: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = startOfMonth(subMonths(now, i));
    const end = endOfMonth(start);
    const label = format(start, 'MMM', { locale: es });
    let count = 0;
    let cost = 0;
    for (const m of ds.maintenance) {
      const d = safeParseDate(m.completedDate || m.scheduledDate);
      if (!d || d < start || d > end) continue;
      count += 1;
      cost += m.laborCost + m.partsCost;
    }
    buckets.push({ label, count, cost });
  }
  return buckets;
}

export function categoryDistribution(ds: InventoryDataset) {
  const counts: Record<string, number> = {};
  for (const e of ds.equipment) {
    const label = getCategoryLabel(ds, e.category);
    counts[label] = (counts[label] || 0) + 1;
  }
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

export function formatEquipmentLocation(eq: InventoryEquipment): string {
  const parts = [eq.sede];
  if (eq.floor) parts.push(`Piso ${eq.floor}`);
  if (eq.room) parts.push(`Cons. ${eq.room}`);
  if (eq.locationDetail) parts.push(eq.locationDetail);
  return parts.filter(Boolean).join(' · ');
}

export function sedeSummary(ds: InventoryDataset) {
  const map = new Map<string, { total: number; active: number; value: number }>();
  for (const e of ds.equipment) {
    const s = e.sede || 'Sin sede';
    const row = map.get(s) || { total: 0, active: 0, value: 0 };
    row.total += 1;
    if (e.status === 'active') row.active += 1;
    row.value += e.currentValue;
    map.set(s, row);
  }
  return [...map.entries()].map(([sede, row]) => ({ sede, ...row }));
}

export function upcomingMaintenance(ds: InventoryDataset, limit = 5) {
  return [...ds.maintenance]
    .filter((m) => m.status === 'scheduled' || m.status === 'overdue' || m.status === 'in_progress')
    .sort((a, b) => {
      const da = safeParseDate(a.scheduledDate)?.getTime() ?? 0;
      const db = safeParseDate(b.scheduledDate)?.getTime() ?? 0;
      return da - db;
    })
    .slice(0, limit);
}

export function getEquipmentById(ds: InventoryDataset, id: string) {
  return ds.equipment.find((e) => e.id === id);
}

export function findEquipmentFromScan(
  ds: InventoryDataset,
  payload: { id?: string; code?: string }
): InventoryEquipment | undefined {
  if (payload.id) {
    const byId = getEquipmentById(ds, payload.id);
    if (byId) return byId;
  }
  if (payload.code) {
    const codeNorm = payload.code.trim().toUpperCase();
    return ds.equipment.find((e) => e.code.trim().toUpperCase() === codeNorm);
  }
  return undefined;
}

export function maintenanceTotalCost(m: InventoryMaintenanceRecord) {
  return m.laborCost + m.partsCost;
}

/** Id estable del mantenimiento generado desde la ficha del equipo. */
export const AUTO_MAINTENANCE_ID_PREFIX = 'inv-m-auto-';

export function autoMaintenanceIdForEquipment(equipmentId: string): string {
  return `${AUTO_MAINTENANCE_ID_PREFIX}${equipmentId}`;
}

export function isAutoScheduledMaintenance(m: InventoryMaintenanceRecord): boolean {
  return m.id.startsWith(AUTO_MAINTENANCE_ID_PREFIX);
}

export function maintenanceStatusForScheduledDate(scheduledDate: string): InventoryMaintenanceStatus {
  const d = safeParseDate(scheduledDate);
  if (!d) return 'scheduled';
  return differenceInDays(d, new Date()) < 0 ? 'overdue' : 'scheduled';
}

/**
 * Crea o actualiza el mantenimiento preventivo programado a partir de `nextMaintenanceDate`.
 * Si la fecha se borra, elimina el registro auto-vinculado (solo si aún está programado/vencido).
 */
export function syncEquipmentMaintenanceInDataset(
  dataset: InventoryDataset,
  equipment: InventoryEquipment
): InventoryMaintenanceRecord[] {
  const autoId = autoMaintenanceIdForEquipment(equipment.id);
  const existing = dataset.maintenance.find((m) => m.id === autoId);
  const others = dataset.maintenance.filter((m) => m.id !== autoId);
  const nextDate = equipment.nextMaintenanceDate?.trim();

  if (!nextDate) {
    if (existing && (existing.status === 'scheduled' || existing.status === 'overdue')) {
      return others;
    }
    return dataset.maintenance;
  }

  if (existing?.status === 'in_progress') {
    return dataset.maintenance;
  }

  const t = nowIso();
  const record: InventoryMaintenanceRecord = {
    id: autoId,
    equipmentId: equipment.id,
    kind: existing?.kind ?? 'preventive',
    status: maintenanceStatusForScheduledDate(nextDate),
    scheduledDate: nextDate,
    completedDate: existing?.status === 'completed' || existing?.status === 'cancelled' ? undefined : existing?.completedDate,
    description:
      existing?.description?.trim() && !existing.description.startsWith('Mantenimiento preventivo —')
        ? existing.description
        : `Mantenimiento preventivo — ${equipment.name}`,
    laborCost: existing?.laborCost ?? 0,
    partsCost: existing?.partsCost ?? 0,
    parts: existing?.parts ?? [],
    sede: equipment.sede,
    technicianName: existing?.technicianName,
    companyName: existing?.companyName ?? equipment.providerName,
    resultNotes: existing?.resultNotes,
    createdAt: existing?.createdAt ?? t,
  };

  return [...others, record];
}

export function applyEquipmentMaintenanceSync(
  dataset: InventoryDataset,
  equipment: InventoryEquipment
): InventoryDataset {
  return {
    ...dataset,
    maintenance: syncEquipmentMaintenanceInDataset(dataset, equipment),
  };
}

export function equipmentMaintenanceWasSynced(
  before: InventoryDataset,
  after: InventoryDataset,
  equipmentId: string
): boolean {
  const autoId = autoMaintenanceIdForEquipment(equipmentId);
  const prev = before.maintenance.find((m) => m.id === autoId);
  const next = after.maintenance.find((m) => m.id === autoId);
  if (next && !prev) return true;
  if (next && prev && (next.scheduledDate !== prev.scheduledDate || next.status !== prev.status)) return true;
  return false;
}
