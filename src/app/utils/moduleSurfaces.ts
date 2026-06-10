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

const LIGHT_KPI: Record<KpiSurfaceKind, KpiSurface> = {
  income: {
    background: 'linear-gradient(135deg, #a7f3d0 0%, #34d399 42%, #059669 100%)',
    border: '1px solid rgba(4, 120, 87, 0.35)',
    boxShadow: '0 18px 45px -14px rgba(5, 150, 105, 0.65), inset 0 1px 0 rgba(255,255,255,0.55)',
    accent: '#047857',
    labelColor: 'rgba(2, 44, 34, 0.75)',
    valueColor: '#022c22',
    iconBg: 'rgba(255, 255, 255, 0.55)',
    iconBorder: 'rgba(255, 255, 255, 0.65)',
    hoverShadow: '0 24px 50px -16px rgba(5, 150, 105, 0.75)',
  },
  expense: {
    background: 'linear-gradient(135deg, #fecaca 0%, #f87171 38%, #dc2626 100%)',
    border: '1px solid rgba(185, 28, 28, 0.35)',
    boxShadow: '0 18px 45px -14px rgba(220, 38, 38, 0.55), inset 0 1px 0 rgba(255,255,255,0.5)',
    accent: '#b91c1c',
    labelColor: 'rgba(69, 10, 10, 0.75)',
    valueColor: '#450a0a',
    iconBg: 'rgba(255, 255, 255, 0.55)',
    iconBorder: 'rgba(255, 255, 255, 0.65)',
    hoverShadow: '0 24px 50px -16px rgba(220, 38, 38, 0.65)',
  },
  profit: {
    background: 'linear-gradient(135deg, #c7d2fe 0%, #818cf8 40%, #4f46e5 100%)',
    border: '1px solid rgba(67, 56, 202, 0.4)',
    boxShadow: '0 18px 45px -14px rgba(79, 70, 229, 0.55), inset 0 1px 0 rgba(255,255,255,0.55)',
    accent: '#4338ca',
    labelColor: 'rgba(30, 27, 75, 0.75)',
    valueColor: '#1e1b4b',
    iconBg: 'rgba(255, 255, 255, 0.55)',
    iconBorder: 'rgba(255, 255, 255, 0.65)',
    hoverShadow: '0 24px 50px -16px rgba(79, 70, 229, 0.65)',
  },
  projection: {
    background: 'linear-gradient(135deg, #7dd3fc 0%, #38bdf8 42%, #0284c7 100%)',
    border: '1px solid rgba(3, 105, 161, 0.4)',
    boxShadow: '0 18px 45px -14px rgba(8, 145, 178, 0.55), inset 0 1px 0 rgba(255,255,255,0.55)',
    accent: '#0369a1',
    labelColor: 'rgba(12, 74, 110, 0.8)',
    valueColor: '#0c4a6e',
    iconBg: 'rgba(255, 255, 255, 0.55)',
    iconBorder: 'rgba(255, 255, 255, 0.65)',
    hoverShadow: '0 24px 50px -16px rgba(8, 145, 178, 0.65)',
  },
  warning: {
    background: 'linear-gradient(135deg, #fde68a 0%, #fbbf24 45%, #d97706 100%)',
    border: '1px solid rgba(180, 83, 9, 0.4)',
    boxShadow: '0 18px 45px -14px rgba(217, 119, 6, 0.5), inset 0 1px 0 rgba(255,255,255,0.5)',
    accent: '#b45309',
    labelColor: 'rgba(120, 53, 15, 0.8)',
    valueColor: '#78350f',
    iconBg: 'rgba(255, 255, 255, 0.55)',
    iconBorder: 'rgba(255, 255, 255, 0.65)',
    hoverShadow: '0 24px 50px -16px rgba(217, 119, 6, 0.55)',
  },
  violet: {
    background: 'linear-gradient(135deg, #ddd6fe 0%, #a78bfa 42%, #7c3aed 100%)',
    border: '1px solid rgba(109, 40, 217, 0.35)',
    boxShadow: '0 18px 45px -14px rgba(124, 58, 237, 0.5), inset 0 1px 0 rgba(255,255,255,0.55)',
    accent: '#6d28d9',
    labelColor: 'rgba(76, 29, 149, 0.8)',
    valueColor: '#4c1d95',
    iconBg: 'rgba(255, 255, 255, 0.55)',
    iconBorder: 'rgba(255, 255, 255, 0.65)',
    hoverShadow: '0 24px 50px -16px rgba(124, 58, 237, 0.55)',
  },
  neutral: {
    background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)',
    border: '1px solid rgba(100, 116, 139, 0.35)',
    boxShadow: '0 16px 40px -14px rgba(15, 23, 42, 0.2), inset 0 1px 0 rgba(255,255,255,0.7)',
    accent: '#475569',
    labelColor: 'rgba(51, 65, 85, 0.8)',
    valueColor: '#0f172a',
    iconBg: 'rgba(255, 255, 255, 0.65)',
    iconBorder: 'rgba(255, 255, 255, 0.75)',
    hoverShadow: '0 22px 48px -16px rgba(15, 23, 42, 0.25)',
  },
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
    divider: 'rgba(148, 163, 184, 0.45)',
    card: {
      background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 55%, #eef2ff 100%)',
      border: '1px solid rgba(99, 102, 241, 0.22)',
      boxShadow: '0 20px 50px -22px rgba(79, 70, 229, 0.45)',
      hoverShadow: '0 28px 60px -20px rgba(79, 70, 229, 0.5)',
      hoverBorder: 'rgba(79, 70, 229, 0.45)',
    },
    chartCard: {
      background: 'linear-gradient(160deg, #ffffff 0%, #f0f9ff 45%, #ede9fe 100%)',
      border: '1px solid rgba(99, 102, 241, 0.28)',
      boxShadow: '0 24px 55px -24px rgba(79, 70, 229, 0.4), inset 0 1px 0 rgba(255,255,255,0.9)',
    },
    tableHeader: '#64748b',
    tableCell: '#334155',
    tableMuted: '#64748b',
    monthPicker: {
      background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
      border: '1px solid rgba(99, 102, 241, 0.35)',
      text: '#1e1b4b',
      icon: '#4f46e5',
      hoverBg: 'rgba(99, 102, 241, 0.12)',
    },
    tooltip: {
      backgroundColor: '#ffffff',
      border: '1px solid rgba(99, 102, 241, 0.25)',
      borderRadius: '14px',
      boxShadow: '0 20px 45px -15px rgba(15, 23, 42, 0.25)',
      padding: '12px 16px',
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
    kpi: LIGHT_KPI,
  };
}

export function useModuleSurfaces(): ModuleSurfaces {
  const { theme } = useApp();
  return getModuleSurfaces(theme === 'dark');
}
