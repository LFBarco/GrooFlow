/**
 * ============================================================
 *  GROOFLOW — REPOSITORY FACTORY
 * ============================================================
 *
 * THIS IS THE ONLY FILE YOU NEED TO CHANGE TO SWITCH BACKENDS.
 *
 * How to switch backends
 * ──────────────────────
 * 1. Set the VITE_BACKEND env variable in your .env file:
 *
 *      VITE_BACKEND=supabase        ← current default
 *      VITE_BACKEND=local           ← pure localStorage (offline/dev)
 *      VITE_BACKEND=rest            ← your own REST API (implement it)
 *      VITE_BACKEND=firebase        ← Firebase (implement it)
 *
 * 2. (If adding a new backend)
 *    - Create src/app/services/repository/myBackend.ts
 *    - Implement IDataRepository
 *    - Add a case below
 *
 * The rest of the application imports `repository` from here
 * and never knows which backend is active.
 * ============================================================
 */

import type { IDataRepository } from '../types';
import { supabaseRepository } from './supabase';
import { localStorageRepository } from './localStorage';

const env = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env
  : {} as Record<string, string | undefined>;

type BackendType = 'supabase' | 'local';

function createRepository(): IDataRepository {
  const backend = (env.VITE_BACKEND ?? 'supabase') as BackendType;

  switch (backend) {
    case 'supabase':
      return supabaseRepository;

    case 'local':
      return localStorageRepository;

    default:
      console.warn(
        `[repository] Unknown backend "${backend}". Falling back to "local".`
      );
      return localStorageRepository;
  }
}

/**
 * The active repository instance.
 *
 * Usage throughout the app:
 *   import { repository } from '@/app/services/repository';
 *   const txs = await repository.transactions.getAll();
 */
export const repository: IDataRepository = createRepository();

// Re-export types for convenience so importers don't need two paths
export type { IDataRepository } from '../types';
export { KV_KEYS } from '../types';
