import { test, expect } from '@playwright/test';
import {
  expectLoginScreen,
  loginAsE2eUser,
  logoutFromApp,
  skipWithoutCredentials,
  waitForCloudSynced,
} from './helpers/auth';

/** Rutas go-live adicionales (complementa routes.spec.ts). */
const GO_LIVE_PROTECTED = [
  { path: '/proveedores', label: 'Proveedores' },
  { path: '/transacciones', label: 'Transacciones' },
  { path: '/caja-chica', label: 'Caja chica' },
  { path: '/configuracion', label: 'Configuración' },
] as const;

test.describe('Transversales go-live (E2E)', () => {
  test('T6 login / logout / login', async ({ page }) => {
    skipWithoutCredentials();
    await loginAsE2eUser(page);
    await expect(page.getByTestId('app-authenticated')).toBeVisible();
    await logoutFromApp(page);
    await loginAsE2eUser(page);
    await expect(page.getByTestId('app-authenticated')).toBeVisible();
  });

  test('T8 indicador nube estable tras login', async ({ page }) => {
    skipWithoutCredentials();
    await loginAsE2eUser(page);
    await waitForCloudSynced(page);
    const indicator = page.getByTestId('cloud-sync-indicator').first();
    await expect(indicator).not.toContainText(/Cargando|Guardando/i, { timeout: 30_000 });
  });

  for (const route of GO_LIVE_PROTECTED) {
    test(`T7 ${route.label} redirige al login sin sesión`, async ({ page }) => {
      await page.goto(route.path);
      await expectLoginScreen(page);
    });
  }

  test('T4 modo offline muestra app autenticada (indicador presente)', async ({ page, context }) => {
    skipWithoutCredentials();
    await loginAsE2eUser(page);
    await waitForCloudSynced(page);
    await context.setOffline(true);
    await expect(page.getByTestId('app-authenticated')).toBeVisible();
    await context.setOffline(false);
  });
});
