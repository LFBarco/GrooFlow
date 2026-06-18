import { test, expect } from '@playwright/test';
import { loginAsE2eUser, skipWithoutCredentials, waitForCloudSynced } from './helpers/auth';
import {
  registerPettyCashExpense,
  resolvePettyCashProvider,
} from './helpers/pettyCash';

test.describe('Caja chica E2E', () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutCredentials();
    await loginAsE2eUser(page);
    await waitForCloudSynced(page);
  });

  test('registrar gasto y persiste tras recarga', async ({ page }) => {
    const provider = await resolvePettyCashProvider(page);
    test.skip(
      !provider,
      'Define E2E_PETTY_RUC (11 dígitos) o ten al menos un proveedor RUC con motivos de caja chica'
    );

    const marker = `E2E-CC-${Date.now().toString(36).slice(-6).toUpperCase()}`;
    await registerPettyCashExpense(page, provider!, marker);

    await page.reload();
    await expect(page.getByTestId('petty-cash-module')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(marker)).toBeVisible({ timeout: 25_000 });
  });
});

test.describe('Reinicio custodio caja chica E2E', () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutCredentials();
    await loginAsE2eUser(page);
    await waitForCloudSynced(page);
  });

  test('admin puede abrir diálogo de reinicio en configuración', async ({ page }) => {
    const custodianId = process.env.E2E_PETTY_RESET_USER_ID;
    test.skip(!custodianId, 'Define E2E_PETTY_RESET_USER_ID para probar reinicio de custodio');

    await page.goto('/configuracion');
    await page.getByRole('tab', { name: 'Contabilidad' }).click();
    await expect(page.getByTestId(`petty-cash-reset-${custodianId}`)).toBeVisible({
      timeout: 20_000,
    });
  });
});
