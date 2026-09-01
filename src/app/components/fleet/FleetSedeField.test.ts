import { describe, expect, it } from 'vitest';
import { buildFleetSedeOptions } from './FleetSedeField';

describe('buildFleetSedeOptions', () => {
  it('usa sedes visibles del sistema', () => {
    const { baseSedes, resolvedDefault } = buildFleetSedeOptions(
      ['10. Benavides', '20. Miraflores'],
      '10. Benavides',
      '10. Benavides',
    );
    expect(baseSedes).toEqual(['10. Benavides', '20. Miraflores']);
    expect(resolvedDefault).toBe('10. Benavides');
  });

  it('sin catálogo no inventa Principal', () => {
    const { baseSedes, resolvedDefault, options } = buildFleetSedeOptions([], undefined, undefined);
    expect(baseSedes).toEqual([]);
    expect(options).toEqual([]);
    expect(resolvedDefault).toBe('');
  });

  it('mapea valor legacy al canónico del catálogo', () => {
    const { options, resolvedDefault } = buildFleetSedeOptions(
      ['10. Benavides'],
      undefined,
      'Benavides',
    );
    expect(options).toEqual(['10. Benavides']);
    expect(resolvedDefault).toBe('10. Benavides');
  });
});
