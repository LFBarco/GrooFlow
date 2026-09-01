import { getGrooflowBackend } from '../config/backend';
import { getGrooflowApiBase, getGrooflowToken } from '../services/repository/apiBase';
import { getEdgeFunctionAccessTokenLazy, getSupabaseFunctionsUrlLazy } from '../services/repository/supabaseLazy';
import type { BukPeEmployeeRow } from '../types/rrhh';
import { normalizeBukPeEmployee } from './bukPeEmployeeUtils';
import { isBukPeTokenRedacted, mergeBukPeSettings, normalizeBukPeToken, sanitizeBukPeBaseUrl } from './bukPeApi';
import type { BukPeIntegrationSettings } from '../types';

const PAGE_SIZE = 100;
const MAX_PAGES = 30;

function extractRecords(json: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(json.data)) {
    return json.data.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object');
  }
  return [];
}

async function postBukPeProxy(
  path: 'fetch' | 'fetch-all',
  body: Record<string, unknown>
): Promise<Response> {
  const backend = getGrooflowBackend();
  if (backend === 'rest') {
    const token = getGrooflowToken();
    if (!token) throw new Error('Sesión caducada. Vuelve a iniciar sesión.');
    return fetch(`${getGrooflowApiBase()}/proxy/buk-pe/${path}`, {
      method: 'POST',
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

export type FetchBukPeEmployeesResult = {
  ok: boolean;
  employees: BukPeEmployeeRow[];
  message: string;
  durationMs?: number;
};

export async function fetchAllBukPeEmployees(input: {
  bukPe: BukPeIntegrationSettings | undefined;
  onProgress?: (page: number, totalPages: number) => void;
}): Promise<FetchBukPeEmployeesResult> {
  const cfg = mergeBukPeSettings(input.bukPe);
  const baseUrl = sanitizeBukPeBaseUrl(cfg.apiBaseUrl ?? '');
  const apiToken = normalizeBukPeToken(cfg.apiToken ?? '');

  if (!cfg.enabled) {
    return { ok: false, employees: [], message: 'Activa la integración Buk.pe en Configuración → Integraciones.' };
  }
  if (!apiToken || isBukPeTokenRedacted(apiToken)) {
    return {
      ok: false,
      employees: [],
      message: 'Configura el auth_token de Buk.pe en Integraciones antes de sincronizar.',
    };
  }

  const start = Date.now();
  try {
    const res = await postBukPeProxy('fetch-all', {
      baseUrl,
      apiToken,
      pageSize: PAGE_SIZE,
      maxPages: MAX_PAGES,
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const message =
      typeof json.message === 'string'
        ? json.message
        : typeof json.error === 'string'
          ? json.error
          : res.ok
            ? 'Sincronización completada.'
            : `Error HTTP ${res.status}`;

    if (!res.ok && json.ok !== true) {
      return { ok: false, employees: [], message, durationMs: Date.now() - start };
    }

    const raw = extractRecords(json);
    const employees = raw.map(normalizeBukPeEmployee);
    return {
      ok: true,
      employees,
      message: `OK. ${employees.length} colaborador(es) cargados desde Buk.pe.`,
      durationMs: typeof json.durationMs === 'number' ? json.durationMs : Date.now() - start,
    };
  } catch (err) {
    return {
      ok: false,
      employees: [],
      message: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}
