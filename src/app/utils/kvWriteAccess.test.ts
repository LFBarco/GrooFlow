import { describe, expect, it } from 'vitest';

import { canWriteKvKey, isKvPermissionDeniedError } from './kvWriteAccess';

describe('canWriteKvKey', () => {
  it('permite super-admin siempre', () => {
    expect(
      canWriteKvKey('data:products', { isSuperAdmin: true, permissions: null })
    ).toBe(true);
  });

  it('bloquea si aún no hay mapa de permisos', () => {
    expect(
      canWriteKvKey('data:products', { isSuperAdmin: false, permissions: null })
    ).toBe(false);
  });

  it('permite productos con Productos o Compras', () => {
    expect(
      canWriteKvKey('data:products', {
        isSuperAdmin: false,
        permissions: { Productos: true },
      })
    ).toBe(true);
    expect(
      canWriteKvKey('data:products', {
        isSuperAdmin: false,
        permissions: { Compras: true },
      })
    ).toBe(true);
  });

  it('bloquea tesorería / umbrales / inventario sin módulo', () => {
    const perms = { 'Caja Chica': true, Proveedores: true };
    expect(
      canWriteKvKey('data:treasuryInvoices', { isSuperAdmin: false, permissions: perms })
    ).toBe(false);
    expect(
      canWriteKvKey('settings:alertThresholds', { isSuperAdmin: false, permissions: perms })
    ).toBe(false);
    expect(
      canWriteKvKey('data:inventory', { isSuperAdmin: false, permissions: perms })
    ).toBe(false);
  });

  it('detecta errores de permiso', () => {
    const err = Object.assign(new Error('Sin permiso para modificar data:products'), {
      status: 403,
    });
    expect(isKvPermissionDeniedError(err)).toBe(true);
  });
});
