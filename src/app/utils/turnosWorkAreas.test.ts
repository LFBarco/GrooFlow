import { describe, expect, it } from 'vitest';
import { canonicalizeWorkArea, uniqueWorkAreas } from './turnosWorkAreas';

describe('turnosWorkAreas', () => {
  it('dedupe casing and accents', () => {
    expect(
      uniqueWorkAreas([
        'Medica',
        'MEDICA',
        'Médica',
        'Administración',
        'administrativa',
        'ADMINISTRATIVA',
        'COUNTER',
        'Counters',
      ])
    ).toEqual(['Administración', 'Área Médica', 'Recepción / Counter']);
  });

  it('canonicalize aliases', () => {
    expect(canonicalizeWorkArea('GERENTE DE TIENDA')).toBe('Gerencia');
    expect(canonicalizeWorkArea('Logistica')).toBe('Logística');
  });
});
