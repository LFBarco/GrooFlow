/**
 * ============================================================
 *  GROOFLOW — SUPABASE ADAPTER
 * ============================================================
 *
 * Implements IDataRepository using:
 *   - Supabase Auth  (authentication)
 *   - Supabase Edge Function (KV store — current approach)
 *   - Supabase Tables (future — uncomment table sections below)
 *
 * When Supabase tables are ready, you only need to:
 *   1. Create the tables (see BACKEND_MIGRATION.md)
 *   2. Uncomment the table implementations below
 *   3. Remove / comment the Edge Function KV calls
 * ============================================================
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  IDataRepository,
  IAuthRepository,
  IKVRepository,
  ICollectionRepository,
  AuthUser,
} from '../types';

// ─── Config ──────────────────────────────────────────────────

const env = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env
  : {} as Record<string, string | undefined>;

const SUPABASE_URL  = env.VITE_SUPABASE_URL
  ?? `https://${env.VITE_SUPABASE_PROJECT_ID ?? 'sklseqxhhanuzsancbgn'}.supabase.co`;

const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrbHNlcXhoaGFudXpzYW5jYmduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4Mzg4NzMsImV4cCI6MjA4MzQxNDg3M30.GwTYNF7LXNbFBpM6xFVuMowFLGezvnm393OcjibnVu0';

const FUNCTIONS_URL = env.VITE_SUPABASE_FUNCTIONS_URL
  ?? `${SUPABASE_URL}/functions/v1/make-server-674cc941`;

// ─── Supabase client singleton ───────────────────────────────

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _client;
}

// ─── Auth Implementation ─────────────────────────────────────

class SupabaseAuthRepository implements IAuthRepository {
  private get sb() { return getSupabaseClient(); }

  async getSession(): Promise<AuthUser | null> {
    const { data } = await this.sb.auth.getSession();
    const u = data.session?.user;
    if (!u) return null;
    return { id: u.id, email: u.email!, name: u.user_metadata?.name };
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    const u = data.user!;
    return { id: u.id, email: u.email!, name: u.user_metadata?.name };
  }

  async signOut(): Promise<void> {
    await this.sb.auth.signOut();
  }

  async createUser(email: string, password: string, name: string): Promise<AuthUser> {
    const { data, error } = await this.sb.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw new Error(error.message);
    const u = data.user!;
    return { id: u.id, email: u.email!, name };
  }

  async updateUserPassword(_userId: string, _newPassword: string): Promise<void> {
    // NOTE: Changing another user's password requires a service_role key
    // and must be done server-side (Edge Function).
    // TODO: Call a secure Edge Function: POST /admin/update-password { userId, newPassword }
    throw new Error(
      'updateUserPassword must be handled by a server-side Edge Function. ' +
      'See BACKEND_MIGRATION.md for implementation details.'
    );
  }

  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    const { data } = this.sb.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      callback(u ? { id: u.id, email: u.email!, name: u.user_metadata?.name } : null);
    });
    return () => data.subscription.unsubscribe();
  }
}

// ─── KV Implementation (Edge Function store) ─────────────────
//
// Currently persists data through:
//   1. localStorage (instant, offline-capable)
//   2. Supabase Edge Function KV (cloud sync)
//
// FUTURE: Replace with a real `app_kv` Supabase table:
//   CREATE TABLE app_kv (key text PRIMARY KEY, value jsonb, updated_at timestamptz DEFAULT now());
//   Then swap the fetch() calls for supabase.from('app_kv').upsert(...)

const STORAGE_PREFIX = 'grooflow_';

class SupabaseKVRepository implements IKVRepository {
  private readonly headers = {
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };

  async get<T = unknown>(key: string): Promise<T | null> {
    // 1. Read from localStorage first (instant, offline)
    try {
      const item = localStorage.getItem(STORAGE_PREFIX + key);
      const local = item ? (JSON.parse(item) as T) : null;

      // 2. Try to get fresher data from cloud
      try {
        const res = await fetch(`${FUNCTIONS_URL}/init`, { headers: this.headers });
        if (res.ok) {
          const { data } = (await res.json()) as { data?: Record<string, unknown> };
          if (data?.[key] !== undefined) {
            // Update local cache with cloud value
            localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data[key]));
            return data[key] as T;
          }
        }
      } catch {
        // Cloud unavailable — use local
      }
      return local;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    // 1. Always write locally first (optimistic)
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.warn('localStorage write failed:', e);
    }

    // 2. Sync to cloud (fire-and-forget, non-blocking)
    fetch(`${FUNCTIONS_URL}/kv/${key}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(value),
    }).catch(() => {
      // Cloud unavailable — data is safe in localStorage
    });
  }

  async delete(key: string): Promise<void> {
    localStorage.removeItem(STORAGE_PREFIX + key);
    // TODO: DELETE from Edge Function / table when implemented
  }
}

// ─── Generic Collection — localStorage + KV store ────────────
//
// CURRENT: Each collection is serialised as a single JSON blob in KV.
//
// FUTURE (Supabase tables): Replace with direct supabase.from() calls.
// Template shown below. Just swap the class body when tables exist.
//
// class SupabaseCollectionRepository<T extends { id: string }>
//   implements ICollectionRepository<T> {
//
//   constructor(private readonly table: string) {}
//   private get sb() { return getSupabaseClient(); }
//
//   async getAll(filters?: Partial<T>) {
//     let q = this.sb.from(this.table).select('*');
//     if (filters) {
//       Object.entries(filters).forEach(([k, v]) => { q = q.eq(k, v); });
//     }
//     const { data, error } = await q;
//     if (error) throw error;
//     return (data ?? []) as T[];
//   }
//
//   async getById(id: string) {
//     const { data, error } = await this.sb.from(this.table).select('*').eq('id', id).single();
//     if (error) return null;
//     return data as T;
//   }
//
//   async create(record: T) {
//     const { data, error } = await this.sb.from(this.table).insert(record).select().single();
//     if (error) throw error;
//     return data as T;
//   }
//
//   async update(id: string, record: Partial<T>) {
//     const { data, error } = await this.sb.from(this.table).update(record).eq('id', id).select().single();
//     if (error) throw error;
//     return data as T;
//   }
//
//   async delete(id: string) {
//     const { error } = await this.sb.from(this.table).delete().eq('id', id);
//     if (error) throw error;
//   }
//
//   async upsertMany(records: T[]) {
//     if (!records.length) return;
//     const { error } = await this.sb.from(this.table).upsert(records);
//     if (error) throw error;
//   }
// }

class KVCollectionRepository<T extends { id: string }>
  implements ICollectionRepository<T> {

  private readonly kv: IKVRepository;

  constructor(private readonly key: string, kv: IKVRepository) {
    this.kv = kv;
  }

  private async load(): Promise<T[]> {
    return (await this.kv.get<T[]>(this.key)) ?? [];
  }

  private async save(records: T[]): Promise<void> {
    await this.kv.set(this.key, records);
  }

  async getAll(filters?: Partial<T>): Promise<T[]> {
    const all = await this.load();
    if (!filters) return all;
    return all.filter(item =>
      Object.entries(filters).every(([k, v]) => (item as any)[k] === v)
    );
  }

  async getById(id: string): Promise<T | null> {
    const all = await this.load();
    return all.find(r => r.id === id) ?? null;
  }

  async create(record: T): Promise<T> {
    const all = await this.load();
    const exists = all.some(r => r.id === record.id);
    if (exists) throw new Error(`Record ${record.id} already exists in ${this.key}`);
    await this.save([record, ...all]);
    return record;
  }

  async update(id: string, partial: Partial<T>): Promise<T> {
    const all = await this.load();
    const idx = all.findIndex(r => r.id === id);
    if (idx === -1) throw new Error(`Record ${id} not found in ${this.key}`);
    const updated = { ...all[idx], ...partial } as T;
    all[idx] = updated;
    await this.save(all);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const all = await this.load();
    await this.save(all.filter(r => r.id !== id));
  }

  async upsertMany(records: T[]): Promise<void> {
    if (!records.length) return;
    const existing = await this.load();
    const map = new Map(existing.map(r => [r.id, r]));
    records.forEach(r => map.set(r.id, r));
    await this.save(Array.from(map.values()));
  }
}

// ─── Repository factory ───────────────────────────────────────

function buildSupabaseRepository(): IDataRepository {
  const kv = new SupabaseKVRepository();

  return {
    auth:         new SupabaseAuthRepository(),
    kv,
    transactions: new KVCollectionRepository('data:transactions', kv),
    providers:    new KVCollectionRepository('data:providers', kv),
    requests:     new KVCollectionRepository('data:requests', kv),
    invoices:     new KVCollectionRepository('data:invoices', kv),
    pettyCash:    new KVCollectionRepository('data:pettyCash', kv),
    users:        new KVCollectionRepository('data:users', kv),
    roles:        new KVCollectionRepository('data:roles', kv),
    requisitions: new KVCollectionRepository('data:requisitions', kv),
  };
}

export const supabaseRepository: IDataRepository = buildSupabaseRepository();
