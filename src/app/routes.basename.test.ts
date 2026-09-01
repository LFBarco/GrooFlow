import { describe, expect, it } from 'vitest';
import { getRouterBasename, isKnownAppPath, pathToView } from './routes';

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

describe('pathToView / isKnownAppPath', () => {
  it('resuelve rutas conocidas', () => {
    expect(pathToView('/')).toBe('dashboard');
    expect(pathToView('/transacciones')).toBe('transactions');
    expect(pathToView('/grooflow/caja-chica')).toBe('pettycash');
  });

  it('devuelve null para rutas inexistentes (sin caer a dashboard)', () => {
    expect(pathToView('/no-existe')).toBeNull();
    expect(pathToView('/grooflow/ruta-inventada')).toBeNull();
    expect(isKnownAppPath('/foo')).toBe(false);
    expect(isKnownAppPath('/config/menu')).toBe(true);
  });
});
