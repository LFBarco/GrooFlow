/** Oferta / vínculo Producto ↔ Proveedor (catálogo de compra). */
export type SupplierProductPriceStatus = 'active' | 'pending_approval' | 'rejected' | 'superseded';

export type SupplierProductPriceSource =
  | 'manual'
  | 'supplier_list'
  | 'quotation'
  | 'purchase_order'
  | 'import';

export interface SupplierProductPriceRecord {
  id: string;
  supplierProductId: string;
  price: number;
  currency: 'PEN' | 'USD';
  /** Precio unitario comparable (tras factor de conversión). */
  unitComparablePrice: number;
  minimumQuantity?: number;
  validFrom: string;
  validUntil?: string;
  source: SupplierProductPriceSource;
  documentReference?: string;
  status: SupplierProductPriceStatus;
  previousPrice?: number;
  variationPercent?: number;
  reason?: string;
  createdBy?: string;
  approvedBy?: string;
  createdAt: string;
  approvedAt?: string;
}

export interface SupplierProductOffer {
  id: string;
  productId: string;
  providerId: string;
  /** Snapshot del nombre (por si el proveedor se renombra). */
  providerName: string;
  supplierSku?: string;
  supplierDescription?: string;
  brand?: string;
  presentation?: string;
  purchaseUnit?: string;
  /** Cuántas unidades de producto master trae 1 unidad de compra (ej. caja×100 → 100). */
  conversionFactor: number;
  lastPrice: number;
  currency: 'PEN' | 'USD';
  /** Precio por unidad master = lastPrice / conversionFactor. */
  unitComparablePrice: number;
  minimumOrderQty?: number;
  leadTimeDays?: number;
  isPreferred: boolean;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierProductsSettings {
  version: 1;
  offers: SupplierProductOffer[];
  priceHistory: SupplierProductPriceRecord[];
  /** Umbrales % para alerta / aprobación de variación de precio. */
  pricePolicy: {
    autoApproveMaxPercent: number;
    purchasesApproveMaxPercent: number;
    /** Por encima → gerencia / rechazo pendiente. */
  };
}

export const DEFAULT_PRICE_POLICY = {
  autoApproveMaxPercent: 3,
  purchasesApproveMaxPercent: 10,
} as const;
