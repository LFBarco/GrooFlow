import type {
  AsistenciaCustomOrgColumn,
  AsistenciaOrgChartColor,
  AsistenciaOrgNodeStyle,
  AsistenciaOrgSubColumn,
  AsistenciaSedeProfile,
} from '../types/asistencia';

export const ORG_CHART_COLOR_OPTIONS: { value: AsistenciaOrgChartColor; label: string }[] = [
  { value: 'default', label: 'Gris' },
  { value: 'blue', label: 'Azul' },
  { value: 'lightblue', label: 'Celeste' },
  { value: 'green', label: 'Verde' },
  { value: 'orange', label: 'Naranja' },
  { value: 'red', label: 'Rojo' },
  { value: 'violet', label: 'Violeta' },
  { value: 'fuchsia', label: 'Fucsia' },
  { value: 'pink', label: 'Rosa' },
];

export const ORG_CHART_COLOR_STYLES: Record<
  AsistenciaOrgChartColor,
  { border: string; bg: string; bar: string; line: string; header: string }
> = {
  default: {
    border: 'border-slate-300 dark:border-slate-600',
    bg: 'bg-slate-50 dark:bg-slate-900/60',
    bar: 'bg-slate-500',
    line: 'bg-slate-400',
    header: 'border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/60',
  },
  blue: {
    border: 'border-blue-500',
    bg: 'bg-blue-50/90 dark:bg-blue-950/30',
    bar: 'bg-blue-600',
    line: 'bg-blue-500',
    header: 'border-blue-500 bg-blue-50 dark:border-blue-500/50 dark:bg-blue-950/30',
  },
  lightblue: {
    border: 'border-sky-400',
    bg: 'bg-sky-50/90 dark:bg-sky-950/30',
    bar: 'bg-sky-500',
    line: 'bg-sky-400',
    header: 'border-sky-400 bg-sky-50 dark:border-sky-500/40 dark:bg-sky-950/30',
  },
  green: {
    border: 'border-emerald-500',
    bg: 'bg-emerald-50/90 dark:bg-emerald-950/30',
    bar: 'bg-emerald-500',
    line: 'bg-emerald-500',
    header: 'border-emerald-500 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-950/30',
  },
  orange: {
    border: 'border-orange-500',
    bg: 'bg-orange-50/90 dark:bg-orange-950/30',
    bar: 'bg-orange-500',
    line: 'bg-orange-500',
    header: 'border-orange-500 bg-orange-50 dark:border-orange-500/40 dark:bg-orange-950/30',
  },
  red: {
    border: 'border-red-400',
    bg: 'bg-red-50/90 dark:bg-red-950/30',
    bar: 'bg-red-500',
    line: 'bg-red-400',
    header: 'border-red-400 bg-red-50 dark:border-red-500/40 dark:bg-red-950/30',
  },
  violet: {
    border: 'border-violet-500',
    bg: 'bg-violet-50/90 dark:bg-violet-950/30',
    bar: 'bg-violet-500',
    line: 'bg-violet-500',
    header: 'border-violet-500 bg-violet-50 dark:border-violet-500/40 dark:bg-violet-950/30',
  },
  fuchsia: {
    border: 'border-fuchsia-400',
    bg: 'bg-fuchsia-50/90 dark:bg-fuchsia-950/30',
    bar: 'bg-fuchsia-500',
    line: 'bg-fuchsia-400',
    header: 'border-fuchsia-400 bg-fuchsia-50 dark:border-fuchsia-500/40 dark:bg-fuchsia-950/30',
  },
  pink: {
    border: 'border-pink-400',
    bg: 'bg-pink-50/90 dark:bg-pink-950/30',
    bar: 'bg-pink-500',
    line: 'bg-pink-400',
    header: 'border-pink-400 bg-pink-50 dark:border-pink-500/40 dark:bg-pink-950/30',
  },
};

const BUILTIN_DEFAULT_COLOR: Record<string, AsistenciaOrgChartColor> = {
  administracion: 'fuchsia',
  medica: 'lightblue',
  peluqueria: 'pink',
};

export function resolveOrgNodeStyle(
  profile: AsistenciaSedeProfile,
  nodeId: string
): Required<AsistenciaOrgNodeStyle> {
  const fromStyles = profile.orgNodeStyles?.[nodeId];
  const custom = (profile.customOrgColumns ?? []).find((c) => c.id === nodeId);
  const sub = (profile.subOrgColumns ?? []).find((s) => s.id === nodeId);
  const color =
    fromStyles?.color ??
    custom?.color ??
    sub?.color ??
    BUILTIN_DEFAULT_COLOR[nodeId] ??
    'default';
  const childrenLayout =
    fromStyles?.childrenLayout ?? custom?.childrenLayout ?? sub?.childrenLayout ?? 'vertical';
  return { color, childrenLayout };
}

export function patchOrgNodeStyle(
  profile: AsistenciaSedeProfile,
  nodeId: string,
  patch: AsistenciaOrgNodeStyle
): {
  orgNodeStyles: Record<string, AsistenciaOrgNodeStyle>;
  customOrgColumns: AsistenciaCustomOrgColumn[];
  subOrgColumns: AsistenciaOrgSubColumn[];
} {
  const current = resolveOrgNodeStyle(profile, nodeId);
  const nextStyle: AsistenciaOrgNodeStyle = {
    color: patch.color ?? current.color,
    childrenLayout: patch.childrenLayout ?? current.childrenLayout,
  };

  const customOrgColumns = (profile.customOrgColumns ?? []).map((c) =>
    c.id === nodeId ? { ...c, ...nextStyle } : c
  );
  const subOrgColumns = (profile.subOrgColumns ?? []).map((s) =>
    s.id === nodeId ? { ...s, ...nextStyle } : s
  );
  const orgNodeStyles = {
    ...(profile.orgNodeStyles ?? {}),
    [nodeId]: nextStyle,
  };
  return { orgNodeStyles, customOrgColumns, subOrgColumns };
}
