import { describe, expect, it } from 'vitest';

interface ProductItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  unitPrice: number;
  isTaxExempt?: boolean;
  purchaseConversionFactor?: number; // e.g. 1 box = 100 units
  purchaseBoxPrice?: number;
}

function calculateProductSellingPriceWithTax(product: ProductItem, taxRate = 0.18): number {
  if (product.isTaxExempt) return product.unitPrice;
  return product.unitPrice * (1 + taxRate);
}

function calculateUnitPriceFromBox(boxPrice: number, conversionFactor: number): number {
  if (conversionFactor <= 0) return boxPrice;
  return Number((boxPrice / conversionFactor).toFixed(4));
}

describe('Product Module', () => {
  it('calcula precio de venta con IGV del 18%', () => {
    const prod: ProductItem = { id: 'p1', sku: 'MED-001', name: 'Jeringa 5ml', category: 'Insumos', unitPrice: 10 };
    const priceWithTax = calculateProductSellingPriceWithTax(prod, 0.18);
    expect(priceWithTax).toBeCloseTo(11.8, 2);
  });

  it('respeta inafectación de IGV si el producto es inafecto', () => {
    const prod: ProductItem = { id: 'p2', sku: 'MED-002', name: 'Vacuna especial', category: 'Biológicos', unitPrice: 150, isTaxExempt: true };
    const priceWithTax = calculateProductSellingPriceWithTax(prod, 0.18);
    expect(priceWithTax).toBe(150);
  });

  it('calcula costo unitario a partir de caja comprada con factor de conversión', () => {
    const unitPrice = calculateUnitPriceFromBox(250, 100); // 250 soles por caja de 100 unidades
    expect(unitPrice).toBe(2.5);
  });
});
