/**
 * Espejo de `grooflow_resource_modules($key, write=true)` en el backend.
 * Evita autosaves KV (y toasts) cuando el usuario no puede escribir esa clave.
 */
import { roleHasModuleAccess } from './rolePermissions';

/** Módulos que conceden escritura a cada clave KV. */
export const KV_WRITE_MODULES: Record<string, readonly string[]> = {
  'data:transactions': ['Transacciones'],
  'data:providers': ['Proveedores', 'Compras', 'Honorarios', 'Tesorería'],
  'data:products': ['Productos', 'Compras'],
  'data:requests': ['Compras'],
  'data:requisitions': ['Compras'],
  'data:invoices': ['Cuentas por Pagar', 'Tesorería'],
  'data:pettyCash': ['Caja Chica'],
  'data:pettyCashMeta': ['Caja Chica'],
  'data:feeReceipts': ['Honorarios', 'Tesorería'],
  'data:fleet': ['Gestión Vehicular'],
  'data:inventory': ['Gestión de Inventario'],
  'data:chartOfAccounts': ['Contabilidad'],
  'data:reconciliation': ['Conciliación'],
  'settings:asistencia': ['Asistencia', 'Recursos Humanos'],
  'data:asistencia-snapshots': ['Asistencia', 'Recursos Humanos'],
  'data:asistencia-operational': ['Asistencia', 'Recursos Humanos'],
  'settings:rrhh': ['Recursos Humanos'],
  'settings:turnos': ['Turnos'],
  'settings:accidentes-trabajo': ['Accidentes de Trabajo'],
  'settings:entrega-uniformes': ['Entrega de Uniformes'],
  'data:treasuryUsdBalance': ['Tesorería'],
  'data:treasuryInvoices': ['Tesorería'],
  'data:treasuryBankBalance': ['Tesorería'],
  'data:treasuryPaidHistory': ['Tesorería'],
  'data:treasurySubscriptions': ['Tesorería'],
  'data:treasuryBankMovements': ['Tesorería'],
  'data:monthlyClosures': ['Reportes'],
  'settings:config': ['Configuración'],
  'settings:system': ['Configuración'],
  'settings:theme': ['Configuración'],
  'settings:alertThresholds': ['Configuración'],
  'data:sedes': ['Configuración'],
  'settings:alertReadState': ['Configuración'],
  'data:users': ['Usuarios'],
  'data:roles': ['Usuarios'],
};

const permissionDeniedKeys = new Set<string>();

export function markKvPermissionDenied(kvKey: string): void {
  permissionDeniedKeys.add(kvKey);
}

/** Consume el flag de 403 por permiso (una vez). */
export function takeKvPermissionDenied(kvKey: string): boolean {
  if (!permissionDeniedKeys.has(kvKey)) return false;
  permissionDeniedKeys.delete(kvKey);
  return true;
}

export function isKvPermissionDeniedError(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  if (status === 403) return true;
  const msg = error instanceof Error ? error.message : String(error);
  return /Sin permiso/i.test(msg);
}

/**
 * ¿El usuario actual puede hacer PUT de esta clave?
 * - Super-admin: sí
 * - Sin mapa de permisos aún (REST): no (evita carrera post-login)
 * - Resto: algún módulo de escritura concedido (respeta go-live vía roleHasModuleAccess)
 */
export function canWriteKvKey(
  kvKey: string,
  options: {
    isSuperAdmin: boolean;
    permissions: Record<string, boolean> | null | undefined;
  }
): boolean {
  if (options.isSuperAdmin) return true;
  if (!options.permissions) return false;
  const modules = KV_WRITE_MODULES[kvKey];
  if (!modules || modules.length === 0) return false;
  // Backend: users/roles nunca se escriben por menú; solo admin.
  if (kvKey === 'data:users' || kvKey === 'data:roles') return false;
  if (
    kvKey === 'settings:system' ||
    kvKey === 'settings:asistencia' ||
    kvKey === 'settings:rrhh' ||
    kvKey === 'data:sedes'
  ) {
    return false;
  }
  return modules.some((mod) => roleHasModuleAccess(options.permissions!, mod));
}
