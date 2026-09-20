/** Acciones CRUD por módulo (espejo de grooflow_menu_actions_for_nivel). */
export type MenuModuleActions = {
  ver?: boolean;
  agregar?: boolean;
  editar?: boolean;
  eliminar?: boolean;
  exportar?: boolean;
  configurar?: boolean;
};

export type MenuActionsMap = Record<string, MenuModuleActions>;

export type MenuActionName = keyof MenuModuleActions;

/** ¿El perfil tiene la acción en el módulo? Super-admin: siempre true. */
export function hasMenuAction(
  menuActions: MenuActionsMap | null | undefined,
  moduleKey: string,
  action: MenuActionName,
  options?: { isSuperAdmin?: boolean }
): boolean {
  if (options?.isSuperAdmin) return true;
  if (!menuActions) return false;
  const mod = menuActions[moduleKey];
  if (!mod) return false;
  return mod[action] === true;
}

/** Alguna acción de escritura (alta/edición/baja/config). */
export function hasAnyWriteMenuAction(
  menuActions: MenuActionsMap | null | undefined,
  moduleKeys: readonly string[],
  options?: { isSuperAdmin?: boolean }
): boolean {
  if (options?.isSuperAdmin) return true;
  if (!menuActions) return false;
  return moduleKeys.some(
    (mod) =>
      hasMenuAction(menuActions, mod, 'agregar') ||
      hasMenuAction(menuActions, mod, 'editar') ||
      hasMenuAction(menuActions, mod, 'eliminar') ||
      hasMenuAction(menuActions, mod, 'configurar')
  );
}
