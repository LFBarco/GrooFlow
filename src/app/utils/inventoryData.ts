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

export function normalizeInventoryDataset(raw: unknown): InventoryDataset {
  const obj = raw && typeof raw === 'object' ? (raw as Partial<InventoryDataset>) : {};
  const categoryConfig = normalizeCategoryConfig(obj.categoryConfig);
  const equipment = normalizeEquipmentList(obj.equipment, categoryConfig);
  const maintenance = normalizeMaintenanceList(obj.maintenance);
  return { equipment, maintenance, categoryConfig };
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
    out.push({
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
      notes: r.notes?.trim(),
      createdAt: r.createdAt || t,
      updatedAt: r.updatedAt || t,
    });
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

export function createDemoInventoryDataset(): InventoryDataset {
  const t = nowIso();
  const mkEq = (
    partial: Omit<InventoryEquipment, 'createdAt' | 'updatedAt'> &
      Partial<Pick<InventoryEquipment, 'createdAt' | 'updatedAt'>>
  ): InventoryEquipment => ({
    ...partial,
    createdAt: partial.createdAt ?? t,
    updatedAt: partial.updatedAt ?? t,
  });

  const equipment: InventoryEquipment[] = [
    mkEq({
      id: 'inv-eq-001',
      code: 'ECO-MIR-001',
      name: 'Ecógrafo Digital Portátil',
      brand: 'Mindray',
      model: 'DP-50 Vet',
      kind: 'medical',
      category: 'imagen',
      status: 'active',
      sede: 'Miraflores',
      purchaseDate: '2020-03-15',
      purchaseValue: 28500,
      currentValue: 21375,
      usefulLifeYears: 8,
      depreciationAnnualPct: 8,
      nextMaintenanceDate: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
      providerName: 'MedEquip Peru SAC',
    }),
    mkEq({
      id: 'inv-eq-002',
      code: 'ANE-SIS-002',
      name: 'Estación de Anestesia WATO',
      brand: 'Mindray',
      model: 'WATO EX-65',
      kind: 'medical',
      category: 'anestesia',
      status: 'maintenance',
      sede: 'Sede San Isidro',
      purchaseDate: '2019-06-01',
      purchaseValue: 52000,
      currentValue: 36400,
      usefulLifeYears: 10,
      nextMaintenanceDate: format(addMonths(new Date(), -1), 'yyyy-MM-dd'),
      providerName: 'MedEquip Peru SAC',
    }),
    mkEq({
      id: 'inv-eq-003',
      code: 'LAB-LAU-003',
      name: 'Analizador Hematológico',
      brand: 'Abaxis',
      model: 'VetScan HM5',
      kind: 'medical',
      category: 'laboratorio',
      status: 'active',
      sede: 'Miraflores',
      purchaseValue: 18500,
      currentValue: 12950,
      usefulLifeYears: 7,
      purchaseDate: '2021-01-10',
    }),
    mkEq({
      id: 'inv-eq-004',
      code: 'MON-SJL-004',
      name: 'Monitor Multiparamétrico',
      brand: 'Philips',
      model: 'IntelliVue MX400',
      kind: 'medical',
      category: 'monitoreo',
      status: 'active',
      sede: 'San Juan de Lurigancho',
      purchaseValue: 22000,
      currentValue: 17600,
      usefulLifeYears: 8,
      purchaseDate: '2020-08-20',
    }),
    mkEq({
      id: 'inv-eq-005',
      code: 'CIR-MIR-005',
      name: 'Mesa Quirúrgica Veterinaria',
      brand: 'Shor-Line',
      model: 'Surgery 2000',
      kind: 'medical',
      category: 'cirugia',
      status: 'active',
      sede: 'Miraflores',
      purchaseValue: 9800,
      currentValue: 7350,
      usefulLifeYears: 12,
      purchaseDate: '2018-04-05',
    }),
    mkEq({
      id: 'inv-eq-006',
      code: 'OPR-SIS-006',
      name: 'Autoclave de Mesa',
      brand: 'Tuttnauer',
      model: '3870EA',
      kind: 'operational',
      category: 'operativo',
      status: 'critical',
      sede: 'Sede San Isidro',
      purchaseValue: 12000,
      currentValue: 6000,
      usefulLifeYears: 10,
      purchaseDate: '2017-11-12',
      nextMaintenanceDate: format(addMonths(new Date(), -2), 'yyyy-MM-dd'),
    }),
    mkEq({
      id: 'inv-eq-007',
      code: 'IMG-SJL-007',
      name: 'Rayos X Digital',
      brand: 'Sound',
      model: 'ExaVision DR',
      kind: 'medical',
      category: 'imagen',
      status: 'active',
      sede: 'San Juan de Lurigancho',
      purchaseValue: 95000,
      currentValue: 76000,
      usefulLifeYears: 10,
      purchaseDate: '2019-02-28',
    }),
    mkEq({
      id: 'inv-eq-008',
      code: 'OPR-MIR-008',
      name: 'Central de Aire Medicinal',
      brand: 'Atlas Copco',
      model: 'MediAir',
      kind: 'operational',
      category: 'operativo',
      status: 'active',
      sede: 'Miraflores',
      purchaseValue: 35000,
      currentValue: 28000,
      usefulLifeYears: 15,
      purchaseDate: '2016-05-15',
    }),
  ];

  const maintenance: InventoryMaintenanceRecord[] = [
    {
      id: 'inv-m-001',
      equipmentId: 'inv-eq-001',
      kind: 'preventive',
      status: 'completed',
      scheduledDate: '2024-10-12',
      completedDate: '2024-10-12',
      technicianName: 'Ing. Felipe Sotelo',
      companyName: 'MedEquip Peru SAC',
      sede: 'Miraflores',
      description: 'Mantenimiento preventivo semestral — calibración y limpieza de transductor.',
      laborCost: 350,
      partsCost: 100,
      parts: [{ name: 'Gel conductor', qty: 2, unitCost: 25 }],
      resultNotes: 'Equipo en óptimas condiciones.',
      createdAt: t,
    },
    {
      id: 'inv-m-002',
      equipmentId: 'inv-eq-002',
      kind: 'corrective',
      status: 'in_progress',
      scheduledDate: format(new Date(), 'yyyy-MM-dd'),
      technicianName: 'Ing. Felipe Sotelo',
      companyName: 'MedEquip Peru SAC',
      sede: 'Sede San Isidro',
      description: 'Reemplazo módulo sensor O2 y revisión válvulas de vaporizadores.',
      laborCost: 800,
      partsCost: 1200,
      parts: [{ name: 'Módulo sensor O2 WATO', qty: 1, unitCost: 1200 }],
      resultNotes: 'Equipo fuera de servicio temporalmente hasta completar reparación.',
      createdAt: t,
    },
    {
      id: 'inv-m-003',
      equipmentId: 'inv-eq-006',
      kind: 'preventive',
      status: 'overdue',
      scheduledDate: format(addMonths(new Date(), -2), 'yyyy-MM-dd'),
      companyName: 'SterilTech SAC',
      sede: 'Sede San Isidro',
      description: 'Mantenimiento preventivo anual autoclave — válvulas y sellos.',
      laborCost: 280,
      partsCost: 150,
      parts: [{ name: 'Kit sellos autoclave', qty: 1, unitCost: 150 }],
      createdAt: t,
    },
    {
      id: 'inv-m-004',
      equipmentId: 'inv-eq-003',
      kind: 'preventive',
      status: 'scheduled',
      scheduledDate: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
      technicianName: 'Téc. Ana Ríos',
      companyName: 'LabVet Solutions',
      sede: 'Miraflores',
      description: 'Calibración y limpieza rutina analizador hematológico.',
      laborCost: 200,
      partsCost: 0,
      parts: [],
      createdAt: t,
    },
    {
      id: 'inv-m-005',
      equipmentId: 'inv-eq-004',
      kind: 'preventive',
      status: 'scheduled',
      scheduledDate: format(addMonths(new Date(), 2), 'yyyy-MM-dd'),
      companyName: 'MedEquip Peru SAC',
      sede: 'San Juan de Lurigancho',
      description: 'Revisión sensores y actualización firmware monitor.',
      laborCost: 180,
      partsCost: 0,
      parts: [],
      createdAt: t,
    },
    {
      id: 'inv-m-006',
      equipmentId: 'inv-eq-001',
      kind: 'preventive',
      status: 'completed',
      scheduledDate: '2024-04-08',
      completedDate: '2024-04-08',
      technicianName: 'Ing. Felipe Sotelo',
      companyName: 'MedEquip Peru SAC',
      sede: 'Miraflores',
      description: 'Mantenimiento preventivo semestral.',
      laborCost: 320,
      partsCost: 80,
      parts: [{ name: 'Filtros de aire', qty: 1, unitCost: 80 }],
      resultNotes: 'Sin observaciones.',
      createdAt: t,
    },
  ];

  return {
    equipment,
    maintenance,
    categoryConfig: normalizeCategoryConfig(undefined),
  };
}

export function computeInventoryKpis(ds: InventoryDataset): InventoryKpis {
  const byStatus = countEquipmentByStatus(ds.equipment);
  const maintScheduled = ds.maintenance.filter((m) => m.status === 'scheduled').length;
  const maintOverdue = ds.maintenance.filter((m) => m.status === 'overdue').length;
  const inMaintStatus = byStatus.maintenance + byStatus.critical;
  const totalPurchase = ds.equipment.reduce((s, e) => s + e.purchaseValue, 0);
  const totalCurrent = ds.equipment.reduce((s, e) => s + e.currentValue, 0);
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
    totalDepreciation: Math.max(0, totalPurchase - totalCurrent),
    sedeCount: sedes.size,
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
