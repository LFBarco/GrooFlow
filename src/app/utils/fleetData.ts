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
import type { SystemAlert } from '../types';
import type {
  FleetChecklistSection,
  FleetComputedAlert,
  FleetDataset,
  FleetFuelEntry,
  FleetInspectionAttachment,
  FleetInspectionRecord,
  FleetKpis,
  FleetMaintenanceRecord,
  FleetVehicle,
  FleetVehicleStatus,
} from '../types/fleet';

const nowIso = () => new Date().toISOString();

/** Plantilla por defecto — movilidad / transporte canino clínica */
export const DEFAULT_FLEET_CHECKLIST: FleetChecklistSection[] = [
  {
    id: 'fc_sec_luces',
    title: 'Sistema de luces',
    sortOrder: 0,
    items: [
      { id: 'fc_it_luz_del', label: 'Luz delantera', sortOrder: 0 },
      { id: 'fc_it_luz_tras', label: 'Luz trasera', sortOrder: 1 },
    ],
  },
  {
    id: 'fc_sec_externa',
    title: 'Parte externa',
    sortOrder: 1,
    items: [
      { id: 'fc_it_parabrisas', label: 'Parabrisas', sortOrder: 0 },
      { id: 'fc_it_espejo', label: 'Espejo retrovisor', sortOrder: 1 },
    ],
  },
  {
    id: 'fc_sec_interna',
    title: 'Parte interna',
    sortOrder: 2,
    items: [
      { id: 'fc_it_orden', label: 'Orden y limpieza', sortOrder: 0 },
      { id: 'fc_it_caniles', label: 'Caniles en buen estado', sortOrder: 1 },
    ],
  },
  {
    id: 'fc_sec_docs',
    title: 'Documentos',
    sortOrder: 3,
    items: [
      { id: 'fc_it_licencia', label: 'Licencia', sortOrder: 0 },
      { id: 'fc_it_soat', label: 'SOAT', sortOrder: 1 },
    ],
  },
  {
    id: 'fc_sec_seg',
    title: 'Seguridad',
    sortOrder: 4,
    items: [
      { id: 'fc_it_extintor', label: 'Extintor', sortOrder: 0 },
      { id: 'fc_it_llanta', label: 'Llanta de repuesto', sortOrder: 1 },
    ],
  },
];

export function getAllChecklistItemIds(sections: FleetChecklistSection[]): string[] {
  const ids: string[] = [];
  for (const s of [...sections].sort((a, b) => a.sortOrder - b.sortOrder)) {
    for (const it of [...s.items].sort((a, b) => a.sortOrder - b.sortOrder)) {
      ids.push(it.id);
    }
  }
  return ids;
}

/** % cumplimiento: ítems contestados como pass / total ítems plantilla */
export function computeInspectionCompliance(
  responses: Record<string, 'pass' | 'fail'>,
  templateIds: string[]
): number {
  if (templateIds.length === 0) return 0;
  let pass = 0;
  for (const id of templateIds) {
    if (responses[id] === 'pass') pass += 1;
  }
  return Math.round((pass / templateIds.length) * 1000) / 10;
}

function normalizeChecklistSections(raw: unknown): FleetChecklistSection[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return JSON.parse(JSON.stringify(DEFAULT_FLEET_CHECKLIST)) as FleetChecklistSection[];
  }
  const out: FleetChecklistSection[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const s = row as Partial<FleetChecklistSection>;
    if (typeof s.id !== 'string' || typeof s.title !== 'string') continue;
    const itemsRaw = Array.isArray(s.items) ? s.items : [];
    const items = itemsRaw
      .map((it, idx) => {
        if (!it || typeof it !== 'object') return null;
        const i = it as { id?: string; label?: string; sortOrder?: number };
        if (typeof i.id !== 'string' || typeof i.label !== 'string') return null;
        return {
          id: i.id,
          label: i.label.trim(),
          sortOrder: typeof i.sortOrder === 'number' ? i.sortOrder : idx,
        };
      })
      .filter(Boolean) as FleetChecklistSection['items'];
    out.push({
      id: s.id,
      title: s.title.trim(),
      sortOrder: typeof s.sortOrder === 'number' ? s.sortOrder : out.length,
      items,
    });
  }
  return out.length ? out : (JSON.parse(JSON.stringify(DEFAULT_FLEET_CHECKLIST)) as FleetChecklistSection[]);
}

function normalizeInspections(raw: unknown): FleetInspectionRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: FleetInspectionRecord[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Partial<FleetInspectionRecord>;
    if (typeof r.id !== 'string' || typeof r.vehicleId !== 'string') continue;
    if (typeof r.dateTime !== 'string' || typeof r.driverName !== 'string') continue;
    const responses =
      r.responses && typeof r.responses === 'object'
        ? (r.responses as Record<string, 'pass' | 'fail'>)
        : {};
    out.push({
      id: r.id,
      vehicleId: r.vehicleId,
      dateTime: r.dateTime,
      odometerKm: r.odometerKm != null ? Number(r.odometerKm) : undefined,
      driverName: r.driverName,
      supervisorName: r.supervisorName?.trim() || undefined,
      responses,
      compliancePercent: Math.min(100, Math.max(0, Number(r.compliancePercent) || 0)),
      driverDemeritPointsAfter: r.driverDemeritPointsAfter != null ? Number(r.driverDemeritPointsAfter) : undefined,
      driverPerformanceScoreAfter: r.driverPerformanceScoreAfter != null ? Number(r.driverPerformanceScoreAfter) : undefined,
      driverSignatureDataUrl: r.driverSignatureDataUrl,
      supervisorSignatureDataUrl: r.supervisorSignatureDataUrl,
      attachments: Array.isArray(r.attachments) ? r.attachments.filter((a) => a && typeof (a as FleetInspectionRecord['attachments'][0]).id === 'string') : [],
      notes: r.notes?.trim() || undefined,
      createdAt: typeof r.createdAt === 'string' ? r.createdAt : nowIso(),
    });
  }
  return out;
}

function safeParseDate(raw?: string): Date | null {
  if (!raw || typeof raw !== 'string') return null;
  const d = parseISO(raw);
  return isValid(d) ? d : null;
}

export function normalizeFleetDataset(raw: unknown): FleetDataset {
  const empty: FleetDataset = {
    vehicles: [],
    maintenance: [],
    fuelEntries: [],
    checklistSections: JSON.parse(JSON.stringify(DEFAULT_FLEET_CHECKLIST)) as FleetChecklistSection[],
    inspections: [],
  };
  if (!raw || typeof raw !== 'object') return empty;
  const o = raw as Partial<FleetDataset>;
  const vehicles = Array.isArray(o.vehicles)
    ? (o.vehicles as FleetVehicle[]).filter((v) => v && typeof v.id === 'string' && v.plate)
    : [];
  const maintenance = Array.isArray(o.maintenance)
    ? (o.maintenance as FleetMaintenanceRecord[]).filter((m) => m && typeof m.id === 'string')
    : [];
  const fuelEntries = Array.isArray(o.fuelEntries)
    ? (o.fuelEntries as FleetFuelEntry[]).filter((f) => f && typeof f.id === 'string')
    : [];
  const checklistSections = normalizeChecklistSections(o.checklistSections);
  const inspections = normalizeInspections(o.inspections);
  return { vehicles, maintenance, fuelEntries, checklistSections, inspections };
}

/** Datos demo — ~10 unidades típicas clínica veterinaria + movimientos. */
export function createDemoFleetDataset(): FleetDataset {
  const t = nowIso();
  const mkV = (
    partial: Omit<FleetVehicle, 'createdAt' | 'updatedAt'> & Partial<Pick<FleetVehicle, 'createdAt' | 'updatedAt'>>
  ): FleetVehicle => ({
    ...partial,
    createdAt: partial.createdAt ?? t,
    updatedAt: partial.updatedAt ?? t,
  });

  const vehicles: FleetVehicle[] = [
    mkV({
      id: 'fv-001',
      plate: 'ABK-851',
      brand: 'Toyota',
      model: 'Hilux',
      year: 2022,
      color: 'Blanco',
      fuelType: 'diesel',
      status: 'in_use',
      currentOdometerKm: 48_200,
      assignedDriverName: 'Carlos Ramos',
      homeBase: 'Sede Principal — San Juan de Lurigancho',
      technicalInspectionDue: format(addMonths(new Date(), 4), 'yyyy-MM-dd'),
      insuranceDue: format(addMonths(new Date(), 2), 'yyyy-MM-dd'),
      insuranceCompany: 'Pacífico SOAT',
      nextServiceKm: 50_000,
      nextOilChangeDate: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
      notes: 'Camioneta de campo + entregas a sedes.',
    }),
    mkV({
      id: 'fv-002',
      plate: 'DVT-942',
      brand: 'Nissan',
      model: 'NP300',
      year: 2021,
      fuelType: 'diesel',
      status: 'available',
      currentOdometerKm: 62_100,
      homeBase: 'Sede Norte',
      technicalInspectionDue: format(addMonths(new Date(), -1), 'yyyy-MM-dd'),
      insuranceDue: format(addMonths(new Date(), 8), 'yyyy-MM-dd'),
      nextOilChangeDate: format(addMonths(new Date(), 0), 'yyyy-MM-dd'),
    }),
    mkV({
      id: 'fv-003',
      plate: 'FHL-337',
      brand: 'Kia',
      model: 'Rio hatchback',
      year: 2023,
      color: 'Azul',
      fuelType: 'gasoline',
      status: 'maintenance',
      currentOdometerKm: 15_050,
      homeBase: 'Principal',
      insuranceDue: format(addMonths(new Date(), 14), 'yyyy-MM-dd'),
      notes: 'Frenos y suspensión en taller.',
      nextServiceKm: 20_000,
    }),
    mkV({
      id: 'fv-004',
      plate: 'GKT-661',
      brand: 'Hyundai',
      model: 'Tucson',
      year: 2020,
      fuelType: 'gasoline',
      status: 'available',
      currentOdometerKm: 73_890,
      assignedDriverName: 'María Quiroz',
      homeBase: 'Sede Este',
      technicalInspectionDue: format(addMonths(new Date(), 25), 'yyyy-MM-dd'),
      insuranceDue: format(addMonths(new Date(), 3), 'yyyy-MM-dd'),
    }),
    mkV({
      id: 'fv-005',
      plate: 'HLP-029',
      brand: 'Suzuki',
      model: 'Swift',
      year: 2022,
      fuelType: 'gasoline',
      status: 'in_use',
      currentOdometerKm: 22_440,
      homeBase: 'Principal',
      insuranceDue: format(addMonths(new Date(), 18), 'yyyy-MM-dd'),
    }),
    mkV({
      id: 'fv-006',
      plate: 'JMR-504',
      brand: 'Mitsubishi',
      model: 'L200',
      year: 2019,
      fuelType: 'diesel',
      status: 'out_of_service',
      currentOdometerKm: 119_800,
      homeBase: 'Depósito',
      notes: 'Evaluación de venta / repower.',
      insuranceDue: format(addMonths(new Date(), -2), 'yyyy-MM-dd'),
    }),
    mkV({
      id: 'fv-007',
      plate: 'KNT-873',
      brand: 'Peugeot',
      model: 'Partner',
      year: 2021,
      fuelType: 'diesel',
      status: 'available',
      currentOdometerKm: 41_200,
      homeBase: 'Sede Norte',
      nextOilChangeDate: format(addMonths(new Date(), -2), 'yyyy-MM-dd'),
    }),
    mkV({
      id: 'fv-008',
      plate: 'LPA-418',
      brand: 'Volkswagen',
      model: 'Amarok',
      year: 2023,
      fuelType: 'diesel',
      status: 'in_use',
      currentOdometerKm: 19_910,
      assignedDriverName: 'Luis Vega',
      homeBase: 'Principal',
      insuranceDue: format(addMonths(new Date(), 30), 'yyyy-MM-dd'),
      nextServiceKm: 22_000,
    }),
    mkV({
      id: 'fv-009',
      plate: 'MRT-955',
      brand: 'Chevrolet',
      model: 'N300',
      year: 2020,
      fuelType: 'gasoline',
      status: 'available',
      currentOdometerKm: 55_670,
      homeBase: 'Sede Este',
    }),
    mkV({
      id: 'fv-010',
      plate: 'NSZ-782',
      brand: 'Mercedes-Benz',
      model: 'Sprinter',
      year: 2018,
      fuelType: 'diesel',
      status: 'maintenance',
      currentOdometerKm: 154_020,
      homeBase: 'Principal',
      technicalInspectionDue: format(addMonths(new Date(), -3), 'yyyy-MM-dd'),
      insuranceDue: format(addMonths(new Date(), -5), 'yyyy-MM-dd'),
      notes: 'Revisión integral motor + ITV vencidas.',
      nextOilChangeDate: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
    }),
  ];

  const maintenance: FleetMaintenanceRecord[] = [
    {
      id: 'fm-001',
      vehicleId: 'fv-001',
      kind: 'preventive',
      date: format(subMonths(new Date(), 2), 'yyyy-MM-dd'),
      odometerKm: 45_900,
      workshopName: 'Servicio oficial Toyota — Comas',
      description: 'Cambio aceite + filtros, revisión niveles.',
      laborCost: 180,
      partsCost: 260,
      parts: [
        { name: 'Filtro aceite', qty: 1, unitCost: 45 },
        { name: 'Filtro aire', qty: 1, unitCost: 85 },
      ],
      nextDueDate: format(addMonths(new Date(), 4), 'yyyy-MM-dd'),
      createdAt: t,
    },
    {
      id: 'fm-002',
      vehicleId: 'fv-003',
      kind: 'corrective',
      date: format(subMonths(new Date(), 0), 'yyyy-MM-dd'),
      odometerKm: 14_980,
      workshopName: 'Frenomatic',
      description: 'Discos pastillas delanteros, rectificado.',
      laborCost: 340,
      partsCost: 520,
      parts: [
        { name: 'Pastillas delanteras', qty: 1, unitCost: 280 },
        { name: 'Líquido freno DOT4', qty: 1, unitCost: 45 },
      ],
      nextDueDate: format(addMonths(new Date(), 6), 'yyyy-MM-dd'),
      createdAt: t,
    },
    {
      id: 'fm-003',
      vehicleId: 'fv-008',
      kind: 'preventive',
      date: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
      odometerKm: 18_900,
      description: 'Revisión 20k km programa fabricante.',
      laborCost: 220,
      partsCost: 0,
      parts: [],
      createdAt: t,
    },
  ];

  const fuelEntries: FleetFuelEntry[] = [
    {
      id: 'ff-001',
      vehicleId: 'fv-001',
      date: format(subMonths(new Date(), 0), 'yyyy-MM-15'),
      odometerKm: 48_050,
      liters: 68,
      totalCost: 272,
      station: 'Primax — Carretera',
      fullTank: true,
      createdAt: t,
    },
    {
      id: 'ff-002',
      vehicleId: 'fv-001',
      date: format(subMonths(new Date(), 0), 'yyyy-MM-02'),
      odometerKm: 47_720,
      liters: 64,
      totalCost: 256,
      fullTank: true,
      createdAt: t,
    },
    {
      id: 'ff-003',
      vehicleId: 'fv-008',
      date: format(subMonths(new Date(), 0), 'yyyy-MM-20'),
      odometerKm: 19_800,
      liters: 72,
      totalCost: 288,
      fullTank: true,
      createdAt: t,
    },
    {
      id: 'ff-004',
      vehicleId: 'fv-004',
      date: format(subMonths(new Date(), 0), 'yyyy-MM-10'),
      odometerKm: 73_500,
      liters: 48,
      totalCost: 192,
      station: 'Repsol',
      createdAt: t,
    },
    {
      id: 'ff-005',
      vehicleId: 'fv-009',
      date: format(subMonths(new Date(), 1), 'yyyy-MM-28'),
      odometerKm: 55_200,
      liters: 35,
      totalCost: 140,
      createdAt: t,
    },
  ];

  const checklistSections = JSON.parse(JSON.stringify(DEFAULT_FLEET_CHECKLIST)) as FleetChecklistSection[];
  const templateIds = getAllChecklistItemIds(checklistSections);

  const demoInspections: FleetInspectionRecord[] = [
    {
      id: 'finsp_demo_1',
      vehicleId: 'fv-001',
      dateTime: format(subMonths(new Date(), 0), "yyyy-MM-dd'T'08:30"),
      odometerKm: 48_100,
      driverName: 'Carlos Ramos',
      supervisorName: 'Supervisión Operaciones',
      responses: Object.fromEntries(
        templateIds.map((id, i) => [id, i === 3 || i === 7 ? 'fail' : 'pass'] as const)
      ) as Record<string, 'pass' | 'fail'>,
      compliancePercent: computeInspectionCompliance(
        Object.fromEntries(templateIds.map((id, i) => [id, i === 3 || i === 7 ? 'fail' : 'pass'])) as Record<
          string,
          'pass' | 'fail'
        >,
        templateIds
      ),
      driverDemeritPointsAfter: 4,
      driverPerformanceScoreAfter: 88,
      attachments: [],
      notes: 'Demo: dos ítems observados en revisión matinal.',
      createdAt: t,
    },
  ];

  const vehiclesPatched = vehicles.map((v) =>
    v.id === 'fv-001'
      ? {
          ...v,
          lastInspectionCompliance: demoInspections[0]!.compliancePercent,
          lastInspectionAt: demoInspections[0]!.dateTime,
          driverInspectionDemerits: 4,
          driverPerformanceScore: 88,
        }
      : v
  );

  return {
    vehicles: vehiclesPatched,
    maintenance,
    fuelEntries,
    checklistSections,
    inspections: demoInspections,
  };
}

/**
 * Alertas de flota para el Centro de Alertas global (SystemAlert).
 */
export function buildFleetSystemAlerts(ds: FleetDataset): SystemAlert[] {
  const out: SystemAlert[] = [];
  const today = new Date();

  const core = buildFleetAlerts(ds);
  for (const a of core) {
    out.push({
      id: `fleet-core-${a.id}`,
      title: `[Flota] ${a.title}`,
      message: a.detail,
      severity: a.severity,
      type: 'operational',
      category: 'operational',
      date: today,
      actionLink: 'fleet',
      actionLabel: 'Abrir flota clínica',
      read: false,
      metadata: { fleet: true, vehicleId: a.vehicleId, plate: a.plate, fleetKind: a.kind },
    });
  }

  const byVehicleLast = new Map<string, FleetInspectionRecord>();
  for (const ins of [...ds.inspections].sort(
    (x, y) => parseISO(y.dateTime).getTime() - parseISO(x.dateTime).getTime()
  )) {
    if (!byVehicleLast.has(ins.vehicleId)) byVehicleLast.set(ins.vehicleId, ins);
  }

  for (const [vehicleId, last] of byVehicleLast) {
    const v = ds.vehicles.find((x) => x.id === vehicleId);
    const plate = v?.plate ?? vehicleId;
    const pct = last.compliancePercent;
    if (pct < 70) {
      out.push({
        id: `fleet-insp-low-${vehicleId}-${last.id}`,
        title: `[Flota] Inspección con bajo cumplimiento`,
        message: `${plate}: última revisión checklist ${pct}% (${format(parseISO(last.dateTime), 'dd/MM/yyyy HH:mm', { locale: es })}). Conductor: ${last.driverName}.`,
        severity: 'critical',
        type: 'operational',
        category: 'operational',
        date: today,
        actionLink: 'fleet',
        actionLabel: 'Ver flota',
        read: false,
        metadata: { fleet: true, vehicleId, inspectionId: last.id, compliance: pct },
      });
    } else if (pct < 85) {
      out.push({
        id: `fleet-insp-warn-${vehicleId}-${last.id}`,
        title: `[Flota] Inspección — observaciones`,
        message: `${plate}: cumplimiento checklist ${pct}% · ${last.driverName}. Revise ítems marcados.`,
        severity: 'warning',
        type: 'operational',
        category: 'operational',
        date: today,
        actionLink: 'fleet',
        actionLabel: 'Ver flota',
        metadata: { fleet: true, vehicleId, inspectionId: last.id, compliance: pct },
      });
    }
  }

  for (const v of ds.vehicles) {
    if (v.status !== 'in_use' && v.status !== 'available') continue;
    const last = byVehicleLast.get(v.id);
    if (!last) continue;
    const daysSince = differenceInDays(new Date(), parseISO(last.dateTime));
    if (daysSince > 14) {
      out.push({
        id: `fleet-insp-stale-${v.id}`,
        title: `[Flota] Sin inspección reciente`,
        message: `${v.plate}: más de 14 días desde el último checklist (${format(parseISO(last.dateTime), 'dd/MM/yyyy', { locale: es })}).`,
        severity: 'warning',
        type: 'operational',
        category: 'operational',
        date: today,
        actionLink: 'fleet',
        actionLabel: 'Registrar inspección',
        read: false,
        metadata: { fleet: true, vehicleId: v.id },
      });
    }
  }

  return out.sort((a, b) => {
    const severityScore = { critical: 3, warning: 2, info: 1, success: 0 };
    const d = severityScore[b.severity] - severityScore[a.severity];
    return d !== 0 ? d : new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

/** Al hidratar: si la clave no existía en KV devolvemos demo; si `{}` válido pero vacío, respetar vacío opcionalmente — usar createDemoFleetDataset solo cuando undefined. */

export function countByStatus(vehicles: FleetVehicle[]): Record<FleetVehicleStatus, number> {
  const base: Record<FleetVehicleStatus, number> = {
    available: 0,
    in_use: 0,
    maintenance: 0,
    out_of_service: 0,
  };
  for (const v of vehicles) {
    if (v.status in base) base[v.status] += 1;
  }
  return base;
}

export function buildFleetAlerts(ds: FleetDataset): FleetComputedAlert[] {
  const alerts: FleetComputedAlert[] = [];

  const addDue = (
    kind: FleetComputedAlert['kind'],
    v: FleetVehicle | undefined,
    label: string,
    dueRaw?: string,
    fallbackTitle?: string
  ) => {
    const dueDate = safeParseDate(dueRaw);
    const plate = v?.plate ?? '—';
    if (!dueDate) return;
    const days = differenceInDays(dueDate, new Date());

    let severity: FleetComputedAlert['severity'] = 'info';
    if (days < 0) severity = 'critical';
    else if (days <= 14) severity = 'critical';
    else if (days <= 45) severity = 'warning';

    alerts.push({
      id: `${kind}-${v?.id ?? plate}-${dueRaw}`,
      severity,
      vehicleId: v?.id,
      plate,
      title: fallbackTitle ?? label,
      detail: `${plate}: ${days < 0 ? `vencido hace ${-days} días` : `vence en ${days} día(s)`} (${format(dueDate, 'dd/MM/yyyy', { locale: es })})`,
      daysUntil: days,
      due: dueRaw,
      kind,
    });
  };

  for (const v of ds.vehicles) {
    addDue('insurance', v, `SOAT / seguro (${v.insuranceCompany || 'póliza'})`, v.insuranceDue);
    addDue('technical', v, 'Revisión técnica ambiental', v.technicalInspectionDue);
    addDue('service', v, 'Cambio aceite rutina', v.nextOilChangeDate);

    if (v.nextServiceKm != null && v.currentOdometerKm >= v.nextServiceKm - 500) {
      const overdue = v.currentOdometerKm >= v.nextServiceKm;
      alerts.push({
        id: `odometer-${v.id}`,
        severity: overdue ? 'critical' : 'warning',
        vehicleId: v.id,
        plate: v.plate,
        title: 'Mantenimiento preventivo por kilometraje',
        detail: `${v.plate}: odómetro ${v.currentOdometerKm.toLocaleString('es-PE')} km · objetivo ${v.nextServiceKm.toLocaleString('es-PE')} km`,
        kind: 'odometer',
      });
    }
  }

  alerts.sort((a, b) => {
    const sw = { critical: 0, warning: 1, info: 2 };
    return sw[a.severity] - sw[b.severity] || (b.daysUntil ?? 9999) - (a.daysUntil ?? 9999);
  });

  return alerts;
}

export function avgFleetConsumptionLPer100(ds: FleetDataset): number | null {
  const totals: number[] = [];
  for (const vid of [...new Set(ds.fuelEntries.map((e) => e.vehicleId))]) {
    const list = [...ds.fuelEntries].filter((e) => e.vehicleId === vid);
    list.sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
    let acc = 0;
    let cnt = 0;
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1]!;
      const cur = list[i]!;
      const km = cur.odometerKm - prev.odometerKm;
      const L = cur.liters;
      if (km > 5 && L > 0) {
        acc += (L / km) * 100;
        cnt += 1;
      }
    }
    if (cnt > 0) totals.push(acc / cnt);
  }
  if (totals.length === 0) return null;
  return totals.reduce((a, b) => a + b, 0) / totals.length;
}

export function vehicleConsumptionLPer100(ds: FleetDataset, vehicleId: string): number | null {
  const list = [...ds.fuelEntries].filter((e) => e.vehicleId === vehicleId);
  list.sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
  let acc = 0;
  let cnt = 0;
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1]!;
    const cur = list[i]!;
    const km = cur.odometerKm - prev.odometerKm;
    const L = cur.liters;
    if (km > 5 && L > 0) {
      acc += (L / km) * 100;
      cnt += 1;
    }
  }
  return cnt > 0 ? acc / cnt : null;
}

export function monthlyCostsSeries(ds: FleetDataset, monthsBack = 6): { label: string; fuel: number; maintenance: number }[] {
  const out: { label: string; fuel: number; maintenance: number }[] = [];
  const now = new Date();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const m = subMonths(now, i);
    const start = startOfMonth(m);
    const end = endOfMonth(m);
    const label = format(m, 'MMM yy', { locale: es });

    let fuel = 0;
    for (const f of ds.fuelEntries) {
      const d = safeParseDate(f.date);
      if (d && d >= start && d <= end) fuel += Number(f.totalCost) || 0;
    }
    let maintenance = 0;
    for (const r of ds.maintenance) {
      const d = safeParseDate(r.date);
      if (d && d >= start && d <= end) maintenance += Number(r.laborCost) + Number(r.partsCost) || 0;
    }
    out.push({ label, fuel, maintenance });
  }
  return out;
}

export function computeFleetKpis(ds: FleetDataset): FleetKpis {
  const counts = countByStatus(ds.vehicles);
  const alerts = buildFleetAlerts(ds);
  const critical = alerts.filter((a) => a.severity === 'critical').length;
  const warning = alerts.filter((a) => a.severity === 'warning').length;

  const thisMonthStart = startOfMonth(new Date());
  const thisMonthEnd = endOfMonth(new Date());
  let monthMaintenanceSpend = 0;
  for (const r of ds.maintenance) {
    const d = safeParseDate(r.date);
    if (d && d >= thisMonthStart && d <= thisMonthEnd) {
      monthMaintenanceSpend += (Number(r.laborCost) || 0) + (Number(r.partsCost) || 0);
    }
  }
  let monthFuelSpend = 0;
  let monthFuelLiters = 0;
  for (const f of ds.fuelEntries) {
    const d = safeParseDate(f.date);
    if (d && d >= thisMonthStart && d <= thisMonthEnd) {
      monthFuelSpend += Number(f.totalCost) || 0;
      monthFuelLiters += Number(f.liters) || 0;
    }
  }

  const times = [...ds.maintenance.map((m) => m.createdAt), ...ds.fuelEntries.map((f) => f.createdAt)]
    .map((x) => new Date(x).getTime())
    .filter((x) => !Number.isNaN(x));
  const latest = times.length ? new Date(Math.max(...times)) : new Date();

  return {
    total: ds.vehicles.length,
    available: counts.available,
    inUse: counts.in_use,
    maintenance: counts.maintenance,
    outOfService: counts.out_of_service,
    criticalAlerts: critical,
    warningAlerts: warning,
    monthMaintenanceSpend,
    monthFuelSpend,
    monthFuelLiters,
    avgFleetConsumptionLPer100: avgFleetConsumptionLPer100(ds),
    lastSyncedAtLabel: format(latest, "dd/MM/yyyy HH:mm", { locale: es }),
  };
}

export function statusLabelSpanish(s: FleetVehicleStatus): string {
  const map: Record<FleetVehicleStatus, string> = {
    available: 'Disponible',
    in_use: 'En uso',
    maintenance: 'Mantenimiento',
    out_of_service: 'Fuera de servicio',
  };
  return map[s] ?? s;
}

export function fuelTypeLabel(ft: FleetVehicle['fuelType']): string {
  const m: Record<typeof ft, string> = {
    gasoline: 'Gasolina',
    diesel: 'Diésel',
    cng: 'GNV',
    electric: 'Eléctrico',
    hybrid: 'Híbrido',
  };
  return m[ft];
}
