import { getGrooflowApiBase, getGrooflowToken } from '../services/repository/apiBase';
import type {
  MgrClassifyProposal,
  MgrCuentaMapping,
  MgrDashboardStats,
  MgrDriver,
  MgrNaturaleza,
  MgrPnlLinea,
  MgrPnlStatement,
  MgrQaReport,
  MgrSharedDist,
} from '../types/mgrPnl';
import type { ChartOfAccountEntry } from '../types';

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

export const mgrPnlApi = {
  ensure: async (): Promise<MgrDashboardStats> => {
    const res = await grooflowFetch('/mgr-pnl/ensure', { method: 'POST', body: '{}' });
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return json.stats as MgrDashboardStats;
  },
  stats: async (): Promise<MgrDashboardStats> => {
    const res = await grooflowFetch('/mgr-pnl/stats');
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return json.stats as MgrDashboardStats;
  },
  naturalezas: async (): Promise<MgrNaturaleza[]> => {
    const res = await grooflowFetch('/mgr-pnl/naturalezas');
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return (json.items as MgrNaturaleza[]) ?? [];
  },
  structure: async (): Promise<MgrPnlLinea[]> => {
    const res = await grooflowFetch('/mgr-pnl/structure');
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return (json.items as MgrPnlLinea[]) ?? [];
  },
  drivers: async (): Promise<MgrDriver[]> => {
    const res = await grooflowFetch('/mgr-pnl/drivers');
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return (json.items as MgrDriver[]) ?? [];
  },
  mappings: async (all = true): Promise<MgrCuentaMapping[]> => {
    const res = await grooflowFetch(`/mgr-pnl/mappings${all ? '?all=1' : ''}`);
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return (json.items as MgrCuentaMapping[]) ?? [];
  },
  saveMapping: async (data: Record<string, unknown>, id?: number): Promise<MgrCuentaMapping> => {
    const res = await grooflowFetch(id ? `/mgr-pnl/mappings/${id}` : '/mgr-pnl/mappings', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(data),
    });
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return json.item as MgrCuentaMapping;
  },
  deleteMapping: async (id: number): Promise<void> => {
    const res = await grooflowFetch(`/mgr-pnl/mappings/${id}`, { method: 'DELETE' });
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
  },
  classify: async (input: Record<string, unknown>): Promise<MgrClassifyProposal> => {
    const res = await grooflowFetch('/mgr-pnl/classify', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return json.proposal as MgrClassifyProposal;
  },
  shared: async (): Promise<MgrSharedDist[]> => {
    const res = await grooflowFetch('/mgr-pnl/shared');
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return (json.items as MgrSharedDist[]) ?? [];
  },
  saveShared: async (data: Record<string, unknown>, id?: number): Promise<MgrSharedDist> => {
    const res = await grooflowFetch(id ? `/mgr-pnl/shared/${id}` : '/mgr-pnl/shared', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(data),
    });
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return json.item as MgrSharedDist;
  },
  deleteShared: async (id: number): Promise<void> => {
    const res = await grooflowFetch(`/mgr-pnl/shared/${id}`, { method: 'DELETE' });
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
  },
  qa: async (chartAccounts: ChartOfAccountEntry[]): Promise<MgrQaReport> => {
    const res = await grooflowFetch('/mgr-pnl/qa', {
      method: 'POST',
      body: JSON.stringify({ chart_accounts: chartAccounts }),
    });
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return json.qa as MgrQaReport;
  },
  statement: async (periodo: string): Promise<MgrPnlStatement> => {
    const res = await grooflowFetch(`/mgr-pnl/statement?periodo=${encodeURIComponent(periodo)}`);
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return json.statement as MgrPnlStatement;
  },
  autoMapFromChart: async (
    chartAccounts: ChartOfAccountEntry[],
    opts?: { apply?: boolean; overwrite?: boolean; min_confianza?: string; created_by?: string }
  ): Promise<{
    reviewed: number;
    proposed: number;
    usable: number;
    applied: number;
    skipped_existing: number;
    apply: boolean;
    items: Array<Record<string, unknown>>;
  }> => {
    const res = await grooflowFetch('/mgr-pnl/auto-map-from-chart', {
      method: 'POST',
      body: JSON.stringify({
        chart_accounts: chartAccounts,
        apply: opts?.apply !== false,
        overwrite: Boolean(opts?.overwrite),
        min_confianza: opts?.min_confianza ?? 'media',
        created_by: opts?.created_by,
      }),
    });
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return {
      reviewed: Number(json.reviewed ?? 0),
      proposed: Number(json.proposed ?? 0),
      usable: Number(json.usable ?? 0),
      applied: Number(json.applied ?? 0),
      skipped_existing: Number(json.skipped_existing ?? 0),
      apply: Boolean(json.apply),
      items: (json.items as Array<Record<string, unknown>>) ?? [],
    };
  },
  ingestExpense: async (data: Record<string, unknown>): Promise<{
    ok: boolean;
    duplicated?: boolean;
    distributed?: boolean;
    gasto?: Record<string, unknown>;
    proposal?: MgrClassifyProposal;
    dist_error?: string | null;
  }> => {
    const res = await grooflowFetch('/mgr-pnl/ingest-expense', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const json = await readJson(res);
    if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `HTTP ${res.status}`));
    return json as {
      ok: boolean;
      duplicated?: boolean;
      distributed?: boolean;
      gasto?: Record<string, unknown>;
      proposal?: MgrClassifyProposal;
      dist_error?: string | null;
    };
  },
};
