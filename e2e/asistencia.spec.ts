import { test, expect } from '@playwright/test';
import { loginAsE2eUser, skipWithoutCredentials } from './helpers/auth';

test.describe('Asistencia E2E', () => {
  test.beforeEach(async ({ page }) => {
    skipWithoutCredentials();
    await loginAsE2eUser(page);
  });

  test('carga el módulo operativo', async ({ page }) => {
    await page.goto('/asistencia');
    await expect(page.getByTestId('asistencia-module')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /Panel de dotación operativa/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Operativa en vivo/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Dashboard Buk/i })).toBeVisible();
  });

  test('agregar personal en configuración persiste tras recarga', async ({ page }) => {
    const staffName = `E2E Staff ${Date.now().toString(36).slice(-5)}`;
    const rut = `${Math.floor(10_000_000 + Math.random() * 8_999_999)}-${Math.floor(Math.random() * 9)}`;

    await page.goto('/asistencia');
    await expect(page.getByTestId('asistencia-module')).toBeVisible({ timeout: 30_000 });

    const configTab = page.getByTestId('asistencia-tab-config');
    if (!(await configTab.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'El usuario E2E no tiene permisos de administrador para configurar asistencia');
    }

    await configTab.click();
    await page.getByTestId('asistencia-add-staff').click();

    await page.getByTestId('asistencia-staff-name').fill(staffName);
    await page.getByTestId('asistencia-staff-rut').fill(rut);
    await page.getByTestId('asistencia-staff-save').click();

    await expect(page.getByText(staffName)).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.getByTestId('asistencia-module')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('asistencia-tab-config').click();
    await expect(page.getByText(staffName)).toBeVisible({ timeout: 20_000 });
  });
});
