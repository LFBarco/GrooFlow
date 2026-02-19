import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from "sonner";

/** Claves conocidas que devuelve fetchInitialData / init */
export interface InitialDataKeys {
  'settings:config'?: unknown;
  'settings:system'?: unknown;
  'data:transactions'?: unknown;
  'data:invoices'?: unknown;
  'data:providers'?: unknown;
  'data:requests'?: unknown;
  'data:pettyCash'?: unknown;
  'data:users'?: unknown;
  'data:roles'?: unknown;
}

const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {} as Record<string, string | undefined>;
const BASE_URL = env.VITE_SUPABASE_FUNCTIONS_URL ?? `https://${projectId}.supabase.co/functions/v1/make-server-674cc941`;

const headers = {
  'Authorization': `Bearer ${publicAnonKey}`,
  'Content-Type': 'application/json',
};

const STORAGE_PREFIX = 'vetflow_db_';

const localStore = {
  get: (key: string): unknown => {
    try {
      const item = localStorage.getItem(STORAGE_PREFIX + key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.warn('Local Storage Read Error:', e);
      return null;
    }
  },
  set: (key: string, data: unknown): boolean => {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('Local Storage Write Error:', e);
      return false;
    }
  }
};

export const api = {
  async fetchInitialData(): Promise<InitialDataKeys> {
    const localData: InitialDataKeys = {};
    const keys = [
      'settings:config', 
      'settings:system', 
      'data:transactions', 
      'data:invoices', 
      'data:providers', 
      'data:requests', 
      'data:pettyCash', 
      'data:users', 
      'data:roles'
    ];

    keys.forEach(key => {
      const val = localStore.get(key);
      if (val) (localData as Record<string, unknown>)[key] = val;
    });

    try {
      const response = await fetch(`${BASE_URL}/init`, { headers });
      if (!response.ok) throw new Error('Failed to fetch initial data');
      const { data } = (await response.json()) as { data?: InitialDataKeys };
      return { ...localData, ...(data || {}) };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') return localData;
      console.warn('API unavailable, using local data:', error);
      return localData;
    }
  },

  async saveKey(key: string, data: unknown): Promise<boolean> {
    // 1. Always save to Local Storage (Optimistic)
    const localSuccess = localStore.set(key, data);

    // 2. Try saving to API
    try {
      const response = await fetch(`${BASE_URL}/kv/${key}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      
      if (!response.ok) throw new Error(`Failed to save ${key}`);
      return true;
    } catch (error: unknown) {
      console.warn(`Cloud save failed for ${key} (saved locally):`, error);
      return localSuccess;
    }
  },

  async signUp(email: string, password: string, name: string): Promise<{ data?: unknown }> {
    try {
      const response = await fetch(`${BASE_URL}/signup`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, password, name }),
      });
      const result = (await response.json()) as { data?: unknown; error?: string };
      if (!response.ok) throw new Error(result.error || 'Signup failed');
      return result;
    } catch (error: unknown) {
      console.error('API Signup Error:', error);
      let message = error instanceof Error ? error.message : "Error registrando usuario";
      if (message.includes("already been registered") || message.includes("email_exists")) {
          message = "Este correo ya está registrado en el sistema.";
      }
      toast.error(message);
      throw new Error(message);
    }
  }
};
