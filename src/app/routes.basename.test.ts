import { describe, expect, it } from 'vitest';
import { getRouterBasename } from './routes';

describe('getRouterBasename', () => {
  it('usa /grooflow en Hostinger y Vite', () => {
    expect(getRouterBasename('/grooflow')).toBe('/grooflow');
    expect(getRouterBasename('/grooflow/')).toBe('/grooflow');
    expect(getRouterBasename('/grooflow/transacciones')).toBe('/grooflow');
  });

  it('usa / en la raíz de Vercel (grooflow.vercel.app/)', () => {
    expect(getRouterBasename('/')).toBe('/');
    expect(getRouterBasename('/transacciones')).toBe('/');
  });
});
