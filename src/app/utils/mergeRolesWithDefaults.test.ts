import { describe, expect, it } from 'vitest';

import { DEFAULT_ROLES } from '../components/users/types';
import { mergeRolesWithDefaults } from './mergeRolesWithDefaults';
import { roleHasModuleAccess } from './rolePermissions';

describe('mergeRolesWithDefaults', () => {
  it('rellena Asistencia en manager cuando falta en datos guardados (roles viejos)', () => {
    const legacyManager = {
      ...DEFAULT_ROLES.find((r) => r.id === 'manager')!,
      permissions: {
        Dashboard: true,
        Finanzas: true,
        Transacciones: true,
        'Flujo de Caja': true,
      },
    };
    const merged = mergeRolesWithDefaults([legacyManager]);
    const mgr = merged.find((r) => r.id === 'manager')!;
    expect(mgr.permissions.Asistencia).toBe(true);
    expect(mgr.permissions['Gestión de Inventario']).toBe(true);
    expect(roleHasModuleAccess(mgr.permissions, 'Asistencia')).toBe(true);
  });

  it('respeta Asistencia false explícito en manager', () => {
    const managerDenied = {
      ...DEFAULT_ROLES.find((r) => r.id === 'manager')!,
      permissions: {
        ...DEFAULT_ROLES.find((r) => r.id === 'manager')!.permissions,
        Asistencia: false,
      },
    };
    const merged = mergeRolesWithDefaults([managerDenied]);
    const mgr = merged.find((r) => r.id === 'manager')!;
    expect(mgr.permissions.Asistencia).toBe(false);
    expect(roleHasModuleAccess(mgr.permissions, 'Asistencia')).toBe(false);
  });

  it('no altera permisos explícitos distintos al default (datos custom en prod)', () => {
    const managerCustom = {
      ...DEFAULT_ROLES.find((r) => r.id === 'manager')!,
      permissions: {
        Dashboard: true,
        Auditoría: true,
        Compras: true,
        Asistencia: true,
      },
    };
    const merged = mergeRolesWithDefaults([managerCustom]);
    const mgr = merged.find((r) => r.id === 'manager')!;
    expect(mgr.permissions.Auditoría).toBe(true);
    expect(mgr.permissions.Compras).toBe(true);
  });
});
