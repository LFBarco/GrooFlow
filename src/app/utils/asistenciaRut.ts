/**
 * Cuerpo numérico de RUT/DNI (sin DV) para cruce staff ↔ Buk.
 * No trata DNI Perú de 8 dígitos como RUT 7+DV.
 */
export function asistenciaRutMatchKey(raw?: string | null): string {
  const n = String(raw ?? '')
    .replace(/[.\-\s]/g, '')
    .toUpperCase();
  if (!n) return '';
  let body = n;
  if (/^\d{7,8}K$/.test(n)) body = n.slice(0, -1);
  else if (/^\d{8}[0-9]$/.test(n) && n.length === 9) body = n.slice(0, -1);
  else if (!/^\d+$/.test(n)) return n;
  const stripped = body.replace(/^0+/, '');
  return stripped.length >= 6 ? stripped : body;
}

export function asistenciaRutsMatch(a?: string | null, b?: string | null): boolean {
  const x = asistenciaRutMatchKey(a);
  const y = asistenciaRutMatchKey(b);
  return Boolean(x && y && x === y);
}
