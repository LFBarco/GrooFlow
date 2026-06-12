import { describe, expect, it } from 'vitest';

import { mergeInventoryKvAndSql } from './inventoryKvPayload';
import { normalizeInventoryDataset } from './inventoryData';

const eq = (id: string, name: string, updatedAt: string) => ({
  id,
  code: id,
  name,
  kind: 'medical' as const,
  category: 'medico',
  status: 'active' as const,
  sede: 'Principal',
  purchaseValue: 0,
  currentValue: 0,
  createdAt: updatedAt,
  updatedAt,
});

describe('mergeInventoryKvAndSql', () => {
  it('prefiere SQL cuando KV aún tiene equipos borrados', () => {
    const kv = normalizeInventoryDataset({
      equipment: [eq('e1', 'KV Laptop', '2026-06-01'), eq('e2', 'KV Viejo', '2026-06-01')],
      maintenance: [],
    });
    const sql = normalizeInventoryDataset({
      equipment: [eq('e1', 'SQL Laptop', '2026-06-10')],
      maintenance: [],
    });
    const merged = mergeInventoryKvAndSql(kv, sql);
    expect(merged.equipment).toHaveLength(1);
    expect(merged.equipment[0]?.id).toBe('e1');
    expect(merged.equipment[0]?.name).toBe('SQL Laptop');
  });

  it('con misma cantidad elige fila con updatedAt más reciente', () => {
    const kv = normalizeInventoryDataset({
      equipment: [eq('e1', 'KV', '2026-06-01')],
      maintenance: [],
    });
    const sql = normalizeInventoryDataset({
      equipment: [eq('e1', 'SQL', '2026-06-15')],
      maintenance: [],
    });
    const merged = mergeInventoryKvAndSql(kv, sql);
    expect(merged.equipment[0]?.name).toBe('SQL');
  });
});
