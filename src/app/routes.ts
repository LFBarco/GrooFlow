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
  | 'pettycash'
  | 'treasury'
  | 'fees'
  | 'alerts'
  | 'requisitions';

/** Path por defecto (raíz) */
export const DEFAULT_VIEW: ViewType = 'dashboard';

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
  requisitions: '/requerimientos',
  requests: '/solicitudes',
  audit: '/auditoria',
  users: '/usuarios',
  config: '/configuracion',
};

/** Path → vista (para leer la URL) */
const PATH_TO_VIEW = Object.fromEntries(
  (Object.entries(VIEW_TO_PATH) as [ViewType, string][]).map(([v, p]) => [p, v])
) as Record<string, ViewType>;

export function pathToView(pathname: string): ViewType {
  const normalized = pathname.replace(/\/$/, '') || '/';
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
  requisitions: 'Requerimientos',
  requests: 'Compras',
  audit: 'Auditoría',
  users: 'Usuarios',
  config: 'Configuración',
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
  'requisitions',
  'requests',
  'audit',
  'analytics',
  'users',
  'config',
];
