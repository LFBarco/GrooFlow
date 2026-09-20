import type { User } from '../types';
import type { BukPeEmployeeRow } from '../types/rrhh';
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
  return /\bchofer\b|\bconductor\b|flota\s*\/\s*chofer|choferes/.test(blob);
}

export function employeeToChoferOption(e: BukPeEmployeeRow): FleetChoferOption | null {
  if (!isChoferCargoLabel(e.cargo, e.especialidad, e.area, e.roleFamilyName)) return null;
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
    // Preferir RRHH sobre usuario app.
    if (!prev || (prev.source === 'user' && opt.source === 'rrhh')) {
      byName.set(key, opt);
    }
  }
  return [...byName.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
}

/**
 * Lista de choferes: colaboradores Buk.pe (cargo chofer) + fallback usuarios app.
 */
export async function loadFleetChoferOptions(users: User[] = []): Promise<FleetChoferOption[]> {
  const fromUsers = users.map(userToChoferOption).filter((x): x is FleetChoferOption => Boolean(x));
  const fromRrhh: FleetChoferOption[] = [];

  try {
    // 1) Búsqueda dirigida
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
      if (opt) fromRrhh.push(opt);
    }

    // 2) Barrido de activos por si el cargo no matchea "chofer" en search SQL
    if (fromRrhh.length < 5) {
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
          if (opt) fromRrhh.push(opt);
        }
        if (chunk.items.length < pageSize) break;
        page += 1;
      }
    }
  } catch {
    /* sin sesión RRHH: solo usuarios app */
  }

  return dedupeChoferes([...fromRrhh, ...fromUsers]);
}
