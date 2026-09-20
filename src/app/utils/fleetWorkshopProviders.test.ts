import { describe, expect, it } from 'vitest';

import type { Provider } from '../types';
import {
  fleetWorkshopProviders,
  isFleetWorkshopProvider,
  providerAccountLooksLikeFleetMaintenance,
} from './fleetWorkshopProviders';

const base = (partial: Partial<Provider> & Pick<Provider, 'id' | 'name' | 'ruc'>): Provider =>
  ({
    category: 'Servicios',
    defaultCreditDays: 0,
    ...partial,
  }) as Provider;

describe('fleetWorkshopProviders', () => {
  it('acepta por cuenta contable 634…', () => {
    expect(providerAccountLooksLikeFleetMaintenance('6341001')).toBe(true);
    expect(providerAccountLooksLikeFleetMaintenance('4011100')).toBe(false);
  });

  it('acepta por nombre/categoría taller o flota', () => {
    expect(
      isFleetWorkshopProvider(base({ id: '1', name: 'Taller Los Olivos SAC', ruc: '20111111111' }))
    ).toBe(true);
    expect(
      isFleetWorkshopProvider(
        base({ id: '2', name: 'Distribuidora ABC', ruc: '20222222222', category: 'Insumos médicos' })
      )
    ).toBe(false);
  });

  it('lista solo talleres', () => {
    const list = fleetWorkshopProviders([
      base({ id: '1', name: 'Taller Norte', ruc: '1' }),
      base({ id: '2', name: 'Clínica X', ruc: '2', category: 'Médico' }),
      base({ id: '3', name: 'Repuestos Flota', ruc: '3', accountingAccount: '634200' }),
    ]);
    expect(list.map((p) => p.id).sort()).toEqual(['1', '3']);
  });
});
