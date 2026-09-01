import { describe, expect, it } from 'vitest';
import { getSubcategories, mergeConfigStructure, type ConfigStructure } from './initialData';

describe('getSubcategories', () => {
  it('uses legacy concepts when subcategories exist but are empty', () => {
    const def = {
      type: 'expense' as const,
      subcategories: [{ id: 'general', name: 'Planilla', concepts: [] }],
      concepts: [{ id: 'a', name: 'Planilla Base', flexibility: 'fixed' as const }],
    };
    const subs = getSubcategories(def, 'Planilla');
    expect(subs).toHaveLength(1);
    expect(subs[0]?.concepts).toHaveLength(1);
    expect(subs[0]?.concepts[0]?.name).toBe('Planilla Base');
  });

  it('restores default expense concepts when remote category is empty', () => {
    const remote: ConfigStructure = {
      Planilla: { type: 'expense', subcategories: [{ id: 'general', name: 'Planilla', concepts: [] }] },
    };
    const defaults: ConfigStructure = {
      Planilla: {
        type: 'expense',
        concepts: [{ id: 'b', name: 'AFP', flexibility: 'fixed' as const }],
      },
    };
    const merged = mergeConfigStructure(remote, defaults);
    expect(getSubcategories(merged.Planilla!, 'Planilla').flatMap((s) => s.concepts)).toHaveLength(1);
  });
});
