/**
 * Herramientas destructivas (stress test) solo en desarrollo,
 * o en producción si VITE_ALLOW_STRESS_TEST=true (nunca en Hostinger normal).
 */
export function isStressTestEnabled(): boolean {
  if (import.meta.env.VITE_ALLOW_STRESS_TEST === 'true') return true;
  if (import.meta.env.PROD) return false;
  return true;
}
