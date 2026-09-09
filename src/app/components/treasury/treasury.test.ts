import { describe, expect, it } from 'vitest';
import type { BankAccountConfig } from '../../types';

interface AccountTransfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  reference?: string;
  status: 'completed' | 'cancelled';
}

function processAccountTransfer(
  accounts: BankAccountConfig[],
  transfer: AccountTransfer
): { success: boolean; error?: string } {
  if (transfer.amount <= 0) return { success: false, error: 'El monto debe ser mayor a cero' };
  if (transfer.fromAccountId === transfer.toAccountId) {
    return { success: false, error: 'La cuenta de origen y destino no pueden ser iguales' };
  }
  const fromAcc = accounts.find((a) => a.id === transfer.fromAccountId);
  const toAcc = accounts.find((a) => a.id === transfer.toAccountId);
  if (!fromAcc || !toAcc) return { success: false, error: 'Cuenta no encontrada' };
  if (fromAcc.currency !== toAcc.currency) {
    return { success: false, error: 'No se puede transferir directamente entre monedas distintas' };
  }
  return { success: true };
}

describe('Treasury Module', () => {
  const accounts: BankAccountConfig[] = [
    { id: 'bcp-pen', bankName: 'BCP', accountNumber: '191-1234567-0-01', currency: 'PEN', isPrimary: true },
    { id: 'bbva-pen', bankName: 'BBVA', accountNumber: '0011-0123-0100012345', currency: 'PEN' },
    { id: 'bcp-usd', bankName: 'BCP USD', accountNumber: '191-9876543-1-02', currency: 'USD' },
  ];

  it('identifica correctamente la cuenta principal', () => {
    const primary = accounts.find((a) => a.isPrimary);
    expect(primary).toBeDefined();
    expect(primary?.id).toBe('bcp-pen');
  });

  it('permite transferencia válida entre cuentas de la misma moneda', () => {
    const transfer: AccountTransfer = {
      id: 'tr-1',
      fromAccountId: 'bcp-pen',
      toAccountId: 'bbva-pen',
      amount: 1500,
      date: '2026-09-08',
    };
    const result = processAccountTransfer(accounts, transfer);
    expect(result.success).toBe(true);
  });

  it('rechaza transferencia entre la misma cuenta', () => {
    const transfer: AccountTransfer = {
      id: 'tr-2',
      fromAccountId: 'bcp-pen',
      toAccountId: 'bcp-pen',
      amount: 500,
      date: '2026-09-08',
    };
    const result = processAccountTransfer(accounts, transfer);
    expect(result.success).toBe(false);
    expect(result.error).toContain('iguales');
  });

  it('rechaza transferencia entre distintas monedas (PEN vs USD)', () => {
    const transfer: AccountTransfer = {
      id: 'tr-3',
      fromAccountId: 'bcp-pen',
      toAccountId: 'bcp-usd',
      amount: 500,
      date: '2026-09-08',
    };
    const result = processAccountTransfer(accounts, transfer);
    expect(result.success).toBe(false);
    expect(result.error).toContain('monedas distintas');
  });

  it('rechaza transferencia con monto cero o negativo', () => {
    const transfer: AccountTransfer = {
      id: 'tr-4',
      fromAccountId: 'bcp-pen',
      toAccountId: 'bbva-pen',
      amount: 0,
      date: '2026-09-08',
    };
    const result = processAccountTransfer(accounts, transfer);
    expect(result.success).toBe(false);
    expect(result.error).toContain('mayor a cero');
  });
});
