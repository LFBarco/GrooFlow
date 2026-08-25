/**
 * GrooFlow — REST adapter (PHP / Hostinger).
 */
import type {
  IDataRepository,
  IAuthRepository,
  IKVRepository,
  ICollectionRepository,
  AuthUser,
} from '../types';
import { getGrooflowApiBase, getGrooflowToken, setGrooflowToken } from './apiBase';

type AuthListener = (user: AuthUser | null) => void;

const listeners = new Set<AuthListener>();

function notify(user: AuthUser | null): void {
  listeners.forEach((cb) => {
    try {
      cb(user);
    } catch (e) {
      console.warn('[rest auth]', e);
    }
  });
}

function toAuthUser(payload: {
  id?: string;
  email?: string;
  name?: string;
  existing?: boolean;
} | null | undefined): AuthUser | null {
  if (!payload?.id) return null;
  return {
    id: String(payload.id),
    email: String(payload.email || ''),
    name: payload.name,
    existing: payload.existing,
  };
}

async function restFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getGrooflowToken();
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${getGrooflowApiBase()}${path}`, {
    ...init,
    headers,
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  if (text.trim()) {
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = { error: text.slice(0, 200) };
    }
  }
  if (!res.ok) {
    if (res.status === 401) {
      setGrooflowToken('');
      notify(null);
    }
    const err =
      typeof json.error === 'string' && json.error.length < 180
        ? json.error
        : `HTTP ${res.status}`;
    throw new Error(err);
  }
  return json as T;
}

class RestAuthRepository implements IAuthRepository {
  async getSession(): Promise<AuthUser | null> {
    if (!getGrooflowToken()) return null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const data = await restFetch<{ user?: AuthUser }>('/auth/me');
        return toAuthUser(data.user);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const retryable = /HTTP 5\d\d|504|timeout|Time-out/i.test(msg);
        if (retryable && attempt < 2) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
        return null;
      }
    }
    return null;
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const data = await restFetch<{ token?: string; user?: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: email, username: email, email, password }),
    });
    if (!data.token) throw new Error('No se recibió token de sesión');
    setGrooflowToken(data.token);
    const user = toAuthUser(data.user);
    if (!user) throw new Error('Login incompleto');
    notify(user);
    return user;
  }

  async signOut(): Promise<void> {
    const token = getGrooflowToken();
    setGrooflowToken('');
    notify(null);
    if (!token) return;
    try {
      await fetch(`${getGrooflowApiBase()}/auth/logout`, {
        method: 'POST',
        keepalive: true,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      /* ignore: el token ya se borró en local */
    }
  }

  async createUser(email: string, password: string, name: string): Promise<AuthUser> {
    const data = await restFetch<{ user?: AuthUser }>('/auth/create-user', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    const user = toAuthUser(data.user);
    if (!user) throw new Error('No se pudo crear el usuario');
    return user;
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<void> {
    await restFetch('/auth/password', {
      method: 'POST',
      body: JSON.stringify({ userId, password: newPassword }),
    });
  }

  async setUserAuthEnabled(userIdOrEmail: string, enabled: boolean): Promise<void> {
    await restFetch('/auth/enabled', {
      method: 'POST',
      body: JSON.stringify({ userId: userIdOrEmail, enabled }),
    });
  }

  onAuthStateChange(callback: AuthListener): () => void {
    listeners.add(callback);
    void this.getSession().then(callback);
    return () => {
      listeners.delete(callback);
    };
  }
}

class RestKVRepository implements IKVRepository {
  async getMany(keys: string[]): Promise<Record<string, unknown>> {
    const data = await restFetch<{ values?: Record<string, unknown> }>('/bootstrap');
    const values = data.values && typeof data.values === 'object' ? data.values : {};
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        out[key] = values[key];
      }
    }
    return out;
  }

  async getWithStatus<T = unknown>(key: string): Promise<{ ok: boolean; value: T | null }> {
    try {
      const data = await restFetch<{ value?: T | null }>(`/kv/${encodeURIComponent(key)}`);
      return { ok: true, value: (data.value ?? null) as T | null };
    } catch {
      return { ok: false, value: null };
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const { value } = await this.getWithStatus<T>(key);
    return value;
  }

  async set(key: string, value: unknown): Promise<void> {
    await restFetch(`/kv/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  }

  async delete(key: string): Promise<void> {
    await restFetch(`/kv/${encodeURIComponent(key)}`, { method: 'DELETE' });
  }
}

class RestCollectionRepository<T extends { id: string }> implements ICollectionRepository<T> {
  constructor(private readonly name: string) {}

  async getAll(): Promise<T[]> {
    const data = await restFetch<{ items?: T[] }>(`/collections/${this.name}`);
    return Array.isArray(data.items) ? data.items : [];
  }

  async getById(id: string): Promise<T | null> {
    try {
      const data = await restFetch<{ item?: T }>(`/collections/${this.name}/${encodeURIComponent(id)}`);
      return data.item ?? null;
    } catch {
      return null;
    }
  }

  async create(record: T): Promise<T> {
    const data = await restFetch<{ item?: T }>(`/collections/${this.name}`, {
      method: 'POST',
      body: JSON.stringify(record),
    });
    return data.item ?? record;
  }

  async update(id: string, partial: Partial<T>): Promise<T> {
    const data = await restFetch<{ item?: T }>(`/collections/${this.name}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(partial),
    });
    if (!data.item) throw new Error(`No se pudo actualizar ${id}`);
    return data.item;
  }

  async delete(id: string): Promise<void> {
    await restFetch(`/collections/${this.name}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async upsertMany(records: T[]): Promise<void> {
    await restFetch(`/collections/${this.name}/upsert`, {
      method: 'POST',
      body: JSON.stringify({ records }),
    });
  }
}

export const restRepository: IDataRepository = {
  auth: new RestAuthRepository(),
  kv: new RestKVRepository(),
  transactions: new RestCollectionRepository('transactions'),
  providers: new RestCollectionRepository('providers'),
  requests: new RestCollectionRepository('requests'),
  invoices: new RestCollectionRepository('invoices'),
  pettyCash: new RestCollectionRepository('pettyCash'),
  users: new RestCollectionRepository('users'),
  roles: new RestCollectionRepository('roles'),
  requisitions: new RestCollectionRepository('requisitions'),
};
