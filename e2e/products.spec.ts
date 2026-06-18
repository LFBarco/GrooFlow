import { test, expect } from '@playwright/test';
import { loginAsE2eUser, skipWithoutCredentials } from './helpers/auth';

test.describe('Productos E2E', () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutCredentials();
    await loginAsE2eUser(page);
  });

  test('crear producto y persiste tras recarga', async ({ page }) => {
    const productName = `E2E Producto ${Date.now().toString(36).slice(-6)}`;

    await page.goto('/productos');
    await expect(page.getByTestId('products-module')).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('products-add').click();
    await expect(page.getByTestId('product-workspace')).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('product-name-input').fill(productName);
    await page.getByTestId('product-save').click();

    await expect(page.getByTestId('products-module')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(productName)).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.getByTestId('products-module')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(productName)).toBeVisible({ timeout: 20_000 });
  });
});
