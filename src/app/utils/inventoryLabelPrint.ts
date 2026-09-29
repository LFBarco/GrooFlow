import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

import type { InventoryEquipment } from '../types/inventory';
import { buildInventoryQrPayload } from './inventoryCodeGenerator';

export type LabelSymbology = 'qr' | 'barcode' | 'both';

export type LabelSizeId = '50x25' | '60x40' | '62x29' | 'tape24' | 'a4-21';

export type LabelSizePreset = {
  id: LabelSizeId;
  label: string;
  hint: string;
  widthMm: number;
  heightMm: number;
  /** Hoja A4 con varias etiquetas (impresora común). */
  sheet?: { cols: number; rows: number; marginTopMm: number; marginLeftMm: number; gapXMm: number; gapYMm: number };
};

export const LABEL_SIZE_PRESETS: LabelSizePreset[] = [
  { id: '50x25', label: '50 × 25 mm', hint: 'Rollo térmico estándar (Zebra, TSC, Xprinter)', widthMm: 50, heightMm: 25 },
  { id: '60x40', label: '60 × 40 mm', hint: 'Rollo térmico, más legible', widthMm: 60, heightMm: 40 },
  { id: '62x29', label: '62 × 29 mm', hint: 'Brother QL (DK-11209)', widthMm: 62, heightMm: 29 },
  { id: 'tape24', label: 'Cinta 24 mm', hint: 'Brother P-touch TZe laminada (24 × 60 mm)', widthMm: 60, heightMm: 24 },
  {
    id: 'a4-21',
    label: 'Hoja A4 (21 etiquetas)',
    hint: 'Hoja adhesiva 63,5 × 38,1 mm en impresora común',
    widthMm: 63.5,
    heightMm: 38.1,
    sheet: { cols: 3, rows: 7, marginTopMm: 15.1, marginLeftMm: 7.2, gapXMm: 2.5, gapYMm: 0 },
  },
];

export type LabelPrintOptions = {
  sizeId: LabelSizeId;
  symbology: LabelSymbology;
  showName: boolean;
  showSede: boolean;
  /** Copias por equipo. */
  copies: number;
};

export const DEFAULT_LABEL_PRINT_OPTIONS: LabelPrintOptions = {
  sizeId: '50x25',
  symbology: 'qr',
  showName: true,
  showSede: true,
  copies: 1,
};

const PREFS_KEY = 'grooflow_inventory_label_prefs';

export function loadLabelPrintOptions(): LabelPrintOptions {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_LABEL_PRINT_OPTIONS;
    const parsed = JSON.parse(raw) as Partial<LabelPrintOptions>;
    const merged = { ...DEFAULT_LABEL_PRINT_OPTIONS, ...parsed };
    if (!LABEL_SIZE_PRESETS.some((p) => p.id === merged.sizeId)) merged.sizeId = DEFAULT_LABEL_PRINT_OPTIONS.sizeId;
    merged.copies = Math.min(20, Math.max(1, Math.round(Number(merged.copies) || 1)));
    return merged;
  } catch {
    return DEFAULT_LABEL_PRINT_OPTIONS;
  }
}

export function saveLabelPrintOptions(opts: LabelPrintOptions): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(opts));
  } catch {
    /* almacenamiento no disponible */
  }
}

type LabelEquipment = Pick<InventoryEquipment, 'id' | 'code' | 'name' | 'sede' | 'floor' | 'room'>;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function renderQrSvg(eq: LabelEquipment): Promise<string> {
  return QRCode.toString(buildInventoryQrPayload(eq), {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });
}

/** Code128: lo leen todos los lectores láser/imagen USB. */
export function renderBarcodeSvg(code: string): string {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, code, {
    format: 'CODE128',
    displayValue: false,
    margin: 0,
    width: 2,
    height: 60,
    background: '#ffffff',
    lineColor: '#000000',
  });
  const w = svg.getAttribute('width')?.replace('px', '') || '200';
  const h = svg.getAttribute('height')?.replace('px', '') || '60';
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.removeAttribute('style');
  return svg.outerHTML;
}

function locationLine(eq: LabelEquipment): string {
  const parts = [eq.sede];
  if (eq.floor) parts.push(`P${eq.floor}`);
  if (eq.room) parts.push(`C${eq.room}`);
  return parts.filter(Boolean).join(' · ');
}

function labelMetrics(preset: LabelSizePreset) {
  const { widthMm: w, heightMm: h } = preset;
  const pad = Math.min(2, h * 0.07);
  const inner = h - pad * 2;
  const qrSide = Math.min(inner, w * 0.45);
  const qrSideBoth = Math.min(inner * 0.58, w * 0.4);
  const base = Math.max(1.9, Math.min(3.2, h / 9));
  return { w, h, pad, inner, qrSide, qrSideBoth, base };
}

/** Tamaño de letra para que el código quepa en una línea (monoespaciada ≈ 0,6 em por carácter). */
function codeFontMm(code: string, availableMm: number, maxMm: number): number {
  const fit = availableMm / (Math.max(code.length, 1) * 0.62);
  return Math.max(1.6, Math.min(maxMm, fit));
}

async function labelInnerHtml(eq: LabelEquipment, opts: LabelPrintOptions, preset: LabelSizePreset): Promise<string> {
  const rawCode = eq.code.trim();
  const m = labelMetrics(preset);
  const maxCode = m.base * 1.15;
  const textWidth = (qr: number) => m.w - m.pad * 2 - qr - 1.5;
  const codeDiv = (avail: number) =>
    `<div class="code" style="font-size:${codeFontMm(rawCode, avail, maxCode).toFixed(2)}mm">${escapeHtml(rawCode)}</div>`;
  const name = opts.showName && eq.name ? `<div class="name">${escapeHtml(eq.name)}</div>` : '';
  const sede = opts.showSede ? `<div class="sede">${escapeHtml(locationLine(eq))}</div>` : '';
  const qr = opts.symbology !== 'barcode' ? `<div class="qr">${await renderQrSvg(eq)}</div>` : '';
  const bar = opts.symbology !== 'qr' ? `<div class="bar">${renderBarcodeSvg(rawCode)}</div>` : '';

  if (opts.symbology === 'barcode') {
    return `<div class="lbl lbl-bar">${name}${bar}${codeDiv(m.w - m.pad * 2)}${sede}</div>`;
  }
  if (opts.symbology === 'both') {
    return `<div class="lbl lbl-both"><div class="row">${qr}<div class="txt">${codeDiv(textWidth(m.qrSideBoth))}${name}${sede}</div></div>${bar}</div>`;
  }
  return `<div class="lbl lbl-qr"><div class="row">${qr}<div class="txt">${codeDiv(textWidth(m.qrSide))}${name}${sede}</div></div></div>`;
}

function labelCss(preset: LabelSizePreset): string {
  const { w, h, pad, qrSide, qrSideBoth, base } = labelMetrics(preset);
  const page = preset.sheet
    ? `@page { size: A4; margin: 0; }
       .sheet { width: 210mm; height: 297mm; box-sizing: border-box;
         padding: ${preset.sheet.marginTopMm}mm 0 0 ${preset.sheet.marginLeftMm}mm;
         display: grid; grid-template-columns: repeat(${preset.sheet.cols}, ${w}mm);
         grid-auto-rows: ${h}mm; column-gap: ${preset.sheet.gapXMm}mm; row-gap: ${preset.sheet.gapYMm}mm;
         page-break-after: always; }
       .sheet:last-child { page-break-after: auto; }`
    : `@page { size: ${w}mm ${h}mm; margin: 0; }
       .cell { page-break-after: always; }
       .cell:last-child { page-break-after: auto; }`;
  return `
    ${page}
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000;
      font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .cell { width: ${w}mm; height: ${h}mm; overflow: hidden; }
    .lbl { width: 100%; height: 100%; padding: ${pad}mm; display: flex; flex-direction: column; justify-content: center; gap: 0.6mm; }
    .row { display: flex; align-items: center; gap: 1.5mm; min-height: 0; flex: 1; }
    .qr { width: ${qrSide}mm; height: ${qrSide}mm; flex: none; }
    .lbl-both .qr { width: ${qrSideBoth}mm; height: ${qrSideBoth}mm; }
    .qr svg, .bar svg { width: 100%; height: 100%; display: block; }
    .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 0.5mm; }
    .code { font-family: 'Courier New', monospace; font-weight: 700; line-height: 1.1; white-space: nowrap; }
    .name { font-size: ${base}mm; line-height: 1.15; font-weight: 600; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .sede { font-size: ${base * 0.85}mm; line-height: 1.1; color: #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bar { width: 100%; height: ${Math.max(6, h * 0.38)}mm; }
    .lbl-both .bar { height: ${Math.max(5, h * 0.26)}mm; flex: none; }
    .lbl-both .name { -webkit-line-clamp: 1; }
    .lbl-bar { align-items: center; text-align: center; }
    .lbl-bar .name { -webkit-line-clamp: 1; }
  `;
}

export async function buildLabelsHtml(
  equipment: LabelEquipment[],
  opts: LabelPrintOptions
): Promise<string> {
  const preset = LABEL_SIZE_PRESETS.find((p) => p.id === opts.sizeId) ?? LABEL_SIZE_PRESETS[0];
  const copies = Math.min(20, Math.max(1, Math.round(opts.copies || 1)));
  const cells: string[] = [];
  for (const eq of equipment) {
    if (!eq.code.trim()) continue;
    const inner = await labelInnerHtml(eq, opts, preset);
    for (let i = 0; i < copies; i++) cells.push(`<div class="cell">${inner}</div>`);
  }
  let body: string;
  if (preset.sheet) {
    const perSheet = preset.sheet.cols * preset.sheet.rows;
    const sheets: string[] = [];
    for (let i = 0; i < cells.length; i += perSheet) {
      sheets.push(`<div class="sheet">${cells.slice(i, i + perSheet).join('')}</div>`);
    }
    body = sheets.join('');
  } else {
    body = cells.join('');
  }
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Etiquetas inventario</title><style>${labelCss(preset)}</style></head><body>${body}</body></html>`;
}

/** Imprime por iframe oculto (no lo bloquea el navegador como un popup). */
export async function printInventoryLabels(
  equipment: LabelEquipment[],
  opts: LabelPrintOptions
): Promise<number> {
  const printable = equipment.filter((e) => e.code.trim());
  if (printable.length === 0) return 0;
  const html = await buildLabelsHtml(printable, opts);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    throw new Error('No se pudo preparar la impresión.');
  }
  doc.open();
  doc.write(html);
  doc.close();

  await new Promise((r) => setTimeout(r, 150));
  const cleanup = () => setTimeout(() => iframe.remove(), 1000);
  win.addEventListener('afterprint', cleanup, { once: true });
  win.focus();
  win.print();
  setTimeout(() => iframe.isConnected && iframe.remove(), 60_000);
  return printable.length;
}
