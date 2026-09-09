import { describe, expect, it } from 'vitest';

interface UniformItemAssignment {
  id: string;
  employeeId: string;
  garmentType: 'scrub_top' | 'scrub_pants' | 'boots' | 'jacket';
  size: string; // S, M, L, XL
  quantity: number;
  deliveryDate: string;
}

function validateGarmentSize(garmentType: string, size: string): boolean {
  const standardSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const shoeSizes = ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44'];

  if (garmentType === 'boots') {
    return shoeSizes.includes(size.trim());
  }
  return standardSizes.includes(size.trim().toUpperCase());
}

describe('Uniformes Module', () => {
  it('valida talla estándar para prendas tipo scrub', () => {
    expect(validateGarmentSize('scrub_top', 'M')).toBe(true);
    expect(validateGarmentSize('scrub_top', 'INVALID')).toBe(false);
  });

  it('valida calzado/botas con talla numérica', () => {
    expect(validateGarmentSize('boots', '40')).toBe(true);
    expect(validateGarmentSize('boots', 'M')).toBe(false);
  });
});
