/** Límite de dígitos del documento de identidad según tipo (caja chica). */
export function getDocIdentityDigitLimit(docType: string | undefined): number {
  if (docType === 'RUC') return 11;
  if (docType === 'DNI') return 8;
  return 9; // CE
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
