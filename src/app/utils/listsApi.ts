import { getGrooflowApiBase, getGrooflowToken } from '../services/repository/apiBase';

export type ServerListPage<T> = {
  items: T[];
  ids?: string[];
  total: number;
  filtered: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

async function grooflowFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getGrooflowToken();
  if (!token) throw new Error('Sesión caducada. Vuelve a iniciar sesión.');
  return fetch(`${getGrooflowApiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: text.slice(0, 200) };
  }
}

export async function fetchServerListPage<T>(
  name: string,
  params: {
    page?: number;
    pageSize?: number;
    search?: string;
    idsOnly?: boolean;
    extra?: Record<string, string>;
  } = {}
): Promise<ServerListPage<T>> {
  const q = new URLSearchParams();
  q.set('page', String(params.page ?? 1));
  q.set('pageSize', String(params.pageSize ?? 25));
  if (params.search) q.set('search', params.search);
  if (params.idsOnly) q.set('idsOnly', '1');
  if (params.extra) {
    for (const [k, v] of Object.entries(params.extra)) {
      if (v) q.set(k, v);
    }
  }
  const res = await grooflowFetch(`/lists/${encodeURIComponent(name)}?${q.toString()}`);
  const json = await readJson(res);
  if (!res.ok || json.ok === false) {
    throw new Error(String(json.error ?? `HTTP ${res.status}`));
  }
  return {
    items: (json.items as T[]) ?? [],
    ids: Array.isArray(json.ids) ? (json.ids as string[]) : undefined,
    total: Number(json.total ?? 0),
    filtered: Number(json.filtered ?? 0),
    page: Number(json.page ?? 1),
    pageSize: Number(json.pageSize ?? 25),
    totalPages: Number(json.totalPages ?? 1),
  };
}

export async function deleteServerListItems(
  name: string,
  input: { ids?: string[]; allMatching?: boolean; search?: string }
): Promise<number> {
  const res = await grooflowFetch(`/lists/${encodeURIComponent(name)}/delete`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const json = await readJson(res);
  if (!res.ok || json.ok === false) {
    throw new Error(String(json.error ?? `HTTP ${res.status}`));
  }
  return Number(json.deleted ?? 0);
}
