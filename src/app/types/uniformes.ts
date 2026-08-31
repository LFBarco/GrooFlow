/** Tipo de prenda / uniforme. */
export type UniformItemType =
  | 'polo'
  | 'pantalon'
  | 'bata_medica'
  | 'delantal_grooming'
  | 'zapatos_seguridad'
  | 'cofia'
  | 'chaleco'
  | 'casaca_termica'
  | 'guantes'
  | 'otro';

/** Motivo de la entrega. */
export type UniformDeliveryReason =
  | 'ingreso'
  | 'renovacion'
  | 'reposicion'
  | 'cambio_talla'
  | 'perdida'
  | 'otro';

/** Estado de la entrega. */
export type UniformDeliveryStatus = 'entregado' | 'pendiente_firma' | 'devuelto';

export const UNIFORM_ITEM_LABELS: Record<UniformItemType, string> = {
  polo: 'Polo / Camisa',
  pantalon: 'Pantalón',
  bata_medica: 'Bata médica',
  delantal_grooming: 'Delantal grooming',
  zapatos_seguridad: 'Zapatos de seguridad',
  cofia: 'Cofia / Gorro',
  chaleco: 'Chaleco',
  casaca_termica: 'Casaca térmica',
  guantes: 'Guantes',
  otro: 'Otro',
};

export const UNIFORM_REASON_LABELS: Record<UniformDeliveryReason, string> = {
  ingreso: 'Ingreso / Inducción',
  renovacion: 'Renovación anual',
  reposicion: 'Reposición por desgaste',
  cambio_talla: 'Cambio de talla',
  perdida: 'Pérdida / Extravío',
  otro: 'Otro',
};

export const UNIFORM_STATUS_LABELS: Record<UniformDeliveryStatus, string> = {
  entregado: 'Entregado',
  pendiente_firma: 'Pendiente de firma',
  devuelto: 'Devuelto',
};

export const UNIFORM_SIZE_OPTIONS = [
  'XS',
  'S',
  'M',
  'L',
  'XL',
  'XXL',
  '28',
  '30',
  '32',
  '34',
  '36',
  '38',
  '40',
  '42',
  '44',
  'Único',
] as const;

export type UniformSize = (typeof UNIFORM_SIZE_OPTIONS)[number];

/** Ítem individual dentro de una entrega. */
export interface UniformDeliveryItem {
  itemType: UniformItemType;
  size: string;
  quantity: number;
  color?: string;
}

/** Registro de entrega de uniformes al personal. */
export interface UniformDeliveryRecord {
  id: string;
  sede: string;
  userId?: string;
  staffName: string;
  jobTitle: string;
  workArea: string;
  /** yyyy-MM-dd */
  deliveryDate: string;
  reason: UniformDeliveryReason;
  status: UniformDeliveryStatus;
  items: UniformDeliveryItem[];
  notes?: string;
  deliveredBy?: string;
  /** Acta de entrega firmada (data URL imagen/PDF). */
  signatureActDataUrl?: string;
  signatureActName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface UniformKitItem {
  itemType: UniformItemType;
  quantity: number;
  defaultSize?: string;
}

/** Kit de indumentaria por cargo o área. */
export interface UniformKit {
  id: string;
  name: string;
  jobTitle?: string;
  workArea?: string;
  items: UniformKitItem[];
}

export interface UniformesSettings {
  version: 1;
  records: UniformDeliveryRecord[];
  kits?: UniformKit[];
}

export interface UniformesFilters {
  dateFrom: string;
  dateTo: string;
  sede: string;
  workArea: string;
  itemType: string;
  status: string;
  reason: string;
  search: string;
}

export interface UniformesKpiSnapshot {
  totalDeliveries: number;
  totalItems: number;
  pendingSignature: number;
  uniqueStaff: number;
  byItemType: Array<{ type: UniformItemType; count: number; items: number }>;
  bySede: Array<{ sede: string; count: number }>;
  byReason: Array<{ reason: UniformDeliveryReason; count: number }>;
  byMonth: Array<{ month: string; deliveries: number; items: number }>;
  renewalsDueSoon: number;
  renewalsOverdue: number;
}
