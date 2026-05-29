/**
 * Gestión vehicular veterinaria — modelos persistentes (`data:fleet`).
 */

export type FleetVehicleStatus = 'available' | 'in_use' | 'maintenance' | 'out_of_service';

export type FleetFuelType = 'gasoline' | 'diesel' | 'cng' | 'electric' | 'hybrid';

export type FleetMaintenanceKind = 'preventive' | 'corrective';

export interface FleetVehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  color?: string;
  vin?: string;
  fuelType: FleetFuelType;
  status: FleetVehicleStatus;
  currentOdometerKm: number;
  /** Conductor habitual o último conductor asignado */
  assignedDriverName?: string;
  /** Número de licencia del conductor asignado */
  assignedDriverLicense?: string;
  /** Última ubicación conocida / sede habitual */
  homeBase?: string;
  notes?: string;
  /** Próxima revisión técnica (fecha ISO yyyy-MM-dd) */
  technicalInspectionDue?: string;
  /** SOAT / póliza (fecha ISO yyyy-MM-dd) */
  insuranceDue?: string;
  insuranceCompany?: string;
  /** Contrato hasta (ISO fecha) opcional */
  registrationDue?: string;
  /** Última inspección checklist — % cumplimiento */
  lastInspectionCompliance?: number;
  /** ISO fecha/hora última inspección */
  lastInspectionAt?: string;
  /** Puntos acumulados por incumplimientos (afecta seguimiento al chofer) */
  driverInspectionDemerits?: number;
  /** Índice 0–100 desempeño checklist (suavizado) */
  driverPerformanceScore?: number;
  /** Km objetivo siguiente servicio preventivo grande */
  nextServiceKm?: number;
  /** Fecha sugerida próximo cambio aceite rutina */
  nextOilChangeDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FleetPartLine {
  name: string;
  qty: number;
  unitCost: number;
}

export interface FleetMaintenanceRecord {
  id: string;
  vehicleId: string;
  kind: FleetMaintenanceKind;
  date: string;
  odometerKm: number;
  workshopName?: string;
  /** Sede donde se realizó el servicio */
  location?: string;
  description: string;
  laborCost: number;
  partsCost: number;
  parts: FleetPartLine[];
  /** Próximo control sugerido (ISO) */
  nextDueDate?: string;
  /** Próximo km sugerido */
  nextDueOdometerKm?: number;
  createdAt: string;
}

export interface FleetFuelEntry {
  id: string;
  vehicleId: string;
  date: string;
  odometerKm: number;
  liters: number;
  /** Costo total soles */
  totalCost: number;
  station?: string;
  /** Sede / base del repostaje */
  location?: string;
  fullTank?: boolean;
  notes?: string;
  createdAt: string;
}

/** Ítem configurable del checklist (movilidad canina / servicio). */
export interface FleetChecklistItemDef {
  id: string;
  label: string;
  sortOrder: number;
}

/** Sección / categoría del checklist (ej. Sistema de luces, Documentos). */
export interface FleetChecklistSection {
  id: string;
  title: string;
  sortOrder: number;
  items: FleetChecklistItemDef[];
}

export interface FleetInspectionAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  /** Data URL (base64); limitar tamaño en UI */
  dataUrl: string;
  uploadedAt: string;
}

export interface FleetInspectionRecord {
  id: string;
  vehicleId: string;
  /** Fecha/hora del acta (ISO local yyyy-MM-ddTHH:mm o ISO completo) */
  dateTime: string;
  odometerKm?: number;
  driverName: string;
  supervisorName?: string;
  /** respuestas por id de ítem checklist */
  responses: Record<string, 'pass' | 'fail'>;
  compliancePercent: number;
  /** Puntos de desempecho chofer acumulados en el vehículo tras este acta */
  driverDemeritPointsAfter?: number;
  /** Índice 0–100 tras esta inspección (promedio con histórico en vehículo) */
  driverPerformanceScoreAfter?: number;
  driverSignatureDataUrl?: string;
  supervisorSignatureDataUrl?: string;
  attachments: FleetInspectionAttachment[];
  notes?: string;
  createdAt: string;
}

/** Documento KV completo */
export interface FleetDataset {
  vehicles: FleetVehicle[];
  maintenance: FleetMaintenanceRecord[];
  fuelEntries: FleetFuelEntry[];
  /** Plantilla editable del checklist de inspección */
  checklistSections: FleetChecklistSection[];
  /** Historial de inspecciones (todas las unidades) */
  inspections: FleetInspectionRecord[];
}

export interface FleetComputedAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  vehicleId?: string;
  plate?: string;
  title: string;
  detail: string;
  /** Días hasta el vencimiento (negativo = vencido) */
  daysUntil?: number;
  due?: string;
  kind: 'insurance' | 'technical' | 'service' | 'odometer' | 'general';
}

export interface FleetKpis {
  total: number;
  available: number;
  inUse: number;
  maintenance: number;
  outOfService: number;
  criticalAlerts: number;
  warningAlerts: number;
  monthMaintenanceSpend: number;
  monthFuelSpend: number;
  monthFuelLiters: number;
  avgFleetConsumptionLPer100: number | null;
  lastSyncedAtLabel: string;
}
