import { describe, expect, it } from 'vitest';
import { normalizeFleetDataset } from './fleetData';
import { isFleetDatasetEmpty } from './fleetDatasetEmpty';

describe('isFleetDatasetEmpty', () => {
  it('KV vacío normalizado no cuenta como datos (plantilla por defecto)', () => {
    expect(isFleetDatasetEmpty(normalizeFleetDataset({}))).toBe(true);
  });

  it('checklist personalizado cuenta como datos', () => {
    const ds = normalizeFleetDataset({
      checklistSections: [{ id: 's1', title: 'REVISION DE', sortOrder: 0, items: [] }],
    });
    expect(isFleetDatasetEmpty(ds)).toBe(false);
  });
});
