import type { Product } from '../../types';

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function cloneProduct(source: Product): Product {
  const p: Product = {
    ...source,
    createdAt: new Date(source.createdAt),
    updatedAt: new Date(source.updatedAt),
  };
  if (source.extended) {
    p.extended = {
      ...source.extended,
      kardex: source.extended.kardex?.map((r) => ({ ...r })),
      lots: source.extended.lots?.map((r) => ({ ...r })),
      audit: source.extended.audit?.map((r) => ({ ...r })),
      galleryDataUrls: source.extended.galleryDataUrls ? [...source.extended.galleryDataUrls] : undefined,
    };
  }
  return p;
}

export function createDraftProduct(systemCode: number, locationDefault: string): Product {
  const now = new Date();
  return {
    id: `prod-${Date.now()}`,
    systemCode,
    name: '',
    line: 'CLINICA',
    category: 'RESTRICIVOS',
    subcategory: '',
    unit: 'ML',
    salePrice: 0,
    stockAccounting: 0,
    stockAvailable: 0,
    minStock: 2,
    maxStock: 4,
    status: 'active',
    location: locationDefault,
    createdAt: now,
    updatedAt: now,
    extended: {
      salesAvailable: true,
      saleTaxPercent: 18,
      purchaseTaxPercent: 18,
      saleTaxExempt: false,
      purchaseTaxExempt: false,
      saleValueNet: 0,
      purchaseValueNet: 0,
      maxDiscountPercent: 0,
      commissionType: 'fixed',
      commissionAmount: 0,
      commissionPercent: 0,
      commissionApplyOn: '',
      icbperGravado: false,
      loyaltyPoints: 0,
      presentation: 'Botella',
      usePurchaseConversion: false,
      kardex: [],
      lots: [],
      audit: [],
      galleryDataUrls: [],
    },
  };
}

/** Rellena `extended` y precios inferidos desde `salePrice` / `costPrice` si faltan. */
export function normalizeProductForWorkspace(p: Product): Product {
  const c = cloneProduct(p);
  const ex = { ...(c.extended ?? {}) };
  const saleTax = ex.saleTaxPercent ?? 18;
  const purchaseTax = ex.purchaseTaxPercent ?? 18;
  const saleExempt = ex.saleTaxExempt ?? false;
  const purchaseExempt = ex.purchaseTaxExempt ?? false;

  let saleValueNet = ex.saleValueNet;
  if (saleValueNet == null || Number.isNaN(saleValueNet)) {
    saleValueNet = saleExempt ? c.salePrice : round2(c.salePrice / (1 + saleTax / 100));
  }

  let purchaseValueNet = ex.purchaseValueNet;
  const cost = c.costPrice ?? 0;
  if ((purchaseValueNet == null || Number.isNaN(purchaseValueNet)) && cost > 0) {
    purchaseValueNet = purchaseExempt ? cost : round2(cost / (1 + purchaseTax / 100));
  } else if (purchaseValueNet == null) {
    purchaseValueNet = 0;
  }

  c.extended = {
    salesAvailable: true,
    saleTaxPercent: 18,
    purchaseTaxPercent: 18,
    saleTaxExempt: false,
    purchaseTaxExempt: false,
    maxDiscountPercent: 0,
    commissionType: 'fixed',
    commissionAmount: 0,
    commissionPercent: 0,
    loyaltyPoints: 0,
    icbperGravado: false,
    presentation: 'Botella',
    usePurchaseConversion: false,
    kardex: [],
    lots: [],
    audit: [],
    galleryDataUrls: [],
    ...ex,
    saleValueNet,
    purchaseValueNet,
    saleTaxPercent: saleTax,
    purchaseTaxPercent: purchaseTax,
    saleTaxExempt: saleExempt,
    purchaseTaxExempt: purchaseExempt,
    kardex: ex.kardex ?? [],
    lots: ex.lots ?? [],
    audit: ex.audit ?? [],
    galleryDataUrls: ex.galleryDataUrls ?? [],
  };
  return c;
}
