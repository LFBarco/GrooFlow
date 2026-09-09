import { getGrooflowApiBase } from '../services/repository/apiBase';

export interface SunatRucInfo {
  ruc: string;
  razonSocial: string;
  direccion?: string;
  estado?: string;
  condicion?: string;
}

export function normalizeRucDigits(input: string): string {
  return input.replace(/\D/g, '').slice(0, 11);
}

export function isValidRucDigits(input: string): boolean {
  return /^\d{11}$/.test(input.trim());
}

export async function fetchSunatRucData(rucInput: string): Promise<SunatRucInfo | null> {
  const digits = normalizeRucDigits(rucInput);
  if (!isValidRucDigits(digits)) {
    return null;
  }

  // 1. Backend Proxy
  try {
    const apiBase = getGrooflowApiBase();
    const res = await fetch(`${apiBase}/proxy/sunat/ruc?numero=${digits}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.ok && json.razonSocial) {
        return {
          ruc: digits,
          razonSocial: String(json.razonSocial).trim(),
          direccion: json.direccion ? String(json.direccion).trim() : undefined,
          estado: json.estado ? String(json.estado).trim() : undefined,
          condicion: json.condicion ? String(json.condicion).trim() : undefined,
        };
      }
    }
  } catch {
    // Fallback to public endpoints
  }

  // 2. Direct Public Endpoint Fallback (apis.net.pe)
  try {
    const res = await fetch(`https://api.apis.net.pe/v1/ruc?numero=${digits}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      const name = data.nombre || data.razonSocial;
      if (name) {
        return {
          ruc: digits,
          razonSocial: String(name).trim(),
          direccion: data.direccion ? String(data.direccion).trim() : undefined,
          estado: data.estado ? String(data.estado).trim() : undefined,
          condicion: data.condicion ? String(data.condicion).trim() : undefined,
        };
      }
    }
  } catch {
    // Fallback ignore
  }

  // 3. Direct Public Endpoint Fallback (apisperu)
  try {
    const res = await fetch(`https://dniruc.apisperu.com/api/v1/ruc/${digits}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      const name = data.razonsocial || data.nombre;
      if (name) {
        return {
          ruc: digits,
          razonSocial: String(name).trim(),
          direccion: data.direccion ? String(data.direccion).trim() : undefined,
          estado: data.estado ? String(data.estado).trim() : undefined,
          condicion: data.condicion ? String(data.condicion).trim() : undefined,
        };
      }
    }
  } catch {
    // Ignore
  }

  return null;
}
