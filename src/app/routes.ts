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
