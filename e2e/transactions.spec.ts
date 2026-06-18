import { test, expect, type Page } from '@playwright/test';
import { loginAsE2eUser, skipWithoutCredentials } from './helpers/auth';

async function createTransaction(page: Page, marker: string) {
  await page.getByLabel('Monto').fill('150.25');
  await page.getByTestId('transaction-category').click();
  await page.getByRole('option').first().click();

  const conceptInput = page.getByTestId('transaction-concept-input');
  if (await conceptInput.isVisible().catch(() => false)) {
    await conceptInput.fill(marker);
  } else {
    const conceptCombo = page
      .getByTestId('transaction-form')
      .locator('label:has-text("Concepto")')
      .locator('..')
      .getByRole('combobox');
    if (await conceptCombo.isVisible().catch(() => false)) {
      await conceptCombo.click();
      await page.getByRole('option').first().click();
    }
  }

  await page.getByLabel('Nro Operación').fill(marker);
  await page.getByTestId('transaction-submit').click();
}

test.describe('Transacciones E2E', () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutCredentials();
    await loginAsE2eUser(page);
  });

  test('crear transacción y persiste tras recarga', async ({ page }) => {
    const marker = `E2E-TX-${Date.now().toString(36).slice(-6).toUpperCase()}`;

    await page.goto('/transacciones');
    await expect(page.getByTestId('transactions-module')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('transaction-form')).toBeVisible();

    await createTransaction(page, marker);

    await expect(page.getByTestId('transactions-list').getByText(marker)).toBeVisible({
      timeout: 25_000,
    });

    await page.reload();
    await expect(page.getByTestId('transactions-module')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('transactions-list').getByText(marker)).toBeVisible({
      timeout: 25_000,
    });
  });

  test('eliminar transacción E2E y no reaparece tras recarga', async ({ page }) => {
    const marker = `E2E-DEL-${Date.now().toString(36).slice(-6).toUpperCase()}`;

    await page.goto('/transacciones');
    await expect(page.getByTestId('transactions-module')).toBeVisible({ timeout: 30_000 });
    await createTransaction(page, marker);
    await expect(page.getByTestId('transactions-list').getByText(marker)).toBeVisible({
      timeout: 25_000,
    });

    const row = page.getByTestId('transactions-list').locator('tr').filter({ hasText: marker });
    page.once('dialog', (dialog) => void dialog.accept());
    await row.getByRole('button', { name: 'Eliminar transacción' }).click();

    await expect(page.getByTestId('transactions-list').getByText(marker)).not.toBeVisible({
      timeout: 25_000,
    });

    await page.reload();
    await expect(page.getByTestId('transactions-module')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('transactions-list').getByText(marker)).not.toBeVisible({
      timeout: 15_000,
    });
  });
});
