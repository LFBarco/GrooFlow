/**
 * ============================================================
 *  GROOFLOW — REPOSITORY FACTORY
 * ============================================================
 *
 *      VITE_BACKEND=rest            ← Hostinger / PHP (default)
 *      VITE_BACKEND=local           ← localStorage (offline/dev)
 *      VITE_BACKEND=supabase        ← Vercel / Postgres (legacy)
 *
 * El build Hostinger (VITE_BACKEND=rest) no importa el cliente de Supabase.
 * ============================================================
 */

import type { IDataRepository } from '../types';
import { getGrooflowBackend } from '../../config/backend';
import { localStorageRepository } from './localStorage';
import { restRepository } from './rest';

async function createRepository(): Promise<IDataRepository> {
  const backend = getGrooflowBackend();
  if (backend === 'local') {
    return localStorageRepository;
  }
  if (backend === 'supabase') {
    const { supabaseRepository } = await import('./supabase');
    return supabaseRepository;
  }
  return restRepository;
}

export const repository: IDataRepository = await createRepository();

export type { IDataRepository } from '../types';
export { KV_KEYS } from '../types';
