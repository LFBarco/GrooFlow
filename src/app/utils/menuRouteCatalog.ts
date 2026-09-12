import { VIEW_REQUIRED_MODULE, VIEW_TO_PATH, type ViewType, normalizeAppPath } from '../routes';

/** Alias de rutas que los admins suelen escribir en Configuración de menú. */
const ROUTE_ALIASES: Record<string, string> = {
  '/compras': '/solicitudes',
  '/compra': '/solicitudes',
  '/requerimientos': '/solicitudes',
  '/solicitudes-compra': '/solicitudes',
  '/provider': '/proveedores',
  '/providers': '/proveedores',
  '/producto': '/productos',
  '/products': '/productos',
};

const LABEL_TO_PATH: Record<string, string> = {
  proveedores: '/proveedores',
  compras: '/solicitudes',
  'solicitudes de compra': '/solicitudes',
  productos: '/productos',
  transacciones: '/transacciones',
  'flujo de caja': '/flujo-caja',
  'caja chica': '/caja-chica',
  honorarios: '/honorarios',
  tesoreria: '/tesoreria',
  tesorería: '/tesoreria',
  contabilidad: '/contabilidad',
  conciliacion: '/conciliacion',
  conciliación: '/conciliacion',
  dashboard: '/',
  alertas: '/alertas',
  analitica: '/analitica',
  analítica: '/analitica',
  reportes: '/reportes',
  'estado de resultados': '/estado-resultados',
  auditoria: '/auditoria',
  auditoría: '/auditoria',
  configuracion: '/configuracion',
  configuración: '/configuracion',
  'marketing eventos': '/marketing-eventos',
  'cursos mkt': '/marketing-eventos',
};

function normalizeLabelKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/** Normaliza ruta de menú (sin basename /grooflow) y aplica alias canónicos. */
export function canonicalizeMenuRoute(route: string): string {
  let normalized = normalizeAppPath((route || '/').trim());
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  normalized = normalized.replace(/\/$/, '') || '/';
  return ROUTE_ALIASES[normalized] ?? normalized;
}

export function knownMenuRoutes(): string[] {
  return Object.values(VIEW_TO_PATH).slice().sort((a, b) => a.localeCompare(b));
}

export function isKnownMenuRoute(route: string): boolean {
  const canonical = canonicalizeMenuRoute(route);
  return Object.values(VIEW_TO_PATH).includes(canonical);
}

export function moduloKeyForMenuRoute(route: string): string | null {
  const canonical = canonicalizeMenuRoute(route);
  const entry = (Object.entries(VIEW_TO_PATH) as [ViewType, string][]).find(([, path]) => path === canonical);
  if (!entry) return null;
  const mod = VIEW_REQUIRED_MODULE[entry[0]];
  return mod?.trim() ? mod : null;
}

/** Sugiere ruta canónica a partir del nombre visible. */
export function suggestMenuRouteFromLabel(label: string): string {
  const key = normalizeLabelKey(label);
  if (LABEL_TO_PATH[key]) return LABEL_TO_PATH[key];
  const compact = key.replace(/[^a-z0-9]+/g, ' ').trim();
  if (LABEL_TO_PATH[compact]) return LABEL_TO_PATH[compact];

  const slug = key
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) return '/';
  const guessed = `/${slug}`;
  return canonicalizeMenuRoute(guessed);
}

/**
 * Prepara ruta + modulo_key antes de guardar.
 * Devuelve error legible si la ruta no existe en la app.
 */
export function prepareMenuLeafRoute(input: {
  ruta: string;
  texto?: string;
  modulo_key?: string | null;
}): { ruta: string; modulo_key: string } | { error: string } {
  const raw = (input.ruta || '').trim();
  if (!raw || raw === '/') {
    return { error: 'La ruta es obligatoria (ej. /proveedores o /solicitudes).' };
  }
  const ruta = canonicalizeMenuRoute(raw);
  if (!isKnownMenuRoute(ruta)) {
    const hint =
      /compra/i.test(input.texto ?? raw)
        ? ' Para Compras usa /solicitudes.'
        : /proveedor/i.test(input.texto ?? raw)
          ? ' Para Proveedores usa /proveedores.'
          : '';
    return {
      error: `La ruta "${raw}" no existe en GrooFlow.${hint} Elige una del listado o usa la varita mágica.`,
    };
  }
  const fromRoute = moduloKeyForMenuRoute(ruta);
  const modulo_key = (input.modulo_key || '').trim() || fromRoute || (input.texto || '').trim();
  if (!modulo_key) {
    return { error: 'No se pudo determinar el módulo (modulo_key) para esta ruta.' };
  }
  return { ruta, modulo_key };
}
