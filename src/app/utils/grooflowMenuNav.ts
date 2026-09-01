import { pathToView, VIEW_TO_PATH, type ViewType } from '../routes';
import { normalizeMenuIcon } from './menuIcon';
import { resolveMenuIconColorClass } from './menuIconColors';

export type GrooflowNavMenuItem = {
  id?: number;
  label: string;
  route: string;
  modulo_key: string;
  icono?: string;
  icon_color?: string;
};

export type GrooflowNavMenuSection = {
  section: string;
  items: GrooflowNavMenuItem[];
};

const KNOWN_MENU_PATHS = new Set(Object.values(VIEW_TO_PATH));

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

/** Icono Font Awesome desde BD (sin mapa Lucide local). */
export function menuItemFaIcon(icono?: string | null): string {
  return normalizeMenuIcon(icono);
}

export { resolveMenuIconColorClass };
