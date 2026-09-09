import { describe, expect, it } from 'vitest';

interface MenuItemConfig {
  id: string;
  label: string;
  viewKey: string;
  allowedRoles: string[];
  visible: boolean;
}

function filterMenuForRole(menu: MenuItemConfig[], userRole: string): MenuItemConfig[] {
  if (userRole === 'super_admin') return menu.filter((m) => m.visible);
  return menu.filter((m) => m.visible && m.allowedRoles.includes(userRole));
}

function toggleMenuItemVisibility(menu: MenuItemConfig[], itemKey: string): MenuItemConfig[] {
  return menu.map((m) => (m.viewKey === itemKey ? { ...m, visible: !m.visible } : m));
}

describe('Menu Config & Assignment Module', () => {
  const sampleMenu: MenuItemConfig[] = [
    { id: '1', label: 'Dashboard', viewKey: 'dashboard', allowedRoles: ['admin', 'manager', 'analyst'], visible: true },
    { id: '2', label: 'Caja Chica', viewKey: 'pettycash', allowedRoles: ['admin', 'manager'], visible: true },
    { id: '3', label: 'Configuración Menú', viewKey: 'menuConfig', allowedRoles: ['admin'], visible: true },
    { id: '4', label: 'Módulo Oculto', viewKey: 'hidden', allowedRoles: ['admin'], visible: false },
  ];

  it('muestra todos los módulos visibles para super_admin', () => {
    const nav = filterMenuForRole(sampleMenu, 'super_admin');
    expect(nav).toHaveLength(3);
  });

  it('filtra módulos restringidos por rol manager', () => {
    const nav = filterMenuForRole(sampleMenu, 'manager');
    expect(nav.map((m) => m.viewKey)).toEqual(['dashboard', 'pettycash']);
  });

  it('alterna la visibilidad de un elemento de menú', () => {
    const updated = toggleMenuItemVisibility(sampleMenu, 'pettycash');
    expect(updated.find((m) => m.viewKey === 'pettycash')?.visible).toBe(false);
  });
});
