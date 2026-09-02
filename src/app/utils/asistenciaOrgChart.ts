import type {
  AsistenciaLiveSedeSummary,
  AsistenciaOrgChartNode,
  AsistenciaOrgChartTreeNode,
  AsistenciaSedeProfile,
  AsistenciaSettings,
  AsistenciaStaffLiveState,
} from '../types/asistencia';
import { mergeAsistenciaSettings } from './asistenciaData';
import { getSedeProfile } from './asistenciaStaff';
import { resolveOrgAssignableAreas, resolveOrgColumns, resolveOrgSubColumns } from './asistenciaOrgColumns';

export const ORG_CHART_COLOR_STYLES: Record<
  NonNullable<AsistenciaOrgChartNode['color']>,
  { border: string; bg: string; line: string }
> = {
  default: {
    border: 'border-slate-400',
    bg: 'bg-white dark:bg-slate-900',
    line: 'bg-slate-400',
  },
  blue: {
    border: 'border-blue-600',
    bg: 'bg-blue-50/80 dark:bg-blue-950/30',
    line: 'bg-blue-600',
  },
  lightblue: {
    border: 'border-sky-400',
    bg: 'bg-sky-50/80 dark:bg-sky-950/30',
    line: 'bg-sky-400',
  },
  green: {
    border: 'border-emerald-500',
    bg: 'bg-emerald-50/80 dark:bg-emerald-950/30',
    line: 'bg-emerald-500',
  },
  orange: {
    border: 'border-orange-500',
    bg: 'bg-orange-50/80 dark:bg-orange-950/30',
    line: 'bg-orange-500',
  },
  red: {
    border: 'border-red-400',
    bg: 'bg-red-50/80 dark:bg-red-950/30',
    line: 'bg-red-400',
  },
  violet: {
    border: 'border-violet-500',
    bg: 'bg-violet-50/80 dark:bg-violet-950/30',
    line: 'bg-violet-500',
  },
};

function newOrgChartNodeId() {
  return `org_${Math.random().toString(36).slice(2, 9)}`;
}

function upsertSedeProfile(
  settings: AsistenciaSettings,
  sedeName: string,
  patch: Partial<AsistenciaSedeProfile>
): AsistenciaSettings {
  const merged = mergeAsistenciaSettings(settings);
  const profile = getSedeProfile(merged, sedeName);
  const rest = (merged.sedeProfiles ?? []).filter((p) => p.sedeName !== sedeName);
  return mergeAsistenciaSettings({
    ...merged,
    sedeProfiles: [...rest, { ...profile, sedeName, ...patch }],
  });
}

export function sortOrgChartNodes(nodes: AsistenciaOrgChartNode[]): AsistenciaOrgChartNode[] {
  return [...nodes].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function buildOrgChartTree(
  nodes: AsistenciaOrgChartNode[],
  summary: AsistenciaLiveSedeSummary
): AsistenciaOrgChartTreeNode[] {
  const sorted = sortOrgChartNodes(nodes);
  const staffByArea = new Map<string, AsistenciaStaffLiveState[]>();

  for (const area of summary.areas) {
    staffByArea.set(area.area, area.staff.filter((s) => !s.staff.isManager));
    for (const sub of area.subAreas ?? []) {
      staffByArea.set(sub.area, sub.staff.filter((s) => !s.staff.isManager));
    }
  }

  const build = (parentId: string | null, visited: Set<string> = new Set()): AsistenciaOrgChartTreeNode[] =>
    sorted
      .filter((n) => n.parentId === parentId)
      .map((node) => {
        if (visited.has(node.id)) {
          return { node, children: [], staff: [], activeCount: 0, totalCount: 0 };
        }
        const nextVisited = new Set(visited);
        nextVisited.add(node.id);
        const staff = node.areaId ? (staffByArea.get(node.areaId) ?? []) : [];
        const children = build(node.id, nextVisited);
        const activeCount = staff.filter(
          (s) => s.status === 'trabajando' || s.status === 'presente' || s.status === 'tarde'
        ).length;
        return {
          node,
          children,
          staff,
          activeCount,
          totalCount: staff.length || children.reduce((n, c) => n + c.totalCount, 0),
        };
      });

  return build(null);
}

/** Genera nodos iniciales desde columnas y subcolumnas existentes. */
export function buildOrgChartFromColumns(profile: AsistenciaSedeProfile): AsistenciaOrgChartNode[] {
  const nodes: AsistenciaOrgChartNode[] = [];
  const colors: AsistenciaOrgChartNode['color'][] = ['blue', 'lightblue', 'green', 'orange', 'violet'];
  const columns = resolveOrgColumns(profile);
  columns.forEach((col, i) => {
    const colId = newOrgChartNodeId();
    nodes.push({
      id: colId,
      parentId: null,
      label: col.label,
      childrenLayout: 'horizontal',
      color: colors[i % colors.length],
      areaId: col.id,
      sortOrder: i,
    });
    const subs = resolveOrgSubColumns(profile, col.id);
    subs.forEach((sub, j) => {
      nodes.push({
        id: newOrgChartNodeId(),
        parentId: colId,
        label: sub.label,
        childrenLayout: 'vertical',
        color: colors[i % colors.length],
        areaId: sub.id,
        sortOrder: j,
      });
    });
  });
  return nodes;
}

export function applyOrgChartNodes(
  settings: AsistenciaSettings,
  sedeName: string,
  nodes: AsistenciaOrgChartNode[],
  mode: 'columns' | 'tree' = 'tree'
): AsistenciaSettings {
  return upsertSedeProfile(settings, sedeName, {
    orgChartNodes: nodes,
    orgChartMode: mode,
  });
}

export function applyAddOrgChartNode(
  settings: AsistenciaSettings,
  sedeName: string,
  input: Omit<AsistenciaOrgChartNode, 'id' | 'sortOrder'> & { sortOrder?: number }
): AsistenciaSettings {
  const profile = getSedeProfile(settings, sedeName);
  const nodes = profile.orgChartNodes ?? [];
  const siblings = nodes.filter((n) => n.parentId === input.parentId);
  const node: AsistenciaOrgChartNode = {
    ...input,
    id: newOrgChartNodeId(),
    label: input.label.trim() || 'Nuevo nodo',
    sortOrder: input.sortOrder ?? siblings.length,
  };
  return upsertSedeProfile(settings, sedeName, {
    orgChartNodes: [...nodes, node],
    orgChartMode: 'tree',
  });
}

export function applyUpdateOrgChartNode(
  settings: AsistenciaSettings,
  sedeName: string,
  nodeId: string,
  patch: Partial<AsistenciaOrgChartNode>
): AsistenciaSettings {
  const profile = getSedeProfile(settings, sedeName);
  const nodes = (profile.orgChartNodes ?? []).map((n) =>
    n.id === nodeId ? { ...n, ...patch, id: n.id } : n
  );
  return upsertSedeProfile(settings, sedeName, { orgChartNodes: nodes });
}

export function applyRemoveOrgChartNode(
  settings: AsistenciaSettings,
  sedeName: string,
  nodeId: string
): AsistenciaSettings {
  const profile = getSedeProfile(settings, sedeName);
  const toRemove = new Set<string>([nodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of profile.orgChartNodes ?? []) {
      if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
        toRemove.add(n.id);
        changed = true;
      }
    }
  }
  const nodes = (profile.orgChartNodes ?? []).filter((n) => !toRemove.has(n.id));
  return upsertSedeProfile(settings, sedeName, { orgChartNodes: nodes });
}

export function applySetOrgChartMode(
  settings: AsistenciaSettings,
  sedeName: string,
  mode: 'columns' | 'tree'
): AsistenciaSettings {
  return upsertSedeProfile(settings, sedeName, { orgChartMode: mode });
}

export function orgChartAssignableOptions(profile: AsistenciaSedeProfile) {
  return resolveOrgAssignableAreas(profile);
}

export function orgChartParentOptions(
  nodes: AsistenciaOrgChartNode[],
  excludeId?: string
): { id: string | null; label: string }[] {
  const out: { id: string | null; label: string }[] = [{ id: null, label: 'Raíz (bajo sede)' }];
  for (const n of sortOrgChartNodes(nodes)) {
    if (n.id === excludeId) continue;
    out.push({ id: n.id, label: n.label });
  }
  return out;
}
