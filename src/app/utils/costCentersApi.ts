import { getGrooflowApiBase, getGrooflowToken } from '../services/repository/apiBase';
import type {
  BusinessUnit,
  CollaboratorCostAssignmentLine,
  CollaboratorsAssignmentsPage,
  CostCenter,
  CostCentersDashboardStats,
  CostCentersPnlFeed,
  CostCentersReport,
  CostExpense,
  CostExpensesPage,
  DistributionRule,
  OrgArea,
  OrgPosition,
  OrgSubarea,
  ReplaceAssignmentsPayload,
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

  listCollaborators: async (params: {
    page?: number;
    pageSize?: number;
    search?: string;
    assignment?: 'all' | 'assigned' | 'pending';
  }): Promise<CollaboratorsAssignmentsPage> => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    if (params.search) q.set('search', params.search);
    if (params.assignment) q.set('assignment', params.assignment);
    const qs = q.toString();
    const res = await grooflowFetch(`/cost-centers/assignments/collaborators${qs ? `?${qs}` : ''}`);
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return {
      items: (json.items as CollaboratorsAssignmentsPage['items']) ?? [],
      total: Number(json.total ?? 0),
      page: Number(json.page ?? 1),
      pageSize: Number(json.pageSize ?? 25),
      fecha_referencia: String(json.fecha_referencia ?? ''),
    };
  },

  listAssignments: async (
    colaboradorId: string,
    onlyActive = false
  ): Promise<CollaboratorCostAssignmentLine[]> => {
    const q = new URLSearchParams({ colaborador_id: colaboradorId });
    if (onlyActive) q.set('active', '1');
    const res = await grooflowFetch(`/cost-centers/assignments?${q}`);
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return (json.items as CollaboratorCostAssignmentLine[]) ?? [];
  },

  replaceAssignments: async (
    payload: ReplaceAssignmentsPayload
  ): Promise<{ colaborador_id: string; cerradas: number; lines: CollaboratorCostAssignmentLine[] }> => {
    const res = await grooflowFetch('/cost-centers/assignments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return {
      colaborador_id: String(json.colaborador_id ?? ''),
      cerradas: Number(json.cerradas ?? 0),
      lines: (json.lines as CollaboratorCostAssignmentLine[]) ?? [],
    };
  },

  deactivateAssignment: async (id: number): Promise<void> => {
    const res = await grooflowFetch(`/cost-centers/assignments/${id}`, { method: 'DELETE' });
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
  },

  listRules: (all = true) => catalogList<DistributionRule>(`/cost-centers/rules${all ? '?all=1' : ''}`),
  getRule: async (id: number): Promise<DistributionRule> => {
    const res = await grooflowFetch(`/cost-centers/rules/${id}`);
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return json.item as DistributionRule;
  },
  saveRule: (data: Partial<DistributionRule> & { detalle: DistributionRule['detalle'] }, id?: number) =>
    catalogSave<DistributionRule>('/cost-centers/rules', data as Record<string, unknown>, id),
  deleteRule: (id: number) => catalogDelete('/cost-centers/rules', id),
  simulateRule: async (
    reglaId: number,
    monto: number
  ): Promise<{
    regla_id: number;
    metodo: string;
    monto: number;
    lines: Array<{
      centro_costo_id: number;
      centro_codigo?: string;
      centro_nombre?: string;
      porcentaje: number;
      monto: number;
    }>;
    nota?: string;
  }> => {
    const res = await grooflowFetch('/cost-centers/rules/simulate', {
      method: 'POST',
      body: JSON.stringify({ regla_id: reglaId, monto }),
    });
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return json as {
      regla_id: number;
      metodo: string;
      monto: number;
      lines: Array<{
        centro_costo_id: number;
        centro_codigo?: string;
        centro_nombre?: string;
        porcentaje: number;
        monto: number;
      }>;
      nota?: string;
    };
  },

  listExpenses: async (params: {
    page?: number;
    pageSize?: number;
    estado?: string;
    periodo?: string;
    search?: string;
  }): Promise<CostExpensesPage> => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    if (params.estado) q.set('estado', params.estado);
    if (params.periodo) q.set('periodo', params.periodo);
    if (params.search) q.set('search', params.search);
    const qs = q.toString();
    const res = await grooflowFetch(`/cost-centers/expenses${qs ? `?${qs}` : ''}`);
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return {
      items: (json.items as CostExpense[]) ?? [],
      total: Number(json.total ?? 0),
      page: Number(json.page ?? 1),
      pageSize: Number(json.pageSize ?? 25),
    };
  },
  saveExpense: async (data: Record<string, unknown>, id?: number): Promise<CostExpense> => {
    const res = await grooflowFetch(id ? `/cost-centers/expenses/${id}` : '/cost-centers/expenses', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(data),
    });
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return json.item as CostExpense;
  },
  createPersonalExpense: async (data: Record<string, unknown>): Promise<CostExpense> => {
    const res = await grooflowFetch('/cost-centers/expenses/personal', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return json.item as CostExpense;
  },
  deleteExpense: (id: number) => catalogDelete('/cost-centers/expenses', id),
  distributeExpense: async (id: number): Promise<CostExpense> => {
    const res = await grooflowFetch(`/cost-centers/expenses/${id}/distribute`, { method: 'POST', body: '{}' });
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return json.item as CostExpense;
  },
  reverseExpense: async (id: number): Promise<CostExpense> => {
    const res = await grooflowFetch(`/cost-centers/expenses/${id}/reverse`, { method: 'POST', body: '{}' });
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return json.item as CostExpense;
  },

  reports: async (periodo: string): Promise<CostCentersReport> => {
    const res = await grooflowFetch(`/cost-centers/reports?periodo=${encodeURIComponent(periodo)}`);
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return json.report as CostCentersReport;
  },
  pnlFeed: async (periodo: string): Promise<CostCentersPnlFeed> => {
    const res = await grooflowFetch(`/cost-centers/pnl-feed?periodo=${encodeURIComponent(periodo)}`);
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return {
      periodo: String(json.periodo ?? periodo),
      items: (json.items as CostCentersPnlFeed['items']) ?? [],
      total: Number(json.total ?? 0),
      nota: json.nota ? String(json.nota) : undefined,
    };
  },
};
