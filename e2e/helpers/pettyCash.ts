import { expect, type Page } from '@playwright/test';

export type PettyCashProviderRef = {
  ruc: string;
  name: string;
};

/** RUC de proveedor con caja chica habilitada (11 dígitos). */
export function getE2ePettyProviderFromEnv(): PettyCashProviderRef | null {
  const ruc = process.env.E2E_PETTY_RUC?.replace(/\D/g, '');
  if (!ruc || ruc.length !== 11) return null;
  return {
    ruc,
    name: process.env.E2E_PETTY_PROVIDER_NAME ?? 'Proveedor E2E',
  };
}

/** Toma el primer proveedor con RUC de 11 dígitos en el directorio. */
export async function discoverPettyCashProvider(page: Page): Promise<PettyCashProviderRef | null> {
  await page.goto('/proveedores');
  await expect(page.getByRole('heading', { name: /Directorio de Proveedores|Proveedores/i })).toBeVisible({
    timeout: 30_000,
  }).catch(() => null);

  const row = page.locator('table tbody tr').filter({ hasText: /\d{11}/ }).first();
  if ((await row.count()) === 0) return null;

  const name = (await row.locator('.font-medium').first().textContent())?.trim();
  const docLine = (await row.locator('.font-mono').first().textContent()) ?? '';
  const ruc = docLine.match(/\d{11}/)?.[0];
  if (!name || !ruc) return null;
  return { ruc, name };
}

export async function resolvePettyCashProvider(page: Page): Promise<PettyCashProviderRef | null> {
  return getE2ePettyProviderFromEnv() ?? (await discoverPettyCashProvider(page));
}

export async function registerPettyCashExpense(
  page: Page,
  provider: PettyCashProviderRef,
  marker: string
) {
  const voucher = `${Date.now().toString().slice(-8)}`;

  await page.goto('/caja-chica');
  await expect(page.getByTestId('petty-cash-module')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('petty-cash-add-expense').click();
  await expect(page.getByTestId('petty-cash-expense-dialog')).toBeVisible();

  await page.getByTestId('petty-cash-expense-dialog').getByText('Área solicitante').locator('..').getByRole('combobox').click();
  await page.getByRole('option').nth(1).click();

  await page.getByTestId('petty-cash-expense-dialog').getByText('Tipo de documento').locator('..').getByRole('combobox').click();
  await page.getByRole('option', { name: 'Recibo Simple' }).click();

  await page.locator('#docNumber').fill(provider.ruc);
  await expect(page.getByTestId('petty-cash-expense-dialog').getByText(/validado|catálogo/i)).toBeVisible({
    timeout: 15_000,
  });

  await page.locator('#docSeries').fill('E2E');
  await page.locator('#voucherNumber').fill(voucher);

  const motivoCombo = page.locator('#category');
  if (await motivoCombo.isVisible().catch(() => false)) {
    await motivoCombo.click();
    await page.getByRole('option').first().click();
  }

  await page.locator('#amountBI').fill('25.50');
  await page.locator('#description').fill(marker);

  await page.getByTestId('petty-cash-submit-expense').click();
  await expect(page.getByText(marker)).toBeVisible({ timeout: 25_000 });
}
