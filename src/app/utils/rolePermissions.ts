import type { Role } from '../components/users/types';
import { VIEW_TO_PATH, VIEW_REQUIRED_MODULE, VIEW_REDIRECT_PRIORITY } from '../routes';

/**
 * Módulos que antes quedaban bajo el permiso genérico "Finanzas".
 * Si el rol tiene `Finanzas: true` (datos antiguos), conservan acceso a estos.
 * Incluye Caja Chica (antes omitido y los usuarios "solo Finanzas" perdían caja chica).
 */
export const FINANCE_CHILD_MODULES = [
  'Tesorería',
  'Transacciones',
  'Flujo de Caja',
  'Estado de Resultados',
  'Honorarios',
  'Cuentas por Pagar',
  'Caja Chica',
  'Contabilidad',
  'Reportes',
] as const;

/** ¿Este módulo se concedía implícitamente con "Finanzas"? */
export function isFinanceChildModule(moduleName: string): boolean {
  return (FINANCE_CHILD_MODULES as readonly string[]).includes(moduleName);
}

/**
 * Acceso a un módulo del menú / vista.
 * - Permiso explícito del módulo, o
 * - "Finanzas" para hijos financieros (compatibilidad), o
 * - "Compras" para "Requerimientos" (antes iban juntos).
 */
export function roleHasModuleAccess(
  permissions: Record<string, boolean> | undefined,
  moduleName: string
): boolean {
  if (!permissions) return false;
  if (permissions[moduleName] === true) return true;
  /** Antes “Alertas” dependía de Dashboard. */
  if (moduleName === 'Alertas' && permissions['Dashboard'] === true) return true;
  if (permissions['Finanzas'] === true && isFinanceChildModule(moduleName)) return true;
  if (moduleName === 'Requerimientos' && permissions['Compras'] === true) return true;
  return false;
}

export function roleRecordHasModuleAccess(role: Role | undefined | null, moduleName: string): boolean {
  return roleHasModuleAccess(role?.permissions, moduleName);
}

/**
 * Primer módulo permitido (para redirigir si la URL pide un módulo bloqueado).
 */
export function getFirstAllowedViewPath(
  userRole: Role | undefined | null,
  isSuper: boolean
): string {
  if (isSuper) return VIEW_TO_PATH.dashboard;
  for (const v of VIEW_REDIRECT_PRIORITY) {
    const mod = VIEW_REQUIRED_MODULE[v];
    if (mod && roleRecordHasModuleAccess(userRole, mod)) {
      return VIEW_TO_PATH[v];
    }
  }
  return VIEW_TO_PATH.dashboard;
}
