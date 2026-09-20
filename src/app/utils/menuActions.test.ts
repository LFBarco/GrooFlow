import { describe, expect, it } from 'vitest';
import { hasAnyWriteMenuAction, hasMenuAction, type MenuActionsMap } from './menuActions';

describe('menuActions', () => {
  const map: MenuActionsMap = {
    'Gestión Vehicular': {
      ver: true,
      agregar: false,
      editar: false,
      eliminar: false,
    },
    Proveedores: {
      ver: true,
      agregar: true,
      editar: true,
      eliminar: false,
    },
  };

  it('respeta desmarcar agregar/editar/eliminar', () => {
    expect(hasMenuAction(map, 'Gestión Vehicular', 'ver')).toBe(true);
    expect(hasMenuAction(map, 'Gestión Vehicular', 'agregar')).toBe(false);
    expect(hasMenuAction(map, 'Gestión Vehicular', 'editar')).toBe(false);
    expect(hasMenuAction(map, 'Gestión Vehicular', 'eliminar')).toBe(false);
  });

  it('super-admin siempre puede', () => {
    expect(hasMenuAction(map, 'Gestión Vehicular', 'eliminar', { isSuperAdmin: true })).toBe(true);
  });

  it('hasAnyWriteMenuAction', () => {
    expect(hasAnyWriteMenuAction(map, ['Gestión Vehicular'])).toBe(false);
    expect(hasAnyWriteMenuAction(map, ['Proveedores'])).toBe(true);
  });
});
