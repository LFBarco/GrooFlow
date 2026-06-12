import { test, expect } from '@playwright/test';

test.describe('Autenticación', () => {
  test('muestra formulario de login', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByPlaceholder('usuario@empresa.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: /Iniciar Sesion/i })).toBeVisible();
  });
});
