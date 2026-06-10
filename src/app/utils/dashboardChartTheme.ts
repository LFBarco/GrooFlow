import type { CSSProperties } from 'react';

import { useApp } from '../context/AppContext';
import { getModuleSurfaces, type KpiSurface, type KpiSurfaceKind } from './moduleSurfaces';

export type DashboardChartTheme = {
  INCOME: string;
  EXPENSE: string;
  PROFIT: string;
  PROJECTION: string;
  WARNING: string;
  PURPLE: string;
  BLUE: string;
  axisTick: string;
  gridStroke: string;
  tooltipStyle: CSSProperties;
  tooltipItemStyle: CSSProperties;
  tooltipLabelStyle: CSSProperties;
  title: string;
  subtitle: string;
  labelMuted: string;
  value: string;
  secondaryLabel: string;
  divider: string;
  chartColors: string[];
  activeDotStroke: string;
  cursorFill: string;
  card: {
    background: string;
    border: string;
    boxShadow: string;
    hoverBorder: string;
    hoverShadow: string;
  };
  chartCard: {
    background: string;
    border: string;
    boxShadow: string;
  };
  kpi: Record<KpiSurfaceKind, KpiSurface>;
  isDark: boolean;
};

export function getDashboardChartTheme(isDark: boolean): DashboardChartTheme {
  const s = getModuleSurfaces(isDark);
  const c = s.chart;

  return {
    INCOME: c.income,
    EXPENSE: c.expense,
    PROFIT: c.profit,
    PROJECTION: c.projection,
    WARNING: c.warning,
    PURPLE: c.violet,
    BLUE: c.blue,
    axisTick: s.axisTick,
    gridStroke: s.gridStroke,
    tooltipStyle: s.tooltip,
    tooltipItemStyle: s.tooltipItem,
    tooltipLabelStyle: s.tooltipLabel,
    title: s.pageTitle,
    subtitle: s.pageSubtitle,
    labelMuted: s.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(15, 23, 42, 0.65)',
    value: s.isDark ? '#F0EEFF' : '#0f172a',
    secondaryLabel: s.isDark ? '#8b7cf8' : '#475569',
    divider: s.divider,
    chartColors: c.colors,
    activeDotStroke: s.isDark ? '#1A1826' : '#FFFFFF',
    cursorFill: s.isDark ? 'rgba(139,92,246,0.06)' : 'rgba(79,70,229,0.08)',
    card: s.card,
    chartCard: s.chartCard,
    kpi: s.kpi,
    isDark,
  };
}

export function useDashboardChartTheme(): DashboardChartTheme {
  const { theme } = useApp();
  return getDashboardChartTheme(theme === 'dark');
}
