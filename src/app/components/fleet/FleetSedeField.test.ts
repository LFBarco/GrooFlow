import { describe, expect, it } from 'vitest';
import { buildFleetSedeOptions } from './FleetSedeField';

describe('buildFleetSedeOptions', () => {
  it('usa sedes visibles del sistema', () => {
    const { baseSedes, resolvedDefault } = buildFleetSedeOptions(['Norte', 'Sur'], 'Norte', 'Norte');
    expect(baseSedes).toEqual(['Norte', 'Sur']);
    expect(resolvedDefault).toBe('Norte');
  });

  it('fallback Principal si no hay sedes', () => {
    const { baseSedes, resolvedDefault } = buildFleetSedeOptions([], undefined, undefined);
    expect(baseSedes).toEqual(['Principal']);
    expect(resolvedDefault).toBe('Principal');
  });

  it('incluye valor actual aunque no esté en catálogo', () => {
    const { options } = buildFleetSedeOptions(['Norte'], 'Norte', 'Legacy-Sede');
    expect(options).toContain('Legacy-Sede');
  });
});
