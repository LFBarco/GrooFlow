import { getGrooflowApiBase, getGrooflowToken } from '../services/repository/apiBase';
import type { Telefono, TelefonoDraft, TelefonoImportResult, TelefonoImportRow, TelefonosResponse } from '../types/telefonos';

export class TelefonosApiError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors: Record<string, string> = {}
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getGrooflowToken();
  if (!token) throw new TelefonosApiError('Sesión caducada. Vuelve a iniciar sesión.');
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
    const fieldErrors = (json.errors && typeof json.errors === 'object' ? json.errors : {}) as Record<string, string>;
    const first = Object.values(fieldErrors)[0];
    throw new TelefonosApiError(String(first || json.error || `Error ${res.status}`), fieldErrors);
  }
  return json as T;
}

function draftPayload(d: TelefonoDraft) {
  return {
    numero: d.numero,
    tipo: d.tipo,
    bukId: d.tipo === 'persona' ? d.bukId : null,
    etiqueta: d.etiqueta.trim(),
    responsable: d.responsable.trim(),
    operador: d.operador.trim(),
    plan: d.plan.trim(),
    costoMensual: d.costoMensual.trim(),
    equipo: d.equipo.trim(),
    imei: d.imei.trim(),
    iccid: d.iccid.trim(),
    estado: d.estado,
    notas: d.notas.trim(),
  };
}

export const fetchTelefonos = () => request<TelefonosResponse>('/telefonos');

export async function createTelefono(d: TelefonoDraft): Promise<Telefono> {
  return (await request<{ item: Telefono }>('/telefonos', { method: 'POST', body: JSON.stringify(draftPayload(d)) })).item;
}

export async function updateTelefono(id: string, d: TelefonoDraft): Promise<Telefono> {
  return (
    await request<{ item: Telefono }>(`/telefonos/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(draftPayload(d)),
    })
  ).item;
}

export async function deleteTelefono(id: string): Promise<void> {
  await request(`/telefonos/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export const importTelefonos = (rows: TelefonoImportRow[]) =>
  request<TelefonoImportResult>('/telefonos/import', { method: 'POST', body: JSON.stringify({ rows }) });
