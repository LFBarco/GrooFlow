import type { User } from '../types';
import type { BukPeEmployeeRow } from '../types/rrhh';
import { getGrooflowApiBase, getGrooflowToken } from '../services/repository/apiBase';
import { fetchRrhhEmployeesPage } from './rrhhApi';

export type FleetChoferOption = {
  id: string;
  fullName: string;
  cargo?: string;
  source: 'rrhh' | 'user';
};

/** Cargo / área / especialidad que identifican a un chofer. */
export function isChoferCargoLabel(...parts: Array<string | null | undefined>): boolean {
  const blob = parts
    .map((p) => (p ?? '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ');
  if (!blob) return false;
  return (
    /\bchofer(es|a|as)?\b/.test(blob) ||
    /\bconductor(es|a|as)?\b/.test(blob) ||
    /flota\s*\/\s*chofer/.test(blob) ||
    /\bflota\b/.test(blob) && /\b(chofer|conductor)/.test(blob)
  );
}

export function employeeToChoferOption(e: BukPeEmployeeRow): FleetChoferOption | null {
  if (!isChoferCargoLabel(e.cargo, e.especialidad, e.area, e.roleFamilyName, e.areaAsistencia)) {
    return null;
  }
  const fullName = (e.fullName || `${e.firstName ?? ''} ${e.surname ?? ''}`).trim();
  if (!fullName) return null;
  return {
    id: `buk:${e.bukId}`,
    fullName,
    cargo: e.cargo || e.especialidad || undefined,
    source: 'rrhh',
  };
}

export function userToChoferOption(u: User): FleetChoferOption | null {
  if (u.status === 'inactive') return null;
  if (!isChoferCargoLabel(u.jobTitle, u.workArea, u.roleLabel)) return null;
  const fullName = (u.name || '').trim();
  if (!fullName) return null;
  return {
    id: `user:${u.id}`,
    fullName,
    cargo: u.jobTitle || u.workArea || undefined,
    source: 'user',
  };
}

function dedupeChoferes(options: FleetChoferOption[]): FleetChoferOption[] {
  const byName = new Map<string, FleetChoferOption>();
  for (const opt of options) {
    const key = opt.fullName.trim().toLowerCase();
    if (!key) continue;
    const prev = byName.get(key);
    if (!prev || (prev.source === 'user' && opt.source === 'rrhh')) {
      byName.set(key, opt);
    }
  }
  return [...byName.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
}

/** Endpoint Flota: misma lista para admin y operadores con Gestión Vehicular. */
async function fetchFleetChoferesApi(): Promise<FleetChoferOption[]> {
  const token = getGrooflowToken();
  if (!token) throw new Error('Sin sesión');
  const res = await fetch(`${getGrooflowApiBase()}/fleet/choferes`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'X-Groomers-Client': 'grooflow',
    },
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  if (text.trim()) {
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = {};
    }
  }
  if (!res.ok || json.ok === false) {
    throw new Error(String(json.error ?? `HTTP ${res.status}`));
  }
  const items = Array.isArray(json.items) ? json.items : [];
  return items
    .map((raw) => {
      const row = raw as {
        id?: string;
        fullName?: string;
        cargo?: string | null;
        source?: string;
        bukId?: number;
      };
      const fullName = String(row.fullName ?? '').trim();
      if (!fullName) return null;
      const id =
        String(row.id ?? '').trim() ||
        (row.bukId != null ? `buk:${row.bukId}` : `name:${fullName.toLowerCase()}`);
      return {
        id,
        fullName,
        cargo: row.cargo ? String(row.cargo) : undefined,
        source: 'rrhh' as const,
      };
    })
    .filter((x): x is FleetChoferOption => Boolean(x));
}

/**
 * Lista de choferes: endpoint Flota (todos los perfiles con Gestión Vehicular),
 * fallback RRHH si aplica, + usuarios app.
 */
export async function loadFleetChoferOptions(users: User[] = []): Promise<FleetChoferOption[]> {
  const fromUsers = users.map(userToChoferOption).filter((x): x is FleetChoferOption => Boolean(x));
  let fromApi: FleetChoferOption[] = [];

  try {
    fromApi = await fetchFleetChoferesApi();
  } catch {
    /* sin endpoint o sin permiso Gestión Vehicular: intentar RRHH (admin) */
    try {
      const searched = await fetchRrhhEmployeesPage({
        tab: 'activos',
        page: 1,
        pageSize: 100,
        search: 'chofer',
        orderBy: 'full_name',
        orderDir: 'ASC',
      });
      for (const e of searched.items) {
        const opt = employeeToChoferOption(e);
        if (opt) fromApi.push(opt);
      }
      if (fromApi.length < 5) {
        let page = 1;
        const pageSize = 100;
        let total = Infinity;
        while ((page - 1) * pageSize < total && page <= 5) {
          const chunk = await fetchRrhhEmployeesPage({
            tab: 'activos',
            page,
            pageSize,
            orderBy: 'full_name',
            orderDir: 'ASC',
          });
          total = chunk.filtered || chunk.total || 0;
          for (const e of chunk.items) {
            const opt = employeeToChoferOption(e);
            if (opt) fromApi.push(opt);
          }
          if (chunk.items.length < pageSize) break;
          page += 1;
        }
      }
    } catch {
      /* solo usuarios */
    }
  }

  return dedupeChoferes([...fromApi, ...fromUsers]);
}
