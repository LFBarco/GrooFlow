import type { ProductCatalogSettings, SystemSettings } from '../types';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_LINES,
  PRODUCT_PRESENTATIONS,
  PRODUCT_SUBCATEGORIES,
  PRODUCT_UNITS,
} from '../components/products/productCatalogConstants';

function uniq(list: string[] | undefined, seed: readonly string[]): string[] {
  const src = Array.isArray(list) && list.length > 0 ? list : [...seed];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of src) {
    const v = String(raw ?? '').trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out.length > 0 ? out : [...seed];
}

export function defaultProductCatalog(): ProductCatalogSettings {
  return {
    lines: [...PRODUCT_LINES],
    categories: [...PRODUCT_CATEGORIES],
    subcategories: [...PRODUCT_SUBCATEGORIES],
    units: [...PRODUCT_UNITS],
    presentations: [...PRODUCT_PRESENTATIONS],
  };
}

export function mergeProductCatalog(
  incoming?: Partial<ProductCatalogSettings> | null
): ProductCatalogSettings {
  const base = defaultProductCatalog();
  if (!incoming) return base;
  return {
    lines: uniq(incoming.lines, base.lines),
    categories: uniq(incoming.categories, base.categories),
    subcategories: uniq(incoming.subcategories, base.subcategories),
    units: uniq(incoming.units, base.units),
    presentations: uniq(incoming.presentations, base.presentations),
  };
}

export function getProductCatalog(settings?: SystemSettings | null): ProductCatalogSettings {
  return mergeProductCatalog(settings?.productCatalog);
}
