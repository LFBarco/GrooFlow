/**
 * ============================================================
 *  GROOFLOW — REPOSITORY CONTRACTS
 * ============================================================
 *
 * This file defines the INTERFACE (contract) for every data
 * operation the application needs.
 *
 * Rules:
 *  - No implementation here — only types and interfaces.
 *  - Every backend adapter (Supabase, REST API, Firebase, etc.)
 *    must implement IDataRepository.
 *  - The app NEVER imports from a concrete adapter directly;
 *    it always uses the IDataRepository interface.
 *
 * To migrate to a new backend:
 *  1. Create a new file in src/app/services/repository/
 *  2. Implement IDataRepository
 *  3. Change the export in src/app/services/repository/index.ts
 *  ============================================================
 */

import type {
  Transaction,
  Provider,
  PurchaseRequest,
  InvoiceDraft,
  PettyCashTransaction,
  User,
  SystemAlert,
  AlertThresholds,
  Requisition,
  SystemSettings,
} from '../types';
import type { Role } from '../components/users/types';
import type { ConfigStructure } from '../data/initialData';

// ─── Auth ────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export interface IAuthRepository {
  /** Returns current session user or null */
  getSession(): Promise<AuthUser | null>;

  /** Sign in with email + password. Returns the authenticated user. */
  signIn(email: string, password: string): Promise<AuthUser>;

  /** Sign out current session */
  signOut(): Promise<void>;

  /** Create a new user account (admin only) */
  createUser(email: string, password: string, name: string): Promise<AuthUser>;

  /** Update password for a user (admin only — requires service_role key on server) */
  updateUserPassword(userId: string, newPassword: string): Promise<void>;

  /**
   * Subscribe to auth state changes.
   * Returns an unsubscribe function.
   */
  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void;
}

// ─── Key-Value (Settings & small blobs) ──────────────────────

export interface IKVRepository {
  /** Read a stored value by key */
  get<T = unknown>(key: string): Promise<T | null>;

  /**
   * Misma lectura que `get`, pero indica si la petición HTTP al KV fue correcta.
   * Si `ok === false`, no se debe sobrescribir la clave en la nube (p. ej. sesión no lista).
   */
  getWithStatus?<T = unknown>(
    key: string
  ): Promise<{ ok: boolean; value: T | null }>;

  /** Write a value by key */
  set(key: string, value: unknown): Promise<void>;

  /** Delete a key */
  delete(key: string): Promise<void>;
}

// ─── Generic CRUD ─────────────────────────────────────────────

export interface ICollectionRepository<T extends { id: string }> {
  /** Return all records (with optional filters) */
  getAll(filters?: Partial<T>): Promise<T[]>;

  /** Return a single record by ID */
  getById(id: string): Promise<T | null>;

  /** Insert a new record */
  create(record: T): Promise<T>;

  /** Full replace of an existing record */
  update(id: string, record: Partial<T>): Promise<T>;

  /** Delete a record */
  delete(id: string): Promise<void>;

  /**
   * Bulk upsert — insert or update many records.
   * Useful for syncing local state with remote on app load.
   */
  upsertMany(records: T[]): Promise<void>;
}

// ─── Typed collections ────────────────────────────────────────

export type ITransactionRepository   = ICollectionRepository<Transaction>;
export type IProviderRepository      = ICollectionRepository<Provider>;
export type IPurchaseRequestRepo     = ICollectionRepository<PurchaseRequest>;
export type IInvoiceRepository       = ICollectionRepository<InvoiceDraft>;
export type IPettyCashRepository     = ICollectionRepository<PettyCashTransaction>;
export type IUserRepository          = ICollectionRepository<User>;
export type IRoleRepository          = ICollectionRepository<Role>;
export type IRequisitionRepository   = ICollectionRepository<Requisition>;

// ─── Top-level repository facade ─────────────────────────────

/**
 * IDataRepository is the SINGLE interface the application
 * uses to interact with any backend.
 *
 * Inject or import `repository` from
 * src/app/services/repository/index.ts — never from a
 * concrete implementation.
 */
export interface IDataRepository {
  auth:          IAuthRepository;
  kv:            IKVRepository;
  transactions:  ITransactionRepository;
  providers:     IProviderRepository;
  requests:      IPurchaseRequestRepo;
  invoices:      IInvoiceRepository;
  pettyCash:     IPettyCashRepository;
  users:         IUserRepository;
  roles:         IRoleRepository;
  requisitions:  IRequisitionRepository;
}

// ─── KV key registry ─────────────────────────────────────────

/**
 * Centralised list of every KV key used by the app.
 * Change a key name here — it changes everywhere.
 */
export const KV_KEYS = {
  CONFIG:               'settings:config',
  SYSTEM_SETTINGS:      'settings:system',
  THEME:                'settings:theme',
  ALERT_THRESHOLDS:     'settings:alertThresholds',
  FEE_RECEIPTS:         'data:feeReceipts',
  TREASURY_INVOICES:    'data:treasuryInvoices',
  TREASURY_BALANCE:     'data:treasuryBankBalance',
  TREASURY_PAID_HISTORY:'data:treasuryPaidHistory',
  CHART_OF_ACCOUNTS:    'data:chartOfAccounts',
} as const;

export type KVKey = typeof KV_KEYS[keyof typeof KV_KEYS];
