import type { AccountingLinkSettings, BankAccountConfig } from '../types';

export function getBankAccounts(accounting?: AccountingLinkSettings | null): BankAccountConfig[] {
  return Array.isArray(accounting?.bankAccounts) ? accounting.bankAccounts : [];
}

export function getPrimaryBankAccount(
  accounts: BankAccountConfig[]
): BankAccountConfig | undefined {
  return accounts.find((a) => a.isPrimary) ?? accounts[0];
}

export function formatBankAccountLabel(account: BankAccountConfig): string {
  const curr = account.currency === 'USD' ? 'USD' : 'PEN';
  return `${account.bankName} — ${account.accountNumber} (${curr})`;
}

export function resolveBankAccount(
  accounts: BankAccountConfig[],
  ref?: string
): BankAccountConfig | undefined {
  if (!ref?.trim()) return undefined;
  const key = ref.trim().toLowerCase();
  return (
    accounts.find((a) => a.id === ref) ??
    accounts.find((a) => a.accountNumber.toLowerCase() === key) ??
    accounts.find((a) => formatBankAccountLabel(a).toLowerCase() === key) ??
    accounts.find(
      (a) =>
        a.bankName.toLowerCase() === key ||
        `${a.bankName} ${a.accountNumber}`.toLowerCase() === key
    )
  );
}

/** Garantiza una sola cuenta principal. */
export function normalizeBankAccountsPrimary(
  accounts: BankAccountConfig[],
  primaryId?: string
): BankAccountConfig[] {
  if (accounts.length === 0) return [];
  const pid =
    primaryId ??
    accounts.find((a) => a.isPrimary)?.id ??
    accounts[0].id;
  return accounts.map((a) => ({ ...a, isPrimary: a.id === pid }));
}

export function mergeBankAccounts(
  partial?: BankAccountConfig[] | null
): BankAccountConfig[] {
  if (!Array.isArray(partial)) return [];
  return normalizeBankAccountsPrimary(
    partial.filter(
      (a) =>
        a &&
        typeof a === 'object' &&
        typeof a.id === 'string' &&
        typeof a.bankName === 'string' &&
        typeof a.accountNumber === 'string'
    )
  );
}
