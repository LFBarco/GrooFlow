import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
    TrendingDown, 
    Filter, 
    AlertCircle, 
    Printer,
    Search,
    UserCircle,
    Lock,
    Pencil,
    Trash2,
    ClipboardCheck,
    CheckCircle2,
    XCircle,
    Banknote,
} from 'lucide-react';
import { format, startOfWeek } from 'date-fns';
import { receiptTypeUsesIgv } from '../../utils/pettyCashReceiptType';
import {
    getDocIdentityDigitLimit,
    isCompleteDocIdentity,
    normalizeDocIdentityDigits,
} from '../../utils/pettyCashDocIdentity';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import {
    PettyCashTransaction,
    PettyCashSettings,
    User,
    PettyCashWeekClosure,
    PettyCashWeekPreClosure,
    PettyCashFundDelivery,
} from '../../types';
import type { Role } from '../users/types';
import { mergePettyCashRenditionPrint } from '../../data/initialData';
import { weekRangeFromCalendarWeek, weekRangeFromTransactions } from '../../utils/pettyCashWeekRange';
import { getWeekOpeningBreakdown, isWeekClosed, findFundDeliveryForWeek } from '../../utils/pettyCashWeekOpening';
import { getUserOpeningCarryState } from '../../utils/pettyCashOpeningCarry';
import { getPettyCashWeekBalance } from '../../utils/pettyCashBalance';
import { findPettyCashDuplicate, canModifyPettyCashExpense } from '../../utils/pettyCashDocDuplicate';
import { isWeekPreClosed } from '../../utils/pettyCashPreClose';
import {
    canApprovePettyCashMovements,
    allPettyCashWeekMovementsApproved,
    canAdminFundTopUp,
    canConfirmPettyCashFundDelivery,
    ADMIN_FUND_TOPUP_CATEGORY,
    FUND_DELIVERY_CATEGORY,
    isAdminTopUpIncome,
    isFundDeliveryIncome,
    isReplenishmentIncome,
} from '../../utils/pettyCashAudit';
import { userHasGlobalSedeAccess } from '../../utils/roleAccess';
import { formatCurrencyEs, formatNumberEs } from '../../utils/numberFormat';
import {
    canSelectMultiplePettyCashCustodians,
    filterPettyCashCustodianUsersForViewer,
} from '../../utils/pettyCashCustodianVisibility';
import { effectivePettyCashFundLimit, userHasPettyCashFund } from '../../utils/pettyCashFund';
import { getPettyCashWeekKey, parsePettyCashWeekKey, weekKeyMatches } from '../../utils/pettyCashWeekKey';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Checkbox } from '../ui/checkbox';

// --- Helper to get ISO-like year-week key for petty cash ---
const getWeekStr = (date: Date) => getPettyCashWeekKey(date);

const LEGACY_CATEGORY_STYLES: Record<string, { label: string; color: string }> = {
    Movilidad: { label: 'Movilidad / Taxi', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    Refrigerio: { label: 'Alimentación', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    'Insumos Limpieza': { label: 'Insumos Limpieza', color: 'bg-green-100 text-green-700 border-green-200' },
    'Material Oficina': { label: 'Útiles de Oficina', color: 'bg-purple-100 text-purple-700 border-purple-200' },
    'Mantenimiento Menor': { label: 'Mantenimiento', color: 'bg-slate-100 text-slate-700 border-slate-200' },
    Otros: { label: 'Otros', color: 'bg-gray-100 text-gray-700 border-gray-200' },
    Reposición: { label: 'Reposición', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
};

const CATEGORY_COLOR_ROTATION = [
    'bg-indigo-100 text-indigo-800 border-indigo-200',
    'bg-rose-100 text-rose-800 border-rose-200',
    'bg-amber-100 text-amber-900 border-amber-200',
    'bg-teal-100 text-teal-800 border-teal-200',
    'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
];

function buildCategoryStyleMap(catalog: string[]): Record<string, { label: string; color: string }> {
    const out: Record<string, { label: string; color: string }> = { ...LEGACY_CATEGORY_STYLES };
    catalog.forEach((name, i) => {
        if (!out[name]) {
            out[name] = {
                label: name,
                color: CATEGORY_COLOR_ROTATION[i % CATEGORY_COLOR_ROTATION.length],
            };
        }
    });
    return out;
}

interface PettyCashManagerProps {
    transactions: PettyCashTransaction[];
    onUpdateTransactions: (txs: PettyCashTransaction[]) => void;
    settings: PettyCashSettings;
    users: User[];
    currentUser: User;
    roles?: Role[];
    businessName?: string;
    /** Categorías comerciales (Configuración → Contabilidad). */
    categoryCatalog: string[];
    /** Áreas comerciales (edición de gasto). */
    areaCatalog?: string[];
    /** Sedes visibles para el usuario (edición de sede del movimiento). */
    sedeOptions?: string[];
    /** Logo general del negocio si no hay logo específico de rendición. */
    reportLogoFallback?: string;
    /** Catálogo de proveedores (validación documento / razón social en edición). */
    providers?: { id: string; ruc: string; name: string }[];
    /** Abre Proveedores para alta rápida si el documento no está en catálogo. */
    onRequestProviderRegistration?: () => void;
    onClosePettyCashWeek?: (closure: PettyCashWeekClosure) => void;
    onPreClosePettyCashWeek?: (pre: PettyCashWeekPreClosure) => void;
    /** Auditoría confirma entrega de dotación semanal (fondo fijo). */
    onConfirmFundDelivery?: (delivery: PettyCashFundDelivery) => void;
    /** Marca arrastre de apertura consumido en el usuario (apertura de periodo). */
    onConsumeOpeningCarry?: (custodianId: string) => void;
    /** Super admin revoca dotación semanal confirmada. */
    onRevokeFundDelivery?: (custodianId: string, weekNumber: string) => void;
    /** Semana contable activa (controlada desde el módulo padre para alinear registro de gastos). */
    selectedWeek?: string;
    onSelectedWeekChange?: (week: string) => void;
}

function pettyCashStatusLabel(status: PettyCashTransaction['status']): string {
    switch (status) {
        case 'approved':
            return 'Aprobado';
        case 'pending_audit':
            return 'Pend. auditoría';
        case 'rejected':
            return 'Rechazado';
        case 'voided':
            return 'Anulado';
        default:
            return status;
    }
}

function escHtml(s: string) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function PettyCashManager({
    transactions,
    onUpdateTransactions,
    settings,
    users,
    currentUser,
    roles = [],
    businessName = 'GrooFlow',
    categoryCatalog,
    areaCatalog = [],
    sedeOptions = [],
    reportLogoFallback,
    providers = [],
    onRequestProviderRegistration,
    onClosePettyCashWeek,
    onPreClosePettyCashWeek,
    onConfirmFundDelivery,
    onConsumeOpeningCarry,
    onRevokeFundDelivery,
    selectedWeek: selectedWeekProp,
    onSelectedWeekChange,
}: PettyCashManagerProps) {
    const [selectedWeekInternal, setSelectedWeekInternal] = useState<string>(getWeekStr(new Date()));
    const selectedWeek = selectedWeekProp ?? selectedWeekInternal;
    const setSelectedWeek = (week: string) => {
        if (onSelectedWeekChange) onSelectedWeekChange(week);
        else setSelectedWeekInternal(week);
    };
    const [searchTerm, setSearchTerm] = useState('');

    const [editOpen, setEditOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editAmountBI, setEditAmountBI] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editCategory, setEditCategory] = useState('');
    const [editClassification, setEditClassification] = useState<string>('Boleta');
    const [editDocType, setEditDocType] = useState<string>('RUC');
    const [editDocNumber, setEditDocNumber] = useState('');
    const [editDocSeries, setEditDocSeries] = useState('');
    const [editVoucherNumber, setEditVoucherNumber] = useState('');
    const [editProviderName, setEditProviderName] = useState('');
    const [editArea, setEditArea] = useState('');
    const [editIsExtra, setEditIsExtra] = useState(false);
    const [editLocation, setEditLocation] = useState('');
    const [editDocumentDate, setEditDocumentDate] = useState('');
    const [editInvoiceIgv10, setEditInvoiceIgv10] = useState(false);
    const [editAmountExempt, setEditAmountExempt] = useState('');

    const [topupOpen, setTopupOpen] = useState(false);
    const [topupAmount, setTopupAmount] = useState('');
    const [topupNote, setTopupNote] = useState('');
    const [topupSede, setTopupSede] = useState('');

    const [deliveryOpen, setDeliveryOpen] = useState(false);
    const [deliveryAmount, setDeliveryAmount] = useState('');
    const [deliveryCarryAmount, setDeliveryCarryAmount] = useState('');
    const [deliveryReason, setDeliveryReason] = useState('');

    const fundDeliveries = settings.fundDeliveries ?? [];

    const categoryStyles = useMemo(
        () => buildCategoryStyleMap(categoryCatalog),
        [categoryCatalog.join('|')]
    );

    const editNormDoc = useMemo(
        () => normalizeDocIdentityDigits(editDocNumber, editDocType),
        [editDocNumber, editDocType]
    );
    const editDocIdentityLimit = getDocIdentityDigitLimit(editDocType);
    const editDocIdentityComplete = isCompleteDocIdentity(editDocType, editNormDoc);
    const editCatalogMatch = useMemo(() => {
        if (!editDocIdentityComplete) return null;
        return (
            providers.find((p) => (p.ruc || '').replace(/\D/g, '') === editNormDoc) || null
        );
    }, [providers, editNormDoc, editDocIdentityComplete]);

    useEffect(() => {
        if (!editOpen) return;
        setEditDocNumber((d) => normalizeDocIdentityDigits(d, editDocType));
    }, [editDocType, editOpen]);

    useEffect(() => {
        if (!editOpen || !editCatalogMatch) return;
        setEditProviderName((prev) =>
            prev.trim() === editCatalogMatch.name ? prev : editCatalogMatch.name
        );
    }, [editOpen, editCatalogMatch]);

    const viewerSeesAllSedes = useMemo(
        () => userHasGlobalSedeAccess(currentUser),
        [currentUser]
    );

    const canPickMultipleCustodians = useMemo(
        () => canSelectMultiplePettyCashCustodians(currentUser, roles),
        [currentUser, roles]
    );

    // Responsables visibles: solo el propio usuario salvo auditoría / admin / super / gerencia (y sedes acordes).
    const custodians = useMemo(
        () =>
            filterPettyCashCustodianUsersForViewer(
                users,
                currentUser,
                sedeOptions,
                viewerSeesAllSedes,
                roles
            ),
        [users, currentUser, sedeOptions, viewerSeesAllSedes, roles]
    );

    // Determine default custodian
    const defaultCustodianId = useMemo(() => {
        if (custodians.find((c) => c.id === currentUser.id)) return currentUser.id;
        if (custodians.length > 0) return custodians[0].id;
        return currentUser.id;
    }, [currentUser, custodians]);

    const [selectedCustodianId, setSelectedCustodianId] = useState<string>(defaultCustodianId);

    // Update selectedCustodianId when default changes (e.g. data loaded)
    useEffect(() => {
        if (!selectedCustodianId && defaultCustodianId) {
            setSelectedCustodianId(defaultCustodianId);
        }
    }, [defaultCustodianId, selectedCustodianId]);

    /** Si el responsable actual ya no está en la lista filtrada, volver al usuario o al primero. */
    useEffect(() => {
        if (custodians.length === 0) return;
        if (!custodians.some((c) => c.id === selectedCustodianId)) {
            const next =
                custodians.find((c) => c.id === currentUser.id)?.id ?? custodians[0]?.id ?? '';
            if (next) setSelectedCustodianId(next);
        }
    }, [custodians, selectedCustodianId, currentUser.id]);

    useEffect(() => {
        const first = sedeOptions[0];
        if (!first) return;
        if (!topupSede || !sedeOptions.includes(topupSede)) {
            setTopupSede(first);
        }
    }, [sedeOptions, topupSede]);

    const selectedCustodian = users.find(u => u.id === selectedCustodianId);
    const isSuperAdminOnly = currentUser.role === 'super_admin';
    const openingCarryState = useMemo(
        () => getUserOpeningCarryState(selectedCustodian),
        [selectedCustodian]
    );
    /** Límite configurado (referencia); el fondo de apertura de la semana puede ser el arrastre del cierre anterior. */
    const currentLimit = effectivePettyCashFundLimit(selectedCustodian, settings.totalFundLimit);

    // Filter transactions by custodian (y por sedes asignadas si no es vista multi-responsable)
    const custodianTransactions = useMemo(() => {
        if (!selectedCustodianId) return transactions;
        let txs = transactions.filter((t) => t.custodianId === selectedCustodianId);
        if (!canPickMultipleCustodians && sedeOptions.length > 0) {
            txs = txs.filter(
                (t) =>
                    isFundDeliveryIncome(t) ||
                    sedeOptions.includes((t.location || 'Principal').trim())
            );
        }
        return txs;
    }, [transactions, selectedCustodianId, canPickMultipleCustodians, sedeOptions]);

    // Weekly Calculations
    const currentWeekExpenses = useMemo(() => {
        return custodianTransactions.filter((e) => weekKeyMatches(e.weekNumber, selectedWeek));
    }, [custodianTransactions, selectedWeek]);

    const breakdownCategoryKeys = useMemo(() => {
        const s = new Set<string>(categoryCatalog);
        currentWeekExpenses.forEach((e) => {
            if (e.category) s.add(String(e.category));
        });
        return Array.from(s);
    }, [categoryCatalog, currentWeekExpenses]);

    const validWeekTx = (t: PettyCashTransaction) =>
        t.status !== 'voided' && t.status !== 'rejected';

    const weeklyExpenseTotal = currentWeekExpenses
        .filter((t) => validWeekTx(t) && (t.type === 'expense' || !t.type))
        .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    const weeklyIncomeTotal = currentWeekExpenses
        .filter((t) => validWeekTx(t) && t.type === 'income')
        .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    const weeklyReplenishmentIncome = useMemo(
        () =>
            currentWeekExpenses
                .filter((t) => validWeekTx(t) && isReplenishmentIncome(t))
                .reduce((acc, t) => acc + (Number(t.amount) || 0), 0),
        [currentWeekExpenses]
    );

    const weeklyAdminTopupIncome = useMemo(
        () =>
            currentWeekExpenses
                .filter((t) => validWeekTx(t) && isAdminTopUpIncome(t))
                .reduce((acc, t) => acc + (Number(t.amount) || 0), 0),
        [currentWeekExpenses]
    );

    const weekOpening = useMemo(
        () =>
            getWeekOpeningBreakdown(
                selectedCustodianId,
                String(selectedWeek),
                settings.weekClosures,
                fundDeliveries,
                currentLimit,
                openingCarryState
            ),
        [selectedCustodianId, selectedWeek, settings.weekClosures, fundDeliveries, currentLimit, openingCarryState]
    );

    const openingFundForWeek = weekOpening.openingTotal;
    const existingFundDelivery = useMemo(
        () => findFundDeliveryForWeek(selectedCustodianId, String(selectedWeek), fundDeliveries),
        [selectedCustodianId, selectedWeek, fundDeliveries]
    );

    const currentBalance = useMemo(
        () =>
            getPettyCashWeekBalance(
                transactions,
                selectedCustodianId,
                String(selectedWeek),
                settings.weekClosures,
                currentLimit,
                fundDeliveries,
                openingCarryState
            ),
        [
            transactions,
            selectedCustodianId,
            selectedWeek,
            settings.weekClosures,
            currentLimit,
            fundDeliveries,
            openingCarryState,
        ]
    );

    const weekAlreadyClosed = useMemo(
        () => isWeekClosed(selectedCustodianId, String(selectedWeek), settings.weekClosures),
        [selectedCustodianId, selectedWeek, settings.weekClosures]
    );

    const weekPreClosed = useMemo(
        () =>
            isWeekPreClosed(
                selectedCustodianId,
                String(selectedWeek),
                settings.weekPreClosures
            ),
        [selectedCustodianId, selectedWeek, settings.weekPreClosures]
    );

    const allMovementsAuditedApproved = useMemo(
        () => allPettyCashWeekMovementsApproved(currentWeekExpenses),
        [currentWeekExpenses]
    );

    const hasPendingAudit = useMemo(
        () => currentWeekExpenses.some((e) => e.status === 'pending_audit'),
        [currentWeekExpenses]
    );

    const canUserPreCloseWeek =
        !!onPreClosePettyCashWeek &&
        !!selectedCustodianId &&
        !weekAlreadyClosed &&
        !weekPreClosed &&
        selectedCustodianId === currentUser.id &&
        userHasPettyCashFund(currentUser);

    const canAttemptCloseWeek =
        !!onClosePettyCashWeek &&
        !!selectedCustodianId &&
        (selectedCustodianId === currentUser.id ||
            ['admin', 'super_admin', 'manager'].includes(currentUser.role));

    const fundDenominator = Math.max(openingFundForWeek, 1);

    const selectedWeekRangeLabel = useMemo(() => {
        const fromTx = weekRangeFromTransactions(custodianTransactions, String(selectedWeek));
        if (fromTx) return fromTx;
        return weekRangeFromCalendarWeek(String(selectedWeek));
    }, [custodianTransactions, selectedWeek]);
    const selectedCustodianSedeLabel = useMemo(() => {
        if (!selectedCustodian) return 'Principal';
        if (selectedCustodian.allSedes) return 'Todas las sedes';
        if (selectedCustodian.sedes?.length) return selectedCustodian.sedes.join(', ');
        if (selectedCustodian.location?.trim()) return selectedCustodian.location.trim();
        return 'Principal';
    }, [selectedCustodian]);
    const availableWeeks = useMemo(() => {
        const set = new Set<string>();
        /** Permite trabajar histórico desde semana 1 hasta la semana actual del año en curso. */
        const now = new Date();
        const currentWeekKey = getWeekStr(now);
        const parsedCurrent = parsePettyCashWeekKey(currentWeekKey);
        const currentWeek = Math.max(1, parsedCurrent.week ?? 1);
        const year = parsedCurrent.year ?? now.getFullYear();
        for (let w = 1; w <= currentWeek; w++) {
            set.add(`${year}-W${String(w).padStart(2, '0')}`);
        }
        custodianTransactions.forEach((t) => {
            const wk = String(t.weekNumber || '').trim();
            if (wk) set.add(wk);
        });
        (settings.weekClosures || []).forEach((c) => {
            if (c.custodianId !== selectedCustodianId) return;
            const wk = String(c.weekNumber || '').trim();
            if (wk) set.add(wk);
        });
        (settings.weekPreClosures || []).forEach((c) => {
            if (c.custodianId !== selectedCustodianId) return;
            const wk = String(c.weekNumber || '').trim();
            if (wk) set.add(wk);
        });
        return Array.from(set).sort((a, b) => {
            const pa = parsePettyCashWeekKey(a);
            const pb = parsePettyCashWeekKey(b);
            if (pa.year != null && pb.year != null && pa.year !== pb.year) return pb.year - pa.year;
            const wa = pa.week ?? 0;
            const wb = pb.week ?? 0;
            return wb - wa;
        });
    }, [custodianTransactions, settings.weekClosures, settings.weekPreClosures, selectedCustodianId]);

    useEffect(() => {
        if (!availableWeeks.length) return;
        if (!availableWeeks.includes(String(selectedWeek))) {
            setSelectedWeek(availableWeeks[0]!);
        }
    }, [availableWeeks, selectedWeek]);

    const editUsesIgv = receiptTypeUsesIgv(editClassification);
    const numBiEmptyE = editAmountBI.trim() === '';
    const numExEmptyE = editAmountExempt.trim() === '';
    const numBiE = numBiEmptyE ? 0 : parseFloat(editAmountBI);
    const numExE = numExEmptyE ? 0 : parseFloat(editAmountExempt);
    const badBiE = !numBiEmptyE && (Number.isNaN(numBiE) || numBiE < 0);
    const badExE = !numExEmptyE && (Number.isNaN(numExE) || numExE < 0);
    const editIgvRate = editUsesIgv ? (editInvoiceIgv10 ? 0.1 : 0.18) : 0;
    const editIgvPreview = editUsesIgv && !badBiE ? Math.round(numBiE * editIgvRate * 100) / 100 : 0;
    const editTotalPreview = editUsesIgv
        ? badBiE || badExE
            ? NaN
            : Math.round((numBiE + editIgvPreview + (Number.isNaN(numExE) ? 0 : numExE)) * 100) / 100
        : numBiEmptyE
          ? 0
          : Number.isNaN(numBiE) || numBiE < 0
            ? NaN
            : Math.round(numBiE * 100) / 100;

    useEffect(() => {
        if (!editOpen) return;
        if (!receiptTypeUsesIgv(editClassification)) {
            setEditInvoiceIgv10(false);
            setEditAmountExempt('');
        }
    }, [editOpen, editClassification]);

    const openEditExpense = (e: PettyCashTransaction) => {
        if (weekAlreadyClosed) {
            toast.error('La semana está cerrada; no se pueden modificar movimientos.');
            return;
        }
        if (!canModifyPettyCashExpense(e, currentUser)) {
            toast.error('No tiene permiso para editar este movimiento.');
            return;
        }
        setEditingId(e.id);
        const isFact = receiptTypeUsesIgv(e.receiptType);
        let amountField = '';
        if (isFact) {
            if (e.amountBI != null && !Number.isNaN(Number(e.amountBI))) {
                const v = Number(e.amountBI);
                amountField = v > 0 || (e.amountExempt ?? 0) > 0 ? String(v) : '';
            } else {
                const tot = e.amount != null ? Number(e.amount) : 0;
                const igvL = e.igv != null ? Number(e.igv) : 0;
                const ex = e.amountExempt ?? 0;
                const bi = Math.max(0, Math.round((tot - igvL - ex) * 100) / 100);
                amountField = bi > 0 || (e.amountExempt && e.amountExempt > 0) ? String(bi) : '';
            }
            let use10 = e.igvRate === 0.1;
            if (e.igvRate == null && e.amountBI != null && e.igv != null && Number(e.amountBI) > 0) {
                const r = Number(e.igv) / Number(e.amountBI);
                use10 = Math.abs(r - 0.1) < Math.abs(r - 0.18);
            }
            setEditInvoiceIgv10(use10);
            setEditAmountExempt(
                e.amountExempt != null && e.amountExempt > 0
                    ? String(Math.round(e.amountExempt * 100) / 100)
                    : ''
            );
        } else {
            const full = e.amount != null && !Number.isNaN(Number(e.amount)) ? Number(e.amount) : 0;
            amountField = full > 0 ? String(Math.round(full * 100) / 100) : '';
            setEditInvoiceIgv10(false);
            setEditAmountExempt('');
        }
        setEditAmountBI(amountField);
        setEditDocumentDate(
            e.documentDate
                ? format(new Date(e.documentDate as string | Date), 'yyyy-MM-dd')
                : format(new Date(e.date), 'yyyy-MM-dd')
        );
        setEditDescription(e.description || '');
        setEditCategory(
            categoryCatalog.includes(e.category) ? e.category : categoryCatalog[0] || e.category || ''
        );
        setEditClassification(e.receiptType || 'Boleta');
        const dt = e.docType || 'RUC';
        setEditDocType(dt);
        setEditDocNumber(normalizeDocIdentityDigits(e.docNumber || '', dt));
        setEditDocSeries(e.docSeries || '');
        setEditVoucherNumber((e.voucherNumber || e.receiptNumber || '').trim());
        setEditProviderName(e.providerName || '');
        const ar =
            e.area && areaCatalog.includes(e.area)
                ? e.area
                : areaCatalog[0] || e.area || '';
        setEditArea(ar);
        setEditIsExtra(!!e.isExtraExpense);
        const loc =
            e.location && sedeOptions.includes(e.location)
                ? e.location
                : sedeOptions[0] || e.location || 'Principal';
        setEditLocation(loc);
        const nextCat =
            categoryCatalog.includes(e.category) ? e.category : categoryCatalog[0] || e.category || '';
        setEditOpen(true);
    };

    const closeEditExpense = () => {
        setEditOpen(false);
        setEditingId(null);
    };

    const saveEditExpense = () => {
        if (!editingId) return;
        if (categoryCatalog.length === 0) {
            toast.error('Falta catálogo de categorías.');
            return;
        }
        if (areaCatalog.length === 0) {
            toast.error('Falta catálogo de áreas.');
            return;
        }
        if (!editDescription.trim() || !editArea || !editNormDoc || !editProviderName.trim()) {
            toast.error('Complete los campos obligatorios.');
            return;
        }
        if (!editDocSeries.trim() || !editVoucherNumber.trim()) {
            toast.error('Indique serie y número de documento del comprobante.');
            return;
        }
        const needDigits = getDocIdentityDigitLimit(editDocType);
        if (editNormDoc.length !== needDigits) {
            toast.error(`El ${editDocType} debe tener ${needDigits} dígitos.`);
            return;
        }
        if (!editCatalogMatch) {
            toast.error('Proveedor no registrado en catálogo', {
                description:
                    'Use «Caja chica (rápido)» en Proveedores para dar de alta y vuelva a intentar.',
            });
            return;
        }
        const usesIgv = receiptTypeUsesIgv(editClassification);
        const nBiE = editAmountBI.trim() === '' ? 0 : parseFloat(editAmountBI);
        const nExE = editAmountExempt.trim() === '' ? 0 : parseFloat(editAmountExempt);
        const nBiEEmpty = editAmountBI.trim() === '';
        const nExEEmpty = editAmountExempt.trim() === '';
        const bBiE2 = !nBiEEmpty && (Number.isNaN(nBiE) || nBiE < 0);
        const bExE2 = !nExEEmpty && (Number.isNaN(nExE) || nExE < 0);
        if (usesIgv) {
            if (bBiE2 || bExE2) {
                toast.error('Importes inválidos: revise base imponible e inafecto.');
                return;
            }
        } else {
            if (nBiEEmpty || Number.isNaN(nBiE) || nBiE <= 0) {
                toast.error('Monto inválido.');
                return;
            }
        }
        const rateE = usesIgv ? (editInvoiceIgv10 ? 0.1 : 0.18) : 0;
        const igvVal = usesIgv ? Math.round(nBiE * rateE * 100) / 100 : 0;
        const exVal = usesIgv ? Math.round((Number.isNaN(nExE) ? 0 : nExE) * 100) / 100 : 0;
        const totalVal = usesIgv
            ? Math.round((nBiE + igvVal + exVal) * 100) / 100
            : Math.round(nBiE * 100) / 100;
        if (usesIgv && (totalVal <= 0 || Number.isNaN(totalVal))) {
            toast.error('El total a pagar debe ser mayor a 0.');
            return;
        }
        const amountBIVal = usesIgv ? nBiE : totalVal;
        const dup = findPettyCashDuplicate(
            transactions,
            editNormDoc,
            editDocSeries.trim(),
            editVoucherNumber.trim(),
            editingId
        );
        if (dup) {
            toast.error('Otro gasto activo ya usa el mismo RUC/DNI, serie y número de documento.');
            return;
        }
        const row = transactions.find((x) => x.id === editingId);
        const cid = row?.custodianId || selectedCustodianId;
        const weekStr = row ? String(row.weekNumber) : String(selectedWeek);
        if (cid) {
            const cUser = users.find((u) => u.id === cid);
            const fundLimit = effectivePettyCashFundLimit(cUser, settings.totalFundLimit);
            const hypothetical = transactions.map((x) =>
                x.id === editingId
                    ? {
                          ...x,
                          amount: totalVal,
                          amountBI: amountBIVal,
                          igv: usesIgv ? igvVal : 0,
                          igvRate: usesIgv ? (rateE as 0.1 | 0.18) : undefined,
                          amountExempt: usesIgv ? exVal : undefined,
                          type: 'expense' as const,
                      }
                    : x
            );
            const balAfter = getPettyCashWeekBalance(
                hypothetical,
                cid,
                weekStr,
                settings.weekClosures,
                fundLimit,
                fundDeliveries,
                getUserOpeningCarryState(cUser)
            );
            if (balAfter < -0.009) {
                toast.error('El importe dejaría el saldo de la semana en negativo.', {
                    description: `Saldo resultante: ${formatCurrencyEs(balAfter)}. Reduzca el monto o registre reposición.`,
                });
                return;
            }
        }

        if (settings.maxTransactionAmount > 0 && totalVal > settings.maxTransactionAmount + 0.009) {
            toast.error('El monto supera el tope por comprobante configurado.', {
                description: `Tope: ${formatCurrencyEs(settings.maxTransactionAmount)}.`,
            });
            return;
        }

        const sedeVal =
            sedeOptions.length > 0
                ? sedeOptions.includes(editLocation)
                    ? editLocation
                    : sedeOptions[0]!
                : editLocation;

        onUpdateTransactions(
            transactions.map((t) => {
                if (t.id !== editingId) return t;
                let docD: Date;
                try {
                    docD = editDocumentDate
                        ? new Date(editDocumentDate + 'T12:00:00')
                        : new Date(t.date);
                } catch {
                    docD = new Date(t.date);
                }
                if (Number.isNaN(docD.getTime())) docD = new Date(t.date);
                return {
                    ...t,
                    amount: totalVal,
                    amountBI: amountBIVal,
                    igv: usesIgv ? igvVal : 0,
                    igvRate: usesIgv ? (rateE as 0.1 | 0.18) : undefined,
                    amountExempt: usesIgv ? exVal : undefined,
                    documentDate: docD,
                    description: editDescription.trim(),
                    category: categoryCatalog.includes(editCategory) ? editCategory : categoryCatalog[0]!,
                    receiptType: editClassification as PettyCashTransaction['receiptType'],
                    docType: editDocType as PettyCashTransaction['docType'],
                    docNumber: editNormDoc,
                    docSeries: editDocSeries.trim(),
                    voucherNumber: editVoucherNumber.trim(),
                    receiptNumber: editVoucherNumber.trim(),
                    providerName: editProviderName.trim(),
                    area: editArea,
                    isExtraExpense: editIsExtra,
                    location: sedeVal,
                };
            })
        );
        toast.success('Movimiento actualizado.');
        closeEditExpense();
    };

    const voidExpense = (e: PettyCashTransaction) => {
        if (weekAlreadyClosed) {
            toast.error('La semana está cerrada; no se puede anular.');
            return;
        }
        if (!canModifyPettyCashExpense(e, currentUser)) {
            toast.error('No tiene permiso para anular este movimiento.');
            return;
        }
        if (
            !window.confirm(
                `¿Anular este gasto? Quedará marcado como anulado y no sumará en totales.\n\n${(e.description || '').slice(0, 140)}`
            )
        )
            return;
        onUpdateTransactions(
            transactions.map((t) => (t.id === e.id ? { ...t, status: 'voided' as const } : t))
        );
        toast.success('Movimiento anulado.');
    };

    const revokeFundDelivery = (e: PettyCashTransaction) => {
        if (!isSuperAdminOnly) {
            toast.error('Solo el super administrador puede revocar dotaciones.');
            return;
        }
        if (weekAlreadyClosed) {
            toast.error('La semana está cerrada; no se puede revocar la dotación.');
            return;
        }
        if (!isFundDeliveryIncome(e) || !e.custodianId || !e.weekNumber) return;
        if (
            !window.confirm(
                '¿Revocar esta dotación semanal?\n\n' +
                    'Se eliminará la confirmación de entrega. La semana volverá a quedar pendiente de dotación por auditoría.'
            )
        ) {
            return;
        }
        onUpdateTransactions(transactions.filter((t) => t.id !== e.id));
        onRevokeFundDelivery?.(e.custodianId, String(e.weekNumber));
        toast.success('Dotación semanal revocada.');
    };

    const approvePettyMovement = (row: PettyCashTransaction) => {
        if (!canApprovePettyCashMovements(currentUser, roles)) return;
        if (weekAlreadyClosed) {
            toast.error('La semana está cerrada; no se puede modificar el estado de auditoría.');
            return;
        }
        if (row.status !== 'pending_audit') return;
        onUpdateTransactions(
            transactions.map((t) => (t.id === row.id ? { ...t, status: 'approved' as const } : t))
        );
        toast.success('Movimiento aprobado por auditoría.');
    };

    const rejectPettyMovement = (row: PettyCashTransaction) => {
        if (!canApprovePettyCashMovements(currentUser, roles)) return;
        if (weekAlreadyClosed) {
            toast.error('La semana está cerrada.');
            return;
        }
        if (row.status !== 'pending_audit') return;
        if (
            !window.confirm(
                `¿Rechazar este movimiento?\n\n${(row.description || '').slice(0, 120)}\n\nEl responsable deberá corregir o anular y registrar de nuevo.`
            )
        )
            return;
        const note =
            window.prompt('Motivo del rechazo (opcional; queda registrado en el movimiento):', row.auditComment ?? '') ??
            '';
        onUpdateTransactions(
            transactions.map((t) =>
                t.id === row.id
                    ? {
                          ...t,
                          status: 'rejected' as const,
                          auditComment: note.trim() || t.auditComment,
                      }
                    : t
            )
        );
        toast.message('Movimiento rechazado en auditoría.');
    };

    const handlePreCloseWeek = () => {
        if (!onPreClosePettyCashWeek || !selectedCustodianId) return;
        if (weekAlreadyClosed) {
            toast.error('La semana ya está cerrada definitivamente.');
            return;
        }
        if (weekPreClosed) {
            toast.info('Esta semana ya consta como pre-cerrada.');
            return;
        }
        if (!canUserPreCloseWeek) {
            toast.error('Solo el responsable con fondo asignado puede registrar el pre-cierre de su propia caja.');
            return;
        }
        const msg =
            `¿Registrar pre-cierre de la semana ${selectedWeek}?\n\n` +
            `Esto marca que presentó la rendición para revisión. ` +
            `Podrá seguir registrando gastos si el saldo lo permite; el cierre definitivo lo hará contabilidad tras aprobar el 100% de los movimientos.`;
        if (!window.confirm(msg)) return;
        const pre: PettyCashWeekPreClosure = {
            id: `pcp-${Date.now()}`,
            custodianId: selectedCustodianId,
            weekNumber: String(selectedWeek),
            preClosedAt: new Date().toISOString(),
            preClosedByUserId: currentUser.id,
        };
        onPreClosePettyCashWeek(pre);
        toast.success('Pre-cierre registrado', {
            description: 'Puede imprimir la rendición y enviar sustentos a auditoría.',
        });
    };

    const handleSaveAdminTopup = () => {
        if (!canAdminFundTopUp(currentUser)) {
            toast.error('Sin permiso para asignar refuerzo de fondo.');
            return;
        }
        if (!selectedCustodianId) return;
        const amt = parseFloat(topupAmount.replace(',', '.'));
        if (Number.isNaN(amt) || amt <= 0) {
            toast.error('Ingrese un monto válido mayor a 0.');
            return;
        }
        const sedeVal =
            sedeOptions.length > 0
                ? sedeOptions.includes(topupSede)
                    ? topupSede
                    : sedeOptions[0]!
                : topupSede || 'Principal';
        const row: PettyCashTransaction = {
            id: `pc-top-${Date.now()}`,
            date: new Date(),
            amount: amt,
            type: 'income',
            incomeSubtype: 'admin_topup',
            description:
                topupNote.trim() ||
                `Refuerzo extraordinario de fondo — ${currentUser.name} → ${selectedCustodian?.name ?? 'responsable'}`,
            category: ADMIN_FUND_TOPUP_CATEGORY,
            requester: currentUser.name,
            custodianId: selectedCustodianId,
            status: 'approved',
            weekNumber: String(selectedWeek),
            receiptType: 'Recibo Simple',
            location: sedeVal,
        };
        onUpdateTransactions([row, ...transactions]);
        toast.success('Refuerzo de fondo registrado', {
            description: `${formatCurrencyEs(amt)} sumado al saldo de la semana ${selectedWeek}.`,
        });
        setTopupOpen(false);
        setTopupAmount('');
        setTopupNote('');
    };

    const openFundDeliveryDialog = () => {
        if (!canConfirmPettyCashFundDelivery(currentUser, roles)) {
            toast.error('Sin permiso para confirmar entrega de dotación.');
            return;
        }
        if (!onConfirmFundDelivery || !selectedCustodianId) return;
        if (weekAlreadyClosed) {
            toast.error('Esta semana ya está cerrada.');
            return;
        }
        if (existingFundDelivery) {
            toast.info('La dotación de esta semana ya fue confirmada.');
            return;
        }
        if (!weekOpening.requiresFundDelivery) {
            toast.error('Esta semana no requiere confirmación de dotación.');
            return;
        }
        const suggestedCarry = weekOpening.isPeriodOpeningWeek
            ? openingCarryState.availableSuggested
            : weekOpening.carryFromPrevious;
        setDeliveryCarryAmount(
            suggestedCarry > 0 ? String(Math.round(suggestedCarry * 100) / 100) : ''
        );
        setDeliveryAmount(String(currentLimit));
        setDeliveryReason('');
        setDeliveryOpen(true);
    };

    const handleSaveFundDelivery = () => {
        if (!onConfirmFundDelivery || !selectedCustodianId) return;
        if (!canConfirmPettyCashFundDelivery(currentUser, roles)) {
            toast.error('Sin permiso para confirmar entrega de dotación.');
            return;
        }
        if (existingFundDelivery) {
            toast.error('La dotación ya fue registrada para esta semana.');
            return;
        }
        const amt = parseFloat(deliveryAmount.replace(',', '.'));
        if (!Number.isFinite(amt) || amt <= 0) {
            toast.error('Ingrese un monto de dotación válido mayor a cero.');
            return;
        }
        const carryRaw = deliveryCarryAmount.trim();
        const carryAmt = carryRaw === '' ? 0 : parseFloat(carryRaw.replace(',', '.'));
        if (carryRaw !== '' && (!Number.isFinite(carryAmt) || carryAmt < 0)) {
            toast.error('El arrastre de apertura debe ser un monto válido ≥ 0.');
            return;
        }
        const configured = currentLimit;
        const suggestedCarry = weekOpening.isPeriodOpeningWeek
            ? openingCarryState.availableSuggested
            : 0;
        const dotationDiffers = Math.abs(amt - configured) > 0.009;
        const carryDiffers =
            weekOpening.isPeriodOpeningWeek && Math.abs(carryAmt - suggestedCarry) > 0.009;
        if ((dotationDiffers || carryDiffers) && !deliveryReason.trim()) {
            toast.error('Indique el motivo cuando el monto difiere del sugerido en config.');
            return;
        }
        const delivery: PettyCashFundDelivery = {
            id: `pfd-${Date.now()}`,
            custodianId: selectedCustodianId,
            weekNumber: String(selectedWeek),
            configuredAmount: configured,
            deliveredAmount: Math.round(amt * 100) / 100,
            deliveredAt: new Date().toISOString(),
            deliveredByUserId: currentUser.id,
            deliveredByName: currentUser.name,
            reason: dotationDiffers || carryDiffers ? deliveryReason.trim() : undefined,
            ...(weekOpening.isPeriodOpeningWeek
                ? {
                      openingCarryAmount: Math.round(carryAmt * 100) / 100,
                      isPeriodOpening: true,
                  }
                : {}),
        };
        const incomeRow: PettyCashTransaction = {
            id: `pc-fd-${Date.now()}`,
            date: new Date(),
            amount: delivery.deliveredAmount,
            type: 'income',
            incomeSubtype: 'fund_delivery',
            description:
                delivery.reason?.trim() ||
                `Dotación semanal de fondo fijo — ${formatCurrencyEs(delivery.deliveredAmount)} (sem. ${selectedWeek})`,
            category: FUND_DELIVERY_CATEGORY,
            requester: currentUser.name,
            custodianId: selectedCustodianId,
            status: 'approved',
            weekNumber: String(selectedWeek),
        };
        onConfirmFundDelivery(delivery);
        if (delivery.isPeriodOpening) {
            onConsumeOpeningCarry?.(selectedCustodianId);
        }
        onUpdateTransactions([incomeRow, ...transactions]);
        const carryPart =
            delivery.openingCarryAmount && delivery.openingCarryAmount > 0
                ? ` · Arrastre ${formatCurrencyEs(delivery.openingCarryAmount)}`
                : '';
        toast.success('Dotación semanal confirmada', {
            description: `${formatCurrencyEs(delivery.deliveredAmount)} entregados a ${selectedCustodian?.name ?? 'responsable'} · semana ${selectedWeek}${carryPart}.`,
        });
        setDeliveryOpen(false);
        setDeliveryAmount('');
        setDeliveryCarryAmount('');
        setDeliveryReason('');
    };

    const handleCloseWeek = () => {
        if (!onClosePettyCashWeek || !selectedCustodianId) return;
        if (weekAlreadyClosed) {
            toast.error('Esta semana ya está cerrada.');
            return;
        }
        if (!allMovementsAuditedApproved) {
            toast.error(
                'No se puede cerrar: todos los movimientos de la semana (excepto anulados/rechazados) deben estar aprobados por auditoría.'
            );
            return;
        }
        if (currentBalance < -0.009) {
            toast.error(
                'No se puede cerrar con saldo negativo. Regularice (anule, ajuste o registre reposición) hasta que el saldo sea ≥ 0.'
            );
            return;
        }
        const closing = Math.max(0, currentBalance);
        const carried = closing;
        const msg =
            `¿Cerrar DEFINITIVAMENTE la semana ${selectedWeek} para ${selectedCustodian?.name ?? 'el responsable'}?\n\n` +
            `Auditoría: todos los movimientos vigentes están aprobados.\n\n` +
            `Fondo de apertura: ${formatCurrencyEs(openingFundForWeek)}\n` +
            `Gastos: ${formatCurrencyEs(weeklyExpenseTotal)}\n` +
            (weeklyIncomeTotal > 0 ? `Reposiciones: ${formatCurrencyEs(weeklyIncomeTotal)}\n` : '') +
            `Saldo al cierre: ${formatCurrencyEs(closing)}\n` +
            (carried > 0
                ? `Arrastre a la semana siguiente: ${formatCurrencyEs(carried)}.\nLa dotación fija (${formatCurrencyEs(currentLimit)}) la confirmará auditoría al entregar el efectivo.`
                : `Sin arrastre de efectivo.\nLa semana siguiente quedará pendiente hasta que auditoría confirme la dotación de ${formatCurrencyEs(currentLimit)}.`);

        if (!window.confirm(msg)) return;

        const closure: PettyCashWeekClosure = {
            id: `pcw-${Date.now()}`,
            custodianId: selectedCustodianId,
            weekNumber: String(selectedWeek),
            closedAt: new Date().toISOString(),
            openingFund: openingFundForWeek,
            expensesTotal: weeklyExpenseTotal,
            closingBalance: closing,
            carriedForward: carried,
        };
        onClosePettyCashWeek(closure);
        toast.success(`Semana ${selectedWeek} cerrada`, {
            description:
                carried > 0
                    ? `Arrastre ${formatCurrencyEs(carried)}. Auditoría debe confirmar la dotación de la próxima semana.`
                    : `Próxima semana pendiente de dotación (${formatCurrencyEs(currentLimit)}).`,
        });
    };

    const handlePrintRendition = () => {
        const tmpl = mergePettyCashRenditionPrint(settings.renditionPrint);
        const rows = currentWeekExpenses.filter((e) => e.status !== 'voided' && e.status !== 'rejected');
        const logoRaw = (tmpl.reportLogoDataUrl || reportLogoFallback || '').trim();
        const logoSafe =
            logoRaw.startsWith('data:image/png') ||
            logoRaw.startsWith('data:image/jpeg') ||
            logoRaw.startsWith('data:image/jpg') ||
            logoRaw.startsWith('data:image/webp') ||
            logoRaw.startsWith('data:image/gif')
                ? logoRaw.replace(/"/g, '')
                : '';
        const logoBlock = logoSafe
            ? `<img class="rlogo" src="${logoSafe}" alt="" />`
            : '';

        const nroComprobante = (e: PettyCashTransaction) =>
            (e.voucherNumber || e.receiptNumber || '').trim() || '—';
        const serieVal = (e: PettyCashTransaction) => (e.docSeries || '').trim() || '—';
        const nombreVal = (e: PettyCashTransaction) =>
            (e.providerName || e.requester || '').trim() || '—';
        const tipoDoc = (e: PettyCashTransaction) => {
            if (isFundDeliveryIncome(e)) return '—';
            return (e.receiptType || (e.type === 'income' ? 'Reposición' : '—')).trim();
        };
        const sedeVal = (e: PettyCashTransaction) =>
            isFundDeliveryIncome(e) ? '—' : (e.location || 'Principal').trim();
        const nombreForRow = (e: PettyCashTransaction) => {
            if (isFundDeliveryIncome(e)) {
                return (e.description || FUND_DELIVERY_CATEGORY).trim();
            }
            return nombreVal(e);
        };

        const bodyRows = rows
            .map((e) => {
                const d = format(new Date(e.date), 'dd/MM/yyyy HH:mm', { locale: es });
                return `<tr>
          <td>${escHtml(d)}</td>
          <td>${escHtml(sedeVal(e))}</td>
          <td>${escHtml(tipoDoc(e))}</td>
          <td>${escHtml(serieVal(e))}</td>
          <td>${escHtml(nroComprobante(e))}</td>
          <td>${escHtml(nombreForRow(e))}</td>
          <td class="num">${formatNumberEs(Number(e.amount))}</td>
          <td>${escHtml(pettyCashStatusLabel(e.status))}</td>
        </tr>`;
            })
            .join('');

        const catRows = tmpl.showCategoryBreakdown
            ? breakdownCategoryKeys
                  .map((catKey) => {
                      const catVal = categoryStyles[catKey] ?? { label: catKey, color: '' };
                      const catTotal = currentWeekExpenses
                          .filter(
                              (e) =>
                                  e.category === catKey &&
                                  validWeekTx(e) &&
                                  (e.type === 'expense' || !e.type)
                          )
                          .reduce((acc, curr) => acc + curr.amount, 0);
                      if (catTotal === 0) return '';
                      return `<div class="cat"><strong>${escHtml(catVal.label)}</strong> — ${formatCurrencyEs(catTotal)}</div>`;
                  })
                  .join('')
            : '';

        const colSpanEmpty = 8;

        const signatures = tmpl.showSignaturesBlock
            ? `<div class="signatures">
          <div class="sig"><span class="line"></span><br/>Responsable de caja</div>
          <div class="sig"><span class="line"></span><br/>Contabilidad</div>
          <div class="sig"><span class="line"></span><br/>Aprobación</div>
        </div>`
            : '';

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escHtml(tmpl.documentTitle)}</title>
<style>
body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#111;font-size:12px;}
.hdr{display:flex;align-items:flex-start;gap:16px;margin-bottom:12px;}
.rlogo{max-height:64px;max-width:220px;object-fit:contain;}
h1{font-size:18px;margin:0 0 4px;} h2{font-size:13px;color:#444;font-weight:normal;margin:0 0 16px;}
.meta{margin-bottom:16px;color:#333;}
table{width:100%;border-collapse:collapse;margin-top:12px;}
th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;}
th{background:#f3f3f3;font-size:11px;}
td.num{text-align:right;font-variant-numeric:tabular-nums;}
.totals{margin-top:20px;border-top:2px solid #333;padding-top:12px;}
.totals div{display:flex;justify-content:space-between;margin:4px 0;}
.cat{margin:4px 0;}
.signatures{display:flex;justify-content:space-between;margin-top:36px;gap:16px;}
.sig{text-align:center;flex:1;font-size:11px;color:#444;}
.sig .line{display:inline-block;border-bottom:1px solid #333;width:90%;height:28px;}
.footer{margin-top:24px;font-size:10px;color:#555;border-top:1px solid #ddd;padding-top:8px;}
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  @page{margin:12mm;}
}
</style></head><body>
<div class="hdr">
  ${logoBlock}
  <div>
    <h1>${escHtml(tmpl.documentTitle)}</h1>
    <h2>${escHtml(tmpl.subtitle)}</h2>
  </div>
</div>
<div class="meta">
  <div><strong>${escHtml(businessName)}</strong></div>
  <div>Responsable: ${escHtml(selectedCustodian?.name || '')} · Sede: ${escHtml(selectedCustodianSedeLabel)} · Semana ${escHtml(String(selectedWeek))} · <strong>${escHtml(selectedWeekRangeLabel)}</strong></div>
  <div>Impreso: ${escHtml(format(new Date(), "dd/MM/yyyy HH:mm", { locale: es }))}</div>
</div>
<table><thead><tr>
  <th>Fecha</th><th>Sede</th><th>Tipo Doc.</th><th>Serie</th><th>Nro documento</th><th>Nombre</th><th class="num">Monto</th><th>Estado auditoría</th>
</tr></thead><tbody>${bodyRows || `<tr><td colspan="${colSpanEmpty}">Sin movimientos</td></tr>`}</tbody></table>
<div class="totals">
  <div><span>Fondo de apertura (semana)</span><strong>${formatCurrencyEs(openingFundForWeek)}</strong></div>
  <div><span>Total gastos</span><strong>${formatCurrencyEs(weeklyExpenseTotal)}</strong></div>
  ${
      weeklyIncomeTotal > 0
          ? `<div><span>Reposiciones / ingresos</span><strong>${formatCurrencyEs(weeklyIncomeTotal)}</strong></div>`
          : ''
  }
  <div><span>Saldo calculado</span><strong>${formatCurrencyEs(currentBalance)}</strong></div>
</div>
${catRows ? `<h3 style="margin-top:20px;font-size:13px;">Desglose por categoría</h3>${catRows}` : ''}
${signatures}
<div class="footer">${escHtml(tmpl.footerLegal)}</div>
</body></html>`;

        // Blob + load + print diferido: evita PDF/impresión en blanco (document.write + print inmediato).
        const blob = new Blob([html], { type: 'text/html;charset=UTF-8' });
        const url = URL.createObjectURL(blob);
        const w = window.open(url, '_blank', 'width=960,height=800');
        if (!w) {
            URL.revokeObjectURL(url);
            toast.error('Permita ventanas emergentes para imprimir la rendición.');
            return;
        }

        const revokeLater = () => {
            try {
                URL.revokeObjectURL(url);
            } catch {
                /* ignore */
            }
        };

        let printScheduled = false;
        const runPrintOnce = () => {
            if (printScheduled) return;
            printScheduled = true;
            try {
                w.focus();
                // Dar tiempo al layout antes de capturar (Guardar como PDF / impresora).
                window.setTimeout(() => {
                    try {
                        w.print();
                    } finally {
                        window.setTimeout(revokeLater, 2500);
                    }
                }, 350);
            } catch {
                toast.error('No se pudo abrir el cuadro de impresión.');
                revokeLater();
            }
        };

        try {
            w.addEventListener(
                'afterprint',
                () => {
                    revokeLater();
                },
                { once: true }
            );
        } catch {
            /* ignore */
        }

        const fallbackId = window.setTimeout(() => {
            runPrintOnce();
        }, 2000);

        const onReady = () => {
            window.clearTimeout(fallbackId);
            runPrintOnce();
        };

        if (w.document.readyState === 'complete') {
            window.clearTimeout(fallbackId);
            runPrintOnce();
        } else {
            w.addEventListener('load', onReady, { once: true });
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-150">
            {/* Custodian Selector (Visible for Admins or if multiple custodians exist) */}
            {custodians.length > 0 && (
                <div
                    className="relative overflow-hidden flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between p-4 rounded-xl border border-cyan-500/25 shadow-[0_4px_28px_rgba(34,211,238,0.1)] backdrop-blur-sm"
                    style={{
                        background:
                            'linear-gradient(135deg, rgba(22,20,39,0.97) 0%, rgba(18,16,31,0.98) 50%, rgba(20,184,166,0.1) 100%)',
                    }}
                >
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="p-2.5 rounded-full bg-cyan-500/15 border border-cyan-500/25 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
                            <UserCircle className="w-6 h-6 text-cyan-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm text-foreground">Responsable de Caja Chica</h3>
                            <p className="text-xs text-cyan-800/80 dark:text-cyan-200/70">
                                {canPickMultipleCustodians
                                    ? 'Gestionando fondo de:'
                                    : 'Solo puede ver y operar su propio fondo en sus sedes asignadas.'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 lg:justify-end lg:ml-auto">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            {weekAlreadyClosed ? (
                                <Badge variant="secondary" className="text-xs shrink-0">
                                    Semana cerrada
                                </Badge>
                            ) : weekPreClosed ? (
                                <Badge
                                    variant="outline"
                                    className="text-xs shrink-0 border-amber-500/60 text-amber-700 dark:text-amber-400"
                                >
                                    Pre-cerrada
                                </Badge>
                            ) : null}
                            {!weekAlreadyClosed && hasPendingAudit ? (
                                <Badge variant="outline" className="text-xs shrink-0">
                                    Pend. auditoría
                                </Badge>
                            ) : null}
                            {!weekAlreadyClosed &&
                            allMovementsAuditedApproved &&
                            currentWeekExpenses.some(
                                (e) => e.status !== 'voided' && e.status !== 'rejected'
                            ) ? (
                                <Badge
                                    variant="default"
                                    className="text-xs shrink-0 bg-emerald-600 hover:bg-emerald-600 text-white"
                                >
                                    Listo para cierre
                                </Badge>
                            ) : null}
                            <span className="text-xs whitespace-nowrap">
                                <span className="font-semibold text-foreground/90">Periodo:</span>{' '}
                                <span className="text-violet-800 dark:text-violet-300/95">{selectedWeekRangeLabel}</span>
                            </span>
                            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                                <SelectTrigger className="w-[200px] h-9 border-cyan-500/30 bg-cyan-950/25 text-foreground">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableWeeks.map((wk) => (
                                        <SelectItem key={wk} value={wk}>
                                            Semana {wk}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {canPickMultipleCustodians && custodians.length > 1 ? (
                            <Select value={selectedCustodianId} onValueChange={setSelectedCustodianId}>
                                <SelectTrigger className="w-full sm:w-[280px] h-auto min-h-[40px] border-cyan-500/35 bg-cyan-950/30 font-medium shadow-inner">
                                    <SelectValue placeholder="Seleccionar Responsable" />
                                </SelectTrigger>
                                <SelectContent>
                                    {custodians.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.name}
                                            {userHasPettyCashFund(c)
                                                ? ` (Fondo: ${formatCurrencyEs(effectivePettyCashFundLimit(c, settings.totalFundLimit))})`
                                                : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <div className="text-sm font-semibold rounded-lg border border-cyan-500/35 bg-cyan-950/30 px-3 py-2 min-w-[200px] shadow-inner whitespace-nowrap">
                                {selectedCustodian?.name ?? currentUser.name}
                                {selectedCustodian && userHasPettyCashFund(selectedCustodian) ? (
                                    <span className="text-violet-800 dark:text-violet-300/90 font-normal">
                                        {' '}
                                        — Límite {formatCurrencyEs(effectivePettyCashFundLimit(selectedCustodian, settings.totalFundLimit))}
                                    </span>
                                ) : null}
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {custodians.length === 0 && (
                                <div className="bg-amber-500/10 border-l-4 border-amber-500 p-4 rounded-md">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <AlertCircle className="h-5 w-5 text-amber-500" aria-hidden="true" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-foreground">
                                No hay usuarios configurados con fondo de caja chica. Asigna límites en Configuración → Contabilidad.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Header Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-primary/10 to-background border-primary/20 shadow-md">
                    <CardHeader className="pb-2">
                        <CardDescription>
                            Saldo disponible ({selectedCustodian?.name?.split(/\s+/)?.[0] ?? '—'})
                            <span className="block text-[11px] text-muted-foreground/90 font-normal mt-0.5">
                                Arrastre: {formatCurrencyEs(weekOpening.carryFromPrevious)}
                                {weekOpening.fundDeliveryAmount > 0
                                    ? ` · Dotación: ${formatCurrencyEs(weekOpening.fundDeliveryAmount)}`
                                    : weekOpening.deliveryPending
                                      ? ` · Dotación pendiente (${formatCurrencyEs(currentLimit)} sugeridos)`
                                      : ''}
                                {' · '}Límite config.: {formatCurrencyEs(currentLimit)}
                            </span>
                        </CardDescription>
                        <CardTitle className="text-4xl font-bold text-primary">
                            {formatCurrencyEs(currentBalance)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="w-full bg-muted/50 h-2 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-500 ${
                                    (currentBalance / fundDenominator) < (settings.alertThreshold / 100) 
                                    ? 'bg-red-500' 
                                    : 'bg-primary'
                                }`} 
                                style={{ width: `${Math.max(0, Math.min(100, (currentBalance / fundDenominator) * 100))}%` }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 text-right">
                            {weekAlreadyClosed ? (
                                <span className="text-emerald-600 font-medium">Semana cerrada · saldo arrastrado según cierre</span>
                            ) : weekOpening.deliveryPending ? (
                                <span className="text-amber-600 font-medium">
                                    Dotación pendiente: puede gastar solo hasta el arrastre ({formatCurrencyEs(weekOpening.carryFromPrevious)})
                                </span>
                            ) : weekOpening.requiresFundDelivery && existingFundDelivery ? (
                                <span className="text-emerald-600 font-medium">
                                    Dotación confirmada · fondo completo disponible
                                </span>
                            ) : (
                                <>Use «Cerrar semana» al rendir para arrastrar saldo positivo.</>
                            )}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>
                            Fondo asignado e importe en semana {selectedWeek}
                            <span className="block text-[11px] text-muted-foreground/90 font-normal mt-0.5">
                                {selectedWeekRangeLabel}
                            </span>
                        </CardDescription>
                        <CardTitle className="text-3xl font-bold text-foreground">
                            {formatCurrencyEs(openingFundForWeek)}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground font-medium pt-1">
                            {weekOpening.isFirstWeek
                                ? 'Primer importe asignado (apertura de caja)'
                                : weekOpening.deliveryPending
                                  ? `Arrastre ${formatCurrencyEs(weekOpening.carryFromPrevious)} + dotación pendiente`
                                  : `Arrastre ${formatCurrencyEs(weekOpening.carryFromPrevious)} + dotación ${formatCurrencyEs(weekOpening.fundDeliveryAmount)}`}
                        </p>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                                <span className="flex items-center gap-2">
                                    <TrendingDown className="w-4 h-4 text-red-500 shrink-0" />
                                    Gastos acumulados
                                </span>
                                <span className="font-semibold text-foreground tabular-nums">
                                    {formatCurrencyEs(weeklyExpenseTotal)}
                                </span>
                            </div>
                            {weeklyIncomeTotal > 0 ? (
                                <div className="space-y-1 text-xs">
                                    <div className="flex items-center justify-between gap-2 text-emerald-600">
                                        <span>Total ingresos al fondo</span>
                                        <span className="font-semibold tabular-nums">
                                            + {formatCurrencyEs(weeklyIncomeTotal)}
                                        </span>
                                    </div>
                                    {weeklyReplenishmentIncome > 0 ? (
                                        <div className="flex justify-between text-muted-foreground pl-2">
                                            <span>· Reposiciones</span>
                                            <span className="tabular-nums">{formatCurrencyEs(weeklyReplenishmentIncome)}</span>
                                        </div>
                                    ) : null}
                                    {weeklyAdminTopupIncome > 0 ? (
                                        <div className="flex justify-between text-amber-700 dark:text-amber-400 pl-2">
                                            <span>· Refuerzos admin.</span>
                                            <span className="tabular-nums">{formatCurrencyEs(weeklyAdminTopupIncome)}</span>
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <span className="text-xs text-muted-foreground">
                                    Sin ingresos al fondo en la semana.
                                </span>
                            )}
                            <div className="text-xs pt-1">
                                {currentWeekExpenses.length} movimiento
                                {currentWeekExpenses.length === 1 ? '' : 's'} en el periodo
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="flex flex-col justify-center items-center text-center p-6 border-dashed border-2 gap-2">
                    {canConfirmPettyCashFundDelivery(currentUser, roles) &&
                    selectedCustodianId &&
                    weekOpening.deliveryPending &&
                    !weekAlreadyClosed ? (
                        <Button
                            size="lg"
                            className="w-full"
                            variant="default"
                            onClick={openFundDeliveryDialog}
                            title="Confirma entrega física del fondo fijo semanal"
                        >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Confirmar dotación semanal
                        </Button>
                    ) : null}
                    {canAdminFundTopUp(currentUser) && selectedCustodianId ? (
                        <Button
                            size="lg"
                            className="w-full"
                            variant="outline"
                            onClick={() => {
                                setTopupAmount('');
                                setTopupNote('');
                                setTopupSede(sedeOptions[0] || 'Principal');
                                setTopupOpen(true);
                            }}
                            title="Suma efectivo al saldo de la semana seleccionada (casos excepcionales)"
                        >
                            <Banknote className="w-4 h-4 mr-2 text-amber-600" />
                            Refuerzo de fondo (admin)
                        </Button>
                    ) : null}
                    <Button size="lg" className="w-full" variant="outline" onClick={handlePrintRendition}>
                        <Printer className="w-4 h-4 mr-2" />
                        Imprimir Rendición
                    </Button>
                    <Button
                        size="lg"
                        className="w-full"
                        variant="secondary"
                        onClick={handlePreCloseWeek}
                        disabled={!canUserPreCloseWeek}
                        title={
                            !onPreClosePettyCashWeek
                                ? 'Pre-cierre no disponible'
                                : weekAlreadyClosed
                                  ? 'Semana ya cerrada'
                                  : weekPreClosed
                                    ? 'Ya registró pre-cierre'
                                    : !canUserPreCloseWeek
                                      ? 'Solo el responsable de su propio fondo puede pre-cerrar'
                                      : 'Marca que presentó rendición; no bloquea nuevos gastos'
                        }
                    >
                        <ClipboardCheck className="w-4 h-4 mr-2" />
                        Pre-cerrar semana
                    </Button>
                    <Button
                        size="lg"
                        className="w-full"
                        variant="default"
                        onClick={handleCloseWeek}
                        disabled={
                            !onClosePettyCashWeek ||
                            weekAlreadyClosed ||
                            currentBalance < -0.009 ||
                            !canAttemptCloseWeek ||
                            !allMovementsAuditedApproved
                        }
                        title={
                            weekAlreadyClosed
                                ? 'Esta semana ya está cerrada'
                                : currentBalance < -0.009
                                  ? 'Saldo negativo: no se puede cerrar'
                                  : !canAttemptCloseWeek
                                    ? 'Solo el responsable de caja o un administrador puede cerrar'
                                    : !allMovementsAuditedApproved
                                      ? 'Auditoría: deben estar aprobados todos los movimientos vigentes'
                                      : 'Cierre definitivo y arrastre de saldo a la siguiente semana'
                        }
                    >
                        <Lock className="w-4 h-4 mr-2" />
                        Cerrar semana
                    </Button>
                    <p className="text-xs text-muted-foreground">
                        Pre-cierre: presenta rendición sin bloquear gastos. Cierre: requiere 100% aprobado por auditoría y
                        saldo ≥ 0.
                    </p>
                </Card>
            </div>

            {/* Listado y Rendición (Full Width) */}
            <div className="w-full">
                <Tabs defaultValue="details" className="w-full">
                    <div className="flex items-center justify-between mb-4">
                        <TabsList>
                            <TabsTrigger value="details">Detalle de Movimientos</TabsTrigger>
                            <TabsTrigger value="summary">Rendición Semanal</TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="details" className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar por nombre, serie, nro. doc. o descripción…" 
                                    className="pl-9"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Button variant="outline" size="icon">
                                <Filter className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="border rounded-md overflow-x-auto bg-card">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Sede</TableHead>
                                        <TableHead>Tipo Doc.</TableHead>
                                        <TableHead>Serie</TableHead>
                                        <TableHead>Nro documento</TableHead>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead className="text-right">Monto</TableHead>
                                        <TableHead className="text-right w-[130px]">Auditoría</TableHead>
                                        <TableHead className="text-right w-[100px]">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(() => {
                                        const q = searchTerm.toLowerCase();
                                        const filtered = currentWeekExpenses.filter((e) => {
                                            if (!q) return true;
                                            const nro = (e.voucherNumber || e.receiptNumber || '').toLowerCase();
                                            const ser = (e.docSeries || '').toLowerCase();
                                            return (
                                                e.description.toLowerCase().includes(q) ||
                                                e.requester.toLowerCase().includes(q) ||
                                                (e.providerName || '').toLowerCase().includes(q) ||
                                                (e.docNumber || '').toLowerCase().includes(q) ||
                                                nro.includes(q) ||
                                                ser.includes(q) ||
                                                (e.receiptType || '').toLowerCase().includes(q)
                                            );
                                        });
                                        return (
                                            <>
                                    {filtered
                                        .map((expense) => {
                                            const isFundDelivery = isFundDeliveryIncome(expense);
                                            const tipoDoc = isFundDelivery
                                                ? '—'
                                                : expense.receiptType ||
                                                  (expense.type === 'income' ? 'Reposición' : '—');
                                            const serie = expense.docSeries?.trim() || '—';
                                            const nroDoc =
                                                expense.voucherNumber?.trim() ||
                                                expense.receiptNumber?.trim() ||
                                                '—';
                                            const nombre = isFundDelivery
                                                ? (
                                                      expense.description?.trim() ||
                                                      FUND_DELIVERY_CATEGORY
                                                  )
                                                : expense.providerName?.trim() ||
                                                  expense.requester ||
                                                  '—';
                                            const isIncome = expense.type === 'income';
                                            const isVoidedOrRejected =
                                                expense.status === 'voided' || expense.status === 'rejected';
                                            const canRowActions =
                                                !isIncome &&
                                                !isVoidedOrRejected &&
                                                canModifyPettyCashExpense(expense, currentUser) &&
                                                !weekAlreadyClosed;
                                            const canRevokeFundDelivery =
                                                isFundDelivery &&
                                                isSuperAdminOnly &&
                                                !isVoidedOrRejected &&
                                                !weekAlreadyClosed &&
                                                Boolean(existingFundDelivery);

                                            return (
                                                <TableRow
                                                    key={expense.id}
                                                    className={
                                                        expense.status === 'voided' || expense.status === 'rejected'
                                                            ? 'opacity-55'
                                                            : undefined
                                                    }
                                                >
                                                    <TableCell className="font-medium text-xs whitespace-nowrap">
                                                        {format(new Date(expense.date), 'dd/MM/yyyy HH:mm', {
                                                            locale: es,
                                                        })}
                                                    </TableCell>
                                                    <TableCell>
                                                        {isFundDelivery ? (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        ) : (
                                                            <Badge variant="secondary" className="text-xs font-normal">
                                                                {expense.location || 'Principal'}
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-xs">{tipoDoc}</TableCell>
                                                    <TableCell className="text-xs font-mono">{serie}</TableCell>
                                                    <TableCell className="text-xs font-mono">{nroDoc}</TableCell>
                                                    <TableCell className="text-sm max-w-[200px]">
                                                        <div className="truncate" title={nombre}>
                                                            {nombre}
                                                        </div>
                                                        {expense.status === 'pending_audit' && (
                                                            <div className="text-[10px] text-amber-600 mt-0.5">
                                                                Pendiente auditoría
                                                            </div>
                                                        )}
                                                        {expense.status === 'voided' && (
                                                            <div className="text-[10px] text-muted-foreground mt-0.5">
                                                                Anulado
                                                            </div>
                                                        )}
                                                        {expense.status === 'rejected' && (
                                                            <div className="text-[10px] text-red-600 mt-0.5">
                                                                Rechazado
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell
                                                        className={`text-right font-bold whitespace-nowrap tabular-nums ${
                                                            isIncome ? 'text-emerald-600' : 'text-red-600'
                                                        }`}
                                                    >
                                                        {isIncome
                                                            ? `${formatCurrencyEs(expense.amount)}`
                                                            : `-${formatCurrencyEs(expense.amount)}`}
                                                    </TableCell>
                                                    <TableCell className="text-right p-1 align-middle">
                                                        {expense.status === 'voided' ||
                                                        expense.status === 'rejected' ? (
                                                            <span className="text-[10px] text-muted-foreground">
                                                                {pettyCashStatusLabel(expense.status)}
                                                            </span>
                                                        ) : expense.status === 'approved' ? (
                                                            <Badge className="text-[10px] shrink-0 bg-emerald-600 hover:bg-emerald-600">
                                                                Aprobado
                                                            </Badge>
                                                        ) : expense.status === 'pending_audit' &&
                                                          canApprovePettyCashMovements(currentUser, roles) &&
                                                          !weekAlreadyClosed ? (
                                                            <div className="flex justify-end gap-0.5">
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-8 w-8"
                                                                    title="Aprobar movimiento"
                                                                    onClick={() => approvePettyMovement(expense)}
                                                                >
                                                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                                    title="Rechazar movimiento"
                                                                    onClick={() => rejectPettyMovement(expense)}
                                                                >
                                                                    <XCircle className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <Badge variant="secondary" className="text-[10px]">
                                                                Pend. auditoría
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right p-1">
                                                        {canRevokeFundDelivery ? (
                                                            <div className="flex justify-end gap-0.5">
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                                    title="Revocar dotación semanal (super admin)"
                                                                    onClick={() => revokeFundDelivery(expense)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ) : isIncome ? (
                                                            <span className="text-muted-foreground text-xs pr-2">
                                                                —
                                                            </span>
                                                        ) : isVoidedOrRejected ? (
                                                            <Badge variant="outline" className="text-[10px]">
                                                                {expense.status === 'voided' ? 'Anulado' : 'Rechaz.'}
                                                            </Badge>
                                                        ) : canRowActions ? (
                                                            <div className="flex justify-end gap-0.5">
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-8 w-8"
                                                                    title="Editar movimiento"
                                                                    onClick={() => openEditExpense(expense)}
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                                    title="Anular movimiento"
                                                                    onClick={() => voidExpense(expense)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <span
                                                                className="text-muted-foreground text-xs pr-2"
                                                                title={
                                                                    weekAlreadyClosed
                                                                        ? 'Semana cerrada'
                                                                        : 'Sin permiso para modificar'
                                                                }
                                                            >
                                                                —
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    {currentWeekExpenses.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                                                No hay gastos registrados en esta semana para {selectedCustodian?.name}.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {currentWeekExpenses.length > 0 && filtered.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                                                Ningún movimiento coincide con la búsqueda.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                            </>
                                        );
                                    })()}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>

                    <TabsContent value="summary">
                        <Card className="border-dashed">
                            <CardHeader>
                                <CardTitle>Rendición de Caja Chica ({selectedCustodian?.name}) — Sem. {selectedWeek}</CardTitle>
                                <CardDescription>
                                    Periodo: {selectedWeekRangeLabel}. Resumen para reembolso y cuadre de caja.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center py-2 border-b">
                                        <span className="text-muted-foreground">Fondo de apertura (semana)</span>
                                        <span className="font-medium">{formatCurrencyEs(openingFundForWeek)}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b">
                                        <span className="text-muted-foreground">Total gastos</span>
                                        <span className="font-bold text-red-500">- {formatCurrencyEs(weeklyExpenseTotal)}</span>
                                    </div>
                                    {weeklyIncomeTotal > 0 ? (
                                        <div className="flex justify-between items-center py-2 border-b">
                                            <span className="text-muted-foreground">Reposiciones / ingresos</span>
                                            <span className="font-bold text-emerald-600">
                                                + {formatCurrencyEs(weeklyIncomeTotal)}
                                            </span>
                                        </div>
                                    ) : null}
                                    <div className="flex justify-between items-center py-2 border-b bg-muted/20 px-2 rounded">
                                        <span className="font-medium">Saldo Final Calculado</span>
                                        <span className="font-bold text-primary">{formatCurrencyEs(currentBalance)}</span>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-sm font-medium mb-3">Desglose por Categoría</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {breakdownCategoryKeys.map((catKey) => {
                                            const catVal = categoryStyles[catKey] ?? { label: catKey, color: '' };
                                            const catTotal = currentWeekExpenses
                                                .filter(
                                                    (e) =>
                                                        e.category === catKey &&
                                                        validWeekTx(e) &&
                                                        (e.type === 'expense' || !e.type)
                                                )
                                                .reduce((acc, curr) => acc + curr.amount, 0);
                                            
                                            if (catTotal === 0) return null;

                                            return (
                                                <div key={catKey} className="border rounded p-3 text-center bg-card">
                                                    <div className="text-xs text-muted-foreground mb-1">{catVal.label}</div>
                                                    <div className="font-bold text-lg">{formatCurrencyEs(catTotal)}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Banknote className="h-5 w-5 text-amber-600" />
                            Refuerzo extraordinario de fondo
                        </DialogTitle>
                        <DialogDescription>
                            Se registra un <strong>ingreso aprobado</strong> para{' '}
                            <strong>{selectedCustodian?.name ?? 'el responsable'}</strong> en la semana{' '}
                            <strong>{selectedWeek}</strong>. Suma al saldo disponible (casos excepcionales).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 py-2">
                        {sedeOptions.length > 1 ? (
                            <div className="space-y-1">
                                <Label className="text-xs">Sede del registro</Label>
                                <Select value={topupSede} onValueChange={setTopupSede}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sedeOptions.map((s) => (
                                            <SelectItem key={s} value={s}>
                                                {s}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : null}
                        <div className="space-y-1">
                            <Label className="text-xs">Monto (S/)</Label>
                            <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={topupAmount}
                                onChange={(e) => setTopupAmount(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Motivo / referencia</Label>
                            <Textarea
                                value={topupNote}
                                onChange={(e) => setTopupNote(e.target.value)}
                                placeholder="Ej. Autorización gerencia, operación extraordinaria…"
                                rows={3}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setTopupOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="button" onClick={handleSaveAdminTopup}>
                                Registrar refuerzo
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={deliveryOpen} onOpenChange={setDeliveryOpen}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            Confirmar entrega de dotación semanal
                        </DialogTitle>
                        <DialogDescription>
                            Registra la entrega física del fondo fijo a{' '}
                            <strong>{selectedCustodian?.name ?? 'el responsable'}</strong> para la semana{' '}
                            <strong>{selectedWeek}</strong>.
                            {weekOpening.isPeriodOpeningWeek ? (
                                <> Apertura de periodo: confirme arrastre y dotación por separado.</>
                            ) : weekOpening.carryFromPrevious > 0 ? (
                                <>
                                    {' '}
                                    Arrastre del cierre anterior:{' '}
                                    <strong>{formatCurrencyEs(weekOpening.carryFromPrevious)}</strong>.
                                </>
                            ) : null}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 py-2">
                        {weekOpening.isPeriodOpeningWeek ? (
                            <div className="space-y-1">
                                <Label className="text-xs">Arrastre de periodo anterior (S/)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={deliveryCarryAmount}
                                    onChange={(e) => setDeliveryCarryAmount(e.target.value)}
                                    placeholder={
                                        openingCarryState.availableSuggested > 0
                                            ? String(openingCarryState.availableSuggested)
                                            : '0.00'
                                    }
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Sugerido en config:{' '}
                                    {formatCurrencyEs(openingCarryState.availableSuggested)} (no suma al fondo
                                    fijo).
                                </p>
                            </div>
                        ) : null}
                        <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                            Dotación fondo fijo sugerida:{' '}
                            <strong className="text-foreground">{formatCurrencyEs(currentLimit)}</strong>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Dotación entregada (S/)</Label>
                            <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={deliveryAmount}
                                onChange={(e) => setDeliveryAmount(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">
                                Motivo {Math.abs(parseFloat(deliveryAmount.replace(',', '.')) - currentLimit) > 0.009
                                    ? '(obligatorio si difiere del configurado)'
                                    : '(opcional)'}
                            </Label>
                            <Textarea
                                value={deliveryReason}
                                onChange={(e) => setDeliveryReason(e.target.value)}
                                placeholder="Ej. Entrega parcial autorizada por tesorería…"
                                rows={3}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setDeliveryOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="button" onClick={handleSaveFundDelivery}>
                                Confirmar entrega
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog
                open={editOpen}
                onOpenChange={(open) => {
                    if (!open) closeEditExpense();
                }}
            >
                <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Editar movimiento de caja chica</DialogTitle>
                        <DialogDescription>
                            Corrija datos del comprobante o del gasto. No puede duplicar RUC/DNI + serie + nro. de otro
                            gasto activo.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 py-2">
                        {sedeOptions.length > 1 ? (
                            <div className="space-y-1">
                                <Label className="text-xs">Sede</Label>
                                <Select value={editLocation} onValueChange={setEditLocation}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Sede" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sedeOptions.map((s) => (
                                            <SelectItem key={s} value={s}>
                                                {s}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : null}

                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label className="text-xs">Categoría</Label>
                                <Select value={editCategory} onValueChange={setEditCategory}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categoryCatalog.map((c) => (
                                            <SelectItem key={c} value={c}>
                                                {c}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Área</Label>
                                <Select value={editArea} onValueChange={setEditArea}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {areaCatalog.map((a) => (
                                            <SelectItem key={a} value={a}>
                                                {a}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs">Fecha del documento</Label>
                            <Input
                                type="date"
                                value={editDocumentDate}
                                onChange={(e) => setEditDocumentDate(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label className="text-xs">Tipo de documento</Label>
                                <Select value={editClassification} onValueChange={setEditClassification}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Boleta">Boleta</SelectItem>
                                        <SelectItem value="Factura">Factura</SelectItem>
                                        <SelectItem value="RXH">Recibo por honorarios</SelectItem>
                                        <SelectItem value="Recibo Simple">Recibo simple</SelectItem>
                                        <SelectItem value="Planilla de Movilidad">Planilla de Movilidad</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Tipo de identidad</Label>
                                <Select value={editDocType} onValueChange={setEditDocType}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="RUC">RUC</SelectItem>
                                        <SelectItem value="DNI">DNI</SelectItem>
                                        <SelectItem value="CE">CE</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs">N° RUC / DNI / CE</Label>
                            <Input
                                className="font-mono"
                                inputMode="numeric"
                                autoComplete="off"
                                value={editDocNumber}
                                onChange={(e) =>
                                    setEditDocNumber(
                                        normalizeDocIdentityDigits(e.target.value, editDocType)
                                    )
                                }
                                placeholder={
                                    editDocType === 'RUC'
                                        ? '11 dígitos'
                                        : editDocType === 'DNI'
                                          ? '8 dígitos'
                                          : '9 dígitos'
                                }
                            />
                            {editNormDoc.length > 0 && (
                                <p
                                    className={`text-[11px] ${editCatalogMatch ? 'text-emerald-600' : 'text-amber-600'}`}
                                >
                                    {editCatalogMatch
                                        ? `${editDocType} validado en catálogo.`
                                        : editNormDoc.length < editDocIdentityLimit
                                          ? `Complete ${editDocIdentityLimit} dígitos (${editNormDoc.length}/${editDocIdentityLimit}).`
                                          : `${editDocType} no encontrado en catálogo.`}
                                </p>
                            )}
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs">Razón social / Nombre</Label>
                            <Input
                                value={editProviderName}
                                onChange={(e) => setEditProviderName(e.target.value)}
                                readOnly={!!editCatalogMatch}
                            />
                            {editDocIdentityComplete && !editCatalogMatch && (
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-600/30 rounded px-2 py-1.5">
                                    <span>
                                        Proveedor no existe en catálogo. Regístrelo con «Caja chica (rápido)» en
                                        Proveedores.
                                    </span>
                                    {onRequestProviderRegistration ? (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-7 shrink-0 text-[11px]"
                                            onClick={onRequestProviderRegistration}
                                        >
                                            Ir a Proveedores
                                        </Button>
                                    ) : null}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label className="text-xs">Serie</Label>
                                <Input value={editDocSeries} onChange={(e) => setEditDocSeries(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Nro. de documento</Label>
                                <Input value={editVoucherNumber} onChange={(e) => setEditVoucherNumber(e.target.value)} />
                            </div>
                        </div>

                        <div className="text-[10px] text-muted-foreground -mt-1">
                            {editUsesIgv
                                ? 'Factura: base imponible + IGV (10% o 18%) + inafecto opcional = total a pagar.'
                                : 'Sin IGV: el monto completo es el gasto y la salida de caja.'}
                        </div>

                        {editUsesIgv ? (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="edit-igv10"
                                        checked={editInvoiceIgv10}
                                        onCheckedChange={(c) => setEditInvoiceIgv10(c === true)}
                                    />
                                    <Label htmlFor="edit-igv10" className="text-xs cursor-pointer font-normal">
                                        IGV 10% (si no: 18%)
                                    </Label>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-1 min-w-0">
                                        <Label className="text-xs">Base imponible</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            value={editAmountBI}
                                            onChange={(e) => setEditAmountBI(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1 min-w-0">
                                        <Label className="text-xs">IGV ({editInvoiceIgv10 ? 10 : 18}%)</Label>
                                        <Input
                                            readOnly
                                            value={badBiE ? '—' : formatNumberEs(editIgvPreview)}
                                            className="bg-muted"
                                        />
                                    </div>
                                    <div className="space-y-1 min-w-0">
                                        <Label className="text-xs">Total</Label>
                                        <Input
                                            readOnly
                                            value={
                                                Number.isFinite(editTotalPreview) && editTotalPreview > 0
                                                    ? formatNumberEs(editTotalPreview)
                                                    : ''
                                            }
                                            className="bg-muted font-semibold"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1 max-w-xs">
                                    <Label className="text-xs">Inafecto (opcional)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        value={editAmountExempt}
                                        onChange={(e) => setEditAmountExempt(e.target.value)}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-1 max-w-[200px]">
                                <Label className="text-xs">Importe gasto</Label>
                                <Input
                                    type="number"
                                    value={editAmountBI}
                                    onChange={(e) => setEditAmountBI(e.target.value)}
                                />
                            </div>
                        )}

                        <div className="space-y-1">
                            <Label className="text-xs">Descripción</Label>
                            <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
                        </div>

                        <div className="flex items-center gap-2">
                            <Switch checked={editIsExtra} onCheckedChange={setEditIsExtra} id="edit-extra" />
                            <Label htmlFor="edit-extra" className="text-xs cursor-pointer">
                                Gasto extraordinario
                            </Label>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={closeEditExpense}>
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                onClick={saveEditExpense}
                                disabled={
                                    editDocIdentityComplete && !editCatalogMatch
                                }
                                title={
                                    editDocIdentityComplete && !editCatalogMatch
                                        ? 'El documento de identidad no está en el catálogo de proveedores'
                                        : undefined
                                }
                            >
                                Guardar cambios
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
