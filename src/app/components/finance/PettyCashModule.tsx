import React, { useState, useEffect, useMemo } from 'react';
import { PettyCashManager } from './PettyCashManager';
import { CashMovements } from './CashMovements';
import { PettyCashAnalytics } from './PettyCashAnalytics';
import {
    AccountingLinkSettings,
    ChartOfAccountEntry,
    PettyCashTransaction,
    PettyCashSettings,
    User,
    PettyCashWeekClosure,
    PettyCashWeekPreClosure,
    PettyCashFundDelivery,
    Provider,
} from '../../types';
import type { Role } from '../users/types';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import {
    Wallet,
    TrendingUp,
    BarChart2,
    Table2,
    Plus,
    Info,
    Building2,
    AlertTriangle,
    ShieldCheck,
    Printer,
} from 'lucide-react';
import { canApprovePettyCashMovements } from '../../utils/pettyCashAudit';
import { mergeProviderUsageContexts } from '../../utils/providerAccounting';
import { getPettyCashWeekKey } from '../../utils/pettyCashWeekKey';
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
import { getWeekOpeningBreakdown } from '../../utils/pettyCashWeekOpening';
import { getUserOpeningCarryState } from '../../utils/pettyCashOpeningCarry';
import { receiptTypeUsesIgv } from '../../utils/pettyCashReceiptType';
import {
    getDocIdentityDigitLimit,
    isCompleteDocIdentity,
    normalizeDocIdentityDigits,
} from '../../utils/pettyCashDocIdentity';
import { formatCurrencyEs, formatNumberEs } from '../../utils/numberFormat';
import { PettyCashPrintableFormsDialog } from './PettyCashPrintableFormsDialog';
import { PettyCashJournalPreview } from './PettyCashJournalPreview';
import { effectivePettyCashFundLimit, userHasPettyCashFund } from '../../utils/pettyCashFund';

function pettyConfigKey(value: string | undefined) {
    return (value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

interface PettyCashModuleProps {
    transactions: PettyCashTransaction[];
    onUpdateTransactions: (txs: PettyCashTransaction[]) => void | Promise<boolean>;
    settings: PettyCashSettings;
    users: User[];
    currentUser: User;
    /** Roles del sistema (permisos Auditoría + Caja Chica para consola de auditoría). */
    roles?: Role[];
    visibleSedes?: string[];
    /** Consolidado multi-sede: solo usuarios con todas las sedes. */
    canAccessConsolidated?: boolean;
    businessName?: string;
    businessLegalName?: string;
    businessRuc?: string;
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
    /** Auditoría confirma entrega de dotación semanal. */
    onConfirmFundDelivery?: (delivery: PettyCashFundDelivery) => void;
    onConsumeOpeningCarry?: (custodianId: string) => void;
    /** Super admin revoca dotación confirmada (elimina registro en settings). */
    onRevokeFundDelivery?: (custodianId: string, weekNumber: string) => void;
    /** Actualiza opciones globales de caja chica (p. ej. correlativos de recibo imprimibles). */
    onPettyCashSettingsPatch?: (patch: Partial<PettyCashSettings>) => void;
    /** Plan de cuentas importado y enlaces contables para vista previa de asientos. */
    chartOfAccounts?: ChartOfAccountEntry[];
    accountingLinks?: AccountingLinkSettings;
    /**
     * Movimientos globales para la vista previa contable (todos los responsables).
     * Si no se informa, se usa el mismo arreglo `transactions`.
     */
    journalPettyCashTransactions?: PettyCashTransaction[];
}

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
    businessLegalName = '',
    businessRuc = '',
    commercialCategories,
    commercialAreas,
    providers = [],
    onRequestProviderRegistration,
    businessLogo,
    onClosePettyCashWeek,
    onPreClosePettyCashWeek,
    onConfirmFundDelivery,
    onConsumeOpeningCarry,
    onRevokeFundDelivery,
    onPettyCashSettingsPatch,
    chartOfAccounts = [],
    accountingLinks,
    journalPettyCashTransactions,
}: PettyCashModuleProps) {
    const txsForAccountingPreview = journalPettyCashTransactions ?? transactions;
    const accountingForJournal = accountingLinks ?? {};
    const [activeTab, setActiveTab] = useState('manager');
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [printFormsOpen, setPrintFormsOpen] = useState(false);
    /** Semana contable donde el usuario registra gastos (no depende de la fecha del comprobante). */
    const [registrationWeek, setRegistrationWeek] = useState<string>(() => getPettyCashWeekKey(new Date()));

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

    const resetExpenseForm = () => {
        setAmountBI('');
        setAmountExempt('');
        setDescription('');
        setDocSeries('');
        setVoucherNumber('');
        setDocNumber('');
        setProviderName('');
        setCategory(commercialCategories[0] || 'Otros');
        setClassification('Boleta');
        setDocType('RUC');
        setArea('');
        setIsExtraExpense(false);
        setInvoiceIgv10(false);
        setDocumentDate(format(new Date(), 'yyyy-MM-dd'));
        setLocation(sedeOptions[0] || currentUser.location || 'Principal');
    };
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

    const providerAllowsPettyCash = useMemo(
        () =>
            matchedProvider ? mergeProviderUsageContexts(matchedProvider.usageContexts).pettyCash : true,
        [matchedProvider],
    );

    const docIdentityLimit = getDocIdentityDigitLimit(docType);
    const docIdentityComplete = isCompleteDocIdentity(docType, normalizedDoc);

    const expenseCategoryOptions = useMemo(() => {
        if (!docIdentityComplete || !matchedProvider || !providerAllowsPettyCash) return [] as string[];
        const areaKey = pettyConfigKey(area);
        const lines =
            matchedProvider.pettyExpenseLines?.filter((l) => {
                if (!l.commercialCategory?.trim()) return false;
                const lineAreaKey = pettyConfigKey(l.commercialArea);
                return !areaKey || !lineAreaKey || lineAreaKey === areaKey;
            }) ?? [];
        if (lines.length === 0) return [] as string[];
        const s = new Set(lines.map((l) => l.commercialCategory.trim()));
        return commercialCategories.filter((c) => s.has(c));
    }, [docIdentityComplete, matchedProvider, commercialCategories, providerAllowsPettyCash, area]);

    const hasPettyConfig = providerAllowsPettyCash && expenseCategoryOptions.length > 0;
    const suggestedAccountingAccount = useMemo(() => {
        if (!matchedProvider || !category) return undefined;
        const catKey = pettyConfigKey(category);
        const areaKey = pettyConfigKey(area);
        const lines = matchedProvider.pettyExpenseLines ?? [];
        const line =
            lines.find(
                (l) =>
                    pettyConfigKey(l.commercialCategory) === catKey &&
                    pettyConfigKey(l.commercialArea) === areaKey &&
                    l.defaultAccountingAccount?.trim()
            ) ??
            lines.find(
                (l) =>
                    pettyConfigKey(l.commercialCategory) === catKey &&
                    !pettyConfigKey(l.commercialArea) &&
                    l.defaultAccountingAccount?.trim()
            );
        return line?.defaultAccountingAccount?.trim() || undefined;
    }, [matchedProvider, category, area]);

    useEffect(() => {
        if (category && expenseCategoryOptions.length > 0 && !expenseCategoryOptions.includes(category)) {
            setCategory(expenseCategoryOptions[0] || '');
        }
    }, [category, expenseCategoryOptions]);

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
        const configuredAreas =
            matchedProvider?.pettyExpenseLines
                ?.map((l) => l.commercialArea?.trim())
                .filter((a): a is string => !!a && commercialAreas.includes(a)) ?? [];
        if (configuredAreas.length > 0) {
            if (area && configuredAreas.includes(area)) return;
            const providerArea = (matchedProvider?.area || '').trim();
            setArea(providerArea && configuredAreas.includes(providerArea) ? providerArea : configuredAreas[0]!);
            return;
        }
        const providerArea = (matchedProvider?.area || '').trim();
        if (providerArea && commercialAreas.includes(providerArea)) {
            if (area !== providerArea) setArea(providerArea);
            return;
        }
        if (area && !commercialAreas.includes(area)) {
            setArea('');
        }
    }, [commercialAreas, area, matchedProvider?.id, matchedProvider?.area]);

    useEffect(() => {
        if (!receiptTypeUsesIgv(classification)) {
            setInvoiceIgv10(false);
            setAmountExempt('');
        }
    }, [classification]);

    /** Saldo y cierre según la semana seleccionada en el manager, no la fecha del comprobante. */
    const availablePettyBalance = useMemo(() => {
        const limit = effectivePettyCashFundLimit(currentUser, settings.totalFundLimit);
        if (limit <= 0) {
            return { closed: false as const, balance: 0, weekLabel: '' as string, deliveryPending: false, carryOnly: 0 };
        }
        const w = registrationWeek;
        const fundDeliveries = settings.fundDeliveries ?? [];
        const openingCarry = getUserOpeningCarryState(currentUser);
        const opening = getWeekOpeningBreakdown(
            currentUser.id,
            w,
            settings.weekClosures,
            fundDeliveries,
            limit,
            openingCarry
        );
        if (isPettyCashWeekClosedForCustodian(currentUser.id, w, settings.weekClosures)) {
            return { closed: true as const, balance: 0, weekLabel: w, deliveryPending: false, carryOnly: 0 };
        }
        const balance = getPettyCashWeekBalance(
            transactions,
            currentUser.id,
            w,
            settings.weekClosures,
            limit,
            fundDeliveries,
            openingCarry
        );
        return {
            closed: false as const,
            balance,
            weekLabel: w,
            deliveryPending: opening.deliveryPending,
            carryOnly: opening.carryFromPrevious,
        };
    }, [
        transactions,
        settings.weekClosures,
        settings.fundDeliveries,
        settings.totalFundLimit,
        currentUser.id,
        currentUser.pettyCashLimit,
        currentUser.pettyCashFundEnabled,
        currentUser.pettyCashOpeningCarrySuggested,
        currentUser.pettyCashOpeningCarryConsumedAt,
        registrationWeek,
    ]);

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
        if (matchedProvider && !providerAllowsPettyCash) {
            return 'Este RUC no está habilitado para caja chica. Contabilidad puede activar «Caja chica» en la ficha del proveedor (ámbito de módulos).';
        }
        if (!hasPettyConfig) return 'Este proveedor aún no tiene motivos de caja chica: es tarea de Contabilidad en Proveedores.';
        return 'Solo se listan los motivos habilitados para este proveedor.';
    }, [docIdentityComplete, matchedProvider, hasPettyConfig, providerAllowsPettyCash]);

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
        if (matchedProvider && !providerAllowsPettyCash) {
            toast.error('Proveedor excluido de caja chica', {
                description:
                    'En Proveedores → Editar, active «Caja chica» en el bloque de ámbito de módulos, o use otro RUC habilitado.',
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

        if (!userHasPettyCashFund(currentUser)) {
            toast.error('Su usuario no tiene fondo fijo asignado.');
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

        let docDateParsed: Date;
        try {
            docDateParsed = documentDate
                ? new Date(documentDate + 'T12:00:00')
                : new Date();
        } catch {
            docDateParsed = new Date();
        }
        if (Number.isNaN(docDateParsed.getTime())) docDateParsed = new Date();

        const weekStr = registrationWeek;
        const custodianId = currentUser.id;
        const fundLimit = effectivePettyCashFundLimit(currentUser, settings.totalFundLimit);
        if (fundLimit <= 0) {
            toast.error('No hay fondo disponible para este usuario.');
            return;
        }

        if (isPettyCashWeekClosedForCustodian(custodianId, weekStr, settings.weekClosures)) {
            toast.error('Esta semana ya está cerrada para su caja; no puede registrar más gastos en ella.');
            return;
        }

        const balanceBefore = getPettyCashWeekBalance(
            transactions,
            custodianId,
            weekStr,
            settings.weekClosures,
            fundLimit,
            settings.fundDeliveries
        );
        if (balanceBefore - totalVal < -0.009) {
            const pendingMsg = availablePettyBalance.deliveryPending
                ? ` Dotación semanal pendiente: solo puede usar el arrastre (${formatCurrencyEs(availablePettyBalance.carryOnly)}).`
                : '';
            toast.error('Saldo insuficiente en caja chica.', {
                description: `Disponible: ${formatCurrencyEs(balanceBefore)} · Gasto: ${formatCurrencyEs(totalVal)}.${pendingMsg}`,
            });
            return;
        }

        if (settings.maxTransactionAmount > 0 && totalVal > settings.maxTransactionAmount + 0.009) {
            toast.error('El monto supera el tope por comprobante configurado.', {
                description: `Tope actual: ${formatCurrencyEs(settings.maxTransactionAmount)} (Configuración → Contabilidad).`,
            });
            return;
        }

        const weekForEntry = registrationWeek;

        const newExpense: PettyCashTransaction = {
            id: `pc-${Date.now()}`,
            date: docDateParsed,
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
            weekNumber: weekForEntry,
            custodianId: currentUser.id,
            type: 'expense',
            location: sedeOptions.includes(location) ? location : sedeOptions[0],
        };

        onUpdateTransactions([newExpense, ...transactions]).then((saved) => {
            if (saved === false) {
                toast.error('El gasto no quedó guardado en la nube. No cierres sesión hasta reintentar.');
                return;
            }
            resetExpenseForm();
            toast.success('Gasto guardado correctamente', {
                description: `Semana ${weekForEntry} · Total: ${formatCurrencyEs(totalVal)} (${classification}). Puede registrar otro gasto.`,
            });
        });
    };

    return (
        <div className="space-y-6" data-testid="petty-cash-module">
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
                        <TabsTrigger value="journal-preview" className="flex items-center gap-2 shrink-0">
                            <Table2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Vista asientos</span>
                            <span className="sm:hidden">Asientos</span>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="flex flex-wrap gap-2 justify-end shrink-0">
                    <Button
                        type="button"
                        variant="outline"
                        className="border-[#3D3B5C] bg-transparent text-[#e4e0ff] hover:bg-white/10"
                        onClick={() => setPrintFormsOpen(true)}
                        disabled={sedeOptions.length === 0}
                        title="Recibo interno y planilla de movilidad (serie y correlativo global)"
                    >
                        <Printer className="mr-2 h-4 w-4 shrink-0" />
                        Recibo / Planilla
                    </Button>
                    <Button 
                        onClick={() => setIsExpenseModalOpen(true)}
                        className="bg-cyan-500 hover:bg-cyan-600 text-black font-medium"
                        disabled={sedeOptions.length === 0}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Registrar Gasto
                    </Button>
                </div>
            </div>

            <PettyCashPrintableFormsDialog
                open={printFormsOpen}
                onOpenChange={setPrintFormsOpen}
                businessName={businessName}
                businessLegalName={businessLegalName}
                businessRuc={businessRuc}
                settings={settings}
                currentUserName={currentUser.name || 'Usuario'}
                sede={sedeOptions.includes(location) ? location : defaultSede}
                onPatchPettyCash={(patch) => {
                    onPettyCashSettingsPatch?.(patch);
                }}
            />

            <Dialog open={isExpenseModalOpen} onOpenChange={setIsExpenseModalOpen}>
                <DialogContent
                    className="w-[97vw] sm:max-w-[980px] h-auto bg-[#161427]/95 border-[#3D3B5C]/70 text-white max-h-[calc(100vh-2rem)] overflow-y-auto shadow-[0_35px_120px_rgba(0,0,0,0.7)]"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-cyan-400">
                            <Plus className="h-5 w-5" />
                            Registrar Gasto
                        </DialogTitle>
                        <DialogDescription className="text-sm text-slate-400">
                            Salida de dinero de la caja de <span className="text-white font-medium">{currentUser.name}</span>.
                            Tras cada registro puede seguir cargando comprobantes; para salir use la <span className="text-slate-200">X</span> (no se cierra al hacer clic fuera).
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
                    ) : availablePettyBalance.deliveryPending ? (
                        <Alert className="border-amber-600/50 bg-amber-950/30 text-amber-100">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle className="text-sm">Dotación semanal pendiente</AlertTitle>
                            <AlertDescription className="text-xs text-amber-200/90">
                                Puede registrar gastos solo hasta el arrastre (
                                {formatCurrencyEs(availablePettyBalance.carryOnly)}). El fondo fijo de la semana lo
                                confirmará auditoría al entregar el efectivo.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <div className="rounded-lg border border-cyan-900/40 bg-cyan-950/25 px-3 py-2 text-sm">
                            <span className="text-slate-400">
                                Saldo disponible{' '}
                                {availablePettyBalance.weekLabel
                                    ? `(semana ${availablePettyBalance.weekLabel})`
                                    : ''}
                                :{' '}
                            </span>
                            <span className="font-mono font-semibold text-cyan-300">
                                {formatCurrencyEs(availablePettyBalance.balance)}
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
                                    {formatNumberEs(availablePettyBalance.balance - total)}
                                </span>
                            ) : null}
                        </div>
                    )}
                    
                    <div className="grid gap-4 py-4 lg:grid-cols-[1.25fr_1fr]">
                        <div className="space-y-4">
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
                                <Select
                                    value={area || '__choose__'}
                                    onValueChange={(v) => setArea(v === '__choose__' ? '' : v)}
                                >
                                    <SelectTrigger className="bg-[#22203A] border-[#3D3B5C] text-white">
                                        <SelectValue placeholder="Seleccionar área" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#22203A] border-[#3D3B5C] text-white">
                                        <SelectItem value="__choose__">Seleccionar área</SelectItem>
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
                                    Fecha del documento (comprobante)
                                </Label>
                                <Input
                                    id="voucherDate"
                                    type="date"
                                    value={documentDate}
                                    onChange={(e) => setDocumentDate(e.target.value)}
                                    className="bg-[#22203A] border-[#3D3B5C] text-white"
                                />
                                <p className="text-[10px] text-slate-500">
                                    La rendición usa la semana seleccionada arriba ({registrationWeek}), no la fecha del comprobante.
                                </p>
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
                                    <Select
                                        value={docType}
                                        onValueChange={(val) => {
                                            setDocType(val);
                                            setDocNumber((prev) => normalizeDocIdentityDigits(prev, val));
                                        }}
                                    >
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
                                        className={`text-[11px] ${
                                            matchedProvider && !providerAllowsPettyCash
                                                ? 'text-rose-400'
                                                : matchedProvider
                                                  ? 'text-emerald-400'
                                                  : 'text-amber-400'
                                        }`}
                                    >
                                        {matchedProvider
                                            ? !providerAllowsPettyCash
                                                ? `${docType} validado: RUC excluido de caja chica en ficha (Contabilidad puede habilitarlo).`
                                                : `${docType} validado: proveedor en catálogo${
                                                      hasPettyConfig
                                                          ? ' (motivos de caja chica listos)'
                                                          : ' (falta configurar motivos — Contabilidad)'
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

                        </div>

                        <div className="space-y-4">
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
                                            Sin cuenta 62/63/64/65 asignada a este motivo: contabilidad puede completarla en
                                            Proveedores.
                                        </span>
                                    )}
                                </div>
                            )}

                            {matchedProvider && !providerAllowsPettyCash && docIdentityComplete && (
                                <Alert className="border-red-800/50 bg-red-950/30 text-red-100">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle className="text-sm">Caja chica desactivada para este RUC</AlertTitle>
                                    <AlertDescription className="text-xs text-red-200/90 block space-y-1">
                                        <p>
                                            En su ficha de proveedor está desmarcada la opción <strong>Caja chica</strong>
                                            (Proveedores → Editar → «Ámbito y cuentas (módulos)»). Contabilidad puede habilitarla
                                            o usar un proveedor distinto.
                                        </p>
                                    </AlertDescription>
                                </Alert>
                            )}

                            {matchedProvider && providerAllowsPettyCash && !hasPettyConfig && docIdentityComplete && (
                                <Alert className="border-amber-700/50 bg-amber-950/30 text-amber-100">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle className="text-sm">Falta configuración en el proveedor</AlertTitle>
                                    <AlertDescription className="text-xs text-amber-200/90 block space-y-1">
                                        <p>
                                            Este proveedor aún no tiene motivos de caja chica. Solicite a <strong>Contabilidad</strong> que
                                            abra <strong>Proveedores</strong>, edite al proveedor y complete «Caja chica: motivos
                                            permitidos».
                                        </p>
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
                                                    value={badBi ? '—' : Number.isFinite(igv) ? formatNumberEs(igv) : '—'}
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
                                                            ? formatNumberEs(total)
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

                        </div>

                        <div className="lg:col-span-2">
                        <Button
                            className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-bold mt-1 h-11 text-sm"
                            onClick={handleRegisterExpense}
                            disabled={
                                availablePettyBalance.closed ||
                                !area.trim() ||
                                !providerName.trim() ||
                                !docSeries.trim() ||
                                !voucherNumber.trim() ||
                                (docIdentityComplete && !matchedProvider) ||
                                (docIdentityComplete && matchedProvider && !providerAllowsPettyCash) ||
                                (docIdentityComplete && matchedProvider && !hasPettyConfig) ||
                                (hasPettyConfig && !expenseCategoryOptions.includes(category)) ||
                                !Number.isFinite(total) ||
                                total <= 0 ||
                                (!availablePettyBalance.closed &&
                                    availablePettyBalance.balance - total < -0.009)
                            }
                            title={
                                availablePettyBalance.closed
                                    ? 'Semana del comprobante cerrada: no se registran más gastos en ella'
                                    : !area.trim()
                                      ? 'Seleccione área solicitante'
                                    : !providerName.trim()
                                      ? 'Complete o confirme el nombre del proveedor'
                                    : !docSeries.trim() || !voucherNumber.trim()
                                      ? 'Indique serie y número de comprobante'
                                      : docIdentityComplete && !matchedProvider
                                      ? 'El documento de identidad no está en el directorio: Contabilidad debe ingresar al proveedor'
                                      : docIdentityComplete && matchedProvider && !providerAllowsPettyCash
                                        ? 'Proveedor excluido de caja chica: active «Caja chica» en la ficha (Proveedores)'
                                      : docIdentityComplete && matchedProvider && !hasPettyConfig
                                        ? 'Falta configurar motivos de caja chica (Contabilidad en Proveedores)'
                                        : hasPettyConfig && !expenseCategoryOptions.includes(category)
                                          ? 'Seleccione un motivo válido'
                                          : !Number.isFinite(total) || total <= 0
                                            ? 'Indique montos válidos (total a pagar > 0)'
                                            : availablePettyBalance.balance - total < -0.009
                                              ? 'El total supera el saldo disponible (semana seleccionada)'
                                              : undefined
                            }
                        >
                            Registrar salida
                        </Button>
                        </div>
                    </div>
                    
                    <div className="bg-slate-900/45 border border-slate-700/40 rounded-lg p-3 text-xs text-slate-400 space-y-1 opacity-90">
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
                        onConfirmFundDelivery={onConfirmFundDelivery}
                        onConsumeOpeningCarry={onConsumeOpeningCarry}
                        onRevokeFundDelivery={onRevokeFundDelivery}
                        selectedWeek={registrationWeek}
                        onSelectedWeekChange={setRegistrationWeek}
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
                        fundDeliveries={settings.fundDeliveries}
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

                {activeTab === 'journal-preview' && (
                    <PettyCashJournalPreview
                        pettyCashTransactions={txsForAccountingPreview}
                        providers={providers}
                        chartOfAccounts={chartOfAccounts}
                        accounting={accountingForJournal}
                        users={users}
                    />
                )}
            </div>
        </div>
    );
}
