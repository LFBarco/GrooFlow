import type { SystemSettings, PettyCashTransaction } from '../types';

/** Valores por defecto si aún no hay `systemSettings.providers`. */
export const DEFAULT_PROVIDER_CATEGORIES = [
  'Farmacia',
  'Insumos Médicos',
  'Servicios Básicos',
  'Mantenimiento',
  'Alquileres',
  'Laboratorio',
  'Marketing',
  'Otros',
];

export const DEFAULT_PROVIDER_AREAS = [
  'Dirección General',
  'Administración',
  'Logística',
  'Ventas',
  'Recursos Humanos',
  'Sistemas',
  'Operaciones',
  'Mantenimiento',
];

export function getProviderCategories(settings?: SystemSettings | null): string[] {
  const raw = settings?.providers?.categories;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((s) => String(s).trim()).filter(Boolean);
  }
  return [...DEFAULT_PROVIDER_CATEGORIES];
}

export function getProviderAreas(settings?: SystemSettings | null): string[] {
  const raw = settings?.providers?.areas;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((s) => String(s).trim()).filter(Boolean);
  }
  return [...DEFAULT_PROVIDER_AREAS];
}

/**
 * Catálogo para filtros de caja chica: lo definido en Configuración → Contabilidad
 * más categorías/áreas que ya aparecen en movimientos (histórico o renombres).
 */
export function mergePettyCashFilterCatalog(
  settings: SystemSettings | null | undefined,
  transactions: PettyCashTransaction[]
): { categories: string[]; areas: string[] } {
  const baseCat = getProviderCategories(settings);
  const baseArea = getProviderAreas(settings);
  const catSet = new Set(baseCat);
  const areaSet = new Set(baseArea);
  for (const t of transactions) {
    if (t.category) catSet.add(String(t.category).trim());
    if (t.area) areaSet.add(String(t.area).trim());
  }
  const sortEs = (a: string, b: string) => a.localeCompare(b, 'es');
  return {
    categories: Array.from(catSet).filter(Boolean).sort(sortEs),
    areas: Array.from(areaSet).filter(Boolean).sort(sortEs),
  };
}
