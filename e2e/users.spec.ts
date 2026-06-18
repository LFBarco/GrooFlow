import { test, expect } from '@playwright/test';
import { expectLoginScreen, loginAsE2eUser, skipWithoutCredentials } from './helpers/auth';

test.describe('Módulo de usuarios', () => {
  test('ruta /usuarios requiere autenticación', async ({ page }) => {
    await page.goto('/usuarios');
    await expectLoginScreen(page);
  });

  test('login muestra gestión de usuarios', async ({ page }) => {
    skipWithoutCredentials();
    await loginAsE2eUser(page);

    await page.goto('/usuarios');
    await expect(page.getByTestId('user-manager-header')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /Gestión de Usuarios/i })).toBeVisible();
    await expect(page.getByTestId('user-manager-refresh')).toBeVisible();
  });
});
