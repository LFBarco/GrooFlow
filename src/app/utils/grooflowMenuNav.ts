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
  UserCheck,
  ShoppingCart,
  GitCompare,
  Settings,
  ListTree,
  ShieldCheck,
  Circle,
  Shirt,
} from 'lucide-react';
import { pathToView, VIEW_TO_PATH, type ViewType } from '../routes';

const KNOWN_MENU_PATHS = new Set(Object.values(VIEW_TO_PATH));

export type GrooflowNavMenuItem = {
  id?: number;
  label: string;
  route: string;
  modulo_key: string;
  icono?: string;
};

export type GrooflowNavMenuSection = {
  section: string;
  items: GrooflowNavMenuItem[];
};

const MODULE_ICONS: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  Alertas: ShieldAlert,
  Analítica: Brain,
  Tesorería: Landmark,
  Transacciones: Wallet,
  'Flujo de Caja': CalendarDays,
  'Estado de Resultados': TrendingUp,
  Reportes: FileText,
  'Caja Chica': Coins,
  Honorarios: Stethoscope,
  Proveedores: Users,
  Contabilidad: BookOpen,
  'Gestión Vehicular': Truck,
  'Gestión de Inventario': Package,
  Asistencia: UserCheck,
  Turnos: CalendarDays,
  'Entrega de Uniformes': Shirt,
  Compras: ShoppingCart,
  Productos: Package,
  Auditoría: ShieldAlert,
  Conciliación: GitCompare,
  Configuración: Settings,
  'Admin Menú GrooFlow': ListTree,
  'Asignación Menú GrooFlow': ShieldCheck,
};

export function menuRouteToView(route: string): ViewType | null {
  let normalized = (route || '/').trim();
  if (normalized === '/grooflow') normalized = '/';
  else if (normalized.startsWith('/grooflow/')) {
    normalized = normalized.slice('/grooflow'.length) || '/';
  }
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  normalized = normalized.replace(/\/$/, '') || '/';
  if (!KNOWN_MENU_PATHS.has(normalized)) return null;
  return pathToView(normalized);
}

export function menuItemIcon(moduloKey: string): LucideIcon {
  return MODULE_ICONS[moduloKey] ?? Circle;
}

export function menuItemColorClass(moduloKey: string): string {
  const map: Record<string, string> = {
    Dashboard: 'text-sky-400 group-hover/btn:text-sky-300',
    Alertas: 'text-rose-400 group-hover/btn:text-rose-300',
    Analítica: 'text-violet-400 group-hover/btn:text-violet-300',
    Configuración: 'text-slate-400 group-hover/btn:text-slate-300',
    'Admin Menú GrooFlow': 'text-cyan-400 group-hover/btn:text-cyan-300',
    'Asignación Menú GrooFlow': 'text-emerald-400 group-hover/btn:text-emerald-300',
  };
  return map[moduloKey] ?? 'text-indigo-400 group-hover/btn:text-indigo-300';
}
