import type { ProviderDocIdentityType } from '../types';

/** Límite de dígitos del documento de identidad según tipo (caja chica). */
export function getDocIdentityDigitLimit(docType: string | undefined): number {
  if (docType === 'RUC') return 11;
  if (docType === 'DNI') return 8;
  return 9; // CE
}

/** Resuelve tipo de documento priorizando la selección explícita y la longitud del número. */
export function resolveProviderDocIdentityType(
  explicit: ProviderDocIdentityType | undefined,
  digits: string
): ProviderDocIdentityType {
  const len = digits.replace(/\D/g, '').length;
  if (explicit === 'DNI' || explicit === 'CE') return explicit;
  if (len === 8) return 'DNI';
  if (len === 9) return 'CE';
  return explicit ?? 'RUC';
}

/** Compara documentos de proveedor (solo dígitos; tolera ceros a la izquierda). */
export function providerDocDigitsEqual(a: string | undefined, b: string | undefined): boolean {
  const da = String(a ?? '').replace(/\D/g, '');
  const db = String(b ?? '').replace(/\D/g, '');
  if (!da || !db) return false;
  return da === db;
}

export function normalizeDocIdentityDigits(raw: string, docType: string | undefined): string {
  const max = getDocIdentityDigitLimit(docType);
  return String(raw ?? '')
    .replace(/\D/g, '')
    .slice(0, max);
}

export function isCompleteDocIdentity(docType: string | undefined, digitsOnly: string): boolean {
  return digitsOnly.length === getDocIdentityDigitLimit(docType);
}
