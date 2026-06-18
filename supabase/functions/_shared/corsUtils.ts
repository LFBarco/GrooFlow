/** Orígenes permitidos (lista separada por comas en ALLOWED_ORIGINS). Vacío = permitir cualquiera. */
export function parseAllowedOrigins(): string[] {
  return (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function normalizeOrigin(origin: string): string {
  return origin.endsWith('/') ? origin.slice(0, -1) : origin
}

/** Acepta previews de Vercel del mismo proyecto cuando el origen de producción está en la lista. */
export function isOriginAllowed(origin: string, allowed: string[]): boolean {
  const normalized = normalizeOrigin(origin)
  if (allowed.includes(normalized)) return true
  const hasGrooflowProd = allowed.some((o) => normalizeOrigin(o) === 'https://grooflow.vercel.app')
  if (hasGrooflowProd && /^https:\/\/grooflow[a-z0-9-]*\.vercel\.app$/i.test(normalized)) {
    return true
  }
  return false
}

/**
 * Origen a reflejar en Access-Control-Allow-Origin.
 * null = no enviar cabecera (bloquea cross-origin en navegador).
 */
export function resolveCorsAllowOrigin(req: Request): string | null {
  const allowed = parseAllowedOrigins()
  const origin = req.headers.get('Origin')
  if (allowed.length === 0) return origin ?? '*'
  if (!origin) return null
  return isOriginAllowed(origin, allowed) ? normalizeOrigin(origin) : null
}

export function isCorsPreflightAllowed(req: Request): boolean {
  const allowed = parseAllowedOrigins()
  if (allowed.length === 0) return true
  const origin = req.headers.get('Origin')
  if (!origin) return true
  return isOriginAllowed(origin, allowed)
}

export function getCorsHeaders(req: Request, methods = 'GET, POST, PUT, DELETE, OPTIONS'): Record<string, string> {
  const allowOrigin = resolveCorsAllowOrigin(req)
  const base: Record<string, string> = {
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
    'Access-Control-Max-Age': '600',
  }
  if (allowOrigin === null) return base
  return { ...base, 'Access-Control-Allow-Origin': allowOrigin }
}
