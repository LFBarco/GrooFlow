import type { Provider, ProviderDocIdentityType } from '../types';

/** Valores por defecto: un proveedor “sirve” para todos los flujos salvo que se desmarque. */
/** Tipo de documento para listados y caja chica. Sin tipo guardado: infiere RUC/ DNI/ CE por longitud. */
export function getProviderDocumentLabel(
  p: Pick<Provider, 'ruc' | 'docIdentityType'>,
): ProviderDocIdentityType {
  if (p.docIdentityType) return p.docIdentityType;
  const d = String(p.ruc ?? '').replace(/\D/g, '');
  if (d.length === 8) return 'DNI';
  if (d.length === 9) return 'CE';
  return 'RUC';
}

export const DEFAULT_PROVIDER_USAGE_CONTEXTS = {
  pettyCash: true,
  purchases: true,
  professionalFees: true,
} as const;

/**
 * Unifica el objeto guardado (puede faltar o venir parcial de datos antiguos).
 * Cada bandera: `true` salvo `false` explícito.
 */
export function mergeProviderUsageContexts(
  u?: Provider['usageContexts'],
): { pettyCash: boolean; purchases: boolean; professionalFees: boolean } {
  return {
    pettyCash: u?.pettyCash !== false,
    purchases: u?.purchases !== false,
    professionalFees: u?.professionalFees !== false,
  };
}

export type ProviderLedgerHint = 'general' | 'purchase' | 'professionalFee';

/**
 * Código de cuenta (N5) sugerido según el módulo. Requisición de compras e honorarios
 * pueden asignar cuenta dedicada; si no, se usa `accountingAccount` general.
 */
export function getProviderSuggestedExpenseCode(
  p: Pick<Provider, 'accountingAccount' | 'defaultPurchaseAccount' | 'defaultProfessionalFeeAccount'>,
  hint: ProviderLedgerHint,
): string | undefined {
  // Política actual: una sola cuenta global del proveedor para todos los módulos.
  // Se mantiene la firma con `hint` por compatibilidad.
  if (hint === 'purchase' || hint === 'professionalFee' || hint === 'general') {
    return p.accountingAccount?.trim() || undefined;
  }
  return p.accountingAccount?.trim() || undefined;
}
