import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  Barcode as BarcodeIcon,
  CalendarDays,
  Copyright,
  Download,
  FileSpreadsheet,
  Hash,
  ImageIcon,
  Link2,
  Package,
  Plus,
  Rows3,
  Star,
  Tag,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import type { Product, ProductLotRow, ProductStatus, Provider } from '../../types';
import type { SupplierProductsSettings } from '../../types/supplierProducts';
import { formatCurrencyEs } from '../../utils/numberFormat';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  DEFAULT_WAREHOUSES,
} from './productCatalogConstants';
import type { ProductCatalogSettings } from '../../types';
import { defaultProductCatalog } from '../../utils/productCatalog';
import { round2 } from './productDraftUtils';
import { ProductSupplierOffersPanel } from './ProductSupplierOffersPanel';

const PAGE_SIZE = 10;

type LucideIc = React.ComponentType<{ className?: string }>;

function IconField({ Icon, children }: { Icon: LucideIc; children: React.ReactNode }) {
  return (
    <div className="relative w-full [&_.icon-slot]:absolute [&_.icon-slot]:left-2.5 [&_.icon-slot]:top-2.5 [&_.icon-slot]:z-10 [&_input]:pl-9">
      <Icon className="icon-slot pointer-events-none h-4 w-4 text-slate-500" />
      {children}
    </div>
  );
}

function paginateSlice<T>(arr: T[], page: number) {
  return arr.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
}

function summarizeDiff(prev: Product, next: Product): string {
  const parts: string[] = [];
  const pick = (label: string, a: unknown, b: unknown) => {
    if (a !== b) parts.push(`${label}: ${b ?? '-'}`);
  };
  pick('Nombre', prev.name, next.name);
  pick('Marca', prev.brand ?? '', next.brand ?? '');
  pick('SKU', prev.extended?.sku ?? '', next.extended?.sku ?? '');
  pick('Código barras', prev.barcode ?? '', next.barcode ?? '');
  pick('Precio público', prev.salePrice, next.salePrice);
  pick('Precio compra', prev.costPrice ?? '', next.costPrice ?? '');
  pick('Stock disp.', prev.stockAvailable, next.stockAvailable);
  pick('Línea', prev.line, next.line);
  pick('Categoría', prev.category, next.category);
  if (
    prev.extended?.saleValueNet !== next.extended?.saleValueNet ||
    prev.extended?.purchaseValueNet !== next.extended?.purchaseValueNet
  ) {
    parts.push(
      `Precios neto venta/neto compra: ${next.extended?.saleValueNet ?? 0} / ${next.extended?.purchaseValueNet ?? 0}`,
    );
  }
  return parts.slice(0, 16).join('\n');
}

function formatCreationSummary(p: Product): string {
  const ex = p.extended!;
  return [
    `Nombre: ${p.name}`,
    `Marca: ${p.brand || '-'}`,
    `Proveedor: ${p.providerName || '-'}`,
    `Línea: ${p.line}`,
    `Categoría: ${p.category}`,
    `Subcategoría: ${p.subcategory || '—'}`,
    `UM: ${p.unit}`,
    `Stock mín / máx: ${p.minStock} / ${p.maxStock ?? '—'}`,
    `Disponible ventas: ${ex.salesAvailable ? 'SI' : 'NO'}`,
    `Estado: ${statusLabel(p.status)}`,
    `Valor venta neto: ${formatCurrencyEs(ex.saleValueNet ?? 0)}`,
    `Precio compra total: ${formatCurrencyEs(p.costPrice ?? 0)}`,
  ].join('\n');
}

function statusLabel(s: ProductStatus): string {
  if (s === 'active') return 'ACTIVO';
  if (s === 'inactive') return 'INACTIVO';
  return 'DESCONTINUADO';
}

function statusFromLabel(label: string): ProductStatus {
  if (label === 'INACTIVO') return 'inactive';
  if (label === 'DESCONTINUADO') return 'discontinued';
  return 'active';
}

export interface ProductWorkspaceProps {
  open: boolean;
  draft: Product;
  patchDraft: (fn: (p: Product) => Product) => void;
  baseline: Product;
  providers: Provider[];
  visibleSedes?: string[];
  currentUserName: string;
  isNew: boolean;
  onClose: () => void;
  onSave: (product: Product) => void;
  supplierProductsSettings?: SupplierProductsSettings;
  onUpdateSupplierProducts?: (
    updater: (prev: SupplierProductsSettings) => SupplierProductsSettings,
    message?: string
  ) => void;
  canEditSupplierOffers?: boolean;
  catalog?: ProductCatalogSettings;
}

export function ProductWorkspace(props: ProductWorkspaceProps) {
  const {
    open,
    draft,
    patchDraft,
    baseline,
    providers,
    visibleSedes,
    currentUserName,
    isNew,
    onClose,
    onSave,
    supplierProductsSettings,
    onUpdateSupplierProducts,
    canEditSupplierOffers = true,
    catalog: catalogProp,
  } = props;
  const catalog = catalogProp ?? defaultProductCatalog();

  const ex = draft.extended!;
  const barCanvasRef = useRef<HTMLCanvasElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [barcodeBump, setBarcodeBump] = useState(0);
  const [kPage, setKPage] = useState(1);
  const [aPage, setAPage] = useState(1);
  const [lPage, setLPage] = useState(1);
  const [lotOpen, setLotOpen] = useState(false);
  const [lotForm, setLotForm] = useState<ProductLotRow>({
    id: '',
    registeredAt: new Date().toISOString(),
    lotNumber: '',
    warehouse: 'Principal',
    expiresAt: '',
    qtyIn: 0,
    balance: 0,
  });

  const [calcCostNet, setCalcCostNet] = useState('0');
  const [calcTaxVenta, setCalcTaxVenta] = useState('18');
  const [calcMargenPct, setCalcMargenPct] = useState('60');

  const warehouses = useMemo(
    () => (visibleSedes && visibleSedes.length > 0 ? [...visibleSedes] : [...DEFAULT_WAREHOUSES]),
    [visibleSedes],
  );
  const providerOptions = useMemo(
    () => providers.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [providers],
  );

  useEffect(() => {
    setKPage(1);
    setAPage(1);
    setLPage(1);
  }, [draft.id]);

  useEffect(() => {
    const code = String(draft.barcode ?? '').trim();
    const barEl = barCanvasRef.current;
    const qrEl = qrCanvasRef.current;
    if (!barEl || !qrEl || !open) return;
    if (!code) {
      barEl.getContext('2d')?.clearRect(0, 0, barEl.width, barEl.height);
      qrEl.getContext('2d')?.clearRect(0, 0, qrEl.width, qrEl.height);
      return;
    }
    try {
      JsBarcode(barEl, code, {
        format: 'CODE128',
        width: 2,
        height: 64,
        displayValue: true,
        margin: 8,
        background: '#ffffff',
        lineColor: '#0f172a',
        fontSize: 13,
      });
    } catch {
      barEl.getContext('2d')?.clearRect(0, 0, barEl.width, barEl.height);
    }
    void QRCode.toCanvas(qrEl, code, { width: 168, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } }).catch(() => {});
  }, [draft.barcode, barcodeBump, open]);

  useEffect(() => {
    setCalcCostNet(String(ex.purchaseValueNet ?? 0));
    setCalcTaxVenta(String(ex.saleTaxPercent ?? 18));
  }, [draft.id]);

  const saleTaxAmt = useMemo(() => {
    if (ex.saleTaxExempt) return 0;
    return round2(Number(ex.saleValueNet ?? 0) * ((Number(ex.saleTaxPercent ?? 0)) / 100));
  }, [ex.saleTaxExempt, ex.saleValueNet, ex.saleTaxPercent]);

  const publicSale = useMemo(() => round2(Number(ex.saleValueNet ?? 0) + saleTaxAmt), [ex.saleValueNet, saleTaxAmt]);

  const purchaseTaxAmt = useMemo(() => {
    if (ex.purchaseTaxExempt) return 0;
    return round2(Number(ex.purchaseValueNet ?? 0) * ((Number(ex.purchaseTaxPercent ?? 0)) / 100));
  }, [ex.purchaseTaxExempt, ex.purchaseValueNet, ex.purchaseTaxPercent]);

  const purchaseTotal = useMemo(
    () => round2(Number(ex.purchaseValueNet ?? 0) + purchaseTaxAmt),
    [ex.purchaseValueNet, purchaseTaxAmt],
  );

  const grossMargin = useMemo(
    () => round2(Number(ex.saleValueNet ?? 0) - Number(ex.purchaseValueNet ?? 0)),
    [ex.saleValueNet, ex.purchaseValueNet],
  );

  const utilityPct = useMemo(() => {
    const pNet = Number(ex.purchaseValueNet ?? 0);
    return pNet > 0 ? round2((grossMargin / pNet) * 100) : 0;
  }, [grossMargin, ex.purchaseValueNet]);

  const calcSuggested = useMemo(() => {
    const cNet = Number(String(calcCostNet).replace(',', '.')) || 0;
    const mp = Number(String(calcMargenPct).replace(',', '.')) || 0;
    const tax = Number(String(calcTaxVenta).replace(',', '.')) || 0;
    const saleNet = round2(cNet * (1 + mp / 100));
    const taxAmt = round2(saleNet * (tax / 100));
    const publicP = round2(saleNet + taxAmt);
    return { saleNet, taxAmt, publicP };
  }, [calcCostNet, calcMargenPct, calcTaxVenta]);

  const applyCalculatorToPrices = useCallback(() => {
    patchDraft((p) => ({
      ...p,
      extended: {
        ...p.extended!,
        saleValueNet: calcSuggested.saleNet,
        saleTaxPercent: Number(String(calcTaxVenta).replace(',', '.')) || 18,
      },
      salePrice: calcSuggested.publicP,
    }));
    toast.success('Valores aplicados a la pestaña Precios');
  }, [calcSuggested, calcTaxVenta, patchDraft]);

  const exportKardexCsv = useCallback(() => {
    const rows = ex.kardex ?? [];
    const header = ['Fecha', 'Documento', 'Tipo', 'Almacén', 'Stock ini', 'Entrada', 'Salida', 'Stock fin', 'Lote'];
    const body = rows.map((r) => [
      r.date, r.referenceDoc, r.operationType, r.warehouse, r.stockInitial, r.qtyIn, r.qtyOut, r.stockFinal, r.batchNo ?? '',
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...body]), 'Kardex');
    XLSX.writeFile(wb, `kardex-${draft.systemCode}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Kardex exportado');
  }, [draft.systemCode, ex.kardex]);

  const downloadCanvas = (canvas: HTMLCanvasElement | null, filename: string) => {
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = filename;
    a.click();
  };

  const handleSave = () => {
    const name = draft.name.trim();
    if (!name) {
      toast.error('Completa el nombre del producto');
      return;
    }
    if (!draft.line?.trim() || !draft.category?.trim()) {
      toast.error('Línea y categoría son obligatorias');
      return;
    }
    const nextEx = { ...draft.extended! };
    const net = Number(nextEx.saleValueNet ?? 0);
    const sTax = nextEx.saleTaxExempt ? 0 : round2(net * (Number(nextEx.saleTaxPercent ?? 0) / 100));
    const publicP = round2(net + sTax);
    const pNet = Number(nextEx.purchaseValueNet ?? 0);
    const pTax = nextEx.purchaseTaxExempt ? 0 : round2(pNet * (Number(nextEx.purchaseTaxPercent ?? 0) / 100));
    const costTot = round2(pNet + pTax);
    nextEx.saleValueNet = round2(net);
    nextEx.purchaseValueNet = round2(pNet);

    let next: Product = {
      ...draft,
      salePrice: publicP,
      costPrice: costTot,
      extended: { ...nextEx, commissionType: nextEx.commissionType ?? 'fixed', maxDiscountPercent: nextEx.maxDiscountPercent ?? 0 },
      updatedAt: new Date(),
    };

    const audit = [...(next.extended?.audit ?? [])];
    const stamp = new Date().toISOString();
    if (isNew) {
      audit.unshift({
        id: `aud-${Date.now()}`,
        at: stamp,
        action: 'Creación',
        module: 'Productos',
        newValue: formatCreationSummary(next),
        responsible: currentUserName,
      });
    } else {
      const diffLine = summarizeDiff(baseline, next);
      if (diffLine) {
        audit.unshift({
          id: `aud-${Date.now()}`,
          at: stamp,
          action: 'Edición',
          module: 'Productos',
          previousValue: '',
          newValue: diffLine,
          responsible: currentUserName,
        });
      }
    }
    next = { ...next, extended: { ...next.extended!, audit: audit.slice(0, 300) } };
    onSave(next);
    toast.success(isNew ? 'Producto creado' : 'Cambios guardados');
  };

  const kardexRows = ex.kardex ?? [];
  const auditRows = ex.audit ?? [];
  const lotRows = ex.lots ?? [];
  const kTotal = Math.max(1, Math.ceil(kardexRows.length / PAGE_SIZE));
  const aTotal = Math.max(1, Math.ceil(auditRows.length / PAGE_SIZE));
  const lTotal = Math.max(1, Math.ceil(lotRows.length / PAGE_SIZE));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" data-testid="product-workspace">
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button type="button" variant="outline" size="sm" className="border-white/15" onClick={onClose}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Regresar al listado
          </Button>
          <div className="min-w-0">
            <div className="truncate text-xs uppercase tracking-wider text-slate-500">Producto</div>
            <div className="truncate text-lg font-semibold text-foreground">{draft.name.trim() || 'Nuevo producto'}</div>
          </div>
        </div>
        <Button type="button" className="bg-emerald-600 hover:bg-emerald-500" onClick={handleSave} data-testid="product-save">
          <Plus className="mr-2 h-4 w-4" />
          Guardar cambios
        </Button>
      </header>

      <Tabs defaultValue="editar" className="flex min-h-0 flex-1 flex-col px-4 py-3">
        <TabsList className="mb-3 h-auto w-full flex-wrap justify-start gap-1 overflow-x-auto border border-border bg-muted p-2">
          {[
            ['editar', 'Editar'],
            ['precios', 'Precios'],
            ['proveedores', 'Proveedores'],
            ['barcode', 'Código de barras'],
            ['factor', 'Factor de compra'],
            ['kardex', 'Kardex'],
            ['calc', 'Calculadora de precio'],
            ['audit', 'Auditoría'],
            ['gallery', 'Galería'],
            ['lotes', 'Lotes'],
          ].map(([v, label]) => (
            <TabsTrigger key={v} value={v} className="shrink-0 text-[11px] sm:text-xs">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="min-h-0 flex-1 overflow-y-auto pb-28">
          {/* Editar */}
          <TabsContent value="editar" className="mt-0 space-y-4">
            <Card className="border-border bg-card">
              <CardContent className="space-y-4 p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Nombre del producto <span className="text-red-400">*</span></Label>
                    <IconField Icon={Package}>
                      <Input className="border-border bg-background" data-testid="product-name-input" value={draft.name} onChange={(e) => patchDraft((p) => ({ ...p, name: e.target.value }))} />
                    </IconField>
                  </div>
                  <div className="space-y-2">
                    <Label>Marca</Label>
                    <IconField Icon={Copyright}>
                      <Input className="border-border bg-background" value={draft.brand ?? ''} onChange={(e) => patchDraft((p) => ({ ...p, brand: e.target.value }))} />
                    </IconField>
                  </div>
                  <div className="space-y-2">
                    <Label>Código de sistema</Label>
                    <IconField Icon={Rows3}>
                      <Input readOnly disabled className="bg-white/5 opacity-70" value={String(draft.systemCode)} />
                    </IconField>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Código personalizado</Label>
                    <IconField Icon={Hash}>
                      <Input className="border-border bg-background" value={ex.customCode ?? ''} onChange={(e) => patchDraft((p) => ({ ...p, extended: { ...p.extended!, customCode: e.target.value } }))} />
                    </IconField>
                  </div>
                  <div className="space-y-2">
                    <Label>SKU</Label>
                    <IconField Icon={Tag}>
                      <Input className="border-border bg-background" value={ex.sku ?? ''} onChange={(e) => patchDraft((p) => ({ ...p, extended: { ...p.extended!, sku: e.target.value } }))} />
                    </IconField>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Presentación</Label>
                    <Select value={ex.presentation ?? 'Botella'} onValueChange={(v) => patchDraft((p) => ({ ...p, extended: { ...p.extended!, presentation: v } }))}>
                      <SelectTrigger className="border-border bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>{catalog.presentations.map((pr) => (<SelectItem key={pr} value={pr}>{pr}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Contenido</Label>
                    <Input className="border-border bg-background" value={ex.content ?? ''} onChange={(e) => patchDraft((p) => ({ ...p, extended: { ...p.extended!, content: e.target.value } }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Unidad de medida</Label>
                    <Select value={draft.unit} onValueChange={(v) => patchDraft((p) => ({ ...p, unit: v }))}>
                      <SelectTrigger className="border-border bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>{catalog.units.map((u) => (<SelectItem key={u} value={u}>{u}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Proveedor</Label>
                    <Select
                      value={draft.providerId ?? 'none'}
                      onValueChange={(value) => {
                        const pr = providerOptions.find((x) => x.id === value);
                        patchDraft((p) => ({
                          ...p,
                          providerId: value === 'none' ? undefined : value,

                          providerName: value === 'none' ? undefined : pr?.name ?? p.providerName,
                        }));
                      }}
                    >
                      <SelectTrigger className="border-border bg-background"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Seleccione</SelectItem>
                        {providerOptions.map((pr) => (<SelectItem key={pr.id} value={pr.id}>{pr.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Línea <span className="text-red-400">*</span></Label>
                    <Select value={draft.line} onValueChange={(v) => patchDraft((p) => ({ ...p, line: v }))}>
                      <SelectTrigger className="border-border bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>{catalog.lines.map((l) => (<SelectItem key={l} value={l}>{l}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Categoría <span className="text-red-400">*</span></Label>
                    <Select value={draft.category} onValueChange={(v) => patchDraft((p) => ({ ...p, category: v }))}>
                      <SelectTrigger className="border-border bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>{catalog.categories.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Subcategoría</Label>
                    <Select value={draft.subcategory?.trim() ? draft.subcategory! : 'none'} onValueChange={(v) => patchDraft((p) => ({ ...p, subcategory: v === 'none' ? undefined : v }))}>
                      <SelectTrigger className="border-border bg-background"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Seleccione</SelectItem>
                        {catalog.subcategories.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator className="bg-white/10" />
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Stock actual</Label>
                    <IconField Icon={Rows3}><Input readOnly disabled className="opacity-70" value={String(draft.stockAvailable)} /></IconField>
                  </div>
                  <div className="space-y-2">
                    <Label>Stock mínimo <span className="text-red-400">*</span></Label>
                    <Input type="number" min={0} className="border-border bg-background" value={draft.minStock} onChange={(e) => patchDraft((p) => ({ ...p, minStock: Math.max(0, Number(e.target.value) || 0) }))} />
                    <p className="text-[11px] text-slate-500">Cantidad mínima para no quedarse sin stock.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Stock máximo <span className="text-red-400">*</span></Label>
                    <Input type="number" min={0} className="border-border bg-background" value={draft.maxStock ?? ''} onChange={(e) => patchDraft((p) => ({ ...p, maxStock: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0) }))} />
                    <p className="text-[11px] text-slate-500">Máximo para evitar sobrestock.</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Disponible ventas <span className="text-red-400">*</span></Label>
                    <Select value={(ex.salesAvailable ?? true) ? 'yes' : 'no'} onValueChange={(v) => patchDraft((p) => ({ ...p, extended: { ...p.extended!, salesAvailable: v === 'yes' } }))}>
                      <SelectTrigger className="border-border bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="yes">SI</SelectItem><SelectItem value="no">NO</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Frecuencia (días)</Label>
                    <IconField Icon={CalendarDays}>
                      <Input className="border-border bg-background" value={ex.applicationFrequencyDays ?? ''} onChange={(e) => patchDraft((p) => ({ ...p, extended: { ...p.extended!, applicationFrequencyDays: e.target.value } }))} />
                    </IconField>
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select value={statusLabel(draft.status)} onValueChange={(v) => patchDraft((p) => ({ ...p, status: statusFromLabel(v) }))}>
                      <SelectTrigger className="border-border bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVO">ACTIVO</SelectItem>
                        <SelectItem value="INACTIVO">INACTIVO</SelectItem>
                        <SelectItem value="DESCONTINUADO">DESCONTINUADO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>ICBPER</Label>
                    <Select value={ex.icbperGravado ? 'yes' : 'no'} onValueChange={(v) => patchDraft((p) => ({ ...p, extended: { ...p.extended!, icbperGravado: v === 'yes' } }))}>
                      <SelectTrigger className="border-border bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="yes">SI</SelectItem><SelectItem value="no">NO</SelectItem></SelectContent>
                    </Select>
                    <p className="text-[11px] text-slate-500">Grava bolsas plásticas y similares.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Puntos <span className="text-red-400">*</span></Label>
                  <IconField Icon={Star}>
                    <Input type="number" min={0} className="border-border bg-background" value={ex.loyaltyPoints ?? 0} onChange={(e) => patchDraft((p) => ({ ...p, extended: { ...p.extended!, loyaltyPoints: Math.max(0, Number(e.target.value) || 0) } }))} />
                  </IconField>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="precios" className="mt-0 space-y-4">
            <Card className="border-border bg-card">
              <CardContent className="space-y-4 p-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-foreground">Ventas</div>
                    <Label>Valor venta (sin impuestos)</Label>
                    <Input
                      className="border-border bg-background pl-6"
                      value={String(ex.saleValueNet ?? 0)}
                      onChange={(e) => patchDraft((p) => ({ ...p, extended: { ...p.extended!, saleValueNet: Number(e.target.value.replace(',', '.')) || 0 } }))}
                    />
                    <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
                      <div className="space-y-2">
                        <Label>IGV ventas (%)</Label>
                        <Input
                          className="border-border bg-background"
                          value={String(ex.saleTaxPercent ?? 18)}
                          onChange={(e) =>
                            patchDraft((p) => ({ ...p, extended: { ...p.extended!, saleTaxPercent: Number(e.target.value.replace(',', '.')) || 0 } }))
                          }
                        />
                      </div>
                      <label className="flex items-center gap-2 text-xs text-slate-300">
                        <Checkbox
                          checked={!!ex.saleTaxExempt}
                          onCheckedChange={(c) => patchDraft((p) => ({ ...p, extended: { ...p.extended!, saleTaxExempt: c === true } }))}
                        />
                        ¿Exonerado?
                      </label>
                    </div>
                    <Label>Impuesto ventas (monto)</Label>
                    <Input readOnly disabled value={String(saleTaxAmt)} className="opacity-70" />
                    <Label>Precio público (incl. imp.)</Label>
                    <Input readOnly disabled value={String(publicSale)} className="border-cyan-500/30 opacity-90" />
                  </div>
                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-foreground">Compra</div>
                    <Label>Valor compra (sin impuestos)</Label>
                    <Input
                      className="border-border bg-background pl-6"
                      value={String(ex.purchaseValueNet ?? 0)}
                      onChange={(e) =>
                        patchDraft((p) => ({ ...p, extended: { ...p.extended!, purchaseValueNet: Number(e.target.value.replace(',', '.')) || 0 } }))
                      }
                    />
                    <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
                      <div className="space-y-2">
                        <Label>IGV compra (%)</Label>
                        <Input
                          className="border-border bg-background"
                          value={String(ex.purchaseTaxPercent ?? 18)}
                          onChange={(e) =>
                            patchDraft((p) => ({ ...p, extended: { ...p.extended!, purchaseTaxPercent: Number(e.target.value.replace(',', '.')) || 0 } }))
                          }
                        />
                      </div>
                      <label className="flex items-center gap-2 text-xs text-slate-300">
                        <Checkbox checked={!!ex.purchaseTaxExempt} onCheckedChange={(c) => patchDraft((p) => ({ ...p, extended: { ...p.extended!, purchaseTaxExempt: c === true } }))} />
                        ¿Exonerado?
                      </label>
                    </div>
                    <Label>Monto impuesto compra</Label>
                    <Input readOnly disabled className="opacity-70" value={String(purchaseTaxAmt)} />
                    <Label>Precio compra total</Label>
                    <Input readOnly disabled className="opacity-70" value={String(purchaseTotal)} />
                  </div>
                </div>
                <Separator className="bg-white/10" />
                <div className="space-y-2">
                  <Label>Descuento máximo (%)</Label>
                  <Input
                    className="max-w-xs border-border bg-background"
                    value={String(ex.maxDiscountPercent ?? 0)}
                    onChange={(e) =>
                      patchDraft((p) => ({ ...p, extended: { ...p.extended!, maxDiscountPercent: Number(e.target.value.replace(',', '.')) || 0 } }))
                    }
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Margen bruto</Label>
                    <Input readOnly disabled value={formatCurrencyEs(grossMargin)} className="opacity-70" />
                    <p className="mt-1 text-[11px] text-slate-500">Valor venta neto − valor compra neto.</p>
                  </div>
                  <div>
                    <Label>Utilidad % (s/costo)</Label>
                    <Input readOnly disabled className="opacity-70" value={String(utilityPct)} />
                  </div>
                </div>
                <Separator className="bg-white/10" />
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <div className="lg:col-span-2">
                    <Label>Comisión vendedor</Label>
                    <Select
                      value={ex.commissionType === 'percent' ? 'percent' : 'fixed'}
                      onValueChange={(v) => patchDraft((p) => ({ ...p, extended: { ...p.extended!, commissionType: v === 'percent' ? 'percent' : 'fixed' } }))}
                    >
                      <SelectTrigger className="border-border bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Monto fijo</SelectItem>
                        <SelectItem value="percent">Porcentaje</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="lg:col-span-2">
                    <Label>Aplicar % sobre</Label>
                    <Select value={ex.commissionApplyOn ?? 'valor_venta'} onValueChange={(v) => patchDraft((p) => ({ ...p, extended: { ...p.extended!, commissionApplyOn: v } }))}>
                      <SelectTrigger className="border-border bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="valor_venta">Valor venta</SelectItem>
                        <SelectItem value="subtotal">Subtotal sin IGV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Comisión ($)</Label>
                    <Input
                      className="border-border bg-background"
                      value={String(ex.commissionAmount ?? 0)}
                      onChange={(e) =>
                        patchDraft((p) => ({ ...p, extended: { ...p.extended!, commissionAmount: Number(e.target.value.replace(',', '.')) || 0 } }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Comisión (%)</Label>
                    <Input
                      className="border-border bg-background"
                      value={String(ex.commissionPercent ?? 0)}
                      onChange={(e) =>
                        patchDraft((p) => ({ ...p, extended: { ...p.extended!, commissionPercent: Number(e.target.value.replace(',', '.')) || 0 } }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-between gap-3">
              <Button type="button" variant="outline" className="border-white/15" onClick={onClose}>Cancelar</Button>
              <Button type="button" className="bg-emerald-600" onClick={handleSave}><Plus className="mr-2 h-4 w-4" />Guardar cambios</Button>
            </div>
          </TabsContent>

          <TabsContent value="proveedores" className="mt-0 space-y-4">
            {isNew ? (
              <Card className="border-dashed border-border">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Guarda el producto primero para vincular proveedores y precios de compra.
                </CardContent>
              </Card>
            ) : supplierProductsSettings && onUpdateSupplierProducts ? (
              <ProductSupplierOffersPanel
                productId={draft.id}
                productName={draft.name}
                providers={providers}
                settings={supplierProductsSettings}
                canEdit={canEditSupplierOffers}
                currentUserName={currentUserName}
                preferredProviderId={draft.providerId}
                onUpdateSettings={onUpdateSupplierProducts}
                onPreferredProviderChange={(providerId, providerName) => {
                  patchDraft((p) => ({ ...p, providerId, providerName }));
                }}
              />
            ) : (
              <Card className="border-border">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No se pudo cargar el catálogo de ofertas proveedor–producto.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="barcode" className="mt-0 space-y-4">
            <Card className="border-border bg-card">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[200px] flex-1 space-y-2">
                    <Label>Código de barras</Label>
                    <IconField Icon={BarcodeIcon}>
                      <Input className="border-border bg-background" value={draft.barcode ?? ''} onChange={(e) => patchDraft((p) => ({ ...p, barcode: e.target.value }))} />
                    </IconField>
                  </div>
                  <Button type="button" variant="outline" title="Renderizar previews" className="border-white/15" onClick={() => setBarcodeBump((n) => n + 1)}>
                    <ImageIcon className="mr-2 h-4 w-4" />Generar imágenes
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-white p-4 text-center text-slate-800">
                    <div className="mb-2 flex items-center justify-center gap-2 text-sm font-medium">
                      Código de barras
                      <button type="button" className="text-cyan-600" onClick={() => downloadCanvas(barCanvasRef.current, `bar-${draft.barcode ?? 'cod'}.png`)} aria-label="Descargar">
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                    <canvas ref={barCanvasRef} width={320} height={120} className="mx-auto max-w-full bg-white" />
                    <div className="mt-2 text-xs text-slate-600">{draft.name || 'Producto'}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white p-4 text-center text-slate-800">
                    <div className="mb-2 flex items-center justify-center gap-2 text-sm font-medium">
                      Código QR
                      <button type="button" className="text-cyan-600" onClick={() => downloadCanvas(qrCanvasRef.current, `qr-${draft.barcode ?? 'cod'}.png`)} aria-label="Descargar">
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                    <canvas ref={qrCanvasRef} width={180} height={180} className="mx-auto bg-white" />
                    <div className="mt-2 font-mono text-xs">{draft.barcode}</div>
                  </div>
                </div>
                <div className="rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                  Si cambiaste el código, vuelve a generar las imágenes antes de etiquetar.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="factor" className="mt-0 space-y-4">
            <Card className="border-border bg-card">
              <CardContent className="space-y-4 p-4">
                <div className="rounded-lg border border-sky-500/35 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
                  Para compras en formato distinto al de venta (ej. caja → unidades).
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={!!ex.usePurchaseConversion} onCheckedChange={(c) => patchDraft((p) => ({ ...p, extended: { ...p.extended!, usePurchaseConversion: c === true } }))} />
                  Usar factor de conversión para este producto.
                </label>
                <div className="grid gap-3 md:max-w-lg">
                  <div className="space-y-2">
                    <Label>Nombre en compra</Label>
                    <IconField Icon={Link2}>
                      <Input disabled={!ex.usePurchaseConversion} className="border-border bg-background" value={ex.purchaseConversionLabel ?? ''} onChange={(e) => patchDraft((p) => ({ ...p, extended: { ...p.extended!, purchaseConversionLabel: e.target.value } }))} />
                    </IconField>
                  </div>
                  <div className="space-y-2">
                    <Label>Factor de compra</Label>
                    <Input disabled={!ex.usePurchaseConversion} type="number" className="border-border bg-background" value={ex.purchaseConversionFactor ?? ''} onChange={(e) => patchDraft((p) => ({ ...p, extended: { ...p.extended!, purchaseConversionFactor: e.target.value === '' ? undefined : Number(e.target.value) } }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Precio compra ref.</Label>
                    <Input
                      disabled={!ex.usePurchaseConversion}
                      type="number"
                      className="border-border bg-background"
                      value={String(ex.purchaseConversionUnitPurchasePrice ?? 0)}
                      onChange={(e) =>
                        patchDraft((p) => ({
                          ...p,
                          extended: { ...p.extended!, purchaseConversionUnitPurchasePrice: Number(e.target.value.replace(',', '.')) || 0 },
                        }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-between">
              <Button type="button" variant="outline" className="border-white/15" onClick={onClose}>Cancelar</Button>
              <Button type="button" className="bg-emerald-600" onClick={handleSave}><Plus className="mr-2 h-4 w-4" />Guardar cambios</Button>
            </div>
          </TabsContent>

          <TabsContent value="kardex" className="mt-0 space-y-4">
            <Card className="border border-dashed border-border bg-muted/50">
              <CardContent className="grid gap-2 p-4 text-xs md:grid-cols-3">
                {[
                  ['Disponible (general)', draft.stockAvailable],
                  ['Reservado', 0],
                  ['Contable', draft.stockAccounting],
                  ['Disponible (principal)', draft.stockAvailable],
                  ['Reservado (principal)', 0],
                  ['Contable (principal)', draft.stockAccounting],
                ].map(([lbl, num]) => (
                  <div key={String(lbl)} className="flex justify-between gap-2">
                    <span className="text-slate-400">{lbl}</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5">{num}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="border-white/15" onClick={exportKardexCsv} aria-label="Exportar"><FileSpreadsheet className="h-4 w-4" /></Button>
                </div>
                <div className="overflow-x-auto rounded-lg border border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.04] text-slate-400">
                      <tr>
                        <th className="p-2">Fecha</th><th className="p-2">Documento</th><th className="p-2">Tipo</th><th className="p-2">Almacén</th>
                        <th className="p-2 text-right">Ini</th><th className="p-2 text-right">Ent.</th><th className="p-2 text-right">Sal.</th><th className="p-2 text-right">Fin</th><th className="p-2">Lote</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginateSlice(kardexRows, kPage).length === 0 ? (
                        <tr><td colSpan={9} className="p-8 text-center text-slate-500">Sin movimientos.</td></tr>
                      ) : (
                        paginateSlice(kardexRows, kPage).map((row) => (
                          <tr key={row.id} className="border-t border-white/5">
                            <td className="p-2 text-slate-300">{(() => { try { return format(parseISO(row.date), 'dd-MM-yyyy HH:mm', { locale: es }); } catch { return row.date; } })()}</td>
                            <td className="p-2">{row.referenceDoc}</td><td className="p-2">{row.operationType}</td><td className="p-2">{row.warehouse}</td>
                            <td className="p-2 text-right">{row.stockInitial}</td><td className="p-2 text-right">{row.qtyIn}</td><td className="p-2 text-right">{row.qtyOut}</td><td className="p-2 text-right font-medium">{row.stockFinal}</td>
                            <td className="p-2 text-slate-500">{row.batchNo ?? '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>Pág. {kPage}/{kTotal} · Total {kardexRows.length}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={kPage <= 1} onClick={() => setKPage(1)}>Primera</Button>
                    <Button size="sm" variant="outline" disabled={kPage <= 1} onClick={() => setKPage((x) => Math.max(1, x - 1))}>Anterior</Button>
                    <Button size="sm" variant="outline" disabled={kPage >= kTotal} onClick={() => setKPage((x) => Math.min(kTotal, x + 1))}>Siguiente</Button>
                    <Button size="sm" variant="outline" disabled={kPage >= kTotal} onClick={() => setKPage(kTotal)}>Última</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calc" className="mt-0 space-y-4">
            <Card className="border-border bg-card">
              <CardContent className="space-y-4 p-4">
                <p className="text-sm text-slate-400">Calcula valor neto + IGV desde costo neto y utilidad % sobre costo.</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div><Label>Costo neto</Label><Input className="border-border bg-background" value={calcCostNet} onChange={(e) => setCalcCostNet(e.target.value)} /></div>
                  <div><Label>IGV venta %</Label><Input className="border-border bg-background" value={calcTaxVenta} onChange={(e) => setCalcTaxVenta(e.target.value)} /></div>
                  <div><Label>Utilidad % s/costo</Label><Input className="border-border bg-background" value={calcMargenPct} onChange={(e) => setCalcMargenPct(e.target.value)} /></div>
                </div>
                <div className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4 md:grid-cols-3">
                  <div><div className="text-xs text-slate-500">Venta neto</div><div className="text-lg font-semibold text-emerald-300">{formatCurrencyEs(calcSuggested.saleNet)}</div></div>
                  <div><div className="text-xs text-slate-500">IGV</div><div className="text-lg font-semibold text-cyan-200">{formatCurrencyEs(calcSuggested.taxAmt)}</div></div>
                  <div><div className="text-xs text-slate-500">Público</div><div className="text-lg font-semibold text-foreground">{formatCurrencyEs(calcSuggested.publicP)}</div></div>
                </div>
                <Button type="button" className="bg-emerald-600" onClick={applyCalculatorToPrices}>Aplicar a Precios</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-0 space-y-4">
            <Card className="border-border bg-card">
              <CardContent className="space-y-3 p-4">
                <div className="overflow-x-auto rounded-lg border border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.04] text-slate-400">
                      <tr>
                        <th className="p-2">Fecha</th><th className="p-2">Acción</th><th className="p-2">Módulo</th>
                        <th className="p-2 max-w-[180px]">Anterior</th><th className="p-2 min-w-[240px]">Posterior</th><th className="p-2">Resp.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginateSlice(auditRows, aPage).length === 0 ? (
                        <tr><td colSpan={6} className="p-8 text-center text-slate-500">Sin auditoría.</td></tr>
                      ) : (
                        paginateSlice(auditRows, aPage).map((row) => (
                          <tr key={row.id} className="border-t border-white/5 align-top">
                            <td className="p-2">{(() => { try { return format(parseISO(row.at), 'dd-MM-yyyy HH:mm', { locale: es }); } catch { return row.at; } })()}</td>
                            <td className="p-2">{row.action}</td><td className="p-2 text-slate-500">{row.module}</td>
                            <td className="whitespace-pre-wrap p-2 text-slate-500">{row.previousValue ?? '—'}</td>
                            <td className="whitespace-pre-wrap p-2 text-foreground">{row.newValue ?? '—'}</td>
                            <td className="p-2">{row.responsible}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>Pág. {aPage}/{aTotal} · Total {auditRows.length}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={aPage <= 1} onClick={() => setAPage(1)}>Primera</Button>
                    <Button size="sm" variant="outline" disabled={aPage <= 1} onClick={() => setAPage((x) => Math.max(1, x - 1))}>Anterior</Button>
                    <Button size="sm" variant="outline" disabled={aPage >= aTotal} onClick={() => setAPage((x) => Math.min(aTotal, x + 1))}>Siguiente</Button>
                    <Button size="sm" variant="outline" disabled={aPage >= aTotal} onClick={() => setAPage(aTotal)}>Última</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gallery" className="mt-0 space-y-4">
            <Card className="border-border bg-card">
              <CardContent className="space-y-4 p-4">
                <Label>Galería</Label>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  className="cursor-pointer border-border bg-background"
                  onChange={(event) => {
                    const fs = event.target.files;
                    if (!fs?.length) return;
                    const urls = [...(ex.galleryDataUrls ?? [])];
                    const jobs: Promise<void>[] = [];
                    const cap = Math.max(0, 15 - urls.length);
                    for (let i = 0; i < fs.length && i < cap; i++) {
                      const file = fs[i];
                      jobs.push(
                        new Promise<void>((resolve, reject) => {
                          const rd = new FileReader();
                          rd.onload = () => {
                            if (typeof rd.result === 'string') urls.push(rd.result);
                            resolve();
                          };
                          rd.onerror = () => reject(rd.error);
                          rd.readAsDataURL(file);
                        }),
                      );
                    }
                    void Promise.all(jobs).then(() => patchDraft((p) => ({ ...p, extended: { ...p.extended!, galleryDataUrls: urls } })));
                  }}
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  {(ex.galleryDataUrls ?? []).map((src, idx) => (
                    <div key={`g-${idx}`} className="group relative rounded-lg border border-white/10">
                      <img src={src} alt="" className="h-40 w-full rounded bg-black/30 object-cover" />
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() =>
                          patchDraft((p) => {
                            const g = [...(p.extended!.galleryDataUrls ?? [])];
                            g.splice(idx, 1);
                            return { ...p, extended: { ...p.extended!, galleryDataUrls: g } };
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lotes" className="mt-0 space-y-4">
            <Card className="border border-dashed border-border bg-muted/50">
              <CardContent className="grid gap-2 p-4 text-sm md:grid-cols-2">
                <div className="flex justify-between gap-4"><span className="text-slate-400">Disp. general</span><span className="rounded-full bg-white/10 px-2">{draft.stockAvailable}</span></div>
                <div className="flex justify-between gap-4"><span className="text-slate-400">Contable</span><span className="rounded-full bg-white/10 px-2">{draft.stockAccounting}</span></div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="space-y-3 p-4">
                <Button
                  type="button"
                  className="bg-emerald-600"
                  onClick={() => {
                    setLotForm({
                      id: '',
                      registeredAt: new Date().toISOString(),
                      lotNumber: '',
                      warehouse: warehouses[0] ?? 'Principal',
                      expiresAt: '',
                      qtyIn: 0,
                      balance: 0,
                    });
                    setLotOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />Registrar lote
                </Button>
                <div className="overflow-x-auto rounded-lg border border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.04] text-slate-400">
                      <tr>
                        <th className="p-2">ID</th><th className="p-2">Fecha</th><th className="p-2">Producto</th><th className="p-2"># Lote</th>
                        <th className="p-2">Almacén</th><th className="p-2">Vcto.</th><th className="p-2 text-right">Ent.</th><th className="p-2 text-right">Saldo</th><th className="p-2">Opc.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginateSlice(lotRows, lPage).length === 0 ? (
                        <tr><td colSpan={9} className="p-8 text-center text-slate-500">Sin lotes.</td></tr>
                      ) : (
                        paginateSlice(lotRows, lPage).map((row) => (
                          <tr key={row.id} className="border-t border-white/5">
                            <td className="p-2 font-mono text-[10px] text-slate-500">{row.id.slice(0, 8)}</td>
                            <td className="p-2">{(() => { try { return format(parseISO(row.registeredAt), 'dd-MM-yyyy', { locale: es }); } catch { return row.registeredAt; } })()}</td>
                            <td className="p-2">{draft.name}</td><td className="p-2">{row.lotNumber}</td><td className="p-2">{row.warehouse}</td>
                            <td className="p-2 text-slate-500">{row.expiresAt || '—'}</td><td className="p-2 text-right">{row.qtyIn}</td><td className="p-2 text-right">{row.balance}</td>
                            <td className="p-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-red-400"
                                onClick={() =>
                                  patchDraft((p) => ({
                                    ...p,
                                    extended: { ...p.extended!, lots: (p.extended!.lots ?? []).filter((x) => x.id !== row.id) },
                                  }))
                                }
                              >
                                Quitar
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-[11px] text-sky-100">
                  <strong>Entrada:</strong> unidades al cargar stock. <strong>Saldo:</strong> disponible tras movimientos.
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>Pág. {lPage}/{lTotal} · Total {lotRows.length}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={lPage <= 1} onClick={() => setLPage(1)}>Primera</Button>
                    <Button size="sm" variant="outline" disabled={lPage <= 1} onClick={() => setLPage((x) => Math.max(1, x - 1))}>Anterior</Button>
                    <Button size="sm" variant="outline" disabled={lPage >= lTotal} onClick={() => setLPage((x) => Math.min(lTotal, x + 1))}>Siguiente</Button>
                    <Button size="sm" variant="outline" disabled={lPage >= lTotal} onClick={() => setLPage(lTotal)}>Última</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>

        <div className="pointer-events-auto fixed bottom-0 left-0 right-0 z-[60] border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4">
            <Button type="button" variant="outline" className="border-white/15" onClick={onClose}><ArrowLeft className="mr-2 h-4 w-4" />Regresar al listado</Button>
            <Button type="button" className="bg-emerald-600" onClick={handleSave}><Plus className="mr-2 h-4 w-4" />Guardar cambios</Button>
          </div>
        </div>
      </Tabs>

      <Dialog open={lotOpen} onOpenChange={setLotOpen}>
        <DialogContent className="max-w-md border-border bg-card text-foreground">
          <DialogHeader><DialogTitle>Registrar lote</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2"><Label># Lote</Label><Input className="border-border bg-background" value={lotForm.lotNumber} onChange={(e) => setLotForm((f) => ({ ...f, lotNumber: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Almacén</Label>
              <Select value={lotForm.warehouse} onValueChange={(v) => setLotForm((f) => ({ ...f, warehouse: v }))}>
                <SelectTrigger className="border-border bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>{warehouses.map((w) => (<SelectItem key={w} value={w}>{w}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Vencimiento</Label><Input type="date" className="border-border bg-background" value={lotForm.expiresAt ?? ''} onChange={(e) => setLotForm((f) => ({ ...f, expiresAt: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Cantidad entrada</Label><Input type="number" min={0} className="border-border bg-background" value={lotForm.qtyIn} onChange={(e) => setLotForm((f) => ({ ...f, qtyIn: Math.max(0, Number(e.target.value) || 0) }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setLotOpen(false)}>Cancelar</Button>
            <Button type="button" className="bg-emerald-600" onClick={() => {
              if (!lotForm.lotNumber.trim()) {
                toast.error('Ingresa el número de lote');
                return;
              }
              const qty = Number(lotForm.qtyIn) || 0;
              const row: ProductLotRow = { ...lotForm, id: `lot-${Date.now()}`, registeredAt: new Date().toISOString(), qtyIn: qty, balance: qty };
              patchDraft((p) => ({ ...p, extended: { ...p.extended!, lots: [row, ...(p.extended!.lots ?? [])] } }));
              toast.success('Lote agregado — pulsa Guardar para persistir');
              setLotOpen(false);
            }}>Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
