import { describe, expect, it } from 'vitest';

interface CatalogEntry {
  id: string;
  code?: string;
  name: string;
  active: boolean;
}

function processCatalogCrud(
  entries: CatalogEntry[],
  action: 'create' | 'toggle_status' | 'delete',
  payload: { id?: string; code?: string; name?: string }
): CatalogEntry[] {
  if (action === 'create') {
    if (!payload.name?.trim()) return entries;
    const newEntry: CatalogEntry = {
      id: payload.id || `cat-${Date.now()}`,
      code: payload.code,
      name: payload.name.trim(),
      active: true,
    };
    return [...entries, newEntry];
  }

  if (action === 'toggle_status') {
    return entries.map((e) => (e.id === payload.id ? { ...e, active: !e.active } : e));
  }

  if (action === 'delete') {
    return entries.filter((e) => e.id !== payload.id);
  }

  return entries;
}

describe('Catalog CRUD Module (RRHH Catalogs)', () => {
  const initialCatalog: CatalogEntry[] = [
    { id: 'area-1', code: 'MED', name: 'Área Médica', active: true },
    { id: 'area-2', code: 'GROOM', name: 'Grooming', active: true },
  ];

  it('crea un nuevo ítem en el catálogo', () => {
    const updated = processCatalogCrud(initialCatalog, 'create', { id: 'area-3', code: 'LOG', name: 'Logística' });
    expect(updated).toHaveLength(3);
    expect(updated.find((e) => e.id === 'area-3')?.name).toBe('Logística');
  });

  it('alterna estado activo/inactivo', () => {
    const updated = processCatalogCrud(initialCatalog, 'toggle_status', { id: 'area-1' });
    expect(updated.find((e) => e.id === 'area-1')?.active).toBe(false);
  });

  it('elimina un ítem del catálogo', () => {
    const updated = processCatalogCrud(initialCatalog, 'delete', { id: 'area-2' });
    expect(updated).toHaveLength(1);
    expect(updated.find((e) => e.id === 'area-2')).toBeUndefined();
  });
});
