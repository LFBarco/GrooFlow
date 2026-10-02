import { getGrooflowApiBase, getGrooflowToken } from '../services/repository/apiBase';

export type ReceiptPhotoModule = 'caja-chica';

export class ReceiptPhotoApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getGrooflowToken();
  if (!token) throw new ReceiptPhotoApiError('Sesión caducada. Vuelve a iniciar sesión.', 401);
  const res = await fetch(`${getGrooflowApiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
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
    throw new ReceiptPhotoApiError(String(json.error || `Error ${res.status}`), res.status);
  }
  return json as T;
}

const photoPath = (mod: ReceiptPhotoModule, refId: string) =>
  `/receipts/${mod}/${encodeURIComponent(refId)}/photo`;

export async function saveReceiptPhoto(
  mod: ReceiptPhotoModule,
  refId: string,
  dataUrl: string
): Promise<{ duplicateOf: string | null }> {
  const res = await request<{ duplicateOf?: string | null }>(photoPath(mod, refId), {
    method: 'PUT',
    body: JSON.stringify({ photo: dataUrl }),
  });
  return { duplicateOf: res.duplicateOf ?? null };
}

export async function fetchReceiptPhoto(mod: ReceiptPhotoModule, refId: string): Promise<{ dataUrl: string; mime: string }> {
  return request<{ dataUrl: string; mime: string }>(photoPath(mod, refId));
}

export async function deleteReceiptPhoto(mod: ReceiptPhotoModule, refId: string): Promise<void> {
  await request(photoPath(mod, refId), { method: 'DELETE' });
}

/** ¿El comprobante ya fue presentado en Cashback? (pagado con dinero propio del colaborador). */
export async function checkReceiptInCashback(
  mod: ReceiptPhotoModule,
  ruc: string,
  serie: string,
  numero: string
): Promise<{ usuarioNombre: string; estado: string } | null> {
  const qs = new URLSearchParams({ ruc, serie, numero });
  const res = await request<{ cashback?: { usuarioNombre: string; estado: string } | null }>(
    `/receipts/${mod}/check?${qs.toString()}`
  );
  return res.cashback ?? null;
}
