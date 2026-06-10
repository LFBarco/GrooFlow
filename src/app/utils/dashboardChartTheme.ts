import type { CSSProperties } from 'react';

import { useApp } from '../context/AppContext';

/** Paleta neón — modo oscuro (canónica existente). */
export const DASHBOARD_NEON_DARK = {
  INCOME: '#22d3ee',
  EXPENSE: '#fb7185',
  PROFIT: '#34d399',
  PROJECTION: '#c084fc',
  WARNING: '#fbbf24',
  PURPLE: '#c084fc',
  BLUE: '#818cf8',
} as const;

/** Paleta viva — modo claro (tema blanco profesional). */
export const DASHBOARD_NEON_LIGHT = {
  INCOME: '#059669',
  EXPENSE: '#DC2626',
  PROFIT: '#4F46E5',
  PROJECTION: '#0891B2',
  WARNING: '#D97706',
  PURPLE: '#7C3AED',
  BLUE: '#4F46E5',
} as const;

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
  isDark: boolean;
};

export function getDashboardChartTheme(isDark: boolean): DashboardChartTheme {
  const c = isDark ? DASHBOARD_NEON_DARK : DASHBOARD_NEON_LIGHT;

  return {
    INCOME: c.INCOME,
    EXPENSE: c.EXPENSE,
    PROFIT: c.PROFIT,
    PROJECTION: c.PROJECTION,
    WARNING: c.WARNING,
    PURPLE: c.PURPLE,
    BLUE: c.BLUE,
    axisTick: isDark ? '#6b5fa5' : '#64748B',
    gridStroke: isDark ? 'rgba(139,92,246,0.12)' : 'rgba(203,213,225,0.95)',
    tooltipStyle: isDark
      ? {
          backgroundColor: '#22203A',
          borderColor: '#3D3B5C',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          padding: '12px 16px',
          border: '1px solid #3D3B5C',
        }
      : {
          backgroundColor: '#FFFFFF',
          border: '1px solid #CBD5E1',
          borderRadius: '12px',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12)',
          padding: '12px 16px',
        },
    tooltipItemStyle: isDark
      ? { color: '#E4E0FF', fontSize: '12px' }
      : { color: '#020617', fontSize: '12px', fontWeight: 600 },
    tooltipLabelStyle: isDark
      ? {
          color: '#8b7cf8',
          fontSize: '11px',
          fontWeight: '700',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.08em',
        }
      : {
          color: '#64748B',
          fontSize: '11px',
          fontWeight: '700',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.08em',
        },
    title: isDark ? '#F0EEFF' : '#020617',
    subtitle: isDark ? '#6b5fa5' : '#64748B',
    labelMuted: isDark ? 'rgba(255,255,255,0.35)' : '#64748B',
    value: isDark ? '#F0EEFF' : '#020617',
    secondaryLabel: isDark ? '#8b7cf8' : '#64748B',
    divider: isDark ? 'rgba(255,255,255,0.05)' : '#E2E8F0',
    chartColors: isDark
      ? [c.INCOME, c.PROFIT, c.WARNING, c.EXPENSE, c.PURPLE]
      : [c.INCOME, c.PROFIT, c.WARNING, c.EXPENSE, c.PROJECTION],
    activeDotStroke: isDark ? '#1A1826' : '#FFFFFF',
    cursorFill: isDark ? 'rgba(139,92,246,0.06)' : 'rgba(79,70,229,0.06)',
    card: isDark
      ? {
          background: 'linear-gradient(145deg, #1A1826 0%, #161424 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          hoverBorder: 'rgba(255,255,255,0.12)',
          hoverShadow: '0 12px 40px rgba(0,0,0,0.5)',
        }
      : {
          background: '#FFFFFF',
          border: '1px solid #CBD5E1',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
          hoverBorder: 'rgba(79,70,229,0.28)',
          hoverShadow: '0 20px 40px -8px rgba(0,0,0,0.14)',
        },
    isDark,
  };
}

export function useDashboardChartTheme(): DashboardChartTheme {
  const { theme } = useApp();
  return getDashboardChartTheme(theme === 'dark');
}
