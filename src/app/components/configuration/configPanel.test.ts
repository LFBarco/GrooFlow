import { describe, expect, it } from 'vitest';
import type { SedeCatalogEntry, SystemSettings } from '../../types';

function updateSedeStatusInCatalog(sedes: SedeCatalogEntry[], sedeName: string, enabled: boolean): SedeCatalogEntry[] {
  return sedes.map((s) => (s.name === sedeName ? { ...s, enabled } : s));
}

function updateBusinessInfo(settings: SystemSettings, info: { legalName?: string; ruc?: string }): SystemSettings {
  return {
    ...settings,
    businessLegalName: info.legalName || settings.businessLegalName,
    businessRuc: info.ruc || settings.businessRuc,
  };
}

describe('System Configuration Panel', () => {
  const sedesCatalog: SedeCatalogEntry[] = [
    { name: 'Principal', enabled: true },
    { name: 'Surco', enabled: true },
    { name: 'Chorillos', enabled: false },
  ];

  const initialSettings: SystemSettings = {
    pettyCash: { totalFundLimit: 1000, maxTransactionAmount: 150, alertThreshold: 20, requireReceiptAbove: 10, weeklyClosingDay: 5 },
    businessName: 'Groomers Vets',
    businessLegalName: 'Groomers Vets S.A.C.',
    businessRuc: '20601234567',
    currency: 'PEN',
    sedesCatalog,
  };

  it('habilita/deshabilita una sede en el catálogo', () => {
    const updated = updateSedeStatusInCatalog(sedesCatalog, 'Chorillos', true);
    expect(updated.find((s) => s.name === 'Chorillos')?.enabled).toBe(true);
  });

  it('actualiza información corporativa (Razón Social y RUC)', () => {
    const updated = updateBusinessInfo(initialSettings, { legalName: 'Veterinaria Groomers E.I.R.L.', ruc: '20609999999' });
    expect(updated.businessLegalName).toBe('Veterinaria Groomers E.I.R.L.');
    expect(updated.businessRuc).toBe('20609999999');
  });
});
