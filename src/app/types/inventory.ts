/**
 * Gestión de inventario — equipos médicos y operativos (`data:inventory`).
 */

export type InventoryEquipmentKind = 'medical' | 'operational';

/** Id de categoría (predefinida o personalizada en `categoryConfig`). */
export type InventoryEquipmentCategory = string;

export interface InventoryCategoryDef {
  id: string;
  label: string;
  /** Prefijo para código automático (ej. IMG, ANE, CONS). */
  codePrefix: string;
  kind: InventoryEquipmentKind;
  active: boolean;
  sortOrder: number;
}

export type InventoryEquipmentStatus = 'active' | 'maintenance' | 'critical' | 'inactive';

export type InventoryMaintenanceKind = 'preventive' | 'corrective';

export type InventoryMaintenanceStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'overdue'
  | 'cancelled';

export interface InventoryPartLine {
  name: string;
  qty: number;
  unitCost: number;
}

export interface InventoryEquipment {
  id: string;
  code: string;
  name: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  kind: InventoryEquipmentKind;
  category: InventoryEquipmentCategory;
  status: InventoryEquipmentStatus;
  sede: string;
  /** Piso dentro de la sede (ej. 1, 2, PB). */
  floor?: string;
  /** Consultorio / sala / área (ej. 03, Cirugía A). */
  room?: string;
  locationDetail?: string;
  purchaseDate?: string;
  purchaseValue: number;
  currentValue: number;
  usefulLifeYears?: number;
  depreciationAnnualPct?: number;
  nextMaintenanceDate?: string;
  warrantyUntil?: string;
  providerId?: string;
  providerName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMaintenanceRecord {
  id: string;
  equipmentId: string;
  kind: InventoryMaintenanceKind;
  status: InventoryMaintenanceStatus;
  scheduledDate: string;
  completedDate?: string;
  technicianName?: string;
  companyName?: string;
  sede?: string;
  description: string;
  laborCost: number;
  partsCost: number;
  parts: InventoryPartLine[];
  resultNotes?: string;
  createdAt: string;
}

export interface InventoryDataset {
  equipment: InventoryEquipment[];
  maintenance: InventoryMaintenanceRecord[];
  /** Catálogo editable de categorías y prefijos de código. */
  categoryConfig?: InventoryCategoryDef[];
}

export interface InventoryKpis {
  total: number;
  active: number;
  inMaintenance: number;
  critical: number;
  inactive: number;
  operationalPct: number;
  scheduledMaintenance: number;
  overdueMaintenance: number;
  totalCurrentValue: number;
  totalDepreciation: number;
  sedeCount: number;
}

export interface InventoryComputedAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  equipmentId?: string;
  equipmentCode?: string;
  title: string;
  detail: string;
  kind: 'status' | 'maintenance' | 'warranty' | 'value';
}
