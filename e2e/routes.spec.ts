import { test, expect } from '@playwright/test';
import { expectLoginScreen, PROTECTED_ROUTES } from './helpers/auth';

test.describe('Rutas protegidas', () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route.label} (${route.path}) redirige al login sin sesión`, async ({ page }) => {
      await page.goto(route.path);
      await expectLoginScreen(page);
    });
  }
});
