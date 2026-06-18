import { test, expect } from '@playwright/test';
import { loginAsE2eUser, skipWithoutCredentials } from './helpers/auth';

test.describe('Inventario E2E', () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutCredentials();
    await loginAsE2eUser(page);
  });

  test('crear equipo y persiste tras recarga', async ({ page }) => {
    const equipmentName = `E2E Equipo ${Date.now().toString(36).slice(-6)}`;

    await page.goto('/inventario-equipos');
    await expect(page.getByTestId('inventory-module')).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('inventory-tab-equipment').click();
    await page.getByTestId('inventory-add-equipment').click();
    await expect(page.getByTestId('equipment-name-input')).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('equipment-name-input').fill(equipmentName);
    await page.getByTestId('equipment-save').click();

    await expect(page.getByText(equipmentName)).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.getByTestId('inventory-module')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('inventory-tab-equipment').click();
    await expect(page.getByText(equipmentName)).toBeVisible({ timeout: 20_000 });
  });
});
