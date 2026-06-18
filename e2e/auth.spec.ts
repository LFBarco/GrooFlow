import { test, expect } from '@playwright/test';
import { expectLoginScreen } from './helpers/auth';

test.describe('Autenticación', () => {
  test('muestra formulario de login en la raíz', async ({ page }) => {
    await page.goto('/');
    await expectLoginScreen(page);
  });
});
