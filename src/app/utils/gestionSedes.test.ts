import { describe, expect, it } from 'vitest';

import {
  buildFilterSedeOptions,
  buildFormSedeOptions,
  normalizeSedeKey,
  resolveCanonicalSedeName,
} from './gestionSedes';

describe('gestionSedes', () => {
  it('normaliza alias legacy de sedes', () => {
    expect(normalizeSedeKey('10. Benavides')).toBe('benavides');
    expect(normalizeSedeKey('Petmovil')).toBe('pet movil');
    expect(normalizeSedeKey('30. Petmovil')).toBe('pet movil');
  });

  it('deduplica sedes y prefiere etiqueta con código de Gestión', () => {
    const options = buildFormSedeOptions([
      'Benavides',
      '10. Benavides',
      'Jorge Chavez',
      'Pet Movil',
      '30. Petmovil',
    ]);
    expect(options).toEqual(['10. Benavides', '30. Petmovil', 'Jorge Chavez']);
  });

  it('filtros solo usan el catálogo visible (no inventan sedes extra)', () => {
    const visible = ['10. Benavides', '50. La Molina'];
    const filtered = buildFilterSedeOptions({
      visibleSedes: visible,
      extra: ['Benavides', '20. Miraflores', 'Petmovil'],
    });
    expect(filtered).toEqual(['10. Benavides', '50. La Molina']);
  });

  it('resuelve nombre legacy al canónico visible', () => {
    const visible = ['10. Benavides', '30. Pet Movil'];
    expect(resolveCanonicalSedeName('Benavides', visible)).toBe('10. Benavides');
    expect(resolveCanonicalSedeName('Petmovil', visible)).toBe('30. Pet Movil');
  });

  it('sin catálogo no inventa Principal', () => {
    expect(buildFormSedeOptions([])).toEqual([]);
  });
});
