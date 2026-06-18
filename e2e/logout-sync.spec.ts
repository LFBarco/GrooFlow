import { test, expect } from '@playwright/test';
import {
  loginAsE2eUser,
  logoutFromApp,
  skipWithoutCredentials,
  waitForCloudSynced,
} from './helpers/auth';

async function createQuickTransaction(page: import('@playwright/test').Page, marker: string) {
  await page.goto('/transacciones');
  await expect(page.getByTestId('transactions-module')).toBeVisible({ timeout: 30_000 });
  await page.getByLabel('Monto').fill('75.5');
  await page.getByTestId('transaction-category').click();
  await page.getByRole('option').first().click();
  const conceptInput = page.getByTestId('transaction-concept-input');
  if (await conceptInput.isVisible().catch(() => false)) {
    await conceptInput.fill(marker);
  }
  await page.getByLabel('Nro Operación').fill(marker);
  await page.getByTestId('transaction-submit').click();
  await expect(page.getByTestId('transactions-list').getByText(marker)).toBeVisible({
    timeout: 25_000,
  });
}

test.describe('Logout y sincronización E2E', () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutCredentials();
    await loginAsE2eUser(page);
    await waitForCloudSynced(page);
  });

  test('cerrar sesión vuelve al login', async ({ page }) => {
    await expect(page.getByTestId('app-authenticated')).toBeVisible();
    await logoutFromApp(page);
  });

  test('indicador nube llega a estado estable tras login', async ({ page }) => {
    const indicator = page.getByTestId('cloud-sync-indicator').first();
    await expect(indicator).toBeVisible();
    await expect(indicator).not.toContainText(/Cargando|Guardando/i, { timeout: 30_000 });
  });

  test('transacción persiste tras logout y nuevo login', async ({ page }) => {
    const marker = `E2E-LOG-${Date.now().toString(36).slice(-6).toUpperCase()}`;
    await createQuickTransaction(page, marker);
    await waitForCloudSynced(page);

    await logoutFromApp(page);
    await loginAsE2eUser(page);
    await waitForCloudSynced(page);

    await page.goto('/transacciones');
    await expect(page.getByTestId('transactions-list').getByText(marker)).toBeVisible({
      timeout: 30_000,
    });
  });
});
