import { test, expect } from '@playwright/test';
import { loginAsE2eUser, skipWithoutCredentials } from './helpers/auth';

test.describe('Flota clínica E2E', () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutCredentials();
    await loginAsE2eUser(page);
  });

  test('crear vehículo y persiste tras recarga', async ({ page }) => {
    const plate = `E2E-${Date.now().toString(36).slice(-5).toUpperCase()}`;

    await page.goto('/flota-clinica');
    await expect(page.getByTestId('fleet-module')).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('fleet-tab-fleet').click();
    await page.getByTestId('fleet-add-vehicle').click();
    await page.getByTestId('fleet-plate-input').fill(plate);
    await page.getByTestId('fleet-brand-input').fill('Toyota');
    await page.getByTestId('fleet-model-input').fill('Hilux E2E');
    await page.getByTestId('fleet-save-vehicle').click();

    await expect(page.getByText(plate)).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.getByTestId('fleet-module')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('fleet-tab-fleet').click();
    await expect(page.getByText(plate)).toBeVisible({ timeout: 20_000 });
  });

  test('eliminar vehículo E2E y no reaparece tras recarga', async ({ page }) => {
    const plate = `DEL-${Date.now().toString(36).slice(-5).toUpperCase()}`;

    await page.goto('/flota-clinica');
    await expect(page.getByTestId('fleet-module')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('fleet-tab-fleet').click();

    await page.getByTestId('fleet-add-vehicle').click();
    await page.getByTestId('fleet-plate-input').fill(plate);
    await page.getByTestId('fleet-brand-input').fill('Nissan');
    await page.getByTestId('fleet-model-input').fill('NP300');
    await page.getByTestId('fleet-save-vehicle').click();
    await expect(page.getByText(plate)).toBeVisible({ timeout: 20_000 });

    page.once('dialog', (dialog) => void dialog.accept());
    const card = page
      .locator('[class*="rounded"]')
      .filter({ hasText: plate })
      .filter({ has: page.getByRole('button', { name: 'Eliminar' }) })
      .first();
    await card.getByRole('button', { name: 'Eliminar' }).click();

    await expect(page.getByText(plate)).not.toBeVisible({ timeout: 20_000 });
    await page.reload();
    await page.getByTestId('fleet-tab-fleet').click();
    await expect(page.getByText(plate)).not.toBeVisible({ timeout: 20_000 });
  });
});
