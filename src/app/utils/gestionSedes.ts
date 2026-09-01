/** Sede canónica alineada con la tabla tenants de Gestión. */

export type GestionSede = {
  tenant_id: number;
  centro_id: number;
  nombre: string;
  slug?: string;
  nombre_codigo?: string;
};

const SEDE_ALIASES: Record<string, string> = {
  petmovil: 'pet movil',
  'pet móvil': 'pet movil',
  chavez: 'jorge chavez',
  'jorge chávez': 'jorge chavez',
  gm: 'memorial',
  'groomers memorial': 'memorial',
};

/** Clave normalizada para deduplicar variantes legacy ("10. Benavides" vs "Benavides"). */
export function normalizeSedeKey(name: string): string {
  let key = name.trim().toLowerCase().replace(/^\d+\.\s*/, '').replace(/\s+/g, ' ');
  return SEDE_ALIASES[key] ?? key;
}

/** Prefiere etiquetas de Gestión con código ("10. Benavides") sobre legacy ("Benavides"). */
export function preferSedeLabel(existing: string, candidate: string): string {
  const a = existing.trim();
  const b = candidate.trim();
  if (!a) return b;
  if (!b) return a;
  const aCoded = /^\d+\.\s*/.test(a);
  const bCoded = /^\d+\.\s*/.test(b);
  if (bCoded && !aCoded) return b;
  if (aCoded && !bCoded) return a;
  if (b.length > a.length) return b;
  return a;
}

/**
 * Opciones de sede para formularios / selects: solo catálogo visible (Gestión),
 * deduplicado. Sin inventar "Principal" ni listas hardcodeadas.
 */
export function buildFormSedeOptions(visibleSedes: string[]): string[] {
  const byKey = new Map<string, string>();
  for (const raw of visibleSedes) {
    const name = raw.trim();
    if (!name) continue;
    const key = normalizeSedeKey(name);
    const prev = byKey.get(key);
    byKey.set(key, prev ? preferSedeLabel(prev, name) : name);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

/**
 * Filtros: mismas opciones que el catálogo visible.
 * Los `extra` (staff/histórico) no agregan sedes nuevas; solo sirven vía resolveCanonicalSedeName.
 */
export function buildFilterSedeOptions(input: {
  visibleSedes: string[];
  extra?: string[];
}): string[] {
  return buildFormSedeOptions(input.visibleSedes);
}

/** Resuelve un nombre legacy al canónico del catálogo visible (tenants). */
export function resolveCanonicalSedeName(name: string, visibleSedes: string[]): string {
  const key = normalizeSedeKey(name);
  const options = buildFormSedeOptions(visibleSedes);
  const match = options.find((s) => normalizeSedeKey(s) === key);
  return match ?? name.trim();
}

/** Catálogo frontend cuando llega data:sedes del API REST. */
export function sedesCatalogFromGestion(gestionSedes: GestionSede[]): { name: string; enabled: boolean }[] {
  return gestionSedes
    .map((s) => ({ name: s.nombre.trim(), enabled: true }))
    .filter((s) => s.name.length > 0);
}
