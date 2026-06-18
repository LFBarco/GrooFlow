import { describe, expect, it } from 'vitest';
import {
  DEMO_INITIAL_INVOICES,
  DEMO_INITIAL_PRODUCTS,
  DEMO_INITIAL_PROVIDERS,
  DEMO_INITIAL_REQUESTS,
} from './demoSeedData';

describe('demoSeedData', () => {
  it('provee datos demo solo para backend local', () => {
    expect(DEMO_INITIAL_PROVIDERS.length).toBeGreaterThanOrEqual(2);
    expect(DEMO_INITIAL_PRODUCTS.length).toBeGreaterThanOrEqual(1);
    expect(DEMO_INITIAL_INVOICES.length).toBeGreaterThanOrEqual(1);
    expect(DEMO_INITIAL_REQUESTS.length).toBeGreaterThanOrEqual(1);
  });

  it('productos demo referencian proveedor existente', () => {
    const providerIds = new Set(DEMO_INITIAL_PROVIDERS.map((p) => p.id));
    for (const product of DEMO_INITIAL_PRODUCTS) {
      expect(providerIds.has(product.providerId)).toBe(true);
    }
  });
});
