export type ProductStatus = 'active' | 'inactive' | 'discontinued';

/** Movimiento de inventario (Kardex) por producto */
export interface ProductKardexRow {
  id: string;
  date: string;
  referenceDoc: string;
  operationType: string;
  warehouse: string;
  stockInitial: number;
  qtyIn: number;
  qtyOut: number;
  stockFinal: number;
  batchNo?: string;
}

/** Lote / batch asociado al producto */
export interface ProductLotRow {
  id: string;
  registeredAt: string;
  lotNumber: string;
  warehouse: string;
  expiresAt?: string;
  qtyIn: number;
  balance: number;
}

/** Entrada de auditoría de ficha de producto */
export interface ProductAuditRow {
  id: string;
  at: string;
  action: string;
  module: string;
  previousValue?: string;
  newValue?: string;
  responsible: string;
}

/** Campos extra de ficha (pestañas Precios, factor, galería, etc.) */
export interface ProductExtended {
  sku?: string;
  customCode?: string;
  presentation?: string;
  content?: string;
  saleTaxPercent?: number;
  purchaseTaxPercent?: number;
  saleTaxExempt?: boolean;
  purchaseTaxExempt?: boolean;
  /** Valor de venta sin impuestos */
  saleValueNet?: number;
  /** Valor de compra sin impuestos */
  purchaseValueNet?: number;
  maxDiscountPercent?: number;
  commissionType?: 'fixed' | 'percent';
  commissionApplyOn?: string;
  commissionAmount?: number;
  commissionPercent?: number;
  /** Gravado ICBPER (bolsas plásticas, etc.) */
  icbperGravado?: boolean;
  loyaltyPoints?: number;
  salesAvailable?: boolean;
  applicationFrequencyDays?: string;
  usePurchaseConversion?: boolean;
  purchaseConversionLabel?: string;
  purchaseConversionFactor?: number;
  purchaseConversionUnitPurchasePrice?: number;
  /** Imágenes en galería (data URLs; uso moderado por tamaño en KV) */
  galleryDataUrls?: string[];
  kardex?: ProductKardexRow[];
  lots?: ProductLotRow[];
  audit?: ProductAuditRow[];
}

export interface Product {
  id: string;
  systemCode: number;
  barcode?: string;
  name: string;
  brand?: string;
  providerId?: string;
  providerName?: string;
  line: string;
  category: string;
  subcategory?: string;
  unit: string;
  salePrice: number;
  costPrice?: number;
  stockAccounting: number;
  stockAvailable: number;
  minStock: number;
  maxStock?: number;
  location?: string;
  status: ProductStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  extended?: ProductExtended;
}