import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ShieldAlert,
  Brain,
  Landmark,
  Wallet,
  CalendarDays,
  TrendingUp,
  FileText,
  Coins,
  Stethoscope,
  Users,
  BookOpen,
  Truck,
  Package,
  ShoppingCart,
  Settings,
  GitCompare,
} from 'lucide-react';

import type { ViewType } from '../routes';

/** Halos ambientales al 3–8% — solo GrooFlow Light */
export const GF_PALETTE = {
  cyan: 'rgba(34, 211, 238, 0.07)',
  purple: 'rgba(139, 92, 246, 0.07)',
  fuchsia: 'rgba(217, 70, 239, 0.07)',
  emerald: 'rgba(16, 185, 129, 0.07)',
  electricBlue: 'rgba(56, 189, 248, 0.07)',
  indigo: 'rgba(99, 102, 241, 0.07)',
  pink: 'rgba(236, 72, 153, 0.07)',
  navy: 'rgba(30, 58, 138, 0.08)',
  orange: 'rgba(251, 146, 60, 0.06)',
  blue: 'rgba(59, 130, 246, 0.07)',
} as const;

export type ModuleIdentity = {
  ambientA: string;
  ambientB: string;
  accent: string;
  accentGlow: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
};

const DEFAULT_IDENTITY: Omit<ModuleIdentity, 'title' | 'subtitle' | 'icon'> = {
  ambientA: GF_PALETTE.cyan,
  ambientB: GF_PALETTE.purple,
  accent: '#22d3ee',
  accentGlow: 'rgba(34, 211, 238, 0.45)',
};

function id(
  partial: Partial<ModuleIdentity> & Pick<ModuleIdentity, 'title' | 'subtitle' | 'icon'>,
): ModuleIdentity {
  return { ...DEFAULT_IDENTITY, ...partial };
}

export const MODULE_IDENTITY: Record<ViewType, ModuleIdentity> = {
  dashboard: id({
    ambientA: GF_PALETTE.cyan,
    ambientB: GF_PALETTE.purple,
    accent: '#22d3ee',
    accentGlow: 'rgba(34, 211, 238, 0.45)',
    title: 'Resumen Operativo',
    subtitle: 'Bienvenido al panel de control financiero.',
    icon: LayoutDashboard,
  }),
  alerts: id({
    ambientA: GF_PALETTE.fuchsia,
    ambientB: GF_PALETTE.purple,
    accent: '#e879f9',
    accentGlow: 'rgba(232, 121, 249, 0.45)',
    title: 'Centro de Alertas',
    subtitle: 'Notificaciones y avisos del sistema.',
    icon: ShieldAlert,
  }),
  analytics: id({
    ambientA: GF_PALETTE.cyan,
    ambientB: GF_PALETTE.purple,
    accent: '#a78bfa',
    accentGlow: 'rgba(167, 139, 250, 0.45)',
    title: 'Inteligencia Financiera',
    subtitle: 'Análisis profundo y KPIs impulsados por datos.',
    icon: Brain,
  }),
  treasury: id({
    ambientA: GF_PALETTE.emerald,
    ambientB: GF_PALETTE.cyan,
    accent: '#34d399',
    accentGlow: 'rgba(52, 211, 153, 0.45)',
    title: 'Tesorería',
    subtitle: 'Mesa de pagos y control de liquidez.',
    icon: Landmark,
  }),
  transactions: id({
    ambientA: GF_PALETTE.emerald,
    ambientB: GF_PALETTE.cyan,
    accent: '#34d399',
    accentGlow: 'rgba(52, 211, 153, 0.45)',
    title: 'Gestión de Transacciones',
    subtitle: 'Registro y control de movimientos financieros.',
    icon: Wallet,
  }),
  cashflow: id({
    ambientA: GF_PALETTE.cyan,
    ambientB: GF_PALETTE.purple,
    accent: '#22d3ee',
    accentGlow: 'rgba(34, 211, 238, 0.45)',
    title: 'Flujo de Caja',
    subtitle: 'Proyección y análisis de liquidez.',
    icon: CalendarDays,
  }),
  pnl: id({
    ambientA: GF_PALETTE.emerald,
    ambientB: GF_PALETTE.cyan,
    accent: '#c084fc',
    accentGlow: 'rgba(192, 132, 252, 0.45)',
    title: 'Estado de Resultados',
    subtitle: 'P&L y rentabilidad del periodo.',
    icon: TrendingUp,
  }),
  reports: id({
    ambientA: GF_PALETTE.cyan,
    ambientB: GF_PALETTE.indigo,
    accent: '#fbbf24',
    accentGlow: 'rgba(251, 191, 36, 0.4)',
    title: 'Reportes',
    subtitle: 'Resúmenes y exportación de información.',
    icon: FileText,
  }),
  pettycash: id({
    ambientA: GF_PALETTE.emerald,
    ambientB: GF_PALETTE.cyan,
    accent: '#fbbf24',
    accentGlow: 'rgba(251, 191, 36, 0.4)',
    title: 'Control de Caja Chica',
    subtitle: 'Control de fondo fijo y gastos menores.',
    icon: Coins,
  }),
  fees: id({
    ambientA: GF_PALETTE.purple,
    ambientB: GF_PALETTE.fuchsia,
    accent: '#a78bfa',
    accentGlow: 'rgba(167, 139, 250, 0.45)',
    title: 'Honorarios',
    subtitle: 'Profesionales y recibos por honorarios.',
    icon: Stethoscope,
  }),
  providers: id({
    ambientA: GF_PALETTE.indigo,
    ambientB: GF_PALETTE.cyan,
    accent: '#818cf8',
    accentGlow: 'rgba(129, 140, 248, 0.45)',
    title: 'Proveedores',
    subtitle: 'Directorio y relación con proveedores.',
    icon: Users,
  }),
  accounting: id({
    ambientA: GF_PALETTE.purple,
    ambientB: GF_PALETTE.electricBlue,
    accent: '#818cf8',
    accentGlow: 'rgba(129, 140, 248, 0.45)',
    title: 'Contabilidad',
    subtitle: 'Plan de cuentas y registros contables.',
    icon: BookOpen,
  }),
  products: id({
    ambientA: GF_PALETTE.fuchsia,
    ambientB: GF_PALETTE.purple,
    accent: '#e879f9',
    accentGlow: 'rgba(232, 121, 249, 0.45)',
    title: 'Catálogo de Productos',
    subtitle: 'Control comercial, proveedores y stock disponible.',
    icon: Package,
  }),
  requests: id({
    ambientA: GF_PALETTE.orange,
    ambientB: GF_PALETTE.purple,
    accent: '#fb923c',
    accentGlow: 'rgba(251, 146, 60, 0.4)',
    title: 'Solicitudes de Compra',
    subtitle: 'Pedidos y aprobaciones de compras.',
    icon: ShoppingCart,
  }),
  audit: id({
    ambientA: GF_PALETTE.fuchsia,
    ambientB: GF_PALETTE.purple,
    accent: '#e879f9',
    accentGlow: 'rgba(232, 121, 249, 0.45)',
    title: 'Auditoría',
    subtitle: 'Trazabilidad y registro de actividad.',
    icon: ShieldAlert,
  }),
  users: id({
    ambientA: GF_PALETTE.purple,
    ambientB: GF_PALETTE.pink,
    accent: '#c084fc',
    accentGlow: 'rgba(192, 132, 252, 0.45)',
    title: 'Usuarios y Roles',
    subtitle: 'Accesos, permisos y perfiles.',
    icon: Users,
  }),
  config: id({
    ambientA: GF_PALETTE.navy,
    ambientB: GF_PALETTE.cyan,
    accent: '#22d3ee',
    accentGlow: 'rgba(34, 211, 238, 0.45)',
    title: 'Configuración',
    subtitle: 'Parámetros del sistema y personalización.',
    icon: Settings,
  }),
  fleet: id({
    ambientA: GF_PALETTE.cyan,
    ambientB: GF_PALETTE.blue,
    accent: '#22d3ee',
    accentGlow: 'rgba(34, 211, 238, 0.45)',
    title: 'Flota Clínica',
    subtitle: 'Vehículos, mantenimiento y decisiones.',
    icon: Truck,
  }),
  inventory: id({
    ambientA: GF_PALETTE.cyan,
    ambientB: GF_PALETTE.blue,
    accent: '#38bdf8',
    accentGlow: 'rgba(56, 189, 248, 0.45)',
    title: 'Inventario de Equipos',
    subtitle: 'Equipos, mantenimientos y disponibilidad.',
    icon: Package,
  }),
  reconciliation: id({
    ambientA: GF_PALETTE.emerald,
    ambientB: GF_PALETTE.blue,
    accent: '#10b981',
    accentGlow: 'rgba(16, 185, 129, 0.45)',
    title: 'Conciliación de Ingresos',
    subtitle: 'Ventas vs banco, pasarelas y excepciones.',
    icon: GitCompare,
  }),
};

export function getModuleIdentity(view: ViewType): ModuleIdentity {
  return MODULE_IDENTITY[view] ?? MODULE_IDENTITY.dashboard;
}

export function buildAmbientBackground(identity: ModuleIdentity): string {
  return `
    radial-gradient(ellipse 75% 65% at 12% 18%, ${identity.ambientA} 0%, transparent 58%),
    radial-gradient(ellipse 70% 60% at 88% 82%, ${identity.ambientB} 0%, transparent 55%),
    radial-gradient(ellipse 50% 45% at 50% 50%, ${identity.ambientA} 0%, transparent 70%),
    linear-gradient(168deg, #f8fafc 0%, #eef2ff 38%, #f0f9ff 72%, #fdf4ff 100%)
  `;
}
