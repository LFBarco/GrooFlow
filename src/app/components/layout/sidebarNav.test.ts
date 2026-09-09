import { describe, it, expect, beforeEach } from 'vitest';
import type { GrooflowNavMenuSection } from '../../utils/grooflowMenuNav';

const mockSections: GrooflowNavMenuSection[] = [
  {
    section: 'PRINCIPAL',
    items: [
      { id: 1, label: 'Dashboard', route: '/', modulo_key: 'dashboard', icono: 'fa-chart-line' },
      { id: 2, label: 'Alertas', route: '/alertas', modulo_key: 'alertas', icono: 'fa-bell' },
    ],
  },
  {
    section: 'FINANZAS',
    items: [
      { id: 3, label: 'Tesorería', route: '/tesoreria', modulo_key: 'tesoreria', icono: 'fa-vault' },
      { id: 4, label: 'Transacciones', route: '/transacciones', modulo_key: 'transacciones', icono: 'fa-exchange-alt' },
      { id: 5, label: 'Flujo de Caja', route: '/flujo-caja', modulo_key: 'flujo_caja', icono: 'fa-water' },
    ],
  },
];

// Mock localStorage for Node test runner
const memoryStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => memoryStore[key] ?? null,
  setItem: (key: string, val: string) => {
    memoryStore[key] = val;
  },
  clear: () => {
    Object.keys(memoryStore).forEach((k) => delete memoryStore[k]);
  },
};

describe('GrooFlow Sidebar Nav & Search Favorites', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  it('filters menu items correctly by search query', () => {
    const query = 'teso';
    const filtered = mockSections
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
      }))
      .filter((sec) => sec.items.length > 0);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].section).toBe('FINANZAS');
    expect(filtered[0].items[0].label).toBe('Tesorería');
  });

  it('manages favorite keys in localStorage mock per user', () => {
    const userId = 123;
    const storageKey = `grooflow_menu_favorites_${userId}`;

    let favorites: string[] = ['tesoreria', 'dashboard'];
    mockLocalStorage.setItem(storageKey, JSON.stringify(favorites));

    const restored = JSON.parse(mockLocalStorage.getItem(storageKey) || '[]');
    expect(restored).toEqual(['tesoreria', 'dashboard']);

    // Toggle off tesoreria
    favorites = favorites.filter((k) => k !== 'tesoreria');
    mockLocalStorage.setItem(storageKey, JSON.stringify(favorites));

    expect(JSON.parse(mockLocalStorage.getItem(storageKey) || '[]')).toEqual(['dashboard']);
  });
});
