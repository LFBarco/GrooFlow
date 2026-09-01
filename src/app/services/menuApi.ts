import { getGrooflowApiBase, getGrooflowToken } from './repository/apiBase';
import type { User } from '../types';

export type MenuActionKey = 'ver' | 'agregar' | 'editar' | 'eliminar' | 'exportar' | 'configurar';

export interface MenuActionOption {
  clave: MenuActionKey;
  texto: string;
}

export type MenuActionPermissions = Record<MenuActionKey, boolean>;

export interface MenuItem {
  id: number;
  texto: string;
  icono?: string;
  icono_fa?: string;
  icon_color?: string;
  ruta?: string;
  modulo_key?: string;
  es_padre: number;
  padre_id?: number | null;
  padre_texto?: string;
  orden: number;
  estado: string;
  asignado?: boolean;
  heredado?: boolean;
  extra?: boolean;
  acciones_disponibles?: MenuActionOption[];
  permisos?: MenuActionPermissions;
}

/** @deprecated Use MenuItem */
export type GrooflowMenuItem = MenuItem;

export interface MenuSectionVm {
  section: MenuItem;
  children: MenuItem[];
}

export interface GrooflowNivel {
  id: number;
  nombre: string;
  descripcion: string;
  estado: string;
  full_access: boolean;
}

export interface UsuarioItem {
  id: number;
  username: string;
  nombre: string;
  apellido: string;
  email: string;
  nombre_completo: string;
  nivel_id?: number;
  nivel_nombre?: string;
}

export interface UnassignedUser {
  id: number;
  username: string;
  nombre: string;
  apellido: string;
  email: string;
  nombre_completo: string;
}

export interface UsuarioMenuAssignment {
  usuario_id: number;
  menus: MenuItem[];
  menu_ids: number[];
  nivel_menu_ids?: number[];
  extra_menu_ids?: number[];
  menu_source?: 'personal' | 'nivel' | 'merged' | 'none';
  has_personal_menu?: boolean;
  nivel_id?: number | null;
  nivel_nombre?: string | null;
}

export interface NivelMenuAssignment {
  nivel_id: number;
  menus: MenuItem[];
  menu_ids: number[];
  usuarios_activos?: number;
  full_access?: boolean;
}

export interface NivelMenuMatrixNivel {
  id: number;
  nombre: string;
  descripcion?: string;
  estado: string;
  full_access: boolean;
}

export interface NivelMenuMatrixRow {
  kind: 'parent' | 'child';
  id: number;
  texto: string;
  icono?: string | null;
  icono_fa?: string | null;
  orden?: number;
  padre_id?: number;
  ruta?: string;
  child_count?: number;
  assigned?: Record<string, boolean>;
}

export interface NivelMenuMatrix {
  niveles: NivelMenuMatrixNivel[];
  rows: NivelMenuMatrixRow[];
}

export type MenuReorderPayload = Array<{
  id: number;
  orden: number;
  padre_id: number | null;
  es_padre: number;
}>;

export type MenuPermissionsMap = Record<string, boolean>;

export type GrooflowAuthMenuSection = {
  section: string;
  items: Array<{
    id?: number;
    label: string;
    route: string;
    modulo_key: string;
    icono?: string;
    icon_color?: string;
  }>;
};

export type GrooflowAuthMenuPayload = {
  menu_permissions: MenuPermissionsMap;
  menu_sections: GrooflowAuthMenuSection[];
};

async function menuFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getGrooflowToken();
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  headers.set('X-Groomers-Client', 'grooflow');
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${getGrooflowApiBase()}${path}`, { ...init, headers });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  if (text.trim()) {
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = { error: text.slice(0, 200) };
    }
  }
  if (!res.ok) {
    const err =
      typeof json.error === 'string' && json.error.length < 180 ? json.error : `HTTP ${res.status}`;
    throw new Error(err);
  }
  return json as T;
}

export async function fetchMenuTree(): Promise<{
  sections: MenuSectionVm[];
  orphans: MenuItem[];
  items: MenuItem[];
}> {
  const data = await menuFetch<{
    sections?: MenuSectionVm[];
    orphans?: MenuItem[];
    items?: MenuItem[];
  }>('/menu/tree');
  return {
    sections: data.sections ?? [],
    orphans: data.orphans ?? [],
    items: data.items ?? [],
  };
}

export async function createMenuItem(payload: Partial<MenuItem> & { texto: string }): Promise<MenuItem> {
  const data = await menuFetch<{ item?: MenuItem }>('/menu', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!data.item) throw new Error('No se pudo crear la opción');
  return data.item;
}

export async function updateMenuItem(
  id: number,
  payload: Partial<MenuItem>
): Promise<MenuItem> {
  const data = await menuFetch<{ item?: MenuItem }>('/menu', {
    method: 'PUT',
    body: JSON.stringify({ id, ...payload }),
  });
  if (!data.item) throw new Error('No se pudo actualizar la opción');
  return data.item;
}

export async function deleteMenuItem(id: number): Promise<void> {
  await menuFetch(`/menu?id=${encodeURIComponent(String(id))}`, { method: 'DELETE' });
}

export async function reorderMenuItems(items: MenuReorderPayload): Promise<MenuItem[]> {
  const data = await menuFetch<{ items?: MenuItem[] }>('/menu/reorder', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
  return data.items ?? [];
}

export async function fetchUsuariosList(): Promise<UsuarioItem[]> {
  const data = await menuFetch<{ items?: UsuarioItem[] }>('/usuarios/list');
  return data.items ?? [];
}

export async function fetchUsuarioMenuUnassigned(): Promise<UnassignedUser[]> {
  const data = await menuFetch<{ items?: UnassignedUser[] }>('/usuario-menu/unassigned');
  return data.items ?? [];
}

export async function fetchUsuarioMenuForUser(usuarioId: number): Promise<UsuarioMenuAssignment> {
  const data = await menuFetch<{ ok?: boolean } & UsuarioMenuAssignment>(
    `/usuario-menu/user?usuario_id=${encodeURIComponent(String(usuarioId))}`
  );
  return {
    usuario_id: data.usuario_id ?? usuarioId,
    menus: data.menus ?? [],
    menu_ids: data.menu_ids ?? [],
    nivel_menu_ids: data.nivel_menu_ids ?? [],
    extra_menu_ids: data.extra_menu_ids ?? [],
    menu_source: data.menu_source ?? 'none',
    nivel_nombre: data.nivel_nombre ?? '',
    has_personal_menu: data.has_personal_menu ?? false,
  };
}

export async function syncUsuarioMenu(usuarioId: number, menuIds: number[]): Promise<void> {
  await menuFetch('/usuario-menu/sync', {
    method: 'PUT',
    body: JSON.stringify({ usuario_id: usuarioId, menu_ids: menuIds }),
  });
}

export async function assignUsuarioMenuDashboard(usuarioId?: number): Promise<{ assigned: number }> {
  const data = await menuFetch<{ assigned?: number }>('/usuario-menu/assign-dashboard', {
    method: 'POST',
    body: JSON.stringify(usuarioId ? { usuario_id: usuarioId } : {}),
  });
  return { assigned: data.assigned ?? 0 };
}

export async function fetchNiveles(): Promise<GrooflowNivel[]> {
  const data = await menuFetch<{ items?: GrooflowNivel[] }>('/niveles');
  return data.items ?? [];
}

export async function fetchNivelMenuMatrix(): Promise<NivelMenuMatrix> {
  const data = await menuFetch<{ niveles?: NivelMenuMatrixNivel[]; rows?: NivelMenuMatrixRow[] }>(
    '/nivel-menu/matrix'
  );
  return { niveles: data.niveles ?? [], rows: data.rows ?? [] };
}

export async function fetchNivelMenu(nivelId: number): Promise<NivelMenuAssignment> {
  const data = await menuFetch<
    {
      full_access?: boolean;
      menu_ids?: number[];
      items?: MenuItem[];
      menus?: MenuItem[];
      usuarios_activos?: number;
      nivel_id?: number;
    }
  >(`/nivel-menu/nivel?nivel_id=${encodeURIComponent(String(nivelId))}`);
  const menus = data.menus ?? data.items ?? [];
  return {
    nivel_id: data.nivel_id ?? nivelId,
    menus,
    menu_ids: data.menu_ids ?? [],
    full_access: Boolean(data.full_access),
    usuarios_activos: Number(data.usuarios_activos ?? 0),
  };
}

export async function syncNivelMenu(
  nivelId: number,
  menuIds: number[],
  menuPermissions: Record<number, Partial<MenuActionPermissions>> = {}
): Promise<void> {
  await menuFetch('/nivel-menu/sync', {
    method: 'PUT',
    body: JSON.stringify({ nivel_id: nivelId, menu_ids: menuIds, menu_permissions: menuPermissions }),
  });
}

export async function applyNivelMenuToUsers(
  nivelId: number,
  onlyWithExtras = true
): Promise<{ applied: number }> {
  const data = await menuFetch<{ applied?: number }>('/nivel-menu/apply-users', {
    method: 'POST',
    body: JSON.stringify({ nivel_id: nivelId, only_with_extras: onlyWithExtras }),
  });
  return { applied: data.applied ?? 0 };
}

export async function fetchAuthMenuPayload(): Promise<GrooflowAuthMenuPayload> {
  const data = await menuFetch<{
    menu_permissions?: MenuPermissionsMap;
    menu_sections?: GrooflowAuthMenuSection[];
  }>('/auth/me');
  return {
    menu_permissions: data.menu_permissions ?? {},
    menu_sections: data.menu_sections ?? [],
  };
}

/** Perfil canónico del usuario (Gestión: nombre, nivel, foto). */
export async function fetchAuthProfile(): Promise<User | null> {
  const data = await menuFetch<{ profile?: User }>('/auth/me');
  return data.profile ?? null;
}

export async function fetchAuthMenuPermissions(): Promise<MenuPermissionsMap> {
  const data = await fetchAuthMenuPayload();
  return data.menu_permissions;
}

/** Notifica al shell que el menú lateral debe refrescarse. */
export function notifyMenuChanged(): void {
  window.dispatchEvent(new CustomEvent('grooflow:menu-changed'));
}
