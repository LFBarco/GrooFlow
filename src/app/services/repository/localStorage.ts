/**
 * ============================================================
 *  GROOFLOW — LOCAL STORAGE ADAPTER
 * ============================================================
 *
 * Pure offline implementation of IDataRepository.
 * No network calls, no external dependencies.
 *
 * Use cases:
 *   - Development / demo without a backend
 *   - Fallback when the network is unavailable
 *   - Unit testing (mock it instead)
 *   - A "starter" before you have a backend ready
 * ============================================================
 */

import type {
  IDataRepository,
  IAuthRepository,
  IKVRepository,
  ICollectionRepository,
  AuthUser,
} from '../types';

const PREFIX = 'grooflow_';

// ─── helpers ──────────────────────────────────────────────────

function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.warn('[localStorage adapter] write failed:', e);
  }
}

function lsDel(key: string): void {
  localStorage.removeItem(PREFIX + key);
}

// ─── Auth ──────────────────────────────────────────────────────

class LocalAuthRepository implements IAuthRepository {
  private readonly SESSION_KEY = 'auth:session';

  async getSession(): Promise<AuthUser | null> {
    return lsGet<AuthUser>(this.SESSION_KEY);
  }

  async signIn(email: string, _password: string): Promise<AuthUser> {
    // In a real offline auth you'd check a hashed password.
    // For now we just store who "signed in".
    const user: AuthUser = { id: `local-${email}`, email };
    lsSet(this.SESSION_KEY, user);
    return user;
  }

  async signOut(): Promise<void> {
    lsDel(this.SESSION_KEY);
  }

  async createUser(email: string, _password: string, name: string): Promise<AuthUser> {
    const user: AuthUser = { id: `local-${Date.now()}`, email, name };
    return user;
  }

  async updateUserPassword(_userId: string, _newPassword: string): Promise<void> {
    // no-op for local adapter
  }

  onAuthStateChange(_callback: (user: AuthUser | null) => void): () => void {
    // Local adapter has no real-time events
    return () => {};
  }
}

// ─── KV ───────────────────────────────────────────────────────

class LocalKVRepository implements IKVRepository {
  async get<T = unknown>(key: string): Promise<T | null> {
    return lsGet<T>(key);
  }

  async set(key: string, value: unknown): Promise<void> {
    lsSet(key, value);
  }

  async delete(key: string): Promise<void> {
    lsDel(key);
  }
}

// ─── Collection ───────────────────────────────────────────────

class LocalCollectionRepository<T extends { id: string }>
  implements ICollectionRepository<T> {

  constructor(private readonly key: string) {}

  private load(): T[] {
    return lsGet<T[]>(this.key) ?? [];
  }

  private save(records: T[]): void {
    lsSet(this.key, records);
  }

  async getAll(filters?: Partial<T>): Promise<T[]> {
    const all = this.load();
    if (!filters) return all;
    return all.filter(item =>
      Object.entries(filters).every(([k, v]) => (item as any)[k] === v)
    );
  }

  async getById(id: string): Promise<T | null> {
    return this.load().find(r => r.id === id) ?? null;
  }

  async create(record: T): Promise<T> {
    const all = this.load();
    this.save([record, ...all]);
    return record;
  }

  async update(id: string, partial: Partial<T>): Promise<T> {
    const all = this.load();
    const idx = all.findIndex(r => r.id === id);
    if (idx === -1) throw new Error(`[localAdapter] Record ${id} not found in ${this.key}`);
    const updated = { ...all[idx], ...partial } as T;
    all[idx] = updated;
    this.save(all);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.save(this.load().filter(r => r.id !== id));
  }

  async upsertMany(records: T[]): Promise<void> {
    if (!records.length) return;
    const map = new Map(this.load().map(r => [r.id, r]));
    records.forEach(r => map.set(r.id, r));
    this.save(Array.from(map.values()));
  }
}

// ─── factory ──────────────────────────────────────────────────

export const localStorageRepository: IDataRepository = {
  auth:         new LocalAuthRepository(),
  kv:           new LocalKVRepository(),
  transactions: new LocalCollectionRepository('data:transactions'),
  providers:    new LocalCollectionRepository('data:providers'),
  requests:     new LocalCollectionRepository('data:requests'),
  invoices:     new LocalCollectionRepository('data:invoices'),
  pettyCash:    new LocalCollectionRepository('data:pettyCash'),
  users:        new LocalCollectionRepository('data:users'),
  roles:        new LocalCollectionRepository('data:roles'),
  requisitions: new LocalCollectionRepository('data:requisitions'),
};
