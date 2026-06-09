/**
 * Cliente y validación de la API Veterinari (desde el panel de configuración).
 * La prueba usa proxy en Edge Function (evita CORS del navegador).
 */

import { getSupabaseClient, getSupabaseFunctionsUrl } from '../services/repository/supabase';

export const VETERINARI_AUTH_BEARER = 'Authorization: Bearer' as const;

export type VeterinariValidationResult = {
  ok: boolean;
  status?: number;
  authMethod?: string;
  message: string;
  recordHint?: string;
  durationMs: number;
  corsBlocked?: boolean;
  viaProxy?: boolean;
};

/** Quita barra final. */
export function normalizeVeterinariBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

/**
 * Limpia URL pegada por el usuario: sin query, sin endpoint GetXxx al final.
 * Ej: …/api/oapi/GetVentas?page=1 → …/api/oapi
 */
export function sanitizeVeterinariBaseUrl(raw: string): string {
  let s = raw.trim();
  if (!s) return '';
  s = s.split('#')[0].split('?')[0].trim();
  s = s.replace(/\/+$/, '');
  s = s.replace(/\/Get[A-Za-z]+$/i, '');
  s = s.replace(/\/+$/, '');
  return s;
}

/** Quita prefijo Bearer si el usuario lo pegó en el campo token. */
export function normalizeVeterinariToken(raw: string): string {
  let t = raw.trim();
  if (t.toLowerCase().startsWith('bearer ')) {
    t = t.slice(7).trim();
  }
  return t;
}

export type BuildVeterinariUrlOptions = {
  page?: string;
  year?: number;
  month?: number;
};

/** Construye URL: base + recurso + query (page=1 por defecto). */
export function buildVeterinariUrl(
  baseUrl: string,
  resource: string,
  options?: BuildVeterinariUrlOptions
): string {
  const base = sanitizeVeterinariBaseUrl(baseUrl);
  const resourceClean = resource.replace(/^\/+/, '').replace(/\?.*$/, '').trim();
  if (!base || !resourceClean) return '';

  const url = new URL(`${base}/${resourceClean}`);
  url.searchParams.set('page', options?.page ?? '1');
  if (resourceClean === 'GetVentas') {
    const year = options?.year ?? new Date().getFullYear();
    const month = options?.month ?? new Date().getMonth() + 1;
    url.searchParams.set('year', String(year));
    url.searchParams.set('month', String(month));
  }
  return url.toString();
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

/** Cliente: proxy + auth + Veterinari (servidor corta a ~28s). */
const VALIDATE_TIMEOUT_MS = 40_000;
const SESSION_TIMEOUT_MS = 10_000;

async function getAccessTokenWithTimeout(): Promise<string | null> {
  const sessionPromise = getSupabaseClient()
    .auth.getSession()
    .then((d) => d.data.session?.access_token ?? null);
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), SESSION_TIMEOUT_MS);
  });
  return Promise.race([sessionPromise, timeoutPromise]);
}

async function validateViaServerProxy(
  targetUrl: string,
  apiToken: string,
  accessToken: string
): Promise<VeterinariValidationResult> {
  const start = Date.now();
  const functionsUrl = getSupabaseFunctionsUrl();
  if (!functionsUrl) {
    return {
      ok: false,
      message: 'Supabase no configurado (falta VITE_SUPABASE_URL).',
      durationMs: Date.now() - start,
    };
  }

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VALIDATE_TIMEOUT_MS);

  try {
    const res = await fetch(`${functionsUrl}/veterinari/test`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ targetUrl, apiToken }),
    });
    clearTimeout(timeoutId);

    const text = await res.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      const errMsg =
        typeof json?.error === 'string'
          ? json.error
          : text.slice(0, 160) || `Error del servidor (${res.status})`;
      return {
        ok: false,
        status: res.status,
        message: errMsg,
        durationMs: Date.now() - start,
        viaProxy: true,
      };
    }

    const ok = Boolean(json?.ok);
    return {
      ok,
      status: typeof json?.status === 'number' ? json.status : undefined,
      authMethod: typeof json?.authMethod === 'string' ? json.authMethod : VETERINARI_AUTH_BEARER,
      message: typeof json?.message === 'string' ? json.message : ok ? 'Conexión OK.' : 'Error desconocido.',
      recordHint: typeof json?.recordHint === 'string' ? json.recordHint : undefined,
      durationMs: typeof json?.durationMs === 'number' ? json.durationMs : Date.now() - start,
      viaProxy: true,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        ok: false,
        message:
          'Tiempo de espera agotado (40s). Veterinari puede estar lento; intenta GetClientes o más tarde.',
        durationMs: Date.now() - start,
        viaProxy: true,
      };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: `No se pudo contactar el proxy GrooFlow: ${msg}`,
      durationMs: Date.now() - start,
      viaProxy: true,
    };
  }
}

/**
 * Prueba la API Veterinari vía Edge Function (Bearer) para evitar CORS.
 */
export async function validateVeterinariConnection(input: {
  baseUrl: string;
  apiToken: string;
  testEndpoint: string;
  testYear?: number;
  testMonth?: number;
}): Promise<VeterinariValidationResult> {
  const start = Date.now();
  const baseUrl = sanitizeVeterinariBaseUrl(input.baseUrl);
  const token = normalizeVeterinariToken(input.apiToken);
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

  const targetUrl = buildVeterinariUrl(baseUrl, endpoint, {
    year: input.testYear,
    month: input.testMonth,
  });

  const backend = import.meta.env.VITE_BACKEND ?? 'supabase';
  if (backend === 'supabase') {
    const accessToken = await getAccessTokenWithTimeout();
    if (!accessToken) {
      return {
        ok: false,
        message: 'Inicia sesión para probar la conexión (o la sesión tardó demasiado en cargar).',
        durationMs: Date.now() - start,
      };
    }
    return validateViaServerProxy(targetUrl, token, accessToken);
  }

  // Modo local: intento directo (puede fallar por CORS)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VALIDATE_TIMEOUT_MS);
  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
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
        authMethod: VETERINARI_AUTH_BEARER,
        message: hint ? `Conexión exitosa. ${hint}.` : `Conexión exitosa. HTTP ${res.status}.`,
        recordHint: hint,
        durationMs: Date.now() - start,
      };
    }
    return {
      ok: false,
      status: res.status,
      authMethod: VETERINARI_AUTH_BEARER,
      message: `HTTP ${res.status}: ${text.slice(0, 160)}`,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: msg.includes('Failed to fetch')
        ? 'CORS o red bloqueada. Usa VITE_BACKEND=supabase para probar vía servidor.'
        : msg,
      durationMs: Date.now() - start,
      corsBlocked: msg.includes('Failed to fetch'),
    };
  }
}
