import { describe, expect, it } from 'vitest';
import { resolveGrooflowBackend } from './backend';

describe('resolveGrooflowBackend', () => {
  it('fuerza REST en Vercel aunque el build tenga supabase', () => {
    expect(resolveGrooflowBackend('supabase', 'grooflow.vercel.app')).toBe('rest');
    expect(resolveGrooflowBackend('supabase', 'grooflow-git-lbarco-luis-barco-projects.vercel.app')).toBe('rest');
  });

  it('respeta local', () => {
    expect(resolveGrooflowBackend('local', 'grooflow.vercel.app')).toBe('local');
  });

  it('en Hostinger sigue el env', () => {
    expect(resolveGrooflowBackend('rest', 'gestionveterinariagroomers.com')).toBe('rest');
    expect(resolveGrooflowBackend('supabase', 'localhost')).toBe('supabase');
  });
});
