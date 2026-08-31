import { useState, useRef, useMemo, useEffect } from 'react';
import { PurchaseRequest, PurchaseRequestLineItem, Product, Provider, Priority, RequestStatus, PaymentCondition } from '../../types';
import type { SupplierProductsSettings } from '../../types/supplierProducts';
import {
  bestOfferForProduct,
  compareOfferChoice,
  offerForProductAndProvider,
} from '../../utils/supplierProductsData';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '../ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { 
    Plus, CheckCircle2, XCircle, AlertCircle, ShoppingCart, MapPin, DollarSign, Clock, 
    CreditCard, Banknote, Paperclip, FileText, Image as ImageIcon, X, Search, Filter, 
    Calendar, ArrowUpRight, ArrowDownRight, LayoutList, History, Sparkles, Trash2, Package
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { formatCurrencyEs } from '../../utils/numberFormat';
import { Checkbox } from '../ui/checkbox';
import { useSupplierProductsState } from '../../hooks/useSupplierProductsState';

function newLineId(): string {
  return `prl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

type DraftLine = {
  id: string;
  productId: string;
  quantity: string;
  providerId: string;
  unitPrice: string;
  notes: string;
};

function emptyDraftLine(): DraftLine {
  return { id: newLineId(), productId: '', quantity: '1', providerId: '', unitPrice: '', notes: '' };
}

function toRequestDate(d: Date | string | undefined | null): Date {
  if (d instanceof Date && !isNaN(d.getTime())) return d;
  if (d == null || d === '') return new Date();
  const t = new Date(d);
  return isNaN(t.getTime()) ? new Date() : t;
}

interface PurchaseRequestManagerProps {
    requests: PurchaseRequest[];
    providers: Provider[];
    products?: Product[];
    supplierProductsSettings?: SupplierProductsSettings;
    onRequestCreate: (req: PurchaseRequest) => void;
    onRequestStatusChange: (id: string, status: RequestStatus, comment?: string) => void;
    currentUser?: any;
    visibleSedes?: string[];
}

export function PurchaseRequestManager({
    requests,
    providers,
    products = [],
    supplierProductsSettings: supplierProductsSettingsProp,
    onRequestCreate,
    onRequestStatusChange,
    currentUser,
    visibleSedes,
}: PurchaseRequestManagerProps) {
    const { settings: supplierProductsFromHook } = useSupplierProductsState(false);
    const supplierProductsSettings = supplierProductsSettingsProp ?? supplierProductsFromHook;
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('pending');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Action Dialog State (Approve/Reject)
    const [actionDialog, setActionDialog] = useState<{
        isOpen: boolean;
        type: 'approve' | 'reject';
        requestId: string;
        requestDescription: string;
    }>({ isOpen: false, type: 'approve', requestId: '', requestDescription: '' });
    const [actionComment, setActionComment] = useState('');
    const [viewImage, setViewImage] = useState<string | null>(null);

    // Form State
    const [selectedProviderId, setSelectedProviderId] = useState<string>('');
    const [amount, setAmount] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    const defaultLocation = currentUser?.sedes?.[0] || currentUser?.location || visibleSedes?.[0] || 'Principal';
    const [location, setLocation] = useState<string>(defaultLocation);
    const [priority, setPriority] = useState<Priority>('medium');
    const [paymentCondition, setPaymentCondition] = useState<PaymentCondition>('credit');
    const [attachment, setAttachment] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [useLineDetail, setUseLineDetail] = useState(false);
    const [draftLines, setDraftLines] = useState<DraftLine[]>([emptyDraftLine()]);

    const activeProducts = useMemo(
        () => products.filter((p) => p.status !== 'inactive').sort((a, b) => a.name.localeCompare(b.name, 'es')),
        [products]
    );

    const linesTotal = useMemo(() => {
        return draftLines.reduce((sum, line) => {
            const qty = Number(line.quantity) || 0;
            const price = Number(line.unitPrice) || 0;
            return sum + qty * price;
        }, 0);
    }, [draftLines]);

    const applyBestOfferToLine = (lineId: string, silent = false) => {
        if (!supplierProductsSettings) {
            if (!silent) toast.error('No hay catálogo proveedor-producto cargado.');
            return;
        }
        setDraftLines((prev) =>
            prev.map((line) => {
                if (line.id !== lineId || !line.productId) return line;
                const comparison = compareOfferChoice(
                    supplierProductsSettings,
                    line.productId,
                    line.providerId || selectedProviderId || undefined
                );
                const pick = comparison.best;
                if (!pick) {
                    if (!silent) toast.warning('Sin ofertas activas para este producto.');
                    return line;
                }
                if (comparison.cheaperAvailable && !silent) {
                    toast.info(
                        `Mejor precio: ${pick.providerName} (${formatCurrencyEs(pick.lastPrice, 2)}). Ahorro vs selección: ${comparison.savingsPercent.toFixed(1)}%`
                    );
                }
                return {
                    ...line,
                    providerId: pick.providerId,
                    unitPrice: String(pick.lastPrice),
                };
            })
        );
    };

    const applyBestOfferToAllLines = () => {
        if (!supplierProductsSettings) {
            toast.error('No hay catálogo proveedor-producto cargado.');
            return;
        }
        setDraftLines((prev) =>
            prev.map((line) => {
                if (!line.productId) return line;
                const comparison = compareOfferChoice(
                    supplierProductsSettings,
                    line.productId,
                    line.providerId || selectedProviderId || undefined
                );
                const pick = comparison.best;
                if (!pick) return line;
                return {
                    ...line,
                    providerId: pick.providerId,
                    unitPrice: String(pick.lastPrice),
                };
            })
        );
        toast.success('Mejor opción aplicada a las líneas con producto.');
    };

    const patchLine = (lineId: string, patch: Partial<DraftLine>) => {
        setDraftLines((prev) =>
            prev.map((line) => {
                if (line.id !== lineId) return line;
                const next = { ...line, ...patch };
                if (patch.productId && supplierProductsSettings) {
                    const providerId = next.providerId || selectedProviderId;
                    const offer = providerId
                        ? offerForProductAndProvider(supplierProductsSettings, patch.productId, providerId)
                        : bestOfferForProduct(supplierProductsSettings, patch.productId);
                    if (offer) {
                        next.providerId = offer.providerId;
                        next.unitPrice = String(offer.lastPrice);
                    }
                }
                if (patch.providerId && next.productId && supplierProductsSettings) {
                    const offer = offerForProductAndProvider(
                        supplierProductsSettings,
                        next.productId,
                        patch.providerId
                    );
                    if (offer) next.unitPrice = String(offer.lastPrice);
                }
                return next;
            })
        );
    };

    const buildLineItems = (): PurchaseRequestLineItem[] => {
        return draftLines
            .filter((l) => l.productId && Number(l.quantity) > 0)
            .map((line) => {
                const product = activeProducts.find((p) => p.id === line.productId);
                const provider =
                    providers.find((p) => p.id === line.providerId) ??
                    providers.find((p) => p.id === selectedProviderId);
                const qty = Number(line.quantity) || 0;
                const unitPrice = Number(line.unitPrice) || 0;
                const offer = supplierProductsSettings
                    ? offerForProductAndProvider(
                          supplierProductsSettings,
                          line.productId,
                          provider?.id ?? ''
                      )
                    : undefined;
                return {
                    id: line.id,
                    productId: line.productId,
                    productName: product?.name ?? 'Producto',
                    providerId: provider?.id ?? selectedProviderId,
                    providerName: provider?.name ?? '',
                    supplierOfferId: offer?.id,
                    quantity: qty,
                    unitPrice,
                    lineTotal: Math.round(qty * unitPrice * 100) / 100,
                    supplierSku: offer?.supplierSku,
                    notes: line.notes || undefined,
                };
            });
    };

    /**
     * `visibleSedes || [fallback]` NO sirve: `[]` es truthy y deja 0 <SelectItem />
     * → Radix Select se puede colgar. Siempre asegurar al menos un listado y que `value` exista en la lista.
     */
    const baseSedes = useMemo(() => {
        if (visibleSedes && visibleSedes.length > 0) return visibleSedes;
        return ['Principal', 'Norte', 'Sur'];
    }, [visibleSedes]);

    const sedeSelectOptions = useMemo(() => {
        const set = new Set<string>(baseSedes);
        const out = [...baseSedes];
        for (const s of [defaultLocation, location]) {
            if (s && !set.has(s)) {
                set.add(s);
                out.unshift(s);
            }
        }
        return out;
    }, [baseSedes, defaultLocation, location]);

    useEffect(() => {
        if (!isCreateOpen) return;
        if (sedeSelectOptions.length === 0) return;
        if (!sedeSelectOptions.includes(location)) {
            setLocation(sedeSelectOptions[0]!);
        }
    }, [isCreateOpen, sedeSelectOptions, location]);

    // --- Statistics ---
    const stats = useMemo(() => {
        const pending = requests.filter(r => r.status === 'pending');
        const approved = requests.filter(r => r.status === 'approved');
        const rejected = requests.filter(r => r.status === 'rejected');
        
        const pendingAmount = pending.reduce((acc, curr) => acc + curr.amount, 0);
        const approvedAmount = approved.reduce((acc, curr) => acc + curr.amount, 0);

        return {
            pendingCount: pending.length,
            pendingAmount,
            approvedCount: approved.length,
            approvedAmount,
            rejectedCount: rejected.length
        };
    }, [requests]);

    // --- Filtering ---
    const filteredRequests = useMemo(() => {
        return requests.filter(req => {
            // Filter by Tab Status
            if (activeTab === 'pending' && req.status !== 'pending') return false;
            if (activeTab === 'approved' && req.status !== 'approved') return false;
            if (activeTab === 'rejected' && req.status !== 'rejected') return false;
            if (activeTab === 'history' && req.status === 'pending') return false;

            // Filter by Search Term
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                return (
                    (req.providerName || '').toLowerCase().includes(searchLower) ||
                    (req.description || '').toLowerCase().includes(searchLower) ||
                    (req.requesterName || '').toLowerCase().includes(searchLower) ||
                    (req.location || '').toLowerCase().includes(searchLower)
                );
            }

            return true;
        }).sort(
            (a, b) =>
                toRequestDate(b.requestDate).getTime() - toRequestDate(a.requestDate).getTime()
        );
    }, [requests, activeTab, searchTerm]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAttachment(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveAttachment = () => {
        setAttachment(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleCreate = () => {
        const lineItems = useLineDetail ? buildLineItems() : [];
        const computedAmount = useLineDetail ? linesTotal : parseFloat(amount);

        if (useLineDetail) {
            if (lineItems.length === 0) {
                toast.error('Agrega al menos una línea de producto válida.');
                return;
            }
            if (!lineItems.every((l) => l.providerId)) {
                toast.error('Cada línea debe tener proveedor (usa «Mejor opción» o selecciona uno).');
                return;
            }
        } else if (!selectedProviderId || !amount || !description) {
            toast.error('Complete todos los campos obligatorios');
            return;
        }

        const headerProviderId =
            useLineDetail && lineItems.length === 1
                ? lineItems[0]!.providerId
                : selectedProviderId || lineItems[0]?.providerId || '';
        const provider = providers.find((p) => p.id === headerProviderId);
        if (!provider && !useLineDetail) return;

        const autoDescription =
            useLineDetail && lineItems.length > 0
                ? lineItems
                    .map((l) => `${l.productName} ×${l.quantity} (${l.providerName})`)
                    .join('; ')
                : description;

        const newRequest: PurchaseRequest = {
            id: Math.random().toString(36).substring(7),
            providerId: provider?.id ?? headerProviderId,
            providerName: provider?.name ?? lineItems[0]?.providerName ?? 'Varios',
            requestDate: new Date(),
            amount: computedAmount,
            description: useLineDetail ? autoDescription : description,
            location: location,
            priority: priority,
            paymentCondition: paymentCondition,
            status: 'pending',
            requesterName: '',
            requesterInitials: '',
            attachmentUrl: attachment || undefined,
            lineItems: lineItems.length > 0 ? lineItems : undefined,
        };

        onRequestCreate(newRequest);
        setIsCreateOpen(false);
        resetForm();
        toast.success('Solicitud enviada a aprobación');
    };

    const handleAction = () => {
        onRequestStatusChange(
            actionDialog.requestId, 
            actionDialog.type === 'approve' ? 'approved' : 'rejected',
            actionComment
        );
        setActionDialog(prev => ({ ...prev, isOpen: false }));
        setActionComment('');
        toast.success(`Solicitud ${actionDialog.type === 'approve' ? 'aprobada' : 'rechazada'} correctamente`);
    };

    const openActionDialog = (type: 'approve' | 'reject', req: PurchaseRequest) => {
        setActionDialog({
            isOpen: true,
            type,
            requestId: req.id,
            requestDescription: `${req.providerName} - ${formatCurrencyEs(req.amount, 2)}`
        });
        setActionComment('');
    };

    const resetForm = () => {
        setSelectedProviderId('');
        setAmount('');
        setDescription('');
        setPriority('medium');
        setPaymentCondition('credit');
        setAttachment(null);
        setUseLineDetail(false);
        setDraftLines([emptyDraftLine()]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const getPriorityBadge = (p: Priority) => {
        switch(p) {
            case 'high': return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-200 shadow-none">Alta</Badge>;
            case 'medium': return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200 shadow-none">Media</Badge>;
            case 'low': return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 shadow-none">Baja</Badge>;
        }
    };

    const getStatusBadge = (s: RequestStatus) => {
        switch(s) {
            case 'pending': return <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50"><Clock className="w-3 h-3 mr-1"/> Pendiente</Badge>;
            case 'approved': return <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50"><CheckCircle2 className="w-3 h-3 mr-1"/> Aprobado</Badge>;
            case 'rejected': return <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50"><XCircle className="w-3 h-3 mr-1"/> Rechazado</Badge>;
        }
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-150 -mt-2">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-border/60 pb-3">
                <div className="space-y-0.5 min-w-0">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <ShoppingCart className="w-7 h-7 text-orange-500 shrink-0" />
                        Solicitudes de Compra
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Gestiona requerimientos y autorizaciones de gastos antes de que ocurran.
                    </p>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all">
                            <Plus className="w-4 h-4 mr-2" /> Nueva Solicitud
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5 text-primary"/> Nueva Solicitud de Compra
                            </DialogTitle>
                            <DialogDescription>
                                Complete los detalles para solicitar una nueva compra. Todos los campos marcados son obligatorios.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-6 py-4">
                            {/* Section 1: Basic Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Sede / Ubicación</Label>
                                    {baseSedes.length === 1 ? (
                                        <div className="flex items-center h-10 px-3 rounded-md border bg-muted text-sm font-medium">
                                            {location}
                                        </div>
                                    ) : (
                                        <Select value={location} onValueChange={setLocation}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {sedeSelectOptions.map((s) => (
                                                    <SelectItem key={s} value={s}>
                                                        {s}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label>Prioridad</Label>
                                    <Select value={priority} onValueChange={(v: Priority) => setPriority(v)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="low">Baja (Reposición)</SelectItem>
                                            <SelectItem value="medium">Media (Necesario)</SelectItem>
                                            <SelectItem value="high">Alta (Urgente)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            
                            {/* Section 2: Provider & Finance */}
                            <div className="p-4 bg-muted/30 rounded-lg space-y-4 border">
                                <div className="space-y-2">
                                    <Label>Proveedor</Label>
                                    <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                                        <SelectTrigger className="bg-background">
                                            <SelectValue placeholder="Seleccione proveedor..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {providers.map(p => (
                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Monto Estimado (S/)</Label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input 
                                                type="number" 
                                                className="pl-8 bg-background"
                                                placeholder="0.00"
                                                value={useLineDetail ? linesTotal.toFixed(2) : amount}
                                                onChange={e => setAmount(e.target.value)}
                                                disabled={useLineDetail}
                                                readOnly={useLineDetail}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Condición de Pago</Label>
                                        <Select value={paymentCondition} onValueChange={(v: PaymentCondition) => setPaymentCondition(v)}>
                                            <SelectTrigger className="bg-background">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="cash">
                                                    <div className="flex items-center gap-2">
                                                        <Banknote className="w-4 h-4 text-green-600" />
                                                        <span>Contado / Efectivo</span>
                                                    </div>
                                                </SelectItem>
                                                <SelectItem value="credit">
                                                    <div className="flex items-center gap-2">
                                                        <CreditCard className="w-4 h-4 text-blue-600" />
                                                        <span>Crédito (30 días)</span>
                                                    </div>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted/20 p-3">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="use-line-detail"
                                        checked={useLineDetail}
                                        onCheckedChange={(v) => setUseLineDetail(Boolean(v))}
                                    />
                                    <Label htmlFor="use-line-detail" className="cursor-pointer text-sm font-medium">
                                        Detallar por productos (catálogo proveedor)
                                    </Label>
                                </div>
                                {useLineDetail && activeProducts.length > 0 ? (
                                    <Button type="button" size="sm" variant="outline" onClick={applyBestOfferToAllLines}>
                                        <Sparkles className="mr-1 h-3.5 w-3.5" />
                                        Mejor opción (todas)
                                    </Button>
                                ) : null}
                            </div>

                            {useLineDetail ? (
                                <div className="space-y-3 rounded-lg border border-border p-3">
                                    <div className="flex items-center gap-2 text-sm font-medium">
                                        <Package className="h-4 w-4 text-primary" />
                                        Líneas de la solicitud
                                    </div>
                                    {activeProducts.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            No hay productos activos. Registra productos y ofertas en el módulo Productos.
                                        </p>
                                    ) : (
                                        <>
                                            {draftLines.map((line) => {
                                                const comparison =
                                                    line.productId && supplierProductsSettings
                                                        ? compareOfferChoice(
                                                              supplierProductsSettings,
                                                              line.productId,
                                                              line.providerId || selectedProviderId || undefined
                                                          )
                                                        : null;
                                                return (
                                                    <div
                                                        key={line.id}
                                                        className="grid gap-2 rounded-md border border-border/70 bg-background p-2 sm:grid-cols-12"
                                                    >
                                                        <div className="space-y-1 sm:col-span-4">
                                                            <Label className="text-xs">Producto</Label>
                                                            <Select
                                                                value={line.productId || '__none__'}
                                                                onValueChange={(v) =>
                                                                    patchLine(line.id, {
                                                                        productId: v === '__none__' ? '' : v,
                                                                    })
                                                                }
                                                            >
                                                                <SelectTrigger className="h-9">
                                                                    <SelectValue placeholder="Seleccionar…" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="__none__">—</SelectItem>
                                                                    {activeProducts.map((p) => (
                                                                        <SelectItem key={p.id} value={p.id}>
                                                                            {p.name}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1 sm:col-span-2">
                                                            <Label className="text-xs">Cant.</Label>
                                                            <Input
                                                                type="number"
                                                                min={0.01}
                                                                step="0.01"
                                                                className="h-9"
                                                                value={line.quantity}
                                                                onChange={(e) =>
                                                                    patchLine(line.id, { quantity: e.target.value })
                                                                }
                                                            />
                                                        </div>
                                                        <div className="space-y-1 sm:col-span-2">
                                                            <Label className="text-xs">P. unit. (S/)</Label>
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                step="0.01"
                                                                className="h-9"
                                                                value={line.unitPrice}
                                                                onChange={(e) =>
                                                                    patchLine(line.id, { unitPrice: e.target.value })
                                                                }
                                                            />
                                                        </div>
                                                        <div className="space-y-1 sm:col-span-3">
                                                            <Label className="text-xs">Proveedor</Label>
                                                            <Select
                                                                value={line.providerId || '__none__'}
                                                                onValueChange={(v) =>
                                                                    patchLine(line.id, {
                                                                        providerId: v === '__none__' ? '' : v,
                                                                    })
                                                                }
                                                            >
                                                                <SelectTrigger className="h-9">
                                                                    <SelectValue placeholder="Proveedor" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="__none__">—</SelectItem>
                                                                    {providers.map((p) => (
                                                                        <SelectItem key={p.id} value={p.id}>
                                                                            {p.name}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="flex items-end gap-1 sm:col-span-1">
                                                            <Button
                                                                type="button"
                                                                size="icon"
                                                                variant="outline"
                                                                className="h-9 w-9 shrink-0"
                                                                title="Mejor opción"
                                                                onClick={() => applyBestOfferToLine(line.id)}
                                                            >
                                                                <Sparkles className="h-4 w-4" />
                                                            </Button>
                                                            {draftLines.length > 1 ? (
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-9 w-9 shrink-0 text-rose-600"
                                                                    onClick={() =>
                                                                        setDraftLines((prev) =>
                                                                            prev.filter((l) => l.id !== line.id)
                                                                        )
                                                                    }
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            ) : null}
                                                        </div>
                                                        {comparison?.cheaperAvailable ? (
                                                            <p className="text-xs text-amber-700 sm:col-span-12 dark:text-amber-300">
                                                                <AlertCircle className="mr-1 inline h-3.5 w-3.5" />
                                                                Hay proveedor más barato: {comparison.best?.providerName} (
                                                                {formatCurrencyEs(comparison.best?.lastPrice ?? 0, 2)}). Usa
                                                                «Mejor opción».
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                );
                                            })}
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    setDraftLines((prev) => [...prev, emptyDraftLine()])
                                                }
                                            >
                                                <Plus className="mr-1 h-3.5 w-3.5" />
                                                Agregar línea
                                            </Button>
                                            <p className="text-right text-sm font-medium tabular-nums">
                                                Total líneas: {formatCurrencyEs(linesTotal, 2)}
                                            </p>
                                        </>
                                    )}
                                </div>
                            ) : null}

                            {/* Section 3: Details */}
                            {!useLineDetail ? (
                            <div className="space-y-2">
                                <Label>Descripción del Requerimiento</Label>
                                <Textarea 
                                    className="min-h-[100px]"
                                    placeholder="Detalle de los productos o servicios..."
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                />
                            </div>
                            ) : null}

                            {/* Section 4: Attachments */}
                            <div className="space-y-2">
                                <Label>Adjuntar Proforma / Cotización (Opcional)</Label>
                                <div 
                                    className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/50 transition-colors ${attachment ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/25'}`}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {!attachment ? (
                                        <>
                                            <div className="bg-primary/10 p-3 rounded-full mb-3">
                                                <Paperclip className="w-6 h-6 text-primary" />
                                            </div>
                                            <div className="text-sm font-medium">Click para subir imagen o PDF</div>
                                            <div className="text-xs text-muted-foreground mt-1">Máx 5MB</div>
                                        </>
                                    ) : (
                                        <div className="w-full flex items-center justify-between px-2">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-blue-100 p-2 rounded shrink-0">
                                                    {attachment.startsWith('data:image') ? (
                                                        <img src={attachment} alt="Preview" className="w-10 h-10 object-cover rounded" />
                                                    ) : (
                                                        <FileText className="w-6 h-6 text-blue-600" />
                                                    )}
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-sm font-medium text-primary">Archivo adjunto listo</div>
                                                    <div className="text-xs text-muted-foreground">Click en "Registrar" para guardar</div>
                                                </div>
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveAttachment();
                                                }}
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept="image/*,.pdf" 
                                    onChange={handleFileSelect}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                            <Button onClick={handleCreate}>Registrar Solicitud</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pendientes de Aprobación</CardTitle>
                        <Clock className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.pendingCount}</div>
                        <p className="text-xs text-muted-foreground">
                            Valor total: {formatCurrencyEs(stats.pendingAmount, 2)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Aprobadas (Este Mes)</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.approvedCount}</div>
                        <p className="text-xs text-muted-foreground">
                            Valor total: {formatCurrencyEs(stats.approvedAmount, 2)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Rechazadas</CardTitle>
                        <XCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.rejectedCount}</div>
                        <p className="text-xs text-muted-foreground">
                            Solicitudes denegadas
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Area */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
                        <TabsList>
                            <TabsTrigger value="pending" className="flex gap-2">
                                <Clock className="w-4 h-4"/> Pendientes
                                <Badge variant="secondary" className="ml-1 h-5 px-1.5 min-w-[1.25rem]">{stats.pendingCount}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="approved" className="flex gap-2">
                                <CheckCircle2 className="w-4 h-4"/> Aprobadas
                            </TabsTrigger>
                            <TabsTrigger value="rejected" className="flex gap-2">
                                <XCircle className="w-4 h-4"/> Rechazadas
                            </TabsTrigger>
                            <TabsTrigger value="history" className="flex gap-2">
                                <History className="w-4 h-4"/> Historial Completo
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative w-full sm:w-[250px]">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Buscar solicitud..." 
                                className="pl-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" size="icon" title="Filtros avanzados">
                            <Filter className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                <Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">Fecha</TableHead>
                                <TableHead className="w-[180px]">Solicitante</TableHead>
                                <TableHead className="w-[120px]">Área</TableHead>
                                <TableHead>Detalle / Proveedor</TableHead>
                                <TableHead className="w-[100px]">Prioridad</TableHead>
                                <TableHead className="text-right w-[120px]">Monto</TableHead>
                                <TableHead className="w-[120px]">Estado</TableHead>
                                <TableHead className="text-right w-[140px]">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRequests.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="bg-muted p-4 rounded-full">
                                                <Search className="w-8 h-8 opacity-20" />
                                            </div>
                                            <p className="font-medium">No se encontraron solicitudes</p>
                                            <p className="text-sm">Prueba ajustando los filtros o crea una nueva solicitud.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredRequests.map(req => (
                                    <TableRow key={req.id} className="group hover:bg-muted/50 transition-colors">
                                        <TableCell className="text-xs font-mono">
                                            {format(toRequestDate(req.requestDate), 'dd/MM/yy', { locale: es })}
                                            <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                                <MapPin className="w-3 h-3"/> {req.location}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold border border-primary/20" title={req.requesterName}>
                                                    {req.requesterInitials || 'NN'}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-medium truncate max-w-[120px]">{req.requesterName}</span>
                                                    <span className="text-[10px] text-muted-foreground">Asistente</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="font-normal">
                                                {providers.find(p => p.id === req.providerId)?.area || 'General'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium text-foreground">{req.providerName}</div>
                                            <div className="text-xs text-muted-foreground truncate max-w-[250px]" title={req.description}>
                                                {req.description}
                                            </div>
                                            {req.lineItems && req.lineItems.length > 0 ? (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    <Badge variant="secondary" className="text-[10px] font-normal">
                                                        {req.lineItems.length} producto{req.lineItems.length === 1 ? '' : 's'}
                                                    </Badge>
                                                    {[...new Set(req.lineItems.map((l) => l.providerName))].map((name) => (
                                                        <Badge key={name} variant="outline" className="text-[10px] font-normal">
                                                            {name}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            ) : null}
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <Badge variant="outline" className="text-[10px] py-0 h-5 font-normal bg-background">
                                                    {req.paymentCondition === 'cash' ? 'Contado' : 'Crédito 30d'}
                                                </Badge>
                                                {req.attachmentUrl && (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="h-5 px-1.5 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                        onClick={() => setViewImage(req.attachmentUrl!)}
                                                    >
                                                        <Paperclip className="w-3 h-3 mr-1" /> Adjunto
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>{getPriorityBadge(req.priority)}</TableCell>
                                        <TableCell className="text-right font-mono font-medium">
                                            {formatCurrencyEs(req.amount, 2)}
                                        </TableCell>
                                        <TableCell>
                                            {getStatusBadge(req.status)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {req.status === 'pending' ? (
                                                <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button 
                                                        size="icon" 
                                                        variant="ghost" 
                                                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => openActionDialog('reject', req)}
                                                        title="Rechazar"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                    </Button>
                                                    <Button 
                                                        size="icon" 
                                                        variant="ghost" 
                                                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                        onClick={() => openActionDialog('approve', req)}
                                                        title="Aprobar"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" disabled>
                                                    Procesado
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Card>
            </div>

            {/* Dialogo de Acción (Aprobar/Rechazar) */}
            <Dialog open={actionDialog.isOpen} onOpenChange={(open) => setActionDialog(prev => ({ ...prev, isOpen: open }))}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className={actionDialog.type === 'approve' ? "text-green-700 flex items-center gap-2" : "text-red-700 flex items-center gap-2"}>
                            {actionDialog.type === 'approve' ? <CheckCircle2 className="w-5 h-5"/> : <XCircle className="w-5 h-5"/>}
                            {actionDialog.type === 'approve' ? "Confirmar Aprobación" : "Confirmar Rechazo"}
                        </DialogTitle>
                        <DialogDescription>
                            Estás a punto de {actionDialog.type === 'approve' ? "aprobar" : "rechazar"} la solicitud: <br/>
                            <span className="font-medium text-foreground mt-2 block p-2 bg-muted rounded border text-center">{actionDialog.requestDescription}</span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Comentarios / Feedback (Opcional)</Label>
                            <Textarea 
                                placeholder={actionDialog.type === 'approve' ? "Ej: Aprobado, procedan con el pago..." : "Ej: Rechazado por presupuesto excedido..."}
                                value={actionComment}
                                onChange={(e) => setActionComment(e.target.value)}
                                rows={3}
                                className="resize-none"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setActionDialog(prev => ({ ...prev, isOpen: false }))}>Cancelar</Button>
                        <Button 
                            variant={actionDialog.type === 'approve' ? 'default' : 'destructive'}
                            className={actionDialog.type === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                            onClick={handleAction}
                        >
                            {actionDialog.type === 'approve' ? "Confirmar Aprobación" : "Rechazar Solicitud"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Image Preview Dialog */}
            <Dialog open={!!viewImage} onOpenChange={(open) => !open && setViewImage(null)}>
                <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden bg-transparent border-none shadow-none">
                    <div className="relative">
                        <Button 
                            className="absolute right-2 top-2 z-50 rounded-full bg-black/50 hover:bg-black/70 text-white border-none"
                            size="icon"
                            onClick={() => setViewImage(null)}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                        {viewImage && (
                            <img 
                                src={viewImage} 
                                alt="Attachment" 
                                className="w-full h-auto max-h-[85vh] object-contain rounded-lg shadow-2xl bg-black/20 backdrop-blur-sm" 
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}