import React, { useState, useEffect, useMemo } from 'react';
import { PettyCashManager } from './PettyCashManager';
import { CashMovements } from './CashMovements';
import { PettyCashAnalytics } from './PettyCashAnalytics';
import {
    PettyCashTransaction,
    PettyCashSettings,
    User,
    PettyCashWeekClosure,
    PettyCashWeekPreClosure,
    Provider,
} from '../../types';
import type { Role } from '../users/types';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { Wallet, TrendingUp, BarChart2, Plus, Info, Building2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { canApprovePettyCashMovements } from '../../utils/pettyCashAudit';
import { PettyCashAuditConsole } from './PettyCashAuditConsole';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Checkbox } from '../ui/checkbox';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { findPettyCashDuplicate } from '../../utils/pettyCashDocDuplicate';
import {
    getPettyCashWeekBalance,
    isPettyCashWeekClosedForCustodian,
} from '../../utils/pettyCashBalance';
import { receiptTypeUsesIgv } from '../../utils/pettyCashReceiptType';
import {
    getDocIdentityDigitLimit,
    isCompleteDocIdentity,
    normalizeDocIdentityDigits,
} from '../../utils/pettyCashDocIdentity';

interface PettyCashModuleProps {
    transactions: PettyCashTransaction[];
    onUpdateTransactions: (txs: PettyCashTransaction[]) => void;
    settings: PettyCashSettings;
    users: User[];
    currentUser: User;
    /** Roles del sistema (permisos Auditoría + Caja Chica para consola de auditoría). */
    roles?: Role[];
    visibleSedes?: string[];
    /** Consolidado multi-sede: solo usuarios con todas las sedes. */
    canAccessConsolidated?: boolean;
    businessName?: string;
    /** Catálogo desde Configuración → Contabilidad (proveedores / caja chica). */
    commercialCategories: string[];
    commercialAreas: string[];
    /** Directorio con configuración caja chica (motivos por proveedor). */
    providers?: Provider[];
    /** Navega al módulo de proveedores para alta rápida si el RUC no existe. */
    onRequestProviderRegistration?: () => void;
    /** Logo del negocio (respaldo si no hay logo específico en plantilla de rendición). */
    businessLogo?: string;
    /** Persiste cierre de semana (arrastre de saldo en `settings.weekClosures`). */
    onClosePettyCashWeek?: (closure: PettyCashWeekClosure) => void;
    /** Pre-cierre presentado por el responsable (no bloquea gastos). */
    onPreClosePettyCashWeek?: (pre: PettyCashWeekPreClosure) => void;
}

const getWeekStr = (date: Date) => format(date, 'w');

export function PettyCashModule({ 
    transactions, 
    onUpdateTransactions, 
    settings, 
    users, 
    currentUser,
    roles = [],
    visibleSedes = [],
    canAccessConsolidated = false,
    businessName = 'GrooFlow',
    commercialCategories,
    commercialAreas,
    providers = [],
    onRequestProviderRegistration,
    businessLogo,
    onClosePettyCashWeek,
    onPreClosePettyCashWeek,
}: PettyCashModuleProps) {
    const [activeTab, setActiveTab] = useState('manager');
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

    const [amountBI, setAmountBI] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<string>(() => commercialCategories[0] || 'Otros');
    const [classification, setClassification] = useState<string>('Boleta');
    const [docType, setDocType] = useState<string>('RUC');
    const [docNumber, setDocNumber] = useState('');
    const [docSeries, setDocSeries] = useState('');
    const [voucherNumber, setVoucherNumber] = useState('');
    const [providerName, setProviderName] = useState('');
    const [area, setArea] = useState<string>('');
    const [isExtraExpense, setIsExtraExpense] = useState(false);
    
    const sedeOptions = useMemo(
        () => (visibleSedes.length > 0 ? [...visibleSedes] : []),
        [visibleSedes.join('|')]
    );
    const defaultSede = sedeOptions[0] || currentUser.location || 'Principal';
    const [location, setLocation] = useState<string>(defaultSede);
    const [documentDate, setDocumentDate] = useState<string>(() =>
        format(new Date(), 'yyyy-MM-dd')
    );
    /** Factura: IGV 10% si está marcado; por defecto 18%. */
    const [invoiceIgv10, setInvoiceIgv10] = useState(false);
    /** Factura: importe inafecto (no suma a base IGV, sí al total a pagar). */
    const [amountExempt, setAmountExempt] = useState('');

    useEffect(() => {
        const first = sedeOptions[0];
        if (first && !sedeOptions.includes(location)) {
            setLocation(first);
        }
    }, [sedeOptions, location]);

    const showAuditTab = canApprovePettyCashMovements(currentUser, roles);
    const normalizedDoc = useMemo(
        () => normalizeDocIdentityDigits(docNumber, docType),
        [docNumber, docType]
    );
    const matchedProvider = useMemo((): Provider | null => {
        if (!isCompleteDocIdentity(docType, normalizedDoc)) return null;
        return providers.find((p) => (p.ruc || '').replace(/\D/g, '') === normalizedDoc) || null;
    }, [providers, normalizedDoc, docType]);

    const docIdentityLimit = getDocIdentityDigitLimit(docType);
    const docIdentityComplete = isCompleteDocIdentity(docType, normalizedDoc);

    const expenseCategoryOptions = useMemo(() => {
        if (!docIdentityComplete || !matchedProvider) return [] as string[];
        const lines = matchedProvider.pettyExpenseLines?.filter((l) => l.commercialCategory?.trim()) ?? [];
        if (lines.length === 0) return [] as string[];
        const s = new Set(lines.map((l) => l.commercialCategory.trim()));
        return commercialCategories.filter((c) => s.has(c));
    }, [docIdentityComplete, matchedProvider, commercialCategories]);

    const hasPettyConfig = expenseCategoryOptions.length > 0;

    const suggestedAccountingAccount = useMemo(() => {
        if (!matchedProvider || !category) return undefined;
        const line = matchedProvider.pettyExpenseLines?.find(
            (l) => l.commercialCategory?.trim() === category.trim()
        );
        return line?.defaultAccountingAccount?.trim() || undefined;
    }, [matchedProvider, category]);

    useEffect(() => {
        setDocNumber((d) => normalizeDocIdentityDigits(d, docType));
    }, [docType]);

    useEffect(() => {
        if (!matchedProvider) return;
        if (providerName.trim() !== matchedProvider.name) {
            setProviderName(matchedProvider.name);
            toast.info('Proveedor encontrado en catálogo', {
                description: matchedProvider.name,
            });
        }
    }, [matchedProvider]);

    useEffect(() => {
        if (expenseCategoryOptions.length === 0) return;
        if (!expenseCategoryOptions.includes(category)) {
            setCategory(expenseCategoryOptions[0]!);
        }
    }, [expenseCategoryOptions, category]);

    useEffect(() => {
        if (expenseCategoryOptions.length > 0) return;
        if (matchedProvider && !hasPettyConfig) return;
        if (commercialCategories.length > 0 && !commercialCategories.includes(category)) {
            setCategory(commercialCategories[0]!);
        }
    }, [commercialCategories, category, expenseCategoryOptions.length, matchedProvider, hasPettyConfig]);

    useEffect(() => {
        if (!canAccessConsolidated && activeTab === 'consolidated') {
            setActiveTab('manager');
        }
    }, [canAccessConsolidated, activeTab]);

    useEffect(() => {
        if (activeTab === 'audit' && !showAuditTab) {
            setActiveTab('manager');
        }
    }, [activeTab, showAuditTab]);

    useEffect(() => {
        if (commercialAreas.length === 0) return;
        if (!area || !commercialAreas.includes(area)) {
            setArea(commercialAreas[0]!);
        }
    }, [commercialAreas, area]);

    useEffect(() => {
        if (!receiptTypeUsesIgv(classification)) {
            setInvoiceIgv10(false);
            setAmountExempt('');
        }
    }, [classification]);

    const usesIgv = receiptTypeUsesIgv(classification);
    const igvRate = usesIgv ? (invoiceIgv10 ? 0.1 : 0.18) : 0;
    const numBiEmpty = amountBI.trim() === '';
    const numExEmpty = amountExempt.trim() === '';
    const numBi = numBiEmpty ? 0 : parseFloat(amountBI);
    const numEx = numExEmpty ? 0 : parseFloat(amountExempt);
    const badBi = !numBiEmpty && (Number.isNaN(numBi) || numBi < 0);
    const badEx = !numExEmpty && (Number.isNaN(numEx) || numEx < 0);
    const igv = usesIgv && !badBi ? Math.round(numBi * igvRate * 100) / 100 : 0;
    const total = usesIgv
        ? badBi || badEx
            ? NaN
            : Math.round((numBi + igv + (Number.isNaN(numEx) ? 0 : numEx)) * 100) / 100
        : numBiEmpty
          ? 0
          : Number.isNaN(numBi) || numBi < 0
            ? NaN
            : Math.round(numBi * 100) / 100;

    const motivoHelperText = useMemo(() => {
        if (!docIdentityComplete) return 'Indique y complete el RUC, DNI o CE para identificar al proveedor.';
        if (!matchedProvider) return 'No hay coincidencia en el catálogo: solicite a Contabilidad que ingrese al proveedor.';
        if (!hasPettyConfig) return 'Este proveedor aún no tiene motivos de caja chica: es tarea de Contabilidad en Proveedores.';
        return 'Solo se listan los motivos habilitados para este proveedor.';
    }, [docIdentityComplete, matchedProvider, hasPettyConfig]);

    const availablePettyBalance = useMemo(() => {
        const limit =
            currentUser.pettyCashLimit && currentUser.pettyCashLimit > 0
                ? currentUser.pettyCashLimit
                : settings.totalFundLimit;
        const w = getWeekStr(new Date());
        if (isPettyCashWeekClosedForCustodian(currentUser.id, w, settings.weekClosures)) {
            return { closed: true as const, balance: 0 };
        }
        const balance = getPettyCashWeekBalance(
            transactions,
            currentUser.id,
            w,
            settings.weekClosures,
            limit
        );
        return { closed: false as const, balance };
    }, [transactions, settings.weekClosures, settings.totalFundLimit, currentUser.id, currentUser.pettyCashLimit]);

    const handleRegisterExpense = () => {
        if (sedeOptions.length === 0) {
            toast.error('No tiene sedes asignadas para registrar gastos. Contacte al administrador.');
            return;
        }
        if (commercialAreas.length === 0 || commercialCategories.length === 0) {
            toast.error('Falta configurar categorías o áreas en Configuración → Contabilidad.');
            return;
        }
        if (!area || !docNumber || !providerName) {
            toast.error('Complete sede, área y datos del comprobante');
            return;
        }
        const needDigits = getDocIdentityDigitLimit(docType);
        if (normalizedDoc.length !== needDigits) {
            toast.error(`El ${docType} debe tener ${needDigits} dígitos.`);
            return;
        }
        if (!matchedProvider) {
            toast.error('Proveedor no registrado en catálogo', {
                description:
                    'Solicite a Contabilidad que ingrese o complete al proveedor en el directorio (Proveedores).',
            });
            return;
        }
        if (matchedProvider && !hasPettyConfig) {
            toast.error('Proveedor sin motivos de caja chica', {
                description:
                    'Solicite a Contabilidad que configure en Proveedores el bloque «Caja chica: motivos permitidos» con el motivo y la cuenta de gasto.',
            });
            return;
        }
        if (!expenseCategoryOptions.includes(category)) {
            toast.error('Indique un motivo válido para este proveedor.');
            return;
        }
        if (!docSeries.trim() || !voucherNumber.trim()) {
            toast.error('Indique la Serie y el Nro. de documento del comprobante');
            return;
        }

        const usesIgvRow = receiptTypeUsesIgv(classification);
        if (usesIgvRow) {
            if (badBi || badEx) {
                toast.error('Importes inválidos: revise base imponible e inafecto (solo montos ≥ 0).');
                return;
            }
            if (!Number.isFinite(total) || total <= 0) {
                toast.error('Indique base y/o inafecto para un total a pagar mayor a 0.');
                return;
            }
        } else {
            if (numBiEmpty || Number.isNaN(numBi) || numBi <= 0) {
                toast.error('Ingrese un monto válido');
                return;
            }
        }

        const rate = usesIgvRow ? (invoiceIgv10 ? 0.1 : 0.18) : 0;
        const igvVal = usesIgvRow ? Math.round(numBi * rate * 100) / 100 : 0;
        const exVal = usesIgvRow ? Math.round((Number.isNaN(numEx) ? 0 : numEx) * 100) / 100 : 0;
        const totalVal = usesIgvRow
            ? Math.round((numBi + igvVal + exVal) * 100) / 100
            : Math.round(numBi * 100) / 100;

        if (totalVal > 300) {
             toast.warning("Gasto mayor a S/ 300 requiere aprobación.", {
                 description: "El gasto se registrará pero quedará pendiente de validación extra."
             });
        }

        const dup = findPettyCashDuplicate(
            transactions,
            normalizedDoc,
            docSeries.trim(),
            voucherNumber.trim()
        );
        if (dup) {
            toast.error('Ya existe un gasto activo con el mismo RUC/DNI, serie y número de documento.', {
                description: `Registro existente: ${dup.description?.slice(0, 60) || dup.id}…`,
            });
            return;
        }

        const weekStr = getWeekStr(new Date());
        const custodianId = currentUser.id;
        const fundLimit =
            currentUser.pettyCashLimit && currentUser.pettyCashLimit > 0
                ? currentUser.pettyCashLimit
                : settings.totalFundLimit;

        if (isPettyCashWeekClosedForCustodian(custodianId, weekStr, settings.weekClosures)) {
            toast.error('Esta semana ya está cerrada para su caja; no puede registrar más gastos en ella.');
            return;
        }

        const balanceBefore = getPettyCashWeekBalance(
            transactions,
            custodianId,
            weekStr,
            settings.weekClosures,
            fundLimit
        );
        if (balanceBefore - totalVal < -0.009) {
            toast.error('Saldo insuficiente en caja chica.', {
                description: `Disponible: S/ ${balanceBefore.toFixed(2)} · Gasto: S/ ${totalVal.toFixed(2)}. Reduzca el monto o registre una reposición.`,
            });
            return;
        }

        if (settings.maxTransactionAmount > 0 && totalVal > settings.maxTransactionAmount + 0.009) {
            toast.error('El monto supera el tope por comprobante configurado.', {
                description: `Tope actual: S/ ${settings.maxTransactionAmount.toFixed(2)} (Configuración → Contabilidad).`,
            });
            return;
        }

        let docDateParsed: Date;
        try {
            docDateParsed = documentDate
                ? new Date(documentDate + 'T12:00:00')
                : new Date();
        } catch {
            docDateParsed = new Date();
        }
        if (Number.isNaN(docDateParsed.getTime())) docDateParsed = new Date();

        const newExpense: PettyCashTransaction = {
            id: `pc-${Date.now()}`,
            date: new Date(),
            documentDate: docDateParsed,
            amount: totalVal,
            amountBI: usesIgvRow ? numBi : totalVal,
            igv: usesIgvRow ? igvVal : 0,
            igvRate: usesIgvRow ? (rate as 0.1 | 0.18) : undefined,
            amountExempt: usesIgvRow ? exVal : undefined,
            description:
                description.trim() ||
                `${category} — ${providerName.trim() || 'Proveedor'}`,
            category: commercialCategories.includes(category) ? category : commercialCategories[0]!,
            ...(suggestedAccountingAccount ? { accountingAccount: suggestedAccountingAccount } : {}),
            requester: currentUser.name,
            receiptNumber: voucherNumber.trim(),
            receiptType: classification as PettyCashTransaction['receiptType'],
            docType: docType as PettyCashTransaction['docType'],
            docNumber: normalizedDoc,
            docSeries: docSeries.trim(),
            voucherNumber: voucherNumber.trim(),
            providerName: providerName.trim(),
            area: area,
            isExtraExpense: isExtraExpense,
            status: 'pending_audit',
            weekNumber: getWeekStr(new Date()),
            custodianId: currentUser.id,
            type: 'expense',
            location: sedeOptions.includes(location) ? location : sedeOptions[0]
        };

        onUpdateTransactions([newExpense, ...transactions]);
        
        setAmountBI('');
        setAmountExempt('');
        setInvoiceIgv10(false);
        setDescription('');
        setDocNumber('');
        setDocSeries('');
        setVoucherNumber('');
        setProviderName('');
        setArea('');
        setIsExtraExpense(false);
        setClassification('Boleta');
        setDocType('RUC');
        setDocumentDate(format(new Date(), 'yyyy-MM-dd'));

        setCategory(commercialCategories[0] || 'Otros');
        setIsExpenseModalOpen(false);
        toast.success("Gasto registrado correctamente", {
            description: `Total: S/ ${totalVal.toFixed(2)} (${classification})`
        });
    };

    return (
        <div className="space-y-6">
            {sedeOptions.length === 0 && (
                <Alert variant="destructive" className="border-amber-600/50 bg-amber-950/20">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Sin sedes asignadas</AlertTitle>
                    <AlertDescription>
                        Su usuario no tiene sedes habilitadas en el catálogo. Un administrador debe asignarle sedes en <strong>Usuarios</strong> y verificar el catálogo en <strong>Configuración</strong>.
                    </AlertDescription>
                </Alert>
            )}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
                    <TabsList className="flex h-auto min-h-10 w-full max-w-3xl flex-wrap justify-start gap-1 p-1">
                        <TabsTrigger value="manager" className="flex items-center gap-2 shrink-0">
                            <Wallet className="w-4 h-4" />
                            <span className="hidden sm:inline">Mi Caja / Sede</span>
                            <span className="sm:hidden">Caja</span>
                        </TabsTrigger>
                        {canAccessConsolidated && (
                            <TabsTrigger value="consolidated" className="flex items-center gap-2 shrink-0">
                                <TrendingUp className="w-4 h-4" />
                                <span className="hidden sm:inline">Consolidado</span>
                                <span className="sm:hidden">Global</span>
                            </TabsTrigger>
                        )}
                        {showAuditTab && (
                            <TabsTrigger value="audit" className="flex items-center gap-2 shrink-0">
                                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                <span className="hidden sm:inline">Auditoría</span>
                                <span className="sm:hidden">Aud.</span>
                            </TabsTrigger>
                        )}
                        <TabsTrigger value="analytics" className="flex items-center gap-2 shrink-0">
                            <BarChart2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Analítica</span>
                            <span className="sm:hidden">Data</span>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
                
                <Button 
                    onClick={() => setIsExpenseModalOpen(true)}
                    className="bg-cyan-500 hover:bg-cyan-600 text-black font-medium"
                    disabled={sedeOptions.length === 0}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Registrar Gasto
                </Button>
            </div>

            <Dialog open={isExpenseModalOpen} onOpenChange={setIsExpenseModalOpen}>
                <DialogContent className="sm:max-w-[600px] bg-[#1A1826] border-[#3D3B5C] text-white max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-cyan-400">
                            <Plus className="h-5 w-5" />
                            Registrar Gasto
                        </DialogTitle>
                        <DialogDescription className="text-sm text-slate-400">
                            Salida de dinero de la caja de <span className="text-white font-medium">{currentUser.name}</span>.
                        </DialogDescription>
                    </DialogHeader>

                    {availablePettyBalance.closed ? (
                        <Alert className="border-amber-600/50 bg-amber-950/30 text-amber-100">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle className="text-sm">Semana cerrada</AlertTitle>
                            <AlertDescription className="text-xs text-amber-200/90">
                                No puede registrar gastos en esta semana contable hasta que se abra la siguiente o un
                                administrador revierta el cierre.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <div className="rounded-lg border border-cyan-900/40 bg-cyan-950/25 px-3 py-2 text-sm">
                            <span className="text-slate-400">Saldo disponible (esta semana): </span>
                            <span className="font-mono font-semibold text-cyan-300">
                                S/ {availablePettyBalance.balance.toFixed(2)}
                            </span>
                            {Number.isFinite(total) && total > 0 ? (
                                <span
                                    className={`ml-2 text-xs ${
                                        availablePettyBalance.balance - total < -0.009
                                            ? 'text-red-400'
                                            : 'text-slate-400'
                                    }`}
                                >
                                    → Tras este gasto: S/{' '}
                                    {(availablePettyBalance.balance - total).toFixed(2)}
                                </span>
                            ) : null}
                        </div>
                    )}
                    
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4 p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                            <div className="space-y-2 col-span-2 sm:col-span-1">
                                <Label className="text-xs font-medium text-slate-400">Sede</Label>
                                {sedeOptions.length <= 1 ? (
                                    <div className="flex items-center h-10 px-3 rounded-md border border-slate-700 bg-slate-800/50 text-slate-300 text-sm">
                                        <Building2 className="w-4 h-4 mr-2 text-cyan-500" />
                                        {sedeOptions[0] || '—'}
                                    </div>
                                ) : (
                                    <Select value={location} onValueChange={setLocation}>
                                        <SelectTrigger className="bg-[#22203A] border-[#3D3B5C] text-white">
                                            <SelectValue placeholder="Seleccionar Sede" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#22203A] border-[#3D3B5C] text-white">
                                            {sedeOptions.map(s => (
                                                <SelectItem key={s} value={s}>{s}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>

                            <div className="space-y-2 col-span-2 sm:col-span-1">
                                <Label htmlFor="area" className="text-xs font-medium text-slate-400">Área solicitante</Label>
                                <Select value={area} onValueChange={setArea}>
                                    <SelectTrigger className="bg-[#22203A] border-[#3D3B5C] text-white">
                                        <SelectValue placeholder="Seleccionar área" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#22203A] border-[#3D3B5C] text-white">
                                        {commercialAreas.map((a) => (
                                            <SelectItem key={a} value={a}>{a}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-3 p-3 rounded-lg border border-slate-700/50 bg-slate-800/20">
                            <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">1. Comprobante y proveedor</p>

                            <div className="space-y-2">
                                <Label htmlFor="voucherDate" className="text-xs font-medium text-slate-400">
                                    Fecha del documento
                                </Label>
                                <Input
                                    id="voucherDate"
                                    type="date"
                                    value={documentDate}
                                    onChange={(e) => setDocumentDate(e.target.value)}
                                    className="bg-[#22203A] border-[#3D3B5C] text-white"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-slate-400">Tipo de documento</Label>
                                    <Select value={classification} onValueChange={setClassification}>
                                        <SelectTrigger className="bg-[#22203A] border-[#3D3B5C] text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#22203A] border-[#3D3B5C] text-white">
                                            <SelectItem value="Boleta">Boleta</SelectItem>
                                            <SelectItem value="Factura">Factura</SelectItem>
                                            <SelectItem value="RXH">Recibo por Honorarios</SelectItem>
                                            <SelectItem value="Recibo Simple">Recibo Simple</SelectItem>
                                            <SelectItem value="Planilla de Movilidad">Planilla de Movilidad</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {usesIgv ? (
                                        <p className="text-[10px] text-cyan-300/80">
                                            Factura: se calcula IGV 18% (base + IGV = total a pagar).
                                        </p>
                                    ) : (
                                        <p className="text-[10px] text-slate-500">
                                            Este tipo de documento no desglosa IGV; el importe va completo al gasto.
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-slate-400">Tipo de identidad</Label>
                                    <Select value={docType} onValueChange={setDocType}>
                                        <SelectTrigger className="bg-[#22203A] border-[#3D3B5C] text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#22203A] border-[#3D3B5C] text-white">
                                            <SelectItem value="RUC">RUC</SelectItem>
                                            <SelectItem value="DNI">DNI</SelectItem>
                                            <SelectItem value="CE">CE</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="docNumber" className="text-xs font-medium text-slate-400">
                                    N° RUC / DNI / CE <span className="text-red-400">*</span>
                                </Label>
                                <Input
                                    id="docNumber"
                                    value={docNumber}
                                    onChange={(e) =>
                                        setDocNumber(normalizeDocIdentityDigits(e.target.value, docType))
                                    }
                                    placeholder={
                                        docType === 'RUC'
                                            ? '11 dígitos'
                                            : docType === 'DNI'
                                              ? '8 dígitos'
                                              : '9 dígitos'
                                    }
                                    inputMode="numeric"
                                    autoComplete="off"
                                    className="bg-[#22203A] border-[#3D3B5C] text-white placeholder:text-slate-600 font-mono"
                                />
                                {normalizedDoc.length > 0 && (
                                    <p
                                        className={`text-[11px] ${matchedProvider ? 'text-emerald-400' : 'text-amber-400'}`}
                                    >
                                        {matchedProvider
                                            ? `${docType} validado: proveedor en catálogo${
                                                  hasPettyConfig ? ' (motivos de caja chica listos)' : ' (falta configurar motivos — Contabilidad)'
                                              }.`
                                            : normalizedDoc.length < docIdentityLimit
                                              ? `Complete los ${docIdentityLimit} dígitos del ${docType} (${normalizedDoc.length}/${docIdentityLimit}).`
                                              : `${docType} no encontrado en el directorio de proveedores.`}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="providerName" className="text-xs font-medium text-slate-400">
                                    Razón social / Nombre <span className="text-red-400">*</span>
                                </Label>
                                <Input
                                    id="providerName"
                                    value={providerName}
                                    onChange={(e) => setProviderName(e.target.value)}
                                    placeholder="Se completa al validar el RUC o documento en el directorio"
                                    className="bg-[#22203A] border-[#3D3B5C] text-white placeholder:text-slate-600"
                                    readOnly={!!matchedProvider}
                                />
                                {docIdentityComplete && !matchedProvider && (
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-amber-300 bg-amber-950/25 border border-amber-700/40 rounded px-2 py-1.5">
                                        <span>
                                            El proveedor no figura en el directorio. Solicite a <strong>Contabilidad</strong> que
                                            lo ingrese o dé de alta en <strong>Proveedores</strong> antes de registrar el gasto.
                                        </span>
                                        {onRequestProviderRegistration ? (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="h-7 shrink-0 text-[11px] border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                                                onClick={onRequestProviderRegistration}
                                            >
                                                Ir a Proveedores
                                            </Button>
                                        ) : null}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="docSeries" className="text-xs font-medium text-slate-400">
                                        Serie <span className="text-red-400">*</span>
                                    </Label>
                                    <Input
                                        id="docSeries"
                                        value={docSeries}
                                        onChange={(e) => setDocSeries(e.target.value)}
                                        placeholder="Ej. F001, B002"
                                        className="bg-[#22203A] border-[#3D3B5C] text-white placeholder:text-slate-600 font-mono"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="voucherNumber" className="text-xs font-medium text-slate-400">
                                        Nro. de documento <span className="text-red-400">*</span>
                                    </Label>
                                    <Input
                                        id="voucherNumber"
                                        value={voucherNumber}
                                        onChange={(e) => setVoucherNumber(e.target.value)}
                                        placeholder="Correlativo del comprobante"
                                        className="bg-[#22203A] border-[#3D3B5C] text-white placeholder:text-slate-600 font-mono"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 p-3 rounded-lg border border-slate-700/50 bg-slate-800/20">
                            <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">2. Clasificación (caja chica)</p>
                            <p className="text-[11px] text-slate-500 leading-relaxed">{motivoHelperText}</p>

                            {hasPettyConfig ? (
                                <div className="space-y-2">
                                    <Label htmlFor="category" className="text-xs font-medium text-slate-400">
                                        Motivo del gasto <span className="text-red-400">*</span>
                                    </Label>
                                    <Select value={category} onValueChange={setCategory}>
                                        <SelectTrigger id="category" className="bg-[#22203A] border-[#3D3B5C] text-white">
                                            <SelectValue placeholder="Seleccione el motivo" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#22203A] border-[#3D3B5C] text-white max-h-60">
                                            {expenseCategoryOptions.map((c) => (
                                                <SelectItem key={c} value={c}>
                                                    {c}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-slate-400">Motivo del gasto</Label>
                                    <div className="flex min-h-10 w-full items-center rounded-md border border-slate-700 bg-slate-800/50 px-3 text-sm text-slate-500">
                                        {docIdentityComplete && matchedProvider
                                            ? 'Sin motivos configurados'
                                            : 'Valide el documento del proveedor arriba'}
                                    </div>
                                </div>
                            )}

                            {hasPettyConfig && (
                                <div className="rounded-md border border-slate-700/60 bg-slate-900/40 px-2 py-1.5 text-[11px] text-slate-400">
                                    {suggestedAccountingAccount ? (
                                        <span>
                                            Cuenta de gasto sugerida:{' '}
                                            <span className="font-mono text-cyan-300">{suggestedAccountingAccount}</span>
                                        </span>
                                    ) : (
                                        <span className="text-amber-300/90">
                                            Sin cuenta 63/64/65 asignada a este motivo: contabilidad puede completarla en
                                            Proveedores.
                                        </span>
                                    )}
                                </div>
                            )}

                            {matchedProvider && !hasPettyConfig && docIdentityComplete && (
                                <Alert className="border-amber-700/50 bg-amber-950/30 text-amber-100">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle className="text-sm">Falta configuración en el proveedor</AlertTitle>
                                    <AlertDescription className="text-xs text-amber-200/90">
                                        Este proveedor aún no tiene motivos de caja chica. Solicite a <strong>Contabilidad</strong> que
                                        abra <strong>Proveedores</strong>, edite al proveedor y complete «Caja chica: motivos
                                        permitidos».
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="flex items-center justify-between rounded-md border border-[#3D3B5C] bg-[#22203A] p-2">
                                <Label htmlFor="extra-expense" className="text-sm font-medium text-white cursor-pointer">
                                    ¿Gasto extra?
                                </Label>
                                <Switch
                                    id="extra-expense"
                                    checked={isExtraExpense}
                                    onCheckedChange={setIsExtraExpense}
                                    className="data-[state=checked]:bg-cyan-500"
                                />
                            </div>
                        </div>

                        <div className="space-y-3 p-3 rounded-lg border border-slate-700/50 bg-slate-800/20">
                            <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">3. Importes</p>
                            
                            {usesIgv ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="petty-igv10"
                                            checked={invoiceIgv10}
                                            onCheckedChange={(c) => setInvoiceIgv10(c === true)}
                                            className="border-slate-500 data-[state=checked]:bg-cyan-600 data-[state=checked]:border-cyan-500"
                                        />
                                        <Label
                                            htmlFor="petty-igv10"
                                            className="text-[11px] text-slate-300 cursor-pointer leading-none"
                                        >
                                            IGV 10% (si no tilda: 18%)
                                        </Label>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                        <div className="space-y-1.5 min-w-0">
                                            <Label htmlFor="amountBI" className="text-xs font-medium text-slate-400">
                                                Base imponible
                                            </Label>
                                            <div className="relative">
                                                <span className="absolute left-2.5 top-2.5 text-slate-500 text-xs">S/</span>
                                                <Input
                                                    id="amountBI"
                                                    type="number"
                                                    value={amountBI}
                                                    onChange={(e) => setAmountBI(e.target.value)}
                                                    min={0}
                                                    placeholder="0.00"
                                                    className="pl-7 bg-[#22203A] border-[#3D3B5C] text-white font-mono text-sm h-9"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 min-w-0">
                                            <Label htmlFor="igv" className="text-xs font-medium text-slate-400">
                                                IGV ({invoiceIgv10 ? 10 : 18}%)
                                            </Label>
                                            <div className="relative">
                                                <span className="absolute left-2.5 top-2.5 text-slate-500 text-xs">S/</span>
                                                <Input
                                                    id="igv"
                                                    value={badBi ? '—' : Number.isFinite(igv) ? igv.toFixed(2) : '—'}
                                                    readOnly
                                                    className="pl-7 bg-slate-800/50 border-slate-700 text-slate-400 font-mono text-sm h-9 cursor-not-allowed"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 min-w-0">
                                            <Label htmlFor="total" className="text-xs font-medium text-cyan-400">
                                                Total
                                            </Label>
                                            <div className="relative">
                                                <span className="absolute left-2.5 top-2.5 text-cyan-500 text-xs font-bold">S/</span>
                                                <Input
                                                    id="total"
                                                    value={
                                                        Number.isFinite(total) && total > 0
                                                            ? total.toFixed(2)
                                                            : ''
                                                    }
                                                    readOnly
                                                    className="pl-7 bg-cyan-950/30 border-cyan-900/50 text-cyan-400 font-bold font-mono text-sm h-9"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 max-w-xs">
                                        <Label htmlFor="amountExempt" className="text-xs font-medium text-slate-400">
                                            Inafecto (opcional)
                                        </Label>
                                        <div className="relative">
                                            <span className="absolute left-2.5 top-2.5 text-slate-500 text-xs">S/</span>
                                            <Input
                                                id="amountExempt"
                                                type="number"
                                                min={0}
                                                value={amountExempt}
                                                onChange={(e) => setAmountExempt(e.target.value)}
                                                placeholder="0.00"
                                                className="pl-7 bg-[#22203A] border-[#3D3B5C] text-white font-mono text-sm h-9"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-500 leading-snug">
                                            Parte no afecta a IGV; se suma al total a pagar.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4 sm:max-w-xs">
                                    <div className="space-y-2">
                                        <Label htmlFor="amountBI" className="text-xs font-medium text-slate-400">
                                            Importe gasto
                                        </Label>
                                        <div className="relative">
                                            <span className="absolute left-2.5 top-2.5 text-slate-500 text-xs">S/</span>
                                            <Input
                                                id="amountBI"
                                                type="number"
                                                value={amountBI}
                                                onChange={(e) => setAmountBI(e.target.value)}
                                                placeholder="0.00"
                                                className="pl-7 bg-[#22203A] border-[#3D3B5C] text-white font-mono"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-500">
                                            Sin IGV: el monto completo afecta el gasto y la salida de caja.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2 p-3 rounded-lg border border-slate-700/50 bg-slate-800/20">
                            <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-1">4. Detalle y sustento</p>
                            <Label htmlFor="description" className="text-xs font-medium text-slate-400">
                                Descripción del gasto
                            </Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describa brevemente en qué se incurrió (opcional pero recomendado)…"
                                className="bg-[#22203A] border-[#3D3B5C] text-white placeholder:text-slate-600 min-h-[72px]"
                            />
                        </div>

                        <Button
                            className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-bold mt-1"
                            onClick={handleRegisterExpense}
                            disabled={
                                availablePettyBalance.closed ||
                                (docIdentityComplete && !matchedProvider) ||
                                (docIdentityComplete && matchedProvider && !hasPettyConfig) ||
                                (hasPettyConfig && !expenseCategoryOptions.includes(category)) ||
                                !Number.isFinite(total) ||
                                total <= 0 ||
                                (!availablePettyBalance.closed &&
                                    availablePettyBalance.balance - total < -0.009)
                            }
                            title={
                                availablePettyBalance.closed
                                    ? 'Semana cerrada: no se registran gastos'
                                    : docIdentityComplete && !matchedProvider
                                      ? 'El documento de identidad no está en el directorio: Contabilidad debe ingresar al proveedor'
                                      : docIdentityComplete && matchedProvider && !hasPettyConfig
                                        ? 'Falta configurar motivos de caja chica (Contabilidad en Proveedores)'
                                        : hasPettyConfig && !expenseCategoryOptions.includes(category)
                                          ? 'Seleccione un motivo válido'
                                          : !Number.isFinite(total) || total <= 0
                                            ? 'Indique montos válidos (total a pagar > 0)'
                                            : availablePettyBalance.balance - total < -0.009
                                              ? 'El total supera el saldo disponible'
                                              : undefined
                            }
                        >
                            Registrar salida
                        </Button>
                    </div>
                    
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 text-xs text-slate-400 space-y-1">
                         <div className="flex items-center gap-1.5 text-blue-400 font-medium mb-1">
                            <Info className="w-3.5 h-3.5" />
                            Política de Caja Chica
                         </div>
                         <ul className="list-disc pl-4 space-y-0.5 text-slate-400">
                            <li>Rendición de cuentas: Todos los días <strong>Lunes</strong>.</li>
                            <li>Siempre solicitar <strong>Factura</strong> para sustentar gastos.</li>
                            <li>Gastos mayores a <strong>S/ 300.00</strong> requieren aprobación previa.</li>
                         </ul>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="mt-6">
                {activeTab === 'manager' && (
                    <PettyCashManager
                        transactions={transactions}
                        onUpdateTransactions={onUpdateTransactions}
                        settings={settings}
                        users={users}
                        currentUser={currentUser}
                        roles={roles}
                        businessName={businessName}
                        categoryCatalog={commercialCategories}
                        areaCatalog={commercialAreas}
                        sedeOptions={sedeOptions}
                        reportLogoFallback={businessLogo}
                        providers={providers}
                        onRequestProviderRegistration={onRequestProviderRegistration}
                        onClosePettyCashWeek={onClosePettyCashWeek}
                        onPreClosePettyCashWeek={onPreClosePettyCashWeek}
                    />
                )}

                {canAccessConsolidated && activeTab === 'consolidated' && (
                    <CashMovements 
                        transactions={transactions} 
                        visibleSedes={sedeOptions}
                        canUseConsolidatedOption
                        commercialCategories={commercialCategories}
                        commercialAreas={commercialAreas}
                        weekClosures={settings.weekClosures}
                        custodianUsers={users}
                        defaultFundLimit={settings.totalFundLimit}
                    />
                )}

                {showAuditTab && activeTab === 'audit' && (
                    <PettyCashAuditConsole
                        transactions={transactions}
                        users={users}
                        currentUser={currentUser}
                        roles={roles}
                        visibleSedes={sedeOptions}
                        onUpdateTransactions={onUpdateTransactions}
                        commercialCategories={commercialCategories}
                        commercialAreas={commercialAreas}
                    />
                )}

                {activeTab === 'analytics' && (
                    <PettyCashAnalytics transactions={transactions} visibleSedes={sedeOptions} />
                )}
            </div>
        </div>
    );
}
