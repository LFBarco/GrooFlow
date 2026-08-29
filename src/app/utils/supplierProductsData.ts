import type {
  SupplierProductOffer,
  SupplierProductPriceRecord,
  SupplierProductsSettings,
} from '../types/supplierProducts';
import { DEFAULT_PRICE_POLICY } from '../types/supplierProducts';

export const SUPPLIER_PRODUCTS_KV_KEY = 'data:supplierProducts';

export function defaultSupplierProductsSettings(): SupplierProductsSettings {
  return {
    version: 1,
    offers: [],
    priceHistory: [],
    pricePolicy: { ...DEFAULT_PRICE_POLICY },
  };
}

export function mergeSupplierProductsSettings(
  partial?: Partial<SupplierProductsSettings> | null
): SupplierProductsSettings {
  const base = defaultSupplierProductsSettings();
  if (!partial || typeof partial !== 'object') return { ...base };
  return {
    version: 1,
    offers: Array.isArray(partial.offers) ? partial.offers : base.offers,
    priceHistory: Array.isArray(partial.priceHistory) ? partial.priceHistory : base.priceHistory,
    pricePolicy: { ...base.pricePolicy, ...(partial.pricePolicy ?? {}) },
  };
}

export function newSupplierOfferId(): string {
  return `spo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function newPriceRecordId(): string {
  return `spp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function computeUnitComparablePrice(price: number, conversionFactor: number): number {
  const factor = conversionFactor > 0 ? conversionFactor : 1;
  return Math.round((price / factor) * 10000) / 10000;
}

export function variationPercent(previous: number, next: number): number {
  if (previous <= 0) return next > 0 ? 100 : 0;
  return Math.round(((next - previous) / previous) * 10000) / 100;
}

export function offersForProduct(
  settings: SupplierProductsSettings,
  productId: string,
  onlyActive = true
): SupplierProductOffer[] {
  return settings.offers
    .filter((o) => o.productId === productId && (!onlyActive || o.isActive))
    .sort((a, b) => {
      if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1;
      return a.unitComparablePrice - b.unitComparablePrice;
    });
}

export function offersForProvider(
  settings: SupplierProductsSettings,
  providerId: string,
  onlyActive = true
): SupplierProductOffer[] {
  return settings.offers.filter(
    (o) => o.providerId === providerId && (!onlyActive || o.isActive)
  );
}

export function priceHistoryForOffer(
  settings: SupplierProductsSettings,
  supplierProductId: string
): SupplierProductPriceRecord[] {
  return settings.priceHistory
    .filter((p) => p.supplierProductId === supplierProductId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function bestOfferForProduct(
  settings: SupplierProductsSettings,
  productId: string
): SupplierProductOffer | undefined {
  const list = offersForProduct(settings, productId, true);
  if (list.length === 0) return undefined;
  return [...list].sort((a, b) => a.unitComparablePrice - b.unitComparablePrice)[0];
}

export type UpsertOfferInput = {
  id?: string;
  productId: string;
  providerId: string;
  providerName: string;
  supplierSku?: string;
  supplierDescription?: string;
  brand?: string;
  presentation?: string;
  purchaseUnit?: string;
  conversionFactor: number;
  lastPrice: number;
  currency: 'PEN' | 'USD';
  minimumOrderQty?: number;
  leadTimeDays?: number;
  isPreferred?: boolean;
  isActive?: boolean;
  notes?: string;
  createdBy?: string;
  reason?: string;
  source?: SupplierProductPriceRecord['source'];
};

export function upsertSupplierOffer(
  settings: SupplierProductsSettings,
  input: UpsertOfferInput
): { settings: SupplierProductsSettings; offer: SupplierProductOffer; priceChangeRequiresApproval: boolean } {
  const conversionFactor = input.conversionFactor > 0 ? input.conversionFactor : 1;
  const unitComparablePrice = computeUnitComparablePrice(input.lastPrice, conversionFactor);
  const now = new Date().toISOString();
  const existing = input.id
    ? settings.offers.find((o) => o.id === input.id)
    : settings.offers.find(
        (o) => o.productId === input.productId && o.providerId === input.providerId && o.isActive
      );

  const id = existing?.id ?? input.id ?? newSupplierOfferId();
  const previousPrice = existing?.lastPrice;
  const variation =
    previousPrice != null && previousPrice > 0
      ? variationPercent(previousPrice, input.lastPrice)
      : undefined;

  const policy = settings.pricePolicy;
  const absVar = Math.abs(variation ?? 0);
  const priceChanged =
    previousPrice != null && Math.round(previousPrice * 100) !== Math.round(input.lastPrice * 100);
  const requiresApproval =
    priceChanged && absVar > (policy.autoApproveMaxPercent ?? DEFAULT_PRICE_POLICY.autoApproveMaxPercent);

  const offer: SupplierProductOffer = {
    id,
    productId: input.productId,
    providerId: input.providerId,
    providerName: input.providerName,
    supplierSku: input.supplierSku,
    supplierDescription: input.supplierDescription,
    brand: input.brand,
    presentation: input.presentation,
    purchaseUnit: input.purchaseUnit,
    conversionFactor,
    lastPrice: input.lastPrice,
    currency: input.currency,
    unitComparablePrice,
    minimumOrderQty: input.minimumOrderQty,
    leadTimeDays: input.leadTimeDays,
    isPreferred: input.isPreferred ?? existing?.isPreferred ?? false,
    isActive: input.isActive ?? true,
    notes: input.notes,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  let offers = settings.offers.filter((o) => o.id !== id);
  if (offer.isPreferred) {
    offers = offers.map((o) =>
      o.productId === offer.productId ? { ...o, isPreferred: false } : o
    );
  }
  offers = [...offers, offer];

  let priceHistory = settings.priceHistory;
  if (!existing || priceChanged) {
    // Supersede previous active price rows for this offer
    priceHistory = priceHistory.map((p) =>
      p.supplierProductId === id && p.status === 'active'
        ? { ...p, status: 'superseded' as const }
        : p
    );
    const record: SupplierProductPriceRecord = {
      id: newPriceRecordId(),
      supplierProductId: id,
      price: input.lastPrice,
      currency: input.currency,
      unitComparablePrice,
      minimumQuantity: input.minimumOrderQty,
      validFrom: now.slice(0, 10),
      source: input.source ?? 'manual',
      status: requiresApproval ? 'pending_approval' : 'active',
      previousPrice,
      variationPercent: variation,
      reason: input.reason,
      createdBy: input.createdBy,
      createdAt: now,
    };
    priceHistory = [record, ...priceHistory];
  }

  return {
    settings: { ...settings, offers, priceHistory },
    offer,
    priceChangeRequiresApproval: requiresApproval,
  };
}

export function setOfferPreferred(
  settings: SupplierProductsSettings,
  offerId: string
): SupplierProductsSettings {
  const target = settings.offers.find((o) => o.id === offerId);
  if (!target) return settings;
  return {
    ...settings,
    offers: settings.offers.map((o) => ({
      ...o,
      isPreferred: o.productId === target.productId ? o.id === offerId : o.isPreferred,
      updatedAt: o.productId === target.productId ? new Date().toISOString() : o.updatedAt,
    })),
  };
}

export function deactivateOffer(
  settings: SupplierProductsSettings,
  offerId: string
): SupplierProductsSettings {
  return {
    ...settings,
    offers: settings.offers.map((o) =>
      o.id === offerId ? { ...o, isActive: false, updatedAt: new Date().toISOString() } : o
    ),
  };
}

export function approvePendingPrice(
  settings: SupplierProductsSettings,
  priceRecordId: string,
  approvedBy: string
): SupplierProductsSettings {
  const rec = settings.priceHistory.find((p) => p.id === priceRecordId);
  if (!rec || rec.status !== 'pending_approval') return settings;
  const now = new Date().toISOString();
  return {
    ...settings,
    priceHistory: settings.priceHistory.map((p) =>
      p.id === priceRecordId
        ? { ...p, status: 'active', approvedBy, approvedAt: now }
        : p.supplierProductId === rec.supplierProductId && p.status === 'active' && p.id !== priceRecordId
          ? { ...p, status: 'superseded' }
          : p
    ),
  };
}

export function rejectPendingPrice(
  settings: SupplierProductsSettings,
  priceRecordId: string,
  approvedBy: string
): SupplierProductsSettings {
  const rec = settings.priceHistory.find((p) => p.id === priceRecordId);
  if (!rec || rec.status !== 'pending_approval') return settings;
  const offer = settings.offers.find((o) => o.id === rec.supplierProductId);
  const revertPrice = rec.previousPrice;
  let offers = settings.offers;
  if (offer && revertPrice != null) {
    const unitComparablePrice = computeUnitComparablePrice(revertPrice, offer.conversionFactor);
    offers = offers.map((o) =>
      o.id === offer.id
        ? {
            ...o,
            lastPrice: revertPrice,
            unitComparablePrice,
            updatedAt: new Date().toISOString(),
          }
        : o
    );
  }
  return {
    ...settings,
    offers,
    priceHistory: settings.priceHistory.map((p) =>
      p.id === priceRecordId
        ? { ...p, status: 'rejected', approvedBy, approvedAt: new Date().toISOString() }
        : p
    ),
  };
}
