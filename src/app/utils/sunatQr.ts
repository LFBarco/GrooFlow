export type ParsedSunatQr = {
  emisorRuc: string;
  tipoDoc: string;
  serie: string;
  numero: string;
  igv: number | null;
  total: number | null;
  fechaEmision: string;
  compradorTipoDoc: string;
  compradorDoc: string;
};

function qrMoney(value: string | undefined): number | null {
  if (value === undefined) return null;
  const cleaned = value.replace(/S\/|\s/gi, '').replace(/,/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : null;
}

function normalizeQrDate(raw: string): string {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return '';
}

/**
 * QR de comprobante electrónico SUNAT:
 * RUC emisor | tipo | serie | número | IGV | total | fecha | tipo doc adquirente | nro doc adquirente | ...
 */
export function parseSunatQr(raw: string): ParsedSunatQr | null {
  const text = (raw ?? '').trim();
  if (!text) return null;
  const sep = text.includes('|') ? '|' : text.includes(']') ? ']' : text.includes(';') ? ';' : null;
  if (!sep) return null;
  const parts = text.split(sep).map((p) => p.trim());
  if (parts.length < 6) return null;
  const emisorRuc = parts[0].replace(/\D/g, '');
  if (emisorRuc.length !== 11) return null;
  const tipoDoc = parts[1].replace(/\D/g, '').padStart(2, '0');
  const serie = parts[2].toUpperCase();
  const numero = parts[3].replace(/\D/g, '').replace(/^0+/, '');
  if (!serie || !numero) return null;
  return {
    emisorRuc,
    tipoDoc,
    serie,
    numero,
    igv: qrMoney(parts[4]),
    total: qrMoney(parts[5]),
    fechaEmision: normalizeQrDate(parts[6] ?? ''),
    compradorTipoDoc: (parts[7] ?? '').trim(),
    compradorDoc: (parts[8] ?? '').replace(/\D/g, ''),
  };
}
