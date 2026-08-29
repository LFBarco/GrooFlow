/**
 * Rutas de la aplicación. Cada vista tiene una URL para enlaces compartibles y botón atrás.
 */

export type ViewType =
  | 'dashboard'
  | 'transactions'
  | 'cashflow'
  | 'pnl'
  | 'config'
  | 'reports'
  | 'analytics'
  | 'audit'
  | 'providers'
  | 'accounting'
  | 'requests'
  | 'users'
  | 'menuConfig'
  | 'menuAssignment'
  | 'pettycash'
  | 'treasury'
  | 'fees'
  | 'alerts'
  | 'products'
  | 'fleet'
  | 'inventory'
  | 'asistencia'
  | 'turnos'
  | 'accidentes'
  | 'uniformes'
  | 'reconciliation';

/** Path por defecto (raíz) */
export const DEFAULT_VIEW: ViewType = 'dashboard';

/** Hostinger y Vite sirven la app bajo `/grooflow`. En Vercel la URL pública es `/`. */
export const HOSTINGER_BASENAME = '/grooflow';

export function getRouterBasename(pathname?: string): string {
  const path =
    pathname ?? (typeof window !== 'undefined' ? window.location.pathname : HOSTINGER_BASENAME);
  if (path === HOSTINGER_BASENAME || path.startsWith(`${HOSTINGER_BASENAME}/`)) {
    return HOSTINGER_BASENAME;
  }
  return '/';
}

/** Mapa vista → path (una sola ruta por vista) */
export const VIEW_TO_PATH: Record<ViewType, string> = {
  dashboard: '/',
  alerts: '/alertas',
  analytics: '/analitica',
  treasury: '/tesoreria',
  transactions: '/transacciones',
  cashflow: '/flujo-caja',
  pnl: '/estado-resultados',
  reports: '/reportes',
  pettycash: '/caja-chica',
  fees: '/honorarios',
  providers: '/proveedores',
  accounting: '/contabilidad',
  products: '/productos',
  requests: '/solicitudes',
  audit: '/auditoria',
  users: '/usuarios',
  menuConfig: '/config/menu',
  menuAssignment: '/config/asignacion-menu',
  config: '/configuracion',
  fleet: '/flota-clinica',
  inventory: '/inventario-equipos',
  asistencia: '/asistencia',
  turnos: '/turnos',
  accidentes: '/accidentes-trabajo',
  uniformes: '/entrega-uniformes',
  reconciliation: '/conciliacion',
};

/** Path → vista (para leer la URL) */
const PATH_TO_VIEW = Object.fromEntries(
  (Object.entries(VIEW_TO_PATH) as [ViewType, string][]).map(([v, p]) => [p, v])
) as Record<string, ViewType>;

export function pathToView(pathname: string): ViewType {
  let normalized = pathname.replace(/\/$/, '') || '/';
  if (normalized === '/grooflow') normalized = '/';
  else if (normalized.startsWith('/grooflow/')) {
    normalized = normalized.slice('/grooflow'.length) || '/';
  }
  return PATH_TO_VIEW[normalized] ?? DEFAULT_VIEW;
}

export function viewToPath(view: ViewType): string {
  return VIEW_TO_PATH[view];
}

/**
 * Módulo RBAC requerido por vista (alineado con `NavButton` en App).
 * Evita abrir módulos por URL sin el permiso correspondiente.
 */
export const VIEW_REQUIRED_MODULE: Record<ViewType, string> = {
  dashboard: 'Dashboard',
  alerts: 'Alertas',
  analytics: 'Analítica',
  treasury: 'Tesorería',
  transactions: 'Transacciones',
  cashflow: 'Flujo de Caja',
  pnl: 'Estado de Resultados',
  reports: 'Reportes',
  pettycash: 'Caja Chica',
  fees: 'Honorarios',
  providers: 'Proveedores',
  accounting: 'Contabilidad',
  products: 'Productos',
  requests: 'Compras',
  audit: 'Auditoría',
  users: 'Usuarios',
  menuConfig: 'Admin Menú GrooFlow',
  menuAssignment: 'Asignación Menú GrooFlow',
  config: 'Configuración',
  fleet: 'Gestión Vehicular',
  inventory: 'Gestión de Inventario',
  asistencia: 'Asistencia',
  turnos: 'Turnos',
  accidentes: 'Accidentes de Trabajo',
  uniformes: 'Entrega de Uniformes',
  reconciliation: 'Conciliación',
};

/**
 * Orden de búsqueda al redirigir: vistas más "seguras" o centrales primero.
 */
export const VIEW_REDIRECT_PRIORITY: ViewType[] = [
  'dashboard',
  'alerts',
  'pettycash',
  'treasury',
  'transactions',
  'cashflow',
  'pnl',
  'reports',
  'fees',
  'providers',
  'accounting',
  'products',
  'requests',
  'audit',
  'analytics',
  'menuConfig',
  'menuAssignment',
  'config',
  'fleet',
  'inventory',
  'asistencia',
  'turnos',
  'accidentes',
  'uniformes',
  'reconciliation',
];
