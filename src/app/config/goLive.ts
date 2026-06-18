/**
 * Módulos fuera del go-live inicial (ocultos en menú salvo super-admin).
 * Quitar un módulo de esta lista cuando esté listo para producción.
 *
 * Nota: la tabla/KV `requisitions` no tiene UI propia; las solicitudes de compra
 * usan `data:requests` y el módulo Compras.
 */
export const GO_LIVE_EXCLUDED_MODULES = [
  'Tesorería',
  'Honorarios',
  'Productos',
  'Compras',
] as const;

export type GoLiveExcludedModule = (typeof GO_LIVE_EXCLUDED_MODULES)[number];

export function isGoLiveExcludedModule(moduleName: string): boolean {
  return (GO_LIVE_EXCLUDED_MODULES as readonly string[]).includes(moduleName);
}

/** Tesorería activa en el go-live actual (facturas proyectadas en flujo de caja, etc.). */
export function goLiveIncludesTreasury(): boolean {
  return !isGoLiveExcludedModule('Tesorería');
}

/** Fuentes de alertas ligadas a módulos aún no desplegados. */
export function goLiveAlertSources(): { invoices: boolean; purchaseRequests: boolean } {
  return {
    invoices: !isGoLiveExcludedModule('Tesorería'),
    purchaseRequests: !isGoLiveExcludedModule('Compras'),
  };
}
