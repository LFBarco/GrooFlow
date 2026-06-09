import type {
  InventoryCategoryDef,
  InventoryDataset,
  InventoryEquipmentKind,
} from '../types/inventory';

export const DEFAULT_INVENTORY_CATEGORIES: InventoryCategoryDef[] = [
  { id: 'imagen', label: 'Imagen', codePrefix: 'IMG', kind: 'medical', active: true, sortOrder: 0 },
  { id: 'anestesia', label: 'Anestesia', codePrefix: 'ANE', kind: 'medical', active: true, sortOrder: 1 },
  { id: 'laboratorio', label: 'Laboratorio', codePrefix: 'LAB', kind: 'medical', active: true, sortOrder: 2 },
  { id: 'monitoreo', label: 'Monitoreo', codePrefix: 'MON', kind: 'medical', active: true, sortOrder: 3 },
  { id: 'cirugia', label: 'Cirugía', codePrefix: 'CIR', kind: 'medical', active: true, sortOrder: 4 },
  { id: 'consultorio', label: 'Consultorio', codePrefix: 'CONS', kind: 'medical', active: true, sortOrder: 5 },
  { id: 'operativo', label: 'Operativo', codePrefix: 'OPR', kind: 'operational', active: true, sortOrder: 6 },
  { id: 'otros', label: 'Otros', codePrefix: 'EQP', kind: 'operational', active: true, sortOrder: 7 },
];

function slugCategoryId(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 32);
}

export function normalizeCategoryConfig(raw: unknown): InventoryCategoryDef[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return JSON.parse(JSON.stringify(DEFAULT_INVENTORY_CATEGORIES)) as InventoryCategoryDef[];
  }
  const out: InventoryCategoryDef[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || typeof row !== 'object') continue;
    const r = row as Partial<InventoryCategoryDef>;
    const label = (r.label || '').trim();
    if (!label) continue;
    const id = (r.id || slugCategoryId(label)).trim().toLowerCase();
    const prefix =
      (r.codePrefix || label.slice(0, 3))
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6) || 'EQP';
    out.push({
      id,
      label,
      codePrefix: prefix,
      kind: r.kind === 'operational' ? 'operational' : 'medical',
      active: r.active !== false,
      sortOrder: typeof r.sortOrder === 'number' ? r.sortOrder : i,
    });
  }
  return out.length > 0 ? out.sort((a, b) => a.sortOrder - b.sortOrder) : normalizeCategoryConfig([]);
}

export function resolveInventoryCategories(dataset: InventoryDataset): InventoryCategoryDef[] {
  return normalizeCategoryConfig(dataset.categoryConfig);
}

export function getActiveCategories(dataset: InventoryDataset): InventoryCategoryDef[] {
  return resolveInventoryCategories(dataset).filter((c) => c.active);
}

export function getCategoryById(
  dataset: InventoryDataset,
  categoryId: string
): InventoryCategoryDef | undefined {
  return resolveInventoryCategories(dataset).find((c) => c.id === categoryId);
}

export function getCategoryLabel(dataset: InventoryDataset, categoryId: string): string {
  return getCategoryById(dataset, categoryId)?.label ?? categoryId;
}

export function getCategoryPrefix(dataset: InventoryDataset, categoryId: string): string {
  const cat = getCategoryById(dataset, categoryId);
  return cat?.codePrefix ?? 'EQP';
}

export function normalizeCategoryId(raw?: string): string {
  const t = (raw || '').trim().toLowerCase();
  if (!t) return 'otros';
  if (t.includes('anest')) return 'anestesia';
  if (t.includes('lab')) return 'laboratorio';
  if (t.includes('monit')) return 'monitoreo';
  if (t.includes('cirug')) return 'cirugia';
  if (t.includes('imag') || t.includes('eco')) return 'imagen';
  if (t.includes('consul')) return 'consultorio';
  if (t.includes('oper')) return 'operativo';
  return t.replace(/[^a-z0-9_-]/g, '').slice(0, 32) || 'otros';
}

export function newCategoryDraft(kind: InventoryEquipmentKind = 'medical'): InventoryCategoryDef {
  const n = Date.now().toString(36);
  return {
    id: `cat_${n}`,
    label: '',
    codePrefix: '',
    kind,
    active: true,
    sortOrder: 99,
  };
}
