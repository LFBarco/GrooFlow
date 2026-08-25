import type { CSSProperties } from 'react';

import { useApp } from '../context/AppContext';

export type KpiSurfaceKind = 'income' | 'expense' | 'profit' | 'projection' | 'warning' | 'neutral' | 'violet';

export type KpiSurface = {
  background: string;
  border: string;
  boxShadow: string;
  accent: string;
  labelColor: string;
  valueColor: string;
  iconBg: string;
  iconBorder: string;
  hoverShadow: string;
  /** Clase CSS GrooFlow Light (glass KPI) */
  className?: string;
  accentGradient?: string;
};

export type ModuleSurfaces = {
  isDark: boolean;
  pageTitle: string;
  pageSubtitle: string;
  accentText: string;
  divider: string;
  card: {
    background: string;
    border: string;
    boxShadow: string;
    hoverShadow: string;
    hoverBorder: string;
  };
  chartCard: {
    background: string;
    border: string;
    boxShadow: string;
  };
  tableHeader: string;
  tableCell: string;
  tableMuted: string;
  monthPicker: {
    background: string;
    border: string;
    text: string;
    icon: string;
    hoverBg: string;
  };
  tooltip: CSSProperties;
  tooltipItem: CSSProperties;
  tooltipLabel: CSSProperties;
  axisTick: string;
  gridStroke: string;
  chart: {
    income: string;
    expense: string;
    profit: string;
    projection: string;
    warning: string;
    violet: string;
    blue: string;
    colors: string[];
  };
  kpi: Record<KpiSurfaceKind, KpiSurface>;
  assistant: {
    background: string;
    border: string;
    boxShadow: string;
    title: string;
    subtitle: string;
    innerBg: string;
    innerBorder: string;
    body: string;
    miniBg: string;
    miniBorder: string;
    label: string;
    value: string;
  };
};

const DARK_KPI_BASE = {
  background: 'linear-gradient(145deg, #1A1826 0%, #161424 100%)',
  border: '1px solid rgba(255,255,255,0.06)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
  labelColor: 'rgba(255,255,255,0.35)',
  valueColor: '#F0EEFF',
  iconBg: 'rgba(255,255,255,0.06)',
  iconBorder: 'rgba(255,255,255,0.1)',
  hoverShadow: '0 12px 40px rgba(0,0,0,0.5)',
};

function darkKpi(accent: string): KpiSurface {
  return {
    ...DARK_KPI_BASE,
    accent,
    iconBg: `${accent}18`,
    iconBorder: `${accent}25`,
    hoverShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 24px ${accent}22`,
  };
}

function lightGlassKpi(
  accent: string,
  glow: string,
  className: string,
  accentGradient: string,
): KpiSurface {
  return {
    background: 'rgba(255, 255, 255, 0.52)',
    border: '1px solid rgba(255, 255, 255, 0.72)',
    boxShadow: `0 12px 40px -12px ${glow}, inset 0 1px 0 rgba(255,255,255,0.9)`,
    accent,
    labelColor: 'rgba(51, 65, 85, 0.88)',
    valueColor: '#0f172a',
    iconBg: 'rgba(255, 255, 255, 0.65)',
    iconBorder: 'rgba(255, 255, 255, 0.85)',
    hoverShadow: `0 22px 48px -14px ${glow}`,
    className,
    accentGradient,
  };
}

const LIGHT_KPI: Record<KpiSurfaceKind, KpiSurface> = {
  income: lightGlassKpi(
    '#059669',
    'rgba(5, 150, 105, 0.35)',
    'gf-glass-kpi gf-kpi-income',
    'linear-gradient(90deg, #059669, #22d3ee)',
  ),
  expense: lightGlassKpi(
    '#dc2626',
    'rgba(220, 38, 38, 0.32)',
    'gf-glass-kpi gf-kpi-expense',
    'linear-gradient(90deg, #dc2626, #e879f9)',
  ),
  profit: lightGlassKpi(
    '#7c3aed',
    'rgba(124, 58, 237, 0.32)',
    'gf-glass-kpi gf-kpi-profit',
    'linear-gradient(90deg, #7c3aed, #4f46e5)',
  ),
  projection: lightGlassKpi(
    '#0891b2',
    'rgba(8, 145, 178, 0.32)',
    'gf-glass-kpi gf-kpi-projection',
    'linear-gradient(90deg, #22d3ee, #38bdf8)',
  ),
  warning: lightGlassKpi(
    '#d97706',
    'rgba(217, 119, 6, 0.28)',
    'gf-glass-kpi gf-kpi-warning',
    'linear-gradient(90deg, #fbbf24, #fb923c)',
  ),
  violet: lightGlassKpi(
    '#7c3aed',
    'rgba(124, 58, 237, 0.28)',
    'gf-glass-kpi gf-kpi-violet',
    'linear-gradient(90deg, #a78bfa, #e879f9)',
  ),
  neutral: lightGlassKpi(
    '#475569',
    'rgba(71, 85, 105, 0.2)',
    'gf-glass-kpi gf-kpi-neutral',
    'linear-gradient(90deg, #94a3b8, #cbd5e1)',
  ),
};

export function getModuleSurfaces(isDark: boolean): ModuleSurfaces {
  if (isDark) {
    return {
      isDark: true,
      pageTitle: '#F0EEFF',
      pageSubtitle: '#6b5fa5',
      accentText: '#8b7cf8',
      divider: 'rgba(255,255,255,0.05)',
      card: {
        background: 'linear-gradient(145deg, #1A1826 0%, #161424 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        hoverShadow: '0 12px 40px rgba(0,0,0,0.5)',
        hoverBorder: 'rgba(255,255,255,0.12)',
      },
      chartCard: {
        background: 'linear-gradient(145deg, #1A1826 0%, #161424 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      },
      tableHeader: 'rgba(255,255,255,0.3)',
      tableCell: '#8b7cf8',
      tableMuted: '#6b5fa5',
      monthPicker: {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        text: '#F0EEFF',
        icon: '#8b7cf8',
        hoverBg: 'rgba(255,255,255,0.05)',
      },
      tooltip: {
        backgroundColor: '#22203A',
        border: '1px solid #3D3B5C',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        padding: '12px 16px',
      },
      tooltipItem: { color: '#E4E0FF', fontSize: '12px' },
      tooltipLabel: {
        color: '#8b7cf8',
        fontSize: '11px',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      },
      axisTick: '#6b5fa5',
      gridStroke: 'rgba(139,92,246,0.12)',
      chart: {
        income: '#22d3ee',
        expense: '#fb7185',
        profit: '#34d399',
        projection: '#c084fc',
        warning: '#fbbf24',
        violet: '#c084fc',
        blue: '#818cf8',
        colors: ['#22d3ee', '#34d399', '#fbbf24', '#fb7185', '#c084fc'],
      },
      assistant: {
        background: 'linear-gradient(145deg, rgba(52,211,153,0.08) 0%, #161424 55%, #1A1826 100%)',
        border: '1px solid rgba(52,211,153,0.22)',
        boxShadow: '0 4px 28px rgba(0,0,0,0.45), 0 0 40px rgba(52,211,153,0.06)',
        title: '#ECFDF5',
        subtitle: '#6b7f72',
        innerBg: 'rgba(0,0,0,0.22)',
        innerBorder: '1px solid rgba(255,255,255,0.06)',
        body: '#CBD5F5',
        miniBg: 'rgba(255,255,255,0.03)',
        miniBorder: '1px solid rgba(255,255,255,0.06)',
        label: '#64748b',
        value: '#F0EEFF',
      },
      kpi: {
        income: darkKpi('#22d3ee'),
        expense: darkKpi('#fb7185'),
        profit: darkKpi('#34d399'),
        projection: darkKpi('#c084fc'),
        warning: darkKpi('#fbbf24'),
        violet: darkKpi('#c084fc'),
        neutral: darkKpi('#818cf8'),
      },
    };
  }

  return {
    isDark: false,
    pageTitle: '#0f172a',
    pageSubtitle: '#475569',
    accentText: '#4f46e5',
    divider: 'rgba(148, 163, 184, 0.35)',
    card: {
      background: 'rgba(255, 255, 255, 0.52)',
      border: '1px solid rgba(255, 255, 255, 0.72)',
      boxShadow: '0 12px 40px -12px rgba(79, 70, 229, 0.18), inset 0 1px 0 rgba(255,255,255,0.9)',
      hoverShadow: '0 22px 48px -14px rgba(79, 70, 229, 0.28)',
      hoverBorder: 'rgba(99, 102, 241, 0.35)',
    },
    chartCard: {
      background: 'rgba(255, 255, 255, 0.55)',
      border: '1px solid rgba(255, 255, 255, 0.75)',
      boxShadow: '0 16px 48px -16px rgba(79, 70, 229, 0.2), inset 0 1px 0 rgba(255,255,255,0.92)',
    },
    tableHeader: '#64748b',
    tableCell: '#334155',
    tableMuted: '#64748b',
    monthPicker: {
      background: 'rgba(255, 255, 255, 0.55)',
      border: '1px solid rgba(255, 255, 255, 0.72)',
      text: '#0f172a',
      icon: '#0891b2',
      hoverBg: 'rgba(34, 211, 238, 0.12)',
    },
    tooltip: {
      backgroundColor: 'rgba(255, 255, 255, 0.92)',
      border: '1px solid rgba(255, 255, 255, 0.85)',
      borderRadius: '14px',
      boxShadow: '0 20px 45px -15px rgba(15, 23, 42, 0.15)',
      padding: '12px 16px',
      backdropFilter: 'blur(12px)',
    },
    tooltipItem: { color: '#0f172a', fontSize: '12px', fontWeight: 600 },
    tooltipLabel: {
      color: '#6366f1',
      fontSize: '11px',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
    },
    axisTick: '#64748b',
    gridStroke: 'rgba(148, 163, 184, 0.45)',
    chart: {
      income: '#059669',
      expense: '#dc2626',
      profit: '#4f46e5',
      projection: '#0891b2',
      warning: '#d97706',
      violet: '#7c3aed',
      blue: '#4f46e5',
      colors: ['#059669', '#4f46e5', '#d97706', '#dc2626', '#0891b2'],
    },
    assistant: {
      background:
        'linear-gradient(145deg, rgba(16,185,129,0.14) 0%, rgba(255,255,255,0.78) 48%, rgba(238,242,255,0.9) 100%)',
      border: '1px solid rgba(16, 185, 129, 0.28)',
      boxShadow: '0 16px 40px -16px rgba(16,185,129,0.28), inset 0 1px 0 rgba(255,255,255,0.92)',
      title: '#0f172a',
      subtitle: '#475569',
      innerBg: 'rgba(255, 255, 255, 0.72)',
      innerBorder: '1px solid rgba(148, 163, 184, 0.35)',
      body: '#334155',
      miniBg: 'rgba(255, 255, 255, 0.82)',
      miniBorder: '1px solid rgba(148, 163, 184, 0.32)',
      label: '#64748b',
      value: '#0f172a',
    },
    kpi: LIGHT_KPI,
  };
}

export function useModuleSurfaces(): ModuleSurfaces {
  const { theme } = useApp();
  return getModuleSurfaces(theme === 'dark');
}
