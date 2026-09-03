import { getGrooflowApiBase, getGrooflowToken } from '../services/repository/apiBase';
import type { BukPeEmployeeRow, RrhhSyncStats } from '../types/rrhh';

export type RrhhEmployeesPage = {
  items: BukPeEmployeeRow[];
  total: number;
  filtered: number;
  page: number;
  pageSize: number;
};

export type RrhhDbStats = {
  total: number;
  activos: number;
  bajas: number;
  enriched: number;
  missing: number;
  linkedActivos: number;
  unlinkedActivos: number;
  byArea: { area: string; count: number }[];
  byCargo: { cargo: string; count: number }[];
  byRecinto: { recinto: string; count: number }[];
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

export async function fetchRrhhEmployeesPage(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  tab?: 'activos' | 'bajas' | 'all';
  orderBy?: string;
  orderDir?: 'ASC' | 'DESC';
}): Promise<RrhhEmployeesPage> {
  const q = new URLSearchParams();
  q.set('page', String(params.page ?? 1));
  q.set('pageSize', String(params.pageSize ?? 15));
  if (params.search) q.set('search', params.search);
  if (params.tab) q.set('tab', params.tab);
  if (params.orderBy) q.set('orderBy', params.orderBy);
  if (params.orderDir) q.set('orderDir', params.orderDir);
  const res = await grooflowFetch(`/rrhh/empleados?${q.toString()}`);
  const json = await readJson(res);
  if (!res.ok || json.ok === false) {
    throw new Error(String(json.error ?? `HTTP ${res.status}`));
  }
  return {
    items: (json.items as BukPeEmployeeRow[]) ?? [],
    total: Number(json.total ?? 0),
    filtered: Number(json.filtered ?? 0),
    page: Number(json.page ?? 1),
    pageSize: Number(json.pageSize ?? 15),
  };
}

export async function fetchRrhhDbStats(): Promise<RrhhDbStats> {
  const res = await grooflowFetch('/rrhh/stats');
  const json = await readJson(res);
  if (!res.ok || json.ok === false) {
    throw new Error(String(json.error ?? `HTTP ${res.status}`));
  }
  const s = (json.stats as Record<string, unknown>) ?? {};
  const asPairs = <T extends string>(raw: unknown, key: T): Array<Record<T, string> & { count: number }> =>
    Array.isArray(raw)
      ? raw.map((row) => {
          const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
          return { [key]: String(r[key] ?? 'Sin dato'), count: Number(r.count ?? 0) } as Record<T, string> & {
            count: number;
          };
        })
      : [];
  return {
    total: Number(s.total ?? 0),
    activos: Number(s.activos ?? 0),
    bajas: Number(s.bajas ?? 0),
    enriched: Number(s.enriched ?? 0),
    missing: Number(s.missing ?? 0),
    linkedActivos: Number(s.linked_activos ?? s.linkedActivos ?? 0),
    unlinkedActivos: Number(s.unlinked_activos ?? s.unlinkedActivos ?? 0),
    byArea: asPairs(s.by_area ?? s.byArea, 'area'),
    byCargo: asPairs(s.by_cargo ?? s.byCargo, 'cargo'),
    byRecinto: asPairs(s.by_recinto ?? s.byRecinto, 'recinto'),
  };
}

export async function syncRrhhToDatabase(input?: {
  includeAsistencia?: boolean;
}): Promise<{
  ok: boolean;
  message: string;
  stats?: RrhhSyncStats;
  asistenciaMatched?: number;
  duration_ms?: number;
  truncated?: boolean;
}> {
  const res = await grooflowFetch('/rrhh/sync', {
    method: 'POST',
    body: JSON.stringify({
      includeAsistencia: input?.includeAsistencia !== false,
    }),
  });
  const json = await readJson(res);
  if (!res.ok || json.ok === false) {
    return { ok: false, message: String(json.error ?? json.message ?? `HTTP ${res.status}`) };
  }
  return {
    ok: true,
    message: String(json.message ?? 'Sync completado'),
    stats: json.stats as RrhhSyncStats | undefined,
    asistenciaMatched: Number(json.asistenciaMatched ?? 0),
    duration_ms: typeof json.duration_ms === 'number' ? json.duration_ms : undefined,
    truncated: Boolean(json.truncated),
  };
}

export async function downloadRrhhExcel(params?: {
  search?: string;
  tab?: string;
}): Promise<void> {
  const q = new URLSearchParams();
  if (params?.search) q.set('search', params.search);
  if (params?.tab) q.set('tab', params.tab);
  const token = getGrooflowToken();
  if (!token) throw new Error('Sesión caducada.');
  const res = await fetch(`${getGrooflowApiBase()}/rrhh/empleados/export?${q.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Exportación falló (HTTP ${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rrhh-colaboradores.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

export type CatalogItem = {
  id: number;
  nombre: string;
  descripcion?: string;
  codigo?: string;
  horario?: string;
  estado?: string;
  area_id?: number | null;
};

async function catalogList(path: string, all = true): Promise<CatalogItem[]> {
  const res = await grooflowFetch(`${path}${all ? '?all=1' : ''}`);
  const json = await readJson(res);
  if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
  return ((json.items as CatalogItem[]) ?? []).map((i) => ({
    ...i,
    id: Number(i.id),
  }));
}

async function catalogSave(path: string, data: Record<string, unknown>, id?: number): Promise<CatalogItem> {
  const res = await grooflowFetch(id ? `${path}/${id}` : path, {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(data),
  });
  const json = await readJson(res);
  if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
  return json.item as CatalogItem;
}

async function catalogDelete(path: string, id: number): Promise<void> {
  const res = await grooflowFetch(`${path}/${id}`, { method: 'DELETE' });
  const json = await readJson(res);
  if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
}

export const rrhhCatalogApi = {
  listAreas: () => catalogList('/catalog/areas'),
  saveArea: (data: Record<string, unknown>, id?: number) => catalogSave('/catalog/areas', data, id),
  deleteArea: (id: number) => catalogDelete('/catalog/areas', id),
  listPuestos: () => catalogList('/catalog/puestos'),
  savePuesto: (data: Record<string, unknown>, id?: number) => catalogSave('/catalog/puestos', data, id),
  deletePuesto: (id: number) => catalogDelete('/catalog/puestos', id),
  listTurnos: () => catalogList('/catalog/turnos'),
  saveTurno: (data: Record<string, unknown>, id?: number) => catalogSave('/catalog/turnos', data, id),
  deleteTurno: (id: number) => catalogDelete('/catalog/turnos', id),
};
