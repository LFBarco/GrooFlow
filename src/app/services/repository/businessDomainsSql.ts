/**

 * Dominios operativos — persistencia SQL directa (producción).

 * Proveedores, caja chica, facturas, solicitudes de compra, usuarios, roles.

 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {

  Provider,

  PettyCashTransaction,

  InvoiceDraft,

  PurchaseRequest,

  User,

} from '../../types';

import type { Role } from '../../components/users/types';

import { parseTransactionDate } from '../../utils/transactionDate';

import {

  isMissingTableError,

  isProductionSqlEnabled,

  upsertWithPrune,

  selectAllRowsPaginated,

  type SqlLoadResult,

  type SqlSaveResult,

} from './sqlDomainUtils';



export function isBusinessDomainsSqlEnabled(): boolean {

  return isProductionSqlEnabled();

}



// ─── Proveedores ───────────────────────────────────────────────────────────



function providerExtra(p: Provider): Record<string, unknown> {

  const extra: Record<string, unknown> = {};

  if (p.docIdentityType) extra.docIdentityType = p.docIdentityType;

  if (p.defaultExpenseCategory) extra.defaultExpenseCategory = p.defaultExpenseCategory;

  if (p.accountingAccount) extra.accountingAccount = p.accountingAccount;

  if (p.pettyExpenseLines?.length) extra.pettyExpenseLines = p.pettyExpenseLines;

  if (p.registeredVia) extra.registeredVia = p.registeredVia;

  if (p.usageContexts) extra.usageContexts = p.usageContexts;

  if (p.defaultPurchaseAccount) extra.defaultPurchaseAccount = p.defaultPurchaseAccount;

  if (p.defaultProfessionalFeeAccount) extra.defaultProfessionalFeeAccount = p.defaultProfessionalFeeAccount;

  return extra;

}



function rowToProvider(row: Record<string, unknown>): Provider {

  const extra = (row.extra as Record<string, unknown>) ?? {};

  return {

    id: String(row.id),

    ruc: String(row.ruc ?? ''),

    name: String(row.name ?? ''),

    category: String(row.category ?? 'Otros'),

    defaultCreditDays: Number(row.default_credit_days) || 0,

    email: row.email ? String(row.email) : undefined,

    phone: row.phone ? String(row.phone) : undefined,

    area: row.area ? String(row.area) : undefined,

    contactName: row.contact_name ? String(row.contact_name) : undefined,

    bankName: row.bank_name ? String(row.bank_name) : undefined,

    bankAccount: row.bank_account ? String(row.bank_account) : undefined,

    type: row.type as Provider['type'],

    specialty: row.specialty ? String(row.specialty) : undefined,

    totalPurchased: row.total_purchased != null ? Number(row.total_purchased) : undefined,

    docIdentityType: extra.docIdentityType as Provider['docIdentityType'],

    defaultExpenseCategory: extra.defaultExpenseCategory as string | undefined,

    accountingAccount: extra.accountingAccount as string | undefined,

    pettyExpenseLines: extra.pettyExpenseLines as Provider['pettyExpenseLines'],

    registeredVia: extra.registeredVia as Provider['registeredVia'],

    usageContexts: extra.usageContexts as Provider['usageContexts'],

    defaultPurchaseAccount: extra.defaultPurchaseAccount as string | undefined,

    defaultProfessionalFeeAccount: extra.defaultProfessionalFeeAccount as string | undefined,

  };

}



export async function loadProvidersFromSql(client: SupabaseClient): Promise<SqlLoadResult<Provider>> {

  const { rows, errors, missingTable } = await selectAllRowsPaginated(client, 'providers', {
    order: { column: 'name', ascending: true },
  });

  if (missingTable) return { ok: false, data: null, empty: true };

  if (errors.length > 0) {

    console.warn('[providersSql] load error', errors);

    return { ok: false, data: null, empty: false };

  }

  const items = rows.map(rowToProvider);

  return { ok: true, data: items, empty: items.length === 0 };

}



export async function saveProvidersToSql(

  client: SupabaseClient,

  items: Provider[],

  userId: string | null,

  options?: { allowPruneWhenEmpty?: boolean }

): Promise<SqlSaveResult> {

  return upsertWithPrune(client, 'providers', items, (list) =>

    list.map((p) => ({

      id: p.id,

      ruc: p.ruc,

      name: p.name,

      category: p.category,

      default_credit_days: p.defaultCreditDays ?? 0,

      email: p.email ?? null,

      phone: p.phone ?? null,

      area: p.area ?? null,

      contact_name: p.contactName ?? null,

      bank_name: p.bankName ?? null,

      bank_account: p.bankAccount ?? null,

      type: p.type ?? null,

      specialty: p.specialty ?? null,

      total_purchased: p.totalPurchased ?? 0,

      extra: providerExtra(p),

      updated_at: new Date().toISOString(),

    }))

  , userId, options);

}



export async function migrateProvidersKvToSql(

  client: SupabaseClient,

  kvItems: Provider[],

  userId: string | null

): Promise<boolean> {

  return (await saveProvidersToSql(client, kvItems, userId)).ok;

}



// ─── Caja chica ────────────────────────────────────────────────────────────



function pettyExtra(t: PettyCashTransaction): Record<string, unknown> {

  const extra: Record<string, unknown> = {};

  if (t.incomeSubtype) extra.incomeSubtype = t.incomeSubtype;

  if (t.docSeries) extra.docSeries = t.docSeries;

  if (t.voucherNumber) extra.voucherNumber = t.voucherNumber;

  if (t.documentDate != null) extra.documentDate = parseTransactionDate(t.documentDate).toISOString();

  if (t.igvRate != null) extra.igvRate = t.igvRate;

  if (t.amountExempt != null) extra.amountExempt = t.amountExempt;

  if (t.accountingAccount) extra.accountingAccount = t.accountingAccount;

  if (t.costCenterId) extra.costCenterId = t.costCenterId;

  if (t.costCenterPathSnapshot) extra.costCenterPathSnapshot = t.costCenterPathSnapshot;

  if (t.auditComment) extra.auditComment = t.auditComment;

  return extra;

}



function rowToPettyCash(row: Record<string, unknown>): PettyCashTransaction {

  const extra = (row.extra as Record<string, unknown>) ?? {};

  return {

    id: String(row.id),

    date: parseTransactionDate(row.date),

    description: String(row.description ?? ''),

    amount: Number(row.amount) || 0,

    type: row.type === 'income' ? 'income' : 'expense',

    location: row.location ? String(row.location) : undefined,

    category: String(row.category ?? 'Otros'),

    requester: String(row.requester ?? ''),

    custodianId: row.custodian_id ? String(row.custodian_id) : undefined,

    receiptNumber: row.receipt_number ? String(row.receipt_number) : undefined,

    status: (row.status as PettyCashTransaction['status']) ?? 'pending_audit',

    weekNumber: row.week_number != null ? (row.week_number as string | number) : '',

    receiptType: row.receipt_type as PettyCashTransaction['receiptType'],

    docType: row.doc_type as PettyCashTransaction['docType'],

    docNumber: row.doc_number ? String(row.doc_number) : undefined,

    providerName: row.provider_name ? String(row.provider_name) : undefined,

    area: row.area ? String(row.area) : undefined,

    isExtraExpense: row.is_extra === true,

    amountBI: row.amount_bi != null ? Number(row.amount_bi) : undefined,

    igv: row.igv != null ? Number(row.igv) : undefined,

    incomeSubtype: extra.incomeSubtype as PettyCashTransaction['incomeSubtype'],

    docSeries: extra.docSeries as string | undefined,

    voucherNumber: extra.voucherNumber as string | undefined,

    documentDate: extra.documentDate ? parseTransactionDate(extra.documentDate) : undefined,

    igvRate: extra.igvRate as PettyCashTransaction['igvRate'],

    amountExempt: extra.amountExempt as number | undefined,

    accountingAccount: extra.accountingAccount as string | undefined,

    costCenterId: extra.costCenterId as string | undefined,

    costCenterPathSnapshot: extra.costCenterPathSnapshot as string | undefined,

    auditComment: extra.auditComment as string | undefined,

  };

}



export async function loadPettyCashFromSql(

  client: SupabaseClient

): Promise<SqlLoadResult<PettyCashTransaction>> {

  const { rows, errors, missingTable } = await selectAllRowsPaginated(
    client,
    'petty_cash_transactions',
    { order: { column: 'date', ascending: false } }
  );

  if (missingTable) return { ok: false, data: null, empty: true };

  if (errors.length > 0) {

    console.warn('[pettyCashSql] load error', errors);

    return { ok: false, data: null, empty: false };

  }

  const items = rows.map(rowToPettyCash);

  return { ok: true, data: items, empty: items.length === 0 };

}



export async function savePettyCashToSql(

  client: SupabaseClient,

  items: PettyCashTransaction[],

  userId: string | null,

  options?: { allowPruneWhenEmpty?: boolean }

): Promise<SqlSaveResult> {

  return upsertWithPrune(client, 'petty_cash_transactions', items, (list) =>

    list.map((t) => ({

      id: t.id,

      date: parseTransactionDate(t.date).toISOString(),

      description: t.description,

      amount: t.amount,

      type: t.type,

      location: t.location ?? null,

      category: t.category,

      requester: t.requester,

      custodian_id: t.custodianId ?? null,

      receipt_number: t.receiptNumber ?? null,

      status: t.status,

      week_number: t.weekNumber != null ? String(t.weekNumber) : null,

      receipt_type: t.receiptType ?? null,

      doc_type: t.docType ?? null,

      doc_number: t.docNumber ?? null,

      provider_name: t.providerName ?? null,

      area: t.area ?? null,

      is_extra: t.isExtraExpense === true,

      amount_bi: t.amountBI ?? null,

      igv: t.igv ?? null,

      extra: pettyExtra(t),

      updated_at: new Date().toISOString(),

    }))

  , userId, options);

}



export async function migratePettyCashKvToSql(

  client: SupabaseClient,

  kvItems: PettyCashTransaction[],

  userId: string | null

): Promise<boolean> {

  return (await savePettyCashToSql(client, kvItems, userId)).ok;

}



// ─── Facturas (Cuentas por pagar) ──────────────────────────────────────────



function rowToInvoice(row: Record<string, unknown>): InvoiceDraft {

  return {

    id: String(row.id),

    fileName: String(row.file_name ?? ''),

    provider: String(row.provider ?? ''),

    invoiceNumber: String(row.invoice_number ?? ''),

    issueDate: String(row.issue_date ?? '').slice(0, 10),

    dueDate: String(row.due_date ?? '').slice(0, 10),

    description: String(row.description ?? ''),

    location: String(row.location ?? ''),

    subtotal: Number(row.subtotal) || 0,

    igv: Number(row.igv) || 0,

    total: Number(row.total) || 0,

    status: (row.status as InvoiceDraft['status']) ?? 'draft',

  };

}



export async function loadInvoicesFromSql(

  client: SupabaseClient

): Promise<SqlLoadResult<InvoiceDraft>> {

  const { rows, errors, missingTable } = await selectAllRowsPaginated(client, 'invoices', {
    order: { column: 'issue_date', ascending: false },
  });

  if (missingTable) return { ok: false, data: null, empty: true };

  if (errors.length > 0) {

    console.warn('[invoicesSql] load error', errors);

    return { ok: false, data: null, empty: false };

  }

  const items = rows.map(rowToInvoice);

  return { ok: true, data: items, empty: items.length === 0 };

}



export async function saveInvoicesToSql(

  client: SupabaseClient,

  items: InvoiceDraft[],

  userId: string | null,

  options?: { allowPruneWhenEmpty?: boolean }

): Promise<SqlSaveResult> {

  return upsertWithPrune(client, 'invoices', items, (list) =>

    list.map((i) => ({

      id: i.id,

      file_name: i.fileName,

      provider: i.provider,

      invoice_number: i.invoiceNumber,

      issue_date: i.issueDate,

      due_date: i.dueDate,

      description: i.description,

      location: i.location,

      subtotal: i.subtotal,

      igv: i.igv,

      total: i.total,

      status: i.status,

      updated_at: new Date().toISOString(),

    }))

  , userId, options);

}



export async function migrateInvoicesKvToSql(

  client: SupabaseClient,

  kvItems: InvoiceDraft[],

  userId: string | null

): Promise<boolean> {

  return (await saveInvoicesToSql(client, kvItems, userId)).ok;

}



// ─── Solicitudes de compra ─────────────────────────────────────────────────



function rowToPurchaseRequest(row: Record<string, unknown>): PurchaseRequest {

  const extra = (row.extra as Record<string, unknown>) ?? {};

  return {

    id: String(row.id),

    providerId: String(row.provider_id ?? ''),

    providerName: String(row.provider_name ?? ''),

    requestDate: parseTransactionDate(row.request_date),

    description: String(row.description ?? ''),

    amount: Number(row.amount) || 0,

    location: String(row.location ?? ''),

    priority: (row.priority as PurchaseRequest['priority']) ?? 'medium',

    paymentCondition: (row.payment_condition as PurchaseRequest['paymentCondition']) ?? 'cash',

    status: (row.status as PurchaseRequest['status']) ?? 'pending',

    requesterName: String(row.requester_name ?? ''),

    requesterInitials: String(row.requester_initials ?? ''),

    approverName: row.approver_name ? String(row.approver_name) : undefined,

    approverInitials: row.approver_initials ? String(row.approver_initials) : undefined,

    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : undefined,

    approvalComment: row.approval_comment ? String(row.approval_comment) : undefined,

    attachmentUrl: extra.attachmentUrl as string | undefined,

  };

}



export async function loadPurchaseRequestsFromSql(

  client: SupabaseClient

): Promise<SqlLoadResult<PurchaseRequest>> {

  const { rows, errors, missingTable } = await selectAllRowsPaginated(
    client,
    'purchase_requests',
    { order: { column: 'request_date', ascending: false } }
  );

  if (missingTable) return { ok: false, data: null, empty: true };

  if (errors.length > 0) {

    console.warn('[purchaseRequestsSql] load error', errors);

    return { ok: false, data: null, empty: false };

  }

  const items = rows.map(rowToPurchaseRequest);

  return { ok: true, data: items, empty: items.length === 0 };

}



export async function savePurchaseRequestsToSql(

  client: SupabaseClient,

  items: PurchaseRequest[],

  userId: string | null,

  options?: { allowPruneWhenEmpty?: boolean }

): Promise<SqlSaveResult> {

  return upsertWithPrune(client, 'purchase_requests', items, (list) =>

    list.map((r) => ({

      id: r.id,

      provider_id: r.providerId || null,

      provider_name: r.providerName,

      request_date: parseTransactionDate(r.requestDate).toISOString(),

      description: r.description,

      amount: r.amount,

      location: r.location,

      priority: r.priority,

      payment_condition: r.paymentCondition,

      status: r.status,

      requester_name: r.requesterName,

      requester_initials: r.requesterInitials,

      approver_name: r.approverName ?? null,

      approver_initials: r.approverInitials ?? null,

      rejection_reason: r.rejectionReason ?? null,

      approval_comment: r.approvalComment ?? null,

      extra: r.attachmentUrl ? { attachmentUrl: r.attachmentUrl } : {},

      updated_at: new Date().toISOString(),

    }))

  , userId, options);

}



export async function migratePurchaseRequestsKvToSql(

  client: SupabaseClient,

  kvItems: PurchaseRequest[],

  userId: string | null

): Promise<boolean> {

  return (await savePurchaseRequestsToSql(client, kvItems, userId)).ok;

}



// ─── Usuarios app ──────────────────────────────────────────────────────────



function userExtra(u: User): Record<string, unknown> {

  const extra: Record<string, unknown> = {};

  if (u.pettyCashFundEnabled != null) extra.pettyCashFundEnabled = u.pettyCashFundEnabled;

  if (u.pettyCashOpeningCarrySuggested != null) extra.pettyCashOpeningCarrySuggested = u.pettyCashOpeningCarrySuggested;

  if (u.pettyCashOpeningCarryConsumedAt) extra.pettyCashOpeningCarryConsumedAt = u.pettyCashOpeningCarryConsumedAt;

  if (u.tempPassword) extra.tempPassword = u.tempPassword;

  if (u.avatarUrl) extra.avatarUrl = u.avatarUrl;

  return extra;

}



function rowToAppUser(row: Record<string, unknown>): User {

  const extra = (row.extra as Record<string, unknown>) ?? {};

  return {

    id: String(row.id),

    name: String(row.name ?? ''),

    initials: String(row.initials ?? ''),

    role: String(row.role ?? 'manager'),

    email: row.email ? String(row.email) : undefined,

    location: row.location ? String(row.location) : undefined,

    sedes: Array.isArray(row.sedes) ? (row.sedes as string[]) : undefined,

    allSedes: row.all_sedes === true,

    pettyCashLimit: row.petty_cash_limit != null ? Number(row.petty_cash_limit) : undefined,

    lastLogin: row.last_login ? String(row.last_login) : undefined,

    status: (row.status as User['status']) ?? 'active',

    pettyCashFundEnabled: extra.pettyCashFundEnabled as boolean | undefined,

    pettyCashOpeningCarrySuggested: extra.pettyCashOpeningCarrySuggested as number | undefined,

    pettyCashOpeningCarryConsumedAt: extra.pettyCashOpeningCarryConsumedAt as string | undefined,

    tempPassword: extra.tempPassword as string | undefined,

    avatarUrl: extra.avatarUrl as string | undefined,

  };

}



export async function loadAppUsersFromSql(client: SupabaseClient): Promise<SqlLoadResult<User>> {

  const { rows, errors, missingTable } = await selectAllRowsPaginated(client, 'app_users', {
    order: { column: 'name', ascending: true },
  });

  if (missingTable) return { ok: false, data: null, empty: true };

  if (errors.length > 0) {

    console.warn('[appUsersSql] load error', errors);

    return { ok: false, data: null, empty: false };

  }

  const items = rows.map(rowToAppUser);

  return { ok: true, data: items, empty: items.length === 0 };

}



export async function saveAppUsersToSql(

  client: SupabaseClient,

  items: User[],

  userId: string | null

): Promise<SqlSaveResult> {

  return upsertWithPrune(client, 'app_users', items, (list) =>

    list.map((u) => ({

      id: u.id,

      name: u.name,

      initials: u.initials,

      role: u.role,

      email: u.email ?? null,

      location: u.location ?? null,

      sedes: u.sedes ?? [],

      all_sedes: u.allSedes === true,

      petty_cash_limit: u.pettyCashLimit ?? null,

      last_login: u.lastLogin ?? null,

      status: u.status ?? 'active',

      auth_id: /^[0-9a-f-]{36}$/i.test(u.id) ? u.id : null,

      extra: userExtra(u),

      updated_at: new Date().toISOString(),

    }))

  , userId);

}



export async function migrateAppUsersKvToSql(

  client: SupabaseClient,

  kvItems: User[],

  userId: string | null

): Promise<boolean> {

  return (await saveAppUsersToSql(client, kvItems, userId)).ok;

}



// ─── Roles ─────────────────────────────────────────────────────────────────



function rowToRole(row: Record<string, unknown>): Role {

  return {

    id: String(row.id),

    name: String(row.name ?? ''),

    description: String(row.description ?? ''),

    color: String(row.color ?? ''),

    bgColor: String(row.bg_color ?? ''),

    borderColor: String(row.border_color ?? ''),

    isSystem: row.is_system === true,

    permissions: (row.permissions as Record<string, boolean>) ?? {},

  };

}



export async function loadRolesFromSql(client: SupabaseClient): Promise<SqlLoadResult<Role>> {

  const { rows, errors, missingTable } = await selectAllRowsPaginated(client, 'roles', {
    order: { column: 'name', ascending: true },
  });

  if (missingTable) return { ok: false, data: null, empty: true };

  if (errors.length > 0) {

    console.warn('[rolesSql] load error', errors);

    return { ok: false, data: null, empty: false };

  }

  const items = rows.map(rowToRole);

  return { ok: true, data: items, empty: items.length === 0 };

}



export async function saveRolesToSql(

  client: SupabaseClient,

  items: Role[],

  userId: string | null

): Promise<SqlSaveResult> {

  return upsertWithPrune(client, 'roles', items, (list) =>

    list.map((r) => ({

      id: r.id,

      name: r.name,

      description: r.description,

      color: r.color,

      bg_color: r.bgColor,

      border_color: r.borderColor,

      is_system: r.isSystem,

      permissions: r.permissions,

      updated_at: new Date().toISOString(),

    }))

  , userId);

}



export async function migrateRolesKvToSql(

  client: SupabaseClient,

  kvItems: Role[],

  userId: string | null

): Promise<boolean> {

  return (await saveRolesToSql(client, kvItems, userId)).ok;

}



/** Resuelve lista: SQL gana si tiene filas; si no, migra desde KV. */
export async function resolveListFromSql<T extends { id: string }>(
  kvList: T[],
  loadSql: () => Promise<SqlLoadResult<T>>,
  migrate: (list: T[], userId: string | null) => Promise<boolean>,
  userId: string | null
): Promise<T[]> {
  if (!isProductionSqlEnabled()) return kvList;

  const sqlLoad = await loadSql();

  if (!sqlLoad.ok) {
    return kvList;
  }

  const sqlData = sqlLoad.data ?? [];

  if (sqlData.length > 0) {
    const sqlIds = new Set(sqlData.map((r) => r.id));
    const kvOnly = kvList.filter((r) => !sqlIds.has(r.id));
    if (kvOnly.length > 0) {
      const merged = [...sqlData, ...kvOnly];
      if (userId) await migrate(merged, userId);
      return merged;
    }
    return sqlData;
  }

  if (kvList.length > 0) {
    if (userId) await migrate(kvList, userId);
    return kvList;
  }

  return [];
}


