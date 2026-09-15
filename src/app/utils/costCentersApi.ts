import { getGrooflowApiBase, getGrooflowToken } from '../services/repository/apiBase';
import type {
  BusinessUnit,
  CostCenter,
  CostCentersDashboardStats,
  OrgArea,
  OrgPosition,
  OrgSubarea,
} from '../types/costCenters';

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

async function catalogList<T>(path: string): Promise<T[]> {
  const res = await grooflowFetch(path);
  const json = await readJson(res);
  if (!res.ok || json.ok === false) {
    throw new Error(String(json.error ?? `HTTP ${res.status}`));
  }
  return (json.items as T[]) ?? [];
}

async function catalogSave<T>(path: string, data: Record<string, unknown>, id?: number): Promise<T> {
  const res = await grooflowFetch(id ? `${path}/${id}` : path, {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(data),
  });
  const json = await readJson(res);
  if (!res.ok || json.ok === false) {
    throw new Error(String(json.error ?? `HTTP ${res.status}`));
  }
  return json.item as T;
}

async function catalogDelete(path: string, id: number): Promise<void> {
  const res = await grooflowFetch(`${path}/${id}`, { method: 'DELETE' });
  const json = await readJson(res);
  if (!res.ok || json.ok === false) {
    throw new Error(String(json.error ?? `HTTP ${res.status}`));
  }
}

const BU = '/cost-centers/business-units';
const AREAS = '/cost-centers/areas';
const SUBS = '/cost-centers/subareas';
const POS = '/cost-centers/positions';
const CC = '/cost-centers/centers';

export const costCentersApi = {
  stats: async (): Promise<CostCentersDashboardStats> => {
    const res = await grooflowFetch('/cost-centers/stats');
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return json.stats as CostCentersDashboardStats;
  },
  seedSedes: async (sedes: string[]): Promise<{ created: number; items: CostCenter[] }> => {
    const res = await grooflowFetch('/cost-centers/seed-sedes', {
      method: 'POST',
      body: JSON.stringify({ sedes }),
    });
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return { created: Number(json.created ?? 0), items: (json.items as CostCenter[]) ?? [] };
  },

  listBusinessUnits: (all = true) => catalogList<BusinessUnit>(`${BU}${all ? '?all=1' : ''}`),
  saveBusinessUnit: (data: Partial<BusinessUnit>, id?: number) =>
    catalogSave<BusinessUnit>(BU, data as Record<string, unknown>, id),
  deleteBusinessUnit: (id: number) => catalogDelete(BU, id),

  listAreas: (all = true) => catalogList<OrgArea>(`${AREAS}${all ? '?all=1' : ''}`),
  saveArea: (data: Partial<OrgArea>, id?: number) =>
    catalogSave<OrgArea>(AREAS, data as Record<string, unknown>, id),
  deleteArea: (id: number) => catalogDelete(AREAS, id),

  listSubareas: (all = true, areaId?: number) => {
    const q = new URLSearchParams();
    if (all) q.set('all', '1');
    if (areaId) q.set('area_id', String(areaId));
    const qs = q.toString();
    return catalogList<OrgSubarea>(`${SUBS}${qs ? `?${qs}` : ''}`);
  },
  saveSubarea: (data: Partial<OrgSubarea>, id?: number) =>
    catalogSave<OrgSubarea>(SUBS, data as Record<string, unknown>, id),
  deleteSubarea: (id: number) => catalogDelete(SUBS, id),

  listPositions: (all = true, areaId?: number) => {
    const q = new URLSearchParams();
    if (all) q.set('all', '1');
    if (areaId) q.set('area_id', String(areaId));
    const qs = q.toString();
    return catalogList<OrgPosition>(`${POS}${qs ? `?${qs}` : ''}`);
  },
  savePosition: (data: Partial<OrgPosition>, id?: number) =>
    catalogSave<OrgPosition>(POS, data as Record<string, unknown>, id),
  deletePosition: (id: number) => catalogDelete(POS, id),

  listCenters: (all = true, sede?: string) => {
    const q = new URLSearchParams();
    if (all) q.set('all', '1');
    if (sede) q.set('sede', sede);
    const qs = q.toString();
    return catalogList<CostCenter>(`${CC}${qs ? `?${qs}` : ''}`);
  },
  saveCenter: (data: Partial<CostCenter>, id?: number) =>
    catalogSave<CostCenter>(CC, data as Record<string, unknown>, id),
  deleteCenter: (id: number) => catalogDelete(CC, id),
};
