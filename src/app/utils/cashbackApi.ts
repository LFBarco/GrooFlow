import { getGrooflowApiBase, getGrooflowToken } from '../services/repository/apiBase';
import type {
  CashbackInvoice,
  CashbackInvoiceDraft,
  CashbackLiquidation,
  CashbackMeResponse,
  CashbackReport,
  CashbackReviewAction,
  CashbackSettings,
  CashbackUserBalanceRow,
} from '../types/cashback';
import { parseMoney } from './cashbackRules';

export class CashbackApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fieldErrors: Record<string, string> = {}
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getGrooflowToken();
  if (!token) throw new CashbackApiError('Sesión caducada. Vuelve a iniciar sesión.', 401);
  const res = await fetch(`${getGrooflowApiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
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
  if (!res.ok || json.ok === false) {
    const fieldErrors = (json.errors && typeof json.errors === 'object' ? json.errors : {}) as Record<string, string>;
    const first = Object.values(fieldErrors)[0];
    const message = String(json.error || first || `Error ${res.status}`);
    throw new CashbackApiError(first && message === 'Revisa los campos indicados' ? first : message, res.status, fieldErrors);
  }
  return json as T;
}

function draftPayload(draft: CashbackInvoiceDraft, includePhoto: boolean) {
  return {
    emisorRuc: draft.emisorRuc.replace(/\D/g, ''),
    emisorNombre: draft.emisorNombre.trim(),
    emisorEstado: draft.emisorEstado,
    emisorCondicion: draft.emisorCondicion,
    tipoDoc: draft.tipoDoc,
    serie: draft.serie.trim().toUpperCase(),
    numero: draft.numero.trim(),
    fechaEmision: draft.fechaEmision,
    base: parseMoney(draft.base),
    igv: parseMoney(draft.igv),
    total: parseMoney(draft.total),
    compradorRuc: draft.compradorRuc.replace(/\D/g, ''),
    categoria: draft.categoria,
    motivo: draft.motivo.trim(),
    centroCosto: draft.centroCosto.trim(),
    declaraSinExcluidos: draft.declaraSinExcluidos,
    qrRaw: draft.qrRaw,
    ...(includePhoto && draft.photo ? { photo: draft.photo } : {}),
  };
}

export async function fetchCashbackMe(): Promise<CashbackMeResponse> {
  return request<CashbackMeResponse>('/cashback/me');
}

export async function createCashbackInvoice(draft: CashbackInvoiceDraft): Promise<CashbackInvoice> {
  const json = await request<{ item: CashbackInvoice }>('/cashback/invoices', {
    method: 'POST',
    body: JSON.stringify(draftPayload(draft, true)),
  });
  return json.item;
}

/** `photoChanged` evita reenviar la foto existente cuando solo se corrigen datos. */
export async function updateCashbackInvoice(
  id: string,
  draft: CashbackInvoiceDraft,
  photoChanged: boolean
): Promise<CashbackInvoice> {
  const json = await request<{ item: CashbackInvoice }>(`/cashback/invoices/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(draftPayload(draft, photoChanged)),
  });
  return json.item;
}

export async function deleteCashbackInvoice(id: string): Promise<void> {
  await request(`/cashback/invoices/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function fetchCashbackPhoto(id: string): Promise<{ dataUrl: string; mime: string }> {
  return request<{ dataUrl: string; mime: string }>(`/cashback/invoices/${encodeURIComponent(id)}/photo`);
}

export async function listCashbackInvoices(filters: {
  estado?: string;
  desde?: string;
  hasta?: string;
  q?: string;
  usuarioId?: string;
}): Promise<CashbackInvoice[]> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
  const qs = params.toString();
  const json = await request<{ items: CashbackInvoice[] }>(`/cashback/invoices${qs ? `?${qs}` : ''}`);
  return json.items ?? [];
}

export async function reviewCashbackInvoice(
  id: string,
  action: CashbackReviewAction,
  extra: { note?: string; igv?: number | null; total?: number | null; cuentaContable?: string } = {}
): Promise<CashbackInvoice> {
  const json = await request<{ item: CashbackInvoice }>(`/cashback/invoices/${encodeURIComponent(id)}/review`, {
    method: 'POST',
    body: JSON.stringify({ action, ...extra }),
  });
  return json.item;
}

export type CashbackProviderCheck = { registered: boolean; nombre: string | null; cuentaContable: string | null };

export async function fetchCashbackProvider(ruc: string, categoria: string): Promise<CashbackProviderCheck> {
  const qs = new URLSearchParams({ ruc, categoria });
  return request<CashbackProviderCheck>(`/cashback/provider?${qs.toString()}`);
}

export async function fetchCashbackSettings(): Promise<CashbackSettings> {
  const json = await request<{ settings: CashbackSettings }>('/cashback/settings');
  return json.settings;
}

export async function saveCashbackSettings(settings: CashbackSettings): Promise<CashbackSettings> {
  const json = await request<{ settings: CashbackSettings }>('/cashback/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
  return json.settings;
}

export async function fetchCashbackBalances(): Promise<CashbackUserBalanceRow[]> {
  const json = await request<{ items: CashbackUserBalanceRow[] }>('/cashback/balances');
  return json.items ?? [];
}

export async function fetchCashbackLiquidations(): Promise<CashbackLiquidation[]> {
  const json = await request<{ items: CashbackLiquidation[] }>('/cashback/liquidations');
  return json.items ?? [];
}

export async function createCashbackLiquidation(payload: {
  periodo: string;
  usuarioIds?: string[];
  ignorarUmbral?: boolean;
  nota?: string;
}): Promise<CashbackLiquidation> {
  const json = await request<{ item: CashbackLiquidation }>('/cashback/liquidations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return json.item;
}

export async function markCashbackLiquidationPaid(id: string): Promise<CashbackLiquidation> {
  const json = await request<{ item: CashbackLiquidation }>(
    `/cashback/liquidations/${encodeURIComponent(id)}/paid`,
    { method: 'POST' }
  );
  return json.item;
}

export async function fetchCashbackReport(range: { desde?: string; hasta?: string }): Promise<CashbackReport> {
  const params = new URLSearchParams();
  if (range.desde) params.set('desde', range.desde);
  if (range.hasta) params.set('hasta', range.hasta);
  return request<CashbackReport>(`/cashback/report?${params.toString()}`);
}
