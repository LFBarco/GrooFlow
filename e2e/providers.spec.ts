import { test, expect } from '@playwright/test';
import { loginAsE2eUser, skipWithoutCredentials, waitForCloudSynced } from './helpers/auth';

/** RUC de 11 dígitos único por corrida E2E. */
function uniqueE2eRuc(): string {
  const tail = Date.now().toString().slice(-9);
  return `20${tail}`.slice(0, 11);
}

test.describe('Proveedores E2E', () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutCredentials();
    await loginAsE2eUser(page);
    await waitForCloudSynced(page);
  });

  test('alta rápida caja chica persiste tras recarga', async ({ page }) => {
    const marker = `E2E-PROV-${Date.now().toString(36).slice(-6).toUpperCase()}`;
    const ruc = uniqueE2eRuc();

    await page.goto('/proveedores');
    await expect(page.getByTestId('providers-module')).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('providers-simple-petty-open').click();
    await expect(page.getByTestId('providers-simple-petty-dialog')).toBeVisible();

    await page.getByTestId('provider-simple-ruc').fill(ruc);
    await page.getByTestId('provider-simple-name').fill(marker);
    await page.getByTestId('provider-simple-save').click();

    await expect(page.getByTestId('providers-list').getByText(marker)).toBeVisible({
      timeout: 25_000,
    });

    await page.reload();
    await expect(page.getByTestId('providers-module')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('providers-list').getByText(marker)).toBeVisible({
      timeout: 25_000,
    });
  });

  test('búsqueda filtra proveedor recién creado', async ({ page }) => {
    const marker = `E2E-SRCH-${Date.now().toString(36).slice(-6).toUpperCase()}`;
    const ruc = uniqueE2eRuc();

    await page.goto('/proveedores');
    await expect(page.getByTestId('providers-module')).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('providers-simple-petty-open').click();
    await page.getByTestId('provider-simple-ruc').fill(ruc);
    await page.getByTestId('provider-simple-name').fill(marker);
    await page.getByTestId('provider-simple-save').click();
    await expect(page.getByTestId('providers-list').getByText(marker)).toBeVisible({
      timeout: 25_000,
    });

    await page.getByTestId('providers-search').fill(marker);
    await expect(page.getByTestId('providers-list').getByText(marker)).toBeVisible();
    await page.getByTestId('providers-search').fill('ZZZ-NO-EXISTE-999');
    await expect(page.getByTestId('providers-list').getByText(marker)).not.toBeVisible();
  });
});
