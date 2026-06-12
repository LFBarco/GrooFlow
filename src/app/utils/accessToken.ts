/** True si el JWT ya expiró (margen corto por desfase de reloj). */
export function isAccessTokenExpired(accessToken: string | undefined, skewSeconds = 15): boolean {
  if (!accessToken) return true;
  try {
    const parts = accessToken.split('.');
    if (parts.length < 2) return true;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const json = atob(b64 + pad);
    const payload = JSON.parse(json) as { exp?: number };
    const exp = typeof payload.exp === 'number' ? payload.exp : 0;
    const now = Date.now() / 1000;
    return now >= exp - skewSeconds;
  } catch {
    return true;
  }
}
