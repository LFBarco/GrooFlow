import { pathToView, VIEW_TO_PATH, type ViewType } from '../routes';
import { canonicalizeMenuRoute } from './menuRouteCatalog';
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
  const normalized = canonicalizeMenuRoute(route);
  if (!KNOWN_MENU_PATHS.has(normalized)) return null;
  return pathToView(normalized);
}

/** Icono Font Awesome desde BD (sin mapa Lucide local). */
export function menuItemFaIcon(icono?: string | null): string {
  return normalizeMenuIcon(icono);
}

export { resolveMenuIconColorClass };
