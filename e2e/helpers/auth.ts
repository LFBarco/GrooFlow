import { expect, test, type Page } from '@playwright/test';

/** Credenciales E2E: E2E_EMAIL/E2E_PASSWORD o alias PLAYWRIGHT_ADMIN_* */
export function getE2eCredentials() {
  const email = process.env.E2E_EMAIL ?? process.env.PLAYWRIGHT_ADMIN_EMAIL;
  const password = process.env.E2E_PASSWORD ?? process.env.PLAYWRIGHT_ADMIN_PASSWORD;
  return { email, password, hasCreds: Boolean(email && password) };
}

export function skipWithoutCredentials() {
  const { hasCreds } = getE2eCredentials();
  test.skip(
    !hasCreds,
    'Define E2E_EMAIL y E2E_PASSWORD (o PLAYWRIGHT_ADMIN_EMAIL y PLAYWRIGHT_ADMIN_PASSWORD)'
  );
}

export async function loginAsE2eUser(page: Page) {
  const { email, password } = getE2eCredentials();
  if (!email || !password) {
    throw new Error('Faltan credenciales E2E');
  }
  await page.goto('/');
  await page.getByPlaceholder('usuario@empresa.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: /Iniciar Sesion/i }).click();
  await page.waitForURL(
    /\/(dashboard|inicio|flota|transacciones|productos|alertas|asistencia|inventario|proveedores|caja-chica)/i,
    { timeout: 45_000 }
  );
}

export async function expectLoginScreen(page: Page) {
  await expect(page.getByPlaceholder('usuario@empresa.com')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /Iniciar Sesion/i })).toBeVisible();
}

export async function logoutFromApp(page: Page) {
  await page.getByTestId('user-menu-trigger').click();
  await page.getByTestId('user-menu-logout').click();
  await expectLoginScreen(page);
}

/** Espera a que la nube deje de cargar/guardar (estado estable). */
export async function waitForCloudSynced(page: Page) {
  await expect(page.getByTestId('app-authenticated')).toBeVisible({ timeout: 30_000 });
  const indicator = page.getByTestId('cloud-sync-indicator').first();
  await expect(indicator).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(
      async () => {
        const text = (await indicator.textContent()) ?? '';
        return text.includes('Sincronizado') || text.includes('Nube');
      },
      { timeout: 45_000, intervals: [500, 1000, 2000] }
    )
    .toBe(true);
  await expect(indicator).not.toContainText(/Cargando|Guardando/i, { timeout: 30_000 });
}

/** Rutas protegidas que deben redirigir al login sin sesión */
export const PROTECTED_ROUTES = [
  { path: '/productos', label: 'Productos' },
  { path: '/inventario-equipos', label: 'Inventario' },
  { path: '/asistencia', label: 'Asistencia' },
  { path: '/flota-clinica', label: 'Flota' },
  { path: '/usuarios', label: 'Usuarios' },
] as const;
