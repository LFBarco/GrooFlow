import { test, expect } from '@playwright/test';

test.describe('Módulo de usuarios', () => {
  test('ruta /usuarios requiere autenticación', async ({ page }) => {
    await page.goto('/usuarios');
    await expect(page.getByPlaceholder('usuario@empresa.com')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Iniciar Sesion/i })).toBeVisible();
  });

  test('login opcional muestra gestión de usuarios', async ({ page }) => {
    const email = process.env.PLAYWRIGHT_ADMIN_EMAIL;
    const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD;
    test.skip(!email || !password, 'Defina PLAYWRIGHT_ADMIN_EMAIL y PLAYWRIGHT_ADMIN_PASSWORD');

    await page.goto('/');
    await page.getByPlaceholder('usuario@empresa.com').fill(email!);
    await page.getByPlaceholder('••••••••').fill(password!);
    await page.getByRole('button', { name: /Iniciar Sesion/i }).click();

    await page.goto('/usuarios');
    await expect(page.getByTestId('user-manager-header')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /Gestión de Usuarios/i })).toBeVisible();
    await expect(page.getByTestId('user-manager-refresh')).toBeVisible();
  });
});
