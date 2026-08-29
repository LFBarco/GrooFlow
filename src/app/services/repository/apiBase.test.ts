import { describe, expect, it } from 'vitest';
import { HOSTINGER_GROOFLOW_API, resolveGrooflowApiBase } from './apiBase';

describe('resolveGrooflowApiBase', () => {
  it('en Vercel convierte la API relativa al PHP de Hostinger', () => {
    expect(resolveGrooflowApiBase('/grooflow/api', '/grooflow/', 'grooflow.vercel.app')).toBe(
      HOSTINGER_GROOFLOW_API
    );
  });

  it('en Hostinger deja la ruta relativa', () => {
    expect(resolveGrooflowApiBase('/grooflow/api', '/grooflow/', 'gestionveterinariagroomers.com')).toBe(
      '/grooflow/api'
    );
  });

  it('en local respeta el env', () => {
    expect(resolveGrooflowApiBase('/grooflow/api', '/grooflow/', 'localhost')).toBe('/grooflow/api');
  });
});
