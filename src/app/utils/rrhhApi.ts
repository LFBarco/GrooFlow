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

export type RrhhIdentityDiagnosis = {
  policy: {
    sourceOfTruth: string;
    altaSinUsuario: string;
    cesadoDesactivaAccesoYOrganigrama: boolean;
    turnosPublica: string;
    camposOficialesBuk: string[];
    camposEditablesGrooflow: string[];
  };
  generatedAt: string;
  counts: {
    bukActivos: number;
    bukTotal: number;
    matched: number;
    pendingAccess: number;
    usersWithoutDni: number;
    terminatedStillActive: number;
    staffInOrganigrama: number;
    staffWithRut: number;
    staffMatchedBuk: number;
    staffWithoutRut: number;
  };
  samples: {
    matched: Array<Record<string, unknown>>;
    pendingAccess: Array<Record<string, unknown>>;
    usersWithoutDni: Array<Record<string, unknown>>;
    terminatedStillActive: Array<Record<string, unknown>>;
    staffWithoutRut: Array<Record<string, unknown>>;
  };
};

export type RrhhApplyTerminationsResult = {
  dryRun: boolean;
  candidates: number;
  usersDisabled: number;
  staffRemoved: number;
  errors: string[];
  samples: {
    usersDisabled: Array<Record<string, unknown>>;
    staffRemoved: Array<Record<string, unknown>>;
  };
  appliedAt: string;
};

export async function applyRrhhTerminations(input?: {
  dryRun?: boolean;
  bukIds?: number[];
}): Promise<RrhhApplyTerminationsResult> {
  const res = await grooflowFetch('/rrhh/apply-terminations', {
    method: 'POST',
    body: JSON.stringify({
      dryRun: Boolean(input?.dryRun),
      bukIds: input?.bukIds ?? undefined,
    }),
  });
  const json = await readJson(res);
  if (!res.ok || json.ok === false) {
    throw new Error(String(json.error ?? `HTTP ${res.status}`));
  }
  return {
    dryRun: Boolean(json.dryRun),
    candidates: Number(json.candidates ?? 0),
    usersDisabled: Number(json.usersDisabled ?? 0),
    staffRemoved: Number(json.staffRemoved ?? 0),
    errors: Array.isArray(json.errors) ? (json.errors as string[]) : [],
    samples: (json.samples as RrhhApplyTerminationsResult['samples']) ?? {
      usersDisabled: [],
      staffRemoved: [],
    },
    appliedAt: String(json.appliedAt ?? new Date().toISOString()),
  };
}

export async function linkRrhhUser(input: {
  bukId: number;
  userId: string;
  matchMethod?: string;
}): Promise<{ bukId: number; userId: string; pendingAccess: number; identityStatus?: string }> {
  const res = await grooflowFetch('/rrhh/link-user', {
    method: 'POST',
    body: JSON.stringify({
      bukId: input.bukId,
      userId: input.userId,
      matchMethod: input.matchMethod ?? 'manual',
    }),
  });
  const json = await readJson(res);
  if (!res.ok || json.ok === false) {
    throw new Error(String(json.error ?? `HTTP ${res.status}`));
  }
  return {
    bukId: Number(json.bukId ?? input.bukId),
    userId: String(json.userId ?? input.userId),
    pendingAccess: Number(json.pendingAccess ?? 0),
    identityStatus: json.identityStatus != null ? String(json.identityStatus) : undefined,
  };
}

export async function fetchRrhhIdentityDiagnosis(limit = 40): Promise<RrhhIdentityDiagnosis> {
  const res = await grooflowFetch(`/rrhh/identity-diagnosis?limit=${limit}`);
  const json = await readJson(res);
  if (!res.ok || json.ok === false) {
    throw new Error(String(json.error ?? `HTTP ${res.status}`));
  }
  const counts = (json.counts as RrhhIdentityDiagnosis['counts']) ?? {
    bukActivos: 0,
    bukTotal: 0,
    matched: 0,
    pendingAccess: 0,
    usersWithoutDni: 0,
    terminatedStillActive: 0,
    staffInOrganigrama: 0,
    staffWithRut: 0,
    staffMatchedBuk: 0,
    staffWithoutRut: 0,
  };
  const samples = (json.samples as RrhhIdentityDiagnosis['samples']) ?? {
    matched: [],
    pendingAccess: [],
    usersWithoutDni: [],
    terminatedStillActive: [],
    staffWithoutRut: [],
  };
  return {
    policy: (json.policy as RrhhIdentityDiagnosis['policy']) ?? {
      sourceOfTruth: 'buk.pe',
      altaSinUsuario: 'pendiente_notificacion',
      cesadoDesactivaAccesoYOrganigrama: true,
      turnosPublica: 'encargado_sede',
      camposOficialesBuk: [],
      camposEditablesGrooflow: [],
    },
    generatedAt: String(json.generatedAt ?? new Date().toISOString()),
    counts,
    samples,
  };
}

export type RrhhPipelineHealth = {
  ok: boolean;
  summary: string;
  issues: string[];
  rrhh: {
    lastSyncAt: string | null;
    lastSyncOk: boolean | null;
    lastSyncMessage: string | null;
    syncedToday: boolean;
    staffSyncEnabled: boolean;
    intervalMinutes: number;
    pendingAccess: number;
    activos: number;
    linked: number;
    unmatchedPct: number;
    lastPipelineAt: string | null;
  };
  marcaciones: {
    enabled: boolean;
    lastAt: string | null;
    lastOk: boolean | null;
    lastMessage: string | null;
    lastCount: number;
    intervalMinutes: number;
    syncedToday: boolean;
  };
  generatedAt: string;
};

export async function fetchRrhhPipelineHealth(): Promise<RrhhPipelineHealth> {
  const res = await grooflowFetch('/rrhh/pipeline-health');
  const json = await readJson(res);
  if (!res.ok) {
    throw new Error(String(json.error ?? `HTTP ${res.status}`));
  }
  if (json.error && json.summary == null && json.rrhh == null) {
    throw new Error(String(json.error));
  }
  const rrhh = (json.rrhh as RrhhPipelineHealth['rrhh']) ?? {
    lastSyncAt: null,
    lastSyncOk: null,
    lastSyncMessage: null,
    syncedToday: false,
    staffSyncEnabled: true,
    intervalMinutes: 60,
    pendingAccess: 0,
    activos: 0,
    linked: 0,
    unmatchedPct: 0,
    lastPipelineAt: null,
  };
  const marcaciones = (json.marcaciones as RrhhPipelineHealth['marcaciones']) ?? {
    enabled: false,
    lastAt: null,
    lastOk: null,
    lastMessage: null,
    lastCount: 0,
    intervalMinutes: 30,
    syncedToday: false,
  };
  return {
    ok: Boolean(json.pipelineOk ?? json.ok),
    summary: String(json.summary ?? ''),
    issues: Array.isArray(json.issues) ? (json.issues as string[]) : [],
    rrhh,
    marcaciones,
    generatedAt: String(json.generatedAt ?? new Date().toISOString()),
  };
}

/** Dispara pipelines si están due (admin). No fuerza sync. */
export async function runRrhhPipelines(input?: {
  force?: boolean;
  skipMarcaciones?: boolean;
  skipRrhh?: boolean;
}): Promise<{
  ok: boolean;
  message: string;
  health?: RrhhPipelineHealth;
  steps?: Record<string, unknown>;
}> {
  const res = await grooflowFetch('/jobs/pipelines', {
    method: 'POST',
    body: JSON.stringify({
      force: Boolean(input?.force),
      skipMarcaciones: Boolean(input?.skipMarcaciones),
      skipRrhh: Boolean(input?.skipRrhh),
    }),
  });
  const json = await readJson(res);
  if (!res.ok) {
    return { ok: false, message: String(json.error ?? json.message ?? `HTTP ${res.status}`) };
  }
  if (json.error && !json.steps && !json.health) {
    return { ok: false, message: String(json.error) };
  }
  return {
    ok: true,
    message: String((json.health as { summary?: string } | undefined)?.summary ?? 'Pipelines OK'),
    health: json.health as RrhhPipelineHealth | undefined,
    steps: json.steps as Record<string, unknown> | undefined,
  };
}

export async function projectAsistenciaStaffFromRrhh(input?: {
  pruneInactive?: boolean;
  onlySedes?: string[];
}): Promise<{
  ok: boolean;
  message: string;
  added?: number;
  updated?: number;
  unchanged?: number;
  pruned?: number;
  staffTotal?: number;
}> {
  const res = await grooflowFetch('/rrhh/project-asistencia-staff', {
    method: 'POST',
    body: JSON.stringify({
      pruneInactive: input?.pruneInactive !== false,
      onlySedes: input?.onlySedes,
    }),
  });
  const json = await readJson(res);
  if (!res.ok || json.ok === false) {
    return { ok: false, message: String(json.error ?? json.message ?? `HTTP ${res.status}`) };
  }
  const added = Number(json.added ?? 0);
  const updated = Number(json.updated ?? 0);
  const pruned = Number(json.pruned ?? 0);
  return {
    ok: true,
    message: `Organigrama: +${added} · ~${updated} · podados ${pruned} · total ${Number(json.staffTotal ?? 0)}`,
    added,
    updated,
    unchanged: Number(json.unchanged ?? 0),
    pruned,
    staffTotal: Number(json.staffTotal ?? 0),
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
