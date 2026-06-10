import { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Download,
  Edit2,
  Eye,
  FileClock,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Product, Provider } from '../../types';
import { formatCurrencyEs } from '../../utils/numberFormat';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { PRODUCT_CATEGORIES, PRODUCT_LINES } from './productCatalogConstants';
import { cloneProduct, createDraftProduct, normalizeProductForWorkspace } from './productDraftUtils';
import { ProductWorkspace } from './ProductWorkspace';
import { useModuleSurfaces } from '../../utils/moduleSurfaces';

const PAGE_SIZE = 10;

interface ProductModuleProps {
  products: Product[];
  providers: Provider[];
  onUpdateProducts: (products: Product[]) => void;
  visibleSedes?: string[];
  currentUserName: string;
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function stockBadge(product: Product) {
  if (product.stockAvailable <= 0) {
    return <Badge className="border border-red-500/30 bg-red-500/20 text-red-300">Sin stock</Badge>;
  }
  if (product.stockAvailable <= product.minStock) {
    return <Badge className="border border-amber-500/30 bg-amber-500/20 text-amber-300">Bajo</Badge>;
  }
  return <Badge className="border border-emerald-500/30 bg-emerald-500/20 text-emerald-300">OK</Badge>;
}

function statusBadge(status: Product['status']) {
  if (status === 'active') {
    return <span className="inline-flex h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />;
  }
  if (status === 'inactive') {
    return <span className="inline-flex h-3 w-3 rounded-full bg-slate-500" />;
  }
  return <span className="inline-flex h-3 w-3 rounded-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.6)]" />;
}

export function ProductModule({
  products,
  providers,
  onUpdateProducts,
  visibleSedes,
  currentUserName,
}: ProductModuleProps) {
  const s = useModuleSurfaces();
  const nextSystemCode = useMemo(
    () => Math.max(0, ...products.map((product) => product.systemCode || 0)) + 1,
    [products],
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [lineFilter, setLineFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [workspace, setWorkspace] = useState<{
    draft: Product;
    baseline: Product;
    isNew: boolean;
  } | null>(null);

  const providerOptions = useMemo(
    () => providers.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [providers],
  );

  const filteredProducts = useMemo(() => {
    const needle = normalizeText(searchTerm);
    return products.filter((product) => {
      if (providerFilter !== 'all' && product.providerId !== providerFilter) return false;
      if (lineFilter !== 'all' && product.line !== lineFilter) return false;
      if (categoryFilter !== 'all' && product.category !== categoryFilter) return false;
      if (stockFilter === 'low' && product.stockAvailable > product.minStock) return false;
      if (stockFilter === 'out' && product.stockAvailable > 0) return false;
      if (stockFilter === 'active' && product.status !== 'active') return false;
      if (!needle) return true;
      return [
        product.systemCode,
        product.barcode,
        product.name,
        product.brand,
        product.providerName,
        product.line,
        product.category,
        product.subcategory,
      ]
        .filter(Boolean)
        .some((value) => normalizeText(String(value)).includes(needle));
    });
  }, [categoryFilter, lineFilter, products, providerFilter, searchTerm, stockFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const pagedProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedOnPage = pagedProducts.length > 0 && pagedProducts.every((product) => selectedIds.has(product.id));
  const lowStockCount = products.filter((product) => product.stockAvailable <= product.minStock).length;
  const outOfStockCount = products.filter((product) => product.stockAvailable <= 0).length;
  const inventoryValue = products.reduce(
    (sum, product) => sum + (product.costPrice ?? product.salePrice) * product.stockAvailable,
    0,
  );

  const openWorkspaceProduct = useCallback((product: Product) => {
    const normalized = normalizeProductForWorkspace(cloneProduct(product));
    setWorkspace({ draft: normalized, baseline: cloneProduct(normalized), isNew: false });
  }, []);

  const openCreateWorkspace = useCallback(() => {
    const draft = normalizeProductForWorkspace(
      createDraftProduct(nextSystemCode, visibleSedes?.[0] ?? 'General'),
    );
    setWorkspace({ draft, baseline: cloneProduct(draft), isNew: true });
  }, [nextSystemCode, visibleSedes]);

  const patchDraft = useCallback((fn: (p: Product) => Product) => {
    setWorkspace((w) => (w ? { ...w, draft: fn(cloneProduct(w.draft)) } : w));
  }, []);

  const commitWorkspace = useCallback(
    (saved: Product) => {
      const duplicateReal = products.some((p) => p.systemCode === saved.systemCode && p.id !== saved.id);
      if (duplicateReal) {
        toast.error('El código de sistema ya existe');
        return;
      }
      const next = workspace?.isNew ? [saved, ...products] : products.map((p) => (p.id === saved.id ? saved : p));
      onUpdateProducts(next);
      setWorkspace(null);
    },
    [onUpdateProducts, products, workspace?.isNew],
  );

  const handleDeleteProduct = (productId: string) => {
    const product = products.find((item) => item.id === productId);
    onUpdateProducts(products.filter((item) => item.id !== productId));
    setWorkspace((w) => (w?.draft.id === productId ? null : w));
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(productId);
      return next;
    });
    toast.success(product ? `Producto eliminado: ${product.name}` : 'Producto eliminado');
  };

  const handleBulkDeactivate = () => {
    if (selectedIds.size === 0) {
      toast.info('Selecciona al menos un producto');
      return;
    }
    onUpdateProducts(
      products.map((product) =>
        selectedIds.has(product.id) ? { ...product, status: 'inactive' as const, updatedAt: new Date() } : product,
      ),
    );
    toast.success(`${selectedIds.size} producto(s) desactivado(s)`);
    setSelectedIds(new Set());
  };

  const handleExportCsv = () => {
    const header = [
      'Cod. de sistema',
      'Cod. de barras',
      'Nombre',
      'Marca',
      'Proveedor',
      'Linea',
      'Categoria',
      'Subcategoria',
      'Precio de venta',
      'Stock contable',
      'Stock disponible',
      'Estado',
    ];
    const rows = filteredProducts.map((product) => [
      product.systemCode,
      product.barcode ?? '',
      product.name,
      product.brand ?? '',
      product.providerName ?? '',
      product.line,
      product.category,
      product.subcategory ?? '',
      product.salePrice,
      product.stockAccounting,
      product.stockAvailable,
      product.status,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `productos-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Catalogo exportado');
  };

  const handleAudit = () => {
    toast.info('Auditoría de productos', {
      description: `${lowStockCount} con stock bajo, ${outOfStockCount} sin stock, ${products.length} registrados.`,
    });
  };

  const toggleSelected = (productId: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(productId);
      else next.delete(productId);
      return next;
    });
  };

  const togglePageSelected = (checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      pagedProducts.forEach((product) => {
        if (checked) next.add(product.id);
        else next.delete(product.id);
      });
      return next;
    });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setProviderFilter('all');
    setLineFilter('all');
    setCategoryFilter('all');
    setStockFilter('all');
    setPage(1);
  };

  return (
    <div className="space-y-5">
      {workspace && (
        <ProductWorkspace
          open
          draft={workspace.draft}
          patchDraft={patchDraft}
          baseline={workspace.baseline}
          providers={providers}
          visibleSedes={visibleSedes}
          currentUserName={currentUserName}
          isNew={workspace.isNew}
          onClose={() => setWorkspace(null)}
          onSave={commitWorkspace}
        />
      )}

      <div className="grid gap-3 md:grid-cols-4">
        {([
          { kind: 'projection' as const, label: 'Productos', value: String(products.length), icon: Package },
          { kind: 'warning' as const, label: 'Stock bajo', value: String(lowStockCount), icon: AlertTriangle },
          { kind: 'expense' as const, label: 'Sin stock', value: String(outOfStockCount), icon: Archive },
          { kind: 'income' as const, label: 'Valor inventario', value: formatCurrencyEs(inventoryValue), icon: Package },
        ]).map((item) => {
          const kpi = s.kpi[item.kind];
          return (
            <div key={item.label} className="rounded-2xl p-4 relative overflow-hidden" style={{ background: kpi.background, border: kpi.border, boxShadow: kpi.boxShadow }}>
              <div className="text-xs uppercase tracking-[0.18em]" style={{ color: kpi.labelColor }}>{item.label}</div>
              <div className="mt-2 flex items-center gap-2 text-2xl font-bold" style={{ color: kpi.valueColor }}>
                <item.icon className="h-5 w-5" style={{ color: kpi.accent }} />
                {item.value}
              </div>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl shadow-xl light-chart-panel" style={{ background: s.chartCard.background, border: s.chartCard.border, boxShadow: s.chartCard.boxShadow }}>
        <div className="space-y-3 border-b p-4" style={{ borderColor: s.divider }}>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold" style={{ color: s.pageTitle }}>
                <Package className="h-5 w-5" style={{ color: s.chart.projection }} />
                Productos
              </h2>
              <p className="text-xs" style={{ color: s.pageSubtitle }}>Pulsa una fila para abrir la ficha (pestañas Editar, Precios, etc.).</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="border-white/10 bg-transparent text-slate-300 hover:bg-white/5" onClick={handleExportCsv}>
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
              <Button variant="outline" className="border-white/10 bg-transparent text-slate-300 hover:bg-white/5" onClick={handleBulkDeactivate}>
                <Archive className="mr-2 h-4 w-4" />
                Desactivar
              </Button>
              <Button className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={openCreateWorkspace}>
                <Plus className="mr-2 h-4 w-4" />
                Crear nuevo producto
              </Button>
            </div>
          </div>

          <div className="grid gap-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                className="border-white/10 bg-[#0D0B1E] pl-9 text-slate-200 placeholder:text-slate-600"
                placeholder="Buscar producto..."
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select value={providerFilter} onValueChange={(value) => { setProviderFilter(value); setPage(1); }}>
              <SelectTrigger className="border-white/10 bg-[#0D0B1E] text-slate-200">
                <SelectValue placeholder="Proveedor..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Proveedor...</SelectItem>
                {providerOptions.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>{provider.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={lineFilter} onValueChange={(value) => { setLineFilter(value); setPage(1); }}>
              <SelectTrigger className="border-white/10 bg-[#0D0B1E] text-slate-200">
                <SelectValue placeholder="Linea..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Linea...</SelectItem>
                {PRODUCT_LINES.map((line) => <SelectItem key={line} value={line}>{line}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={(value) => { setCategoryFilter(value); setPage(1); }}>
              <SelectTrigger className="border-white/10 bg-[#0D0B1E] text-slate-200">
                <SelectValue placeholder="Categorias..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Categorias...</SelectItem>
                {PRODUCT_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={stockFilter} onValueChange={(value) => { setStockFilter(value); setPage(1); }}>
              <SelectTrigger className="border-white/10 bg-[#0D0B1E] text-slate-200">
                <SelectValue placeholder="Stock..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Stock...</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="low">Stock bajo</SelectItem>
                <SelectItem value="out">Sin stock</SelectItem>
              </SelectContent>
            </Select>
            <Button className="bg-orange-500 text-white hover:bg-orange-400" onClick={handleAudit}>
              <FileClock className="mr-2 h-4 w-4" />
              Auditoria
            </Button>
          </div>

          {(searchTerm || providerFilter !== 'all' || lineFilter !== 'all' || categoryFilter !== 'all' || stockFilter !== 'all') && (
            <Button variant="ghost" size="sm" className="text-cyan-300 hover:bg-cyan-500/10 hover:text-cyan-100" onClick={clearFilters}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Limpiar filtros
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-white/[0.03]">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox checked={selectedOnPage} onCheckedChange={(checked) => togglePageSelected(checked === true)} />
                </TableHead>
                <TableHead className="text-slate-400">Cod. de sistema</TableHead>
                <TableHead className="text-slate-400">Cod. de barras</TableHead>
                <TableHead className="min-w-[240px] text-slate-400">Nombre</TableHead>
                <TableHead className="text-slate-400">Marca</TableHead>
                <TableHead className="text-slate-400">Proveedor</TableHead>
                <TableHead className="text-slate-400">Linea</TableHead>
                <TableHead className="text-right text-slate-400">Precio de venta</TableHead>
                <TableHead className="text-center text-slate-400">Stock Contable</TableHead>
                <TableHead className="text-center text-slate-400">Stock Disponible</TableHead>
                <TableHead className="text-center text-slate-400">Estado</TableHead>
                <TableHead className="text-right text-slate-400">Opciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedProducts.length === 0 ? (
                <TableRow className="border-white/5">
                  <TableCell colSpan={12} className="h-32 text-center text-slate-500">
                    No se encontraron productos con los filtros actuales.
                  </TableCell>
                </TableRow>
              ) : (
                pagedProducts.map((product) => (
                  <TableRow
                    key={product.id}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer border-white/5 hover:bg-white/[0.05]"
                    onClick={() => openWorkspaceProduct(product)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openWorkspaceProduct(product);
                      }
                    }}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(product.id)}
                        onCheckedChange={(checked) => toggleSelected(product.id, checked === true)}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-slate-200">{product.systemCode}</TableCell>
                    <TableCell className="text-slate-400">{product.barcode || '-'}</TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-100">{product.name}</div>
                      <div className="mt-1 flex flex-wrap gap-1 text-xs text-slate-500">
                        <span>{product.category}</span>
                        {product.subcategory && <span>/ {product.subcategory}</span>}
                        {stockBadge(product)}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-400">{product.brand || '-'}</TableCell>
                    <TableCell className="text-slate-300">{product.providerName || 'Sin proveedor'}</TableCell>
                    <TableCell className="text-slate-300">{product.line}</TableCell>
                    <TableCell className="text-right font-medium text-slate-100">{formatCurrencyEs(product.salePrice)}</TableCell>
                    <TableCell className="text-center">
                      <Badge className="border border-cyan-500/25 bg-cyan-500/15 text-cyan-200">{product.stockAccounting}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="border border-emerald-500/25 bg-emerald-500/15 text-emerald-200">{product.stockAvailable}</Badge>
                    </TableCell>
                    <TableCell className="text-center">{statusBadge(product.status)}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="text-cyan-300 hover:bg-cyan-500/10 hover:text-cyan-100" onClick={() => openWorkspaceProduct(product)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-amber-300 hover:bg-amber-500/10 hover:text-amber-100" onClick={() => openWorkspaceProduct(product)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-300 hover:bg-red-500/10 hover:text-red-100" onClick={() => handleDeleteProduct(product.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/5 p-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Pagina: {page} de {totalPages} | Registros del 1 al {filteredProducts.length} | Total {filteredProducts.length}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-white/10 bg-transparent" disabled={page === 1} onClick={() => setPage(1)}>Primera</Button>
            <Button variant="outline" size="sm" className="border-white/10 bg-transparent" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</Button>
            <Button variant="outline" size="sm" className="border-white/10 bg-transparent" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Siguiente</Button>
            <Button variant="outline" size="sm" className="border-white/10 bg-transparent" disabled={page === totalPages} onClick={() => setPage(totalPages)}>Ultima</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
