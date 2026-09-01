import { getEdgeFunctionAccessTokenLazy, getSupabaseFunctionsUrlLazy } from '../services/repository/supabaseLazy';
import { getGrooflowApiBase, getGrooflowToken } from '../services/repository/apiBase';
import { getGrooflowBackend } from '../config/backend';
import { DEFAULT_BUK_ASISTENCIA_BASE_URL, normalizeBukToken, sanitizeBukBaseUrl } from './bukAsistenciaApi';
import { analyzeBukRecordsFields, collectJsonFieldPaths } from './bukFieldPaths';

export type BukEndpointProbeResult = {
  ok: boolean;
  status?: number;
  message: string;
  triedUrl?: string;
  durationMs: number;
  recordCount?: number;
  fieldPaths: string[];
  fields: ReturnType<typeof analyzeBukRecordsFields>;
  sample: unknown[];
  rawPreview?: unknown;
  pagination?: Record<string, unknown> | null;
};

const PROBE_TIMEOUT_MS = 60_000;

async function postBukProbe(body: Record<string, unknown>): Promise<Response> {
  const backend = getGrooflowBackend();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    if (backend === 'rest') {
      const token = getGrooflowToken();
      if (!token) throw new Error('Sesión caducada. Vuelve a iniciar sesión.');
      return await fetch(`${getGrooflowApiBase()}/proxy/buk/probe`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    }
    const functionsUrl = await getSupabaseFunctionsUrlLazy();
    if (!functionsUrl) throw new Error('Supabase no configurado.');
    const accessToken = await getEdgeFunctionAccessTokenLazy();
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    return await fetch(`${functionsUrl}/buk/probe`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function buildBukEndpointUrl(baseUrl: string, pathOrUrl: string): string {
  const raw = pathOrUrl.trim();
  if (!raw) return sanitizeBukBaseUrl(baseUrl);
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = sanitizeBukBaseUrl(baseUrl || DEFAULT_BUK_ASISTENCIA_BASE_URL);
  return `${base.replace(/\/+$/, '')}/${raw.replace(/^\/+/, '')}`;
}

export async function probeBukEndpoint(input: {
  baseUrl: string;
  apiToken: string;
  pathOrUrl: string;
}): Promise<BukEndpointProbeResult> {
  const start = Date.now();
  const baseUrl = sanitizeBukBaseUrl(input.baseUrl);
  const apiToken = normalizeBukToken(input.apiToken);
  const pathOrUrl = input.pathOrUrl.trim();
  const triedUrl = buildBukEndpointUrl(baseUrl, pathOrUrl);

  if (!apiToken) {
    return {
      ok: false,
      message: 'Indica el token Buk antes de consultar.',
      durationMs: 0,
      fieldPaths: [],
      fields: [],
      sample: [],
      triedUrl,
    };
  }
  if (!pathOrUrl) {
    return {
      ok: false,
      message: 'Indica la ruta o URL del endpoint.',
      durationMs: 0,
      fieldPaths: [],
      fields: [],
      sample: [],
    };
  }

  try {
    const res = await postBukProbe({
      baseUrl,
      apiToken,
      pathOrUrl,
      targetUrl: /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : '',
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const durationMs =
      typeof json.durationMs === 'number' ? json.durationMs : Date.now() - start;
    const status = typeof json.status === 'number' ? json.status : res.status;
    const message =
      typeof json.message === 'string'
        ? json.message
        : typeof json.error === 'string'
          ? json.error
          : res.ok
            ? 'Consulta completada.'
            : `Error HTTP ${res.status}`;

    if (!res.ok && json.ok !== true) {
      return {
        ok: false,
        status,
        message,
        triedUrl: typeof json.triedUrl === 'string' ? json.triedUrl : triedUrl,
        durationMs,
        fieldPaths: [],
        fields: [],
        sample: [],
      };
    }

    const sample = Array.isArray(json.sample)
      ? json.sample
      : Array.isArray(json.data)
        ? (json.data as unknown[]).slice(0, 3)
        : [];
    const fields = analyzeBukRecordsFields(sample);
    const fieldPaths =
      fields.length > 0
        ? fields.map((f) => f.path)
        : collectJsonFieldPaths(json.rawPreview ?? json);

    return {
      ok: json.ok === true,
      status,
      message,
      triedUrl: typeof json.triedUrl === 'string' ? json.triedUrl : triedUrl,
      durationMs,
      recordCount: typeof json.recordCount === 'number' ? json.recordCount : sample.length,
      fieldPaths,
      fields,
      sample,
      rawPreview: json.rawPreview,
      pagination:
        json.pagination && typeof json.pagination === 'object'
          ? (json.pagination as Record<string, unknown>)
          : null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message:
        err instanceof Error && err.name === 'AbortError'
          ? 'Tiempo de espera agotado al consultar el endpoint.'
          : msg,
      triedUrl,
      durationMs: Date.now() - start,
      fieldPaths: [],
      fields: [],
      sample: [],
    };
  }
}
