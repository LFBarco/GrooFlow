import { describe, expect, it } from 'vitest';

import { goLiveAlertSources, isGoLiveExcludedModule } from './goLive';
import { roleHasModuleAccess } from '../utils/rolePermissions';

describe('goLive', () => {
  it('excluye módulos fuera del go-live inicial', () => {
    expect(isGoLiveExcludedModule('Tesorería')).toBe(true);
    expect(isGoLiveExcludedModule('Transacciones')).toBe(false);
  });

  it('bloquea acceso RBAC a módulos excluidos aunque Finanzas sea true', () => {
    expect(
      roleHasModuleAccess(
        { Finanzas: true, Tesorería: true },
        'Tesorería'
      )
    ).toBe(false);
    expect(roleHasModuleAccess({ Finanzas: true }, 'Transacciones')).toBe(true);
  });

  it('desactiva alertas de módulos excluidos', () => {
    const sources = goLiveAlertSources();
    expect(sources.invoices).toBe(false);
    expect(sources.purchaseRequests).toBe(false);
  });
});
