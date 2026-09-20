import type { Provider } from '../types';

/**
 * Cuentas contables típicas de mantenimiento / servicios de flota (prefijos o códigos exactos).
 * Ampliable desde Configuración más adelante; hoy cubre el criterio operativo.
 */
export const FLEET_MAINTENANCE_ACCOUNT_HINTS = [
  '634', // Mantenimiento y reparaciones (PCGE frecuente)
  '635',
  '636',
  '659',
  '63',
];

const FLEET_WORKSHOP_KEYWORDS =
  /taller|mec[aá]nic|repuesto|llanta|neum[aá]tic|lubric|aceite|flota|veh[ií]cul|automotr|soat|gr[uú]a|carrocer|electricidad\s*auto|mantenimiento\s*(veh|auto|flota)/i;

function normalizeAccountCode(raw?: string | null): string {
  return String(raw ?? '').replace(/\D+/g, '');
}

/** ¿La cuenta del proveedor encaja con mantenimiento de vehículos? */
export function providerAccountLooksLikeFleetMaintenance(account?: string | null): boolean {
  const code = normalizeAccountCode(account);
  if (!code) return false;
  return FLEET_MAINTENANCE_ACCOUNT_HINTS.some(
    (hint) => code === hint || code.startsWith(hint)
  );
}

/**
 * Proveedores aptos como «Taller» en Flota.
 * Criterio híbrido (recomendado en prod):
 * 1) Cuenta contable de gasto tipo mantenimiento/servicios
 * 2) Nombre / categoría / área con palabras de taller-flota
 */
export function isFleetWorkshopProvider(p: Provider): boolean {
  if (providerAccountLooksLikeFleetMaintenance(p.accountingAccount)) return true;
  if (providerAccountLooksLikeFleetMaintenance(p.defaultPurchaseAccount)) return true;
  const blob = [p.name, String(p.category ?? ''), p.area, p.specialty, p.type]
    .filter(Boolean)
    .join(' ');
  return FLEET_WORKSHOP_KEYWORDS.test(blob);
}

export function fleetWorkshopProviders(providers: Provider[]): Provider[] {
  return providers
    .filter(isFleetWorkshopProvider)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
