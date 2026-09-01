import type { SystemSettings, SedeCatalogEntry } from '../types';

/** Resultado al guardar el diálogo de sedes (migrar renombres en datos). */
export type SedesCatalogSaveResult = {
  entries: SedeCatalogEntry[];
  renames: Record<string, string>;
};

/**
 * Normaliza el catálogo de sedes.
 * Vacío ⇒ [] (nunca inventar sedes; la fuente es Gestión / tenants vía API).
 */
export function normalizeSedesCatalog(
  raw: SystemSettings['sedesCatalog'] | undefined | null
): SedeCatalogEntry[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }
  const first = raw[0];
  if (typeof first === 'string') {
    return (raw as string[]).filter(Boolean).map((name) => ({ name, enabled: true }));
  }
  return (raw as SedeCatalogEntry[])
    .map((e) => ({
      name: typeof e?.name === 'string' ? e.name.trim() : '',
      enabled: e?.enabled !== false,
      tenant_id: typeof e?.tenant_id === 'number' ? e.tenant_id : undefined,
      centro_id: typeof e?.centro_id === 'number' ? e.centro_id : undefined,
    }))
    .filter((e) => e.name.length > 0);
}

export function getSedesCatalogEntries(
  settings?: SystemSettings | null
): SedeCatalogEntry[] {
  return normalizeSedesCatalog(settings?.sedesCatalog);
}

/** Sedes habilitadas: formularios y nuevas asignaciones. */
export function getEnabledSedeNames(settings?: SystemSettings | null): string[] {
  return getSedesCatalogEntries(settings)
    .filter((e) => e.enabled)
    .map((e) => e.name);
}

/** Todas las sedes del catálogo (incl. deshabilitadas): filtros globales y datos históricos. */
export function getAllSedeNames(settings?: SystemSettings | null): string[] {
  return getSedesCatalogEntries(settings).map((e) => e.name);
}

/** @deprecated Preferir getAllSedeNames o getEnabledSedeNames según el caso. */
export function getSedesCatalog(settings?: SystemSettings | null): string[] {
  return getAllSedeNames(settings);
}

export function migrateLocationField(
  loc: string | undefined,
  result: SedesCatalogSaveResult,
  _fallback: string
): string | undefined {
  if (!loc) return undefined;
  return result.renames[loc] ?? loc;
}
