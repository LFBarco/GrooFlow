import type { BukPeIntegrationSettings } from '../types';
import { getGrooflowBackend } from '../config/backend';
import { getGrooflowApiBase, getGrooflowToken } from '../services/repository/apiBase';
import { getEdgeFunctionAccessTokenLazy, getSupabaseFunctionsUrlLazy } from '../services/repository/supabaseLazy';

export const DEFAULT_BUK_PE_BASE_URL = 'https://veterinariagroomers.buk.pe/api/v1/peru';

export function defaultBukPeSettings(): BukPeIntegrationSettings {
  return {
    apiBaseUrl: DEFAULT_BUK_PE_BASE_URL,
    apiToken: '',
    enabled: false,
    staffSyncEnabled: true,
    staffSyncIntervalMinutes: 60,
    catalogEndpoints: [
      {
        id: 'bukpe-employees',
        name: 'Empleados',
        pathOrUrl: 'employees?page=1&page_size=25',
        description: 'Maestro de colaboradores (GET /employees).',
        enabled: true,
      },
      {
        id: 'bukpe-employees-active',
        name: 'Empleados activos',
        pathOrUrl: 'employees/active?page=1&page_size=25',
        description: 'Colaboradores con estado activo.',
        enabled: true,
      },
    ],
  };
}

export function mergeBukPeSettings(
  partial?: Partial<BukPeIntegrationSettings> | null,
  legacyAsistenciaBuk?: {
    staffSyncEnabled?: boolean;
    staffSyncIntervalMinutes?: number;
    lastStaffSyncAt?: string;
    lastStaffSyncOk?: boolean;
    lastStaffSyncMessage?: string;
  } | null
): BukPeIntegrationSettings {
  const base = defaultBukPeSettings();
  if (!partial || typeof partial !== 'object') {
    // Migración suave desde Asistencia si Buk.pe aún no tiene meta de sync.
    if (legacyAsistenciaBuk && typeof legacyAsistenciaBuk === 'object') {
      return {
        ...base,
        staffSyncEnabled: legacyAsistenciaBuk.staffSyncEnabled ?? base.staffSyncEnabled,
        staffSyncIntervalMinutes:
          typeof legacyAsistenciaBuk.staffSyncIntervalMinutes === 'number'
            ? Math.max(15, Math.min(1440, legacyAsistenciaBuk.staffSyncIntervalMinutes))
            : base.staffSyncIntervalMinutes,
        lastStaffSyncAt: legacyAsistenciaBuk.lastStaffSyncAt,
        lastStaffSyncOk: legacyAsistenciaBuk.lastStaffSyncOk,
        lastStaffSyncMessage: legacyAsistenciaBuk.lastStaffSyncMessage,
      };
    }
    return { ...base };
  }
  const hasOwnStaffMeta =
    partial.lastStaffSyncAt != null ||
    partial.staffSyncEnabled !== undefined ||
    partial.staffSyncIntervalMinutes !== undefined;
  return {
    ...base,
    ...partial,
    apiBaseUrl: partial.apiBaseUrl?.trim()
      ? sanitizeBukPeBaseUrl(partial.apiBaseUrl)
      : base.apiBaseUrl,
    apiToken: partial.apiToken ?? base.apiToken,
    staffSyncEnabled:
      partial.staffSyncEnabled !== undefined
        ? partial.staffSyncEnabled
        : !hasOwnStaffMeta && legacyAsistenciaBuk?.staffSyncEnabled !== undefined
          ? legacyAsistenciaBuk.staffSyncEnabled
          : base.staffSyncEnabled,
    staffSyncIntervalMinutes:
      typeof partial.staffSyncIntervalMinutes === 'number' && partial.staffSyncIntervalMinutes > 0
        ? Math.max(15, Math.min(1440, partial.staffSyncIntervalMinutes))
        : !hasOwnStaffMeta && typeof legacyAsistenciaBuk?.staffSyncIntervalMinutes === 'number'
          ? Math.max(15, Math.min(1440, legacyAsistenciaBuk.staffSyncIntervalMinutes))
          : base.staffSyncIntervalMinutes,
    lastStaffSyncAt: partial.lastStaffSyncAt ?? (!hasOwnStaffMeta ? legacyAsistenciaBuk?.lastStaffSyncAt : undefined),
    lastStaffSyncOk: partial.lastStaffSyncOk ?? (!hasOwnStaffMeta ? legacyAsistenciaBuk?.lastStaffSyncOk : undefined),
    lastStaffSyncMessage:
      partial.lastStaffSyncMessage ?? (!hasOwnStaffMeta ? legacyAsistenciaBuk?.lastStaffSyncMessage : undefined),
    catalogEndpoints: Array.isArray(partial.catalogEndpoints)
      ? partial.catalogEndpoints
      : base.catalogEndpoints,
  };
}

/** Normaliza URL base Buk.pe (hasta /api/v1/{país}). */
export function sanitizeBukPeBaseUrl(raw: string): string {
  let s = raw.trim();
  if (!s) return DEFAULT_BUK_PE_BASE_URL;
  s = s.split('#')[0].split('?')[0].trim();
  s = s.replace(/\/+$/, '');
  // Quitar recurso si pegaron URL completa de empleados
  s = s.replace(/\/employees(\/.*)?$/i, '');
  s = s.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    const path = u.pathname.replace(/\/+$/, '');
    if (!path.includes('/api/v1/')) {
      return DEFAULT_BUK_PE_BASE_URL;
    }
    return `${u.origin}${path}`;
  } catch {
    return DEFAULT_BUK_PE_BASE_URL;
  }
}

export function isBukPeTokenRedacted(raw: string): boolean {
  const t = raw.trim();
  if (!t) return true;
  if (t === '********') return true;
  return /^\*+$/.test(t);
}

/** Limpia token pegado desde cURL, Postman o la documentación de Buk.pe. */
export function normalizeBukPeToken(raw: string): string {
  let t = raw.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  t = t.replace(/^auth_token\s*:\s*/i, '');
  if (t.toLowerCase().startsWith('bearer ')) t = t.slice(7).trim();
  return t.trim();
}

export function buildBukPeEndpointUrl(baseUrl: string, pathOrUrl: string): string {
  const raw = pathOrUrl.trim();
  if (!raw) return sanitizeBukPeBaseUrl(baseUrl);
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = sanitizeBukPeBaseUrl(baseUrl);
  return `${base.replace(/\/+$/, '')}/${raw.replace(/^\/+/, '')}`;
}

export function isAllowedBukPeHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h.endsWith('.buk.pe') ||
    h.endsWith('.buk.cl') ||
    h.endsWith('.buk.co') ||
    h.endsWith('.buk.com.br')
  );
}

export type BukPeConnectionResult = {
  ok: boolean;
  status?: number;
  message: string;
  triedUrl?: string;
  durationMs: number;
};

async function postBukPeProxy(
  path: 'test' | 'probe' | 'sync-usuarios',
  body: Record<string, unknown>,
  timeoutMs = 60_000
): Promise<Response> {
  const backend = getGrooflowBackend();
  if (backend === 'rest') {
    const token = getGrooflowToken();
    if (!token) throw new Error('Sesión caducada. Vuelve a iniciar sesión.');
    const ctrl = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
      ? { signal: AbortSignal.timeout(timeoutMs) }
      : {};
    return fetch(`${getGrooflowApiBase()}/proxy/buk-pe/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      ...ctrl,
    });
  }
  const functionsUrl = await getSupabaseFunctionsUrlLazy();
  if (!functionsUrl) throw new Error('Supabase no configurado.');
  const accessToken = await getEdgeFunctionAccessTokenLazy();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return fetch(`${functionsUrl}/buk-pe/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey ?? '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export type BukPeStaffSyncResult = {
  ok: boolean;
  matched?: number;
  updated?: number;
  unmatched_buk?: number;
  users_scanned?: number;
  by_source?: { empleados?: number; turnos?: number };
  message?: string;
  error?: string;
  duration_ms?: number;
  synced_at?: string;
};

/** Proyecta ficha Buk.pe (colaboradores) → app_usuarios. Turno vacío se rellena desde Ctrlit si hay token. */
export async function syncBukPeUsuariosToGestion(input?: {
  baseUrl?: string;
  apiToken?: string;
}): Promise<BukPeStaffSyncResult> {
  const backend = getGrooflowBackend();
  if (backend === 'local') {
    throw new Error('El sync Buk.pe requiere el backend REST de GrooFlow.');
  }
  const body: Record<string, unknown> = {};
  if (input?.baseUrl) body.baseUrl = sanitizeBukPeBaseUrl(input.baseUrl);
  if (input?.apiToken) body.apiToken = normalizeBukPeToken(input.apiToken);

  const res = await postBukPeProxy('sync-usuarios', body, 180_000);
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || json.ok === false) {
    return {
      ok: false,
      error: String(json.error ?? json.message ?? `HTTP ${res.status}`),
      duration_ms: typeof json.duration_ms === 'number' ? json.duration_ms : undefined,
    };
  }
  return {
    ok: true,
    matched: Number(json.matched ?? 0),
    updated: Number(json.updated ?? 0),
    unmatched_buk: Number(json.unmatched_buk ?? 0),
    users_scanned: Number(json.users_scanned ?? 0),
    by_source: (json.by_source as BukPeStaffSyncResult['by_source']) ?? undefined,
    message: String(json.message ?? ''),
    duration_ms: typeof json.duration_ms === 'number' ? json.duration_ms : undefined,
    synced_at: typeof json.synced_at === 'string' ? json.synced_at : undefined,
  };
}

export async function validateBukPeConnection(input: {
  baseUrl: string;
  apiToken: string;
}): Promise<BukPeConnectionResult> {
  const start = Date.now();
  const baseUrl = sanitizeBukPeBaseUrl(input.baseUrl);
  const apiToken = normalizeBukPeToken(input.apiToken);
  const triedUrl = buildBukPeEndpointUrl(baseUrl, 'employees?page=1&page_size=5');
  if (!apiToken) {
    return { ok: false, message: 'Indica el auth_token de Buk.pe.', durationMs: 0, triedUrl };
  }
  try {
    const res = await postBukPeProxy('test', { baseUrl, apiToken, targetUrl: triedUrl });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const ok = json.ok === true;
    const message =
      typeof json.message === 'string'
        ? json.message
        : typeof json.error === 'string'
          ? json.error
          : res.ok
            ? 'Conexión OK.'
            : res.status === 401
              ? 'HTTP 401 — Buk.pe rechazó el auth_token. Genera uno nuevo en Buk.pe → Configuración → Accesos API.'
              : `Error HTTP ${res.status}`;
    return {
      ok,
      status: typeof json.status === 'number' ? json.status : res.status,
      message,
      triedUrl: typeof json.triedUrl === 'string' ? json.triedUrl : triedUrl,
      durationMs: typeof json.durationMs === 'number' ? json.durationMs : Date.now() - start,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
      triedUrl,
      durationMs: Date.now() - start,
    };
  }
}
