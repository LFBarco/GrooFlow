import { describe, expect, it } from 'vitest';

import { generateEntityId } from './generateEntityId';

describe('generateEntityId', () => {
  it('genera IDs con prefijo y longitud estable', () => {
    const id = generateEntityId('tx');
    expect(id.startsWith('tx-')).toBe(true);
    expect(id.length).toBeGreaterThan(10);
  });

  it('genera IDs distintos en llamadas sucesivas', () => {
    const a = generateEntityId('cf');
    const b = generateEntityId('cf');
    expect(a).not.toBe(b);
  });
});
