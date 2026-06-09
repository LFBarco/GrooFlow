import type { InventoryEquipment } from '../types/inventory';

/** Abreviatura de sede para códigos (Miraflores → MIR, San Juan de Lurigancho → SJL). */
const SEDE_SKIP_WORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e']);

export function abbrevSede(sede: string): string {
  const clean = sede.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
  const words = clean
    .split(/\s+/)
    .filter((w) => w && !SEDE_SKIP_WORDS.has(w.toLowerCase()));
  if (words.length === 0) return 'SED';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .map((w) => w[0])
    .join('')
    .slice(0, 4)
    .toUpperCase();
}

/** Segmento piso + consultorio: P2 + C03 → P2C03 */
export function formatFloorRoomSegment(floor?: string, room?: string): string {
  const f = (floor || '').trim();
  const r = (room || '').trim();
  let p = '';
  let c = '';
  if (f) {
    const digits = f.replace(/\D/g, '');
    p = digits ? `P${digits}` : `P${f.slice(0, 2).toUpperCase()}`;
  }
  if (r) {
    const digits = r.replace(/\D/g, '');
    c = digits ? `C${digits.padStart(2, '0').slice(-2)}` : `C${r.replace(/\s/g, '').slice(0, 3).toUpperCase()}`;
  }
  if (p && c) return `${p}${c}`;
  return p || c || '';
}

export type GenerateEquipmentCodeInput = {
  categoryPrefix: string;
  sede: string;
  floor?: string;
  room?: string;
  existingEquipment: InventoryEquipment[];
  excludeId?: string;
};

/**
 * Genera código único: `{PREFIJO}-{SEDE}-{PISOCONS}-{NNN}`
 * Ej: IMG-MIR-P2C03-001, ANE-SIS-002 (sin piso/consultorio).
 */
export function generateEquipmentCode(input: GenerateEquipmentCodeInput): string {
  const prefix =
    input.categoryPrefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'EQP';
  const sedeAbbr = abbrevSede(input.sede);
  const loc = formatFloorRoomSegment(input.floor, input.room);
  const base = loc ? `${prefix}-${sedeAbbr}-${loc}` : `${prefix}-${sedeAbbr}`;

  const existingCodes = new Set(
    input.existingEquipment
      .filter((e) => e.id !== input.excludeId)
      .map((e) => e.code.trim().toUpperCase())
  );

  let n = 1;
  let code = `${base}-${String(n).padStart(3, '0')}`;
  while (existingCodes.has(code.toUpperCase())) {
    n += 1;
    code = `${base}-${String(n).padStart(3, '0')}`;
  }
  return code;
}

/** Payload QR escaneable (muestra en pantalla sin impresora). */
export function buildInventoryQrPayload(eq: Pick<
  InventoryEquipment,
  'id' | 'code' | 'name' | 'sede' | 'floor' | 'room'
>): string {
  return JSON.stringify({
    app: 'grooflow',
    type: 'inventory',
    id: eq.id,
    code: eq.code,
    name: eq.name,
    sede: eq.sede,
    floor: eq.floor ?? '',
    room: eq.room ?? '',
  });
}

export function describeCodePattern(prefix: string): string {
  return `${prefix || 'EQP'}-SEDE-P2C03-001 (piso y consultorio opcionales)`;
}

export type InventoryQrScanPayload = {
  id?: string;
  code?: string;
};

/** Interpreta texto del QR (JSON GrooFlow o código plano). */
export function parseInventoryQrScan(raw: string): InventoryQrScanPayload | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed.app === 'grooflow' && parsed.type === 'inventory') {
        const id = typeof parsed.id === 'string' ? parsed.id.trim() : '';
        const code = typeof parsed.code === 'string' ? parsed.code.trim() : '';
        if (id || code) return { id: id || undefined, code: code || undefined };
      }
    } catch {
      /* texto no JSON válido */
    }
  }

  return { code: trimmed };
}
