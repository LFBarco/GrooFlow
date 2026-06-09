/**
 * Cliente y validación de la API Veterinari (desde el panel de configuración).
 * El token se guarda en settings:system — solo admins.
 */

export const VETERINARI_AUTH_METHODS = [
  'Authorization: Bearer',
  'Authorization',
  'X-Api-Key',
  'ApiKey',
  'query:token',
] as const;

export type VeterinariAuthMethod = (typeof VETERINARI_AUTH_METHODS)[number];

export type VeterinariValidationResult = {
  ok: boolean;
  status?: number;
  authMethod?: VeterinariAuthMethod;
  message: string;
  recordHint?: string;
  durationMs: number;
  corsBlocked?: boolean;
};

export function normalizeVeterinariBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

/** Construye URL: base + recurso + query (page=1 por defecto). */
export function buildVeterinariUrl(
  baseUrl: string,
  resource: string,
  extraParams?: Record<string, string>
): string {
  const base = normalizeVeterinariBaseUrl(baseUrl);
  const resourceClean = resource.replace(/^\/+/, '').replace(/\?.*$/, '');
  const params = new URLSearchParams({ page: '1', ...extraParams });
  if (resourceClean === 'GetVentas') {
    const now = new Date();
    if (!params.has('year')) params.set('year', String(now.getFullYear()));
    if (!params.has('month')) params.set('month', String(now.getMonth() + 1));
  }
  return `${base}/${resourceClean}?${params.toString()}`;
}

function countRecordsHint(json: unknown): string | undefined {
  if (json == null) return undefined;
  if (Array.isArray(json)) {
    return `${json.length} registro(s) en esta página`;
  }
  if (typeof json === 'object') {
    const o = json as Record<string, unknown>;
    for (const key of ['data', 'items', 'results', 'clientes', 'records']) {
      if (Array.isArray(o[key])) {
        return `${(o[key] as unknown[]).length} registro(s) en «${key}» (página actual)`;
      }
    }
    const keys = Object.keys(o);
    if (keys.length > 0) {
      return `JSON con campos: ${keys.slice(0, 6).join(', ')}${keys.length > 6 ? '…' : ''}`;
    }
  }
  return undefined;
}

function buildAuthHeaders(
  method: VeterinariAuthMethod,
  token: string,
  url: string
): { url: string; headers: Record<string, string> } {
  const headers: Record<string, string> = { Accept: 'application/json' };
  let finalUrl = url;
  switch (method) {
    case 'Authorization: Bearer':
      headers.Authorization = `Bearer ${token}`;
      break;
    case 'Authorization':
      headers.Authorization = token;
      break;
    case 'X-Api-Key':
      headers['X-Api-Key'] = token;
      break;
    case 'ApiKey':
      headers.ApiKey = token;
      break;
    case 'query:token':
      const u = new URL(url);
      u.searchParams.set('token', token);
      finalUrl = u.toString();
      break;
  }
  return { url: finalUrl, headers };
}

const VALIDATE_TIMEOUT_MS = 25_000;

/**
 * Prueba la API probando varios métodos de autenticación habituales.
 * Si el navegador bloquea por CORS, devuelve corsBlocked=true.
 */
export async function validateVeterinariConnection(input: {
  baseUrl: string;
  apiToken: string;
  testEndpoint: string;
}): Promise<VeterinariValidationResult> {
  const start = Date.now();
  const baseUrl = normalizeVeterinariBaseUrl(input.baseUrl);
  const token = input.apiToken.trim();
  const endpoint = input.testEndpoint.trim() || 'GetClientes';

  if (!baseUrl) {
    return {
      ok: false,
      message: 'Indica la URL base de la API.',
      durationMs: Date.now() - start,
    };
  }
  if (!token) {
    return {
      ok: false,
      message: 'Indica el token de la API.',
      durationMs: Date.now() - start,
    };
  }

  const targetUrl = buildVeterinariUrl(baseUrl, endpoint);
  let corsBlocked = false;

  for (const method of VETERINARI_AUTH_METHODS) {
    const { url, headers } = buildAuthHeaders(method, token, targetUrl);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VALIDATE_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (res.ok) {
        const hint = countRecordsHint(json);
        return {
          ok: true,
          status: res.status,
          authMethod: method,
          message: hint
            ? `Conexión exitosa (${method}). ${hint}.`
            : `Conexión exitosa (${method}). Respuesta HTTP ${res.status}.`,
          recordHint: hint,
          durationMs: Date.now() - start,
        };
      }

      if (res.status === 401 || res.status === 403) {
        continue;
      }

      const snippet = text.slice(0, 120).replace(/\s+/g, ' ');
      return {
        ok: false,
        status: res.status,
        authMethod: method,
        message: `HTTP ${res.status} con ${method}: ${snippet || 'sin detalle'}`,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('CORS')
      ) {
        corsBlocked = true;
        continue;
      }
      if (err instanceof Error && err.name === 'AbortError') {
        return {
          ok: false,
          message: 'La API no respondió en el tiempo esperado (timeout).',
          durationMs: Date.now() - start,
          corsBlocked,
        };
      }
    }
  }

  if (corsBlocked) {
    return {
      ok: false,
      message:
        'El navegador bloqueó la llamada (CORS). La URL parece correcta pero Veterinari debe permitir origen GrooFlow, o usar un proxy en servidor (próxima fase).',
      durationMs: Date.now() - start,
      corsBlocked: true,
    };
  }

  return {
    ok: false,
    message:
      'No se obtuvo respuesta válida. Revisa URL, token y método de auth (pide a Veterinari cómo enviar el token).',
    durationMs: Date.now() - start,
  };
}
