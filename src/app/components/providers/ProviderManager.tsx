import { useState, useRef, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
    ChartOfAccountEntry,
    Provider,
    ProviderDocIdentityType,
    ProviderPettyExpenseLine,
    SystemSettings,
} from '../../types';
import { ConfigStructure, getConceptsFlat, getSubcategories } from '../../data/initialData';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '../ui/select';
import { 
    Plus, Search, Edit2, Trash2, Building2, Phone, Mail, Clock, Save, 
    X, CreditCard, User, Upload, FileDown, CheckCircle2, XCircle, 
    Landmark, Settings, List, Wallet, Users, Info, ShoppingCart, FileText,
    ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import { getProviderDocumentLabel, mergeProviderUsageContexts } from '../../utils/providerAccounting';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { toast } from 'sonner';
import { getProviderAreas, getProviderCategories } from '../../utils/providerCatalog';
import {
  CHART_OPERATIVE_LEVEL,
  chartSelectOptionsWithOrphanExpenseClasses,
  findChartEntryByCode,
  normalizeAccountCode,
} from '../../utils/chartOfAccountsHelpers';
import {
    getDocIdentityDigitLimit,
    normalizeDocIdentityDigits,
    providerDocDigitsEqual,
    resolveProviderDocIdentityType,
} from '../../utils/pettyCashDocIdentity';
import {
    encodeFlowClassification,
    getAllFlowClassificationValidKeys,
    migrateLegacyFlowClassification,
    resolveFlowClassificationShortLabel,
} from '../../utils/expenseFlowClassification';
import { formatCurrencyEs } from '../../utils/numberFormat';
import { getGrooflowBackend } from '../../config/backend';
import { useServerPagedList } from '../../hooks/useServerPagedList';
import { deleteServerListItems, fetchServerListPage } from '../../utils/listsApi';
import { appConfirm } from '../ui/app-dialog';

interface ProviderManagerProps {
    providers: Provider[];
    /** true = guardado en KV correcto; false = no aplicar cierre de diálogos / mensaje de éxito */
    onUpdateProviders: (providers: Provider[]) => boolean | Promise<boolean>;
    userRole?: string;
    config?: ConfigStructure; // Configuración global inyectada (Flujo de Caja)
    systemSettings?: SystemSettings; // Configuración persistente del sistema
    onUpdateSystemSettings?: (settings: SystemSettings) => void;
    /** Abre automáticamente el formulario corto "Caja chica (rápido)". */
    openSimplePettyOnMount?: boolean;
    /** Callback para limpiar el trigger de apertura automática. */
    onSimplePettyOpenHandled?: () => void;
    /** Plan de cuentas importado (opcional): selector de cuenta de gasto. */
    chartOfAccounts?: ChartOfAccountEntry[];
    /** Categorías “motivo” de caja chica (mismo listado que en registro de gasto). */
    pettyCashCommercialCategories: string[];
}

function normalizeImportKey(s: string) {
    return s
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

/** Lee la primera columna con valor entre varios alias (comparación insensible a mayúsculas / espacios). */
function getImportCell(row: Record<string, unknown>, ...aliases: string[]): unknown {
    for (const a of aliases) {
        const target = normalizeImportKey(a);
        for (const key of Object.keys(row)) {
            if (normalizeImportKey(key) === target) {
                const v = row[key];
                if (v !== undefined && v !== null && String(v).trim() !== '') {
                    return v;
                }
            }
        }
    }
    for (const a of aliases) {
        if (a in row) {
            const v = row[a];
            if (v !== undefined && v !== null && String(v).trim() !== '') {
                return v;
            }
        }
    }
    return undefined;
}

/** Comprueba tipo explícito y longitud, o infiere DNI(8) / CE(9) / RUC(11) si "Tipo documento" está vacío. */
function parseImportDocument(
    docRaw: unknown,
    tipoRaw: unknown,
): { digits: string; docType: ProviderDocIdentityType } | null {
    const digits = String(docRaw ?? '')
        .replace(/\D/g, '')
        .trim();
    if (!digits) return null;

    const rawTipo = String(tipoRaw ?? '').trim();
    const t = rawTipo
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (t === 'ruc' || t === 'r.u.c' || t === 'r.u.c.') {
        return digits.length === 11 ? { digits, docType: 'RUC' } : null;
    }
    if (t === 'dni') {
        return digits.length === 8 ? { digits, docType: 'DNI' } : null;
    }
    if (t === 'ce' || t === 'c.e' || t === 'c.e.c' || t === 'carnet' || t === 'carne' || t === 'ce.') {
        return digits.length === 9 ? { digits, docType: 'CE' } : null;
    }

    if (!rawTipo) {
        if (digits.length === 11) return { digits, docType: 'RUC' };
        if (digits.length === 8) return { digits, docType: 'DNI' };
        if (digits.length === 9) return { digits, docType: 'CE' };
    }
    return null;
}

function inferDocIdentityTypeFromSaved(
    p: Pick<Provider, 'ruc' | 'docIdentityType'>,
): ProviderDocIdentityType {
    if (p.docIdentityType) return p.docIdentityType;
    const d = String(p.ruc ?? '').replace(/\D/g, '');
    if (d.length === 8) return 'DNI';
    if (d.length === 9) return 'CE';
    return 'RUC';
}

function parseImportBoolean(value: unknown, whenEmpty: boolean): boolean {
    if (value === undefined || value === null) return whenEmpty;
    const s = String(value).trim().toLowerCase();
    if (s === '') return whenEmpty;
    if (['s', 'sí', 'si', '1', 'true', 'yes', 'x', 'y'].includes(s)) return true;
    if (['n', 'no', '0', 'false', 'f'].includes(s)) return false;
    return whenEmpty;
}

function parseProviderTypeFromImport(value: unknown): NonNullable<Provider['type']> {
    const s = String(value ?? '')
        .trim()
        .toLowerCase();
    if (!s) return 'Mercaderia';
    if (s.includes('méd') || s.includes('medic') || s === 'médico externo') {
        return 'Médico Externo';
    }
    if (s.includes('servic')) return 'Servicios';
    if (s.includes('merc')) return 'Mercaderia';
    if (s === 'servicios') return 'Servicios';
    if (s === 'mercaderia' || s === 'mercadería') return 'Mercaderia';
    return 'Mercaderia';
}

/**
 * Pares: "Motivo:cuenta" o "Motivo|cuenta", separados por ; o | entre pares.
 * Cuenta opcional. Ej: "Insumos:6510101; Farmacia" o "Transporte:651|6520200"
 */
/**
 * Si existe plan importado y el código existe, devuelve el código canónico (`entry.code`).
 * Si no hay plan o no hay coincidencia, devuelve el valor sin espacios o solo dígitos según alcance típico.
 */
function resolveChartCodeForImport(
    chart: ChartOfAccountEntry[],
    raw: unknown,
): string | undefined {
    if (raw === undefined || raw === null) return undefined;
    const s = String(raw).trim().replace(/\u00a0/g, '');
    if (!s) return undefined;
    if (!chart.length) return s.replace(/\s+/g, '');
    const hit = findChartEntryByCode(chart, s);
    if (hit) return hit.code.trim();
    return normalizeAccountCode(s) || s.replace(/\s+/g, '');
}

function parsePettyLinesFromImport(
    value: unknown,
    rowSeed: string,
    chart: ChartOfAccountEntry[],
): ProviderPettyExpenseLine[] {
    if (value === undefined || value === null) return [];
    const raw = String(value).trim();
    if (!raw) return [];
    const segments = raw
        .split(/[;\uFF1B\r\n]+/)
        .map((p) => p.trim())
        .filter(Boolean);
    const lines: ProviderPettyExpenseLine[] = [];
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        let commercialCategory: string;
        let commercialArea: string | undefined;
        let defaultAccountingAccount: string | undefined;
        if (seg.includes(':')) {
            const idx = seg.indexOf(':');
            const left = seg.slice(0, idx).trim();
            defaultAccountingAccount = seg.slice(idx + 1).trim() || undefined;
            const [cat, ar] = left.split('@').map((p) => p.trim());
            commercialCategory = cat || left;
            commercialArea = ar || undefined;
        } else if (seg.includes('|')) {
            const parts = seg.split('|').map((p) => p.trim());
            commercialCategory = parts[0] || '';
            commercialArea = parts[1] || undefined;
            defaultAccountingAccount = parts[2] || undefined;
        } else {
            commercialCategory = seg;
        }
        if (!commercialCategory) continue;
        const acctResolved = defaultAccountingAccount
            ? resolveChartCodeForImport(chart, defaultAccountingAccount)
            : undefined;
        lines.push({
            id: `pel-imp-${rowSeed}-${i}`,
            commercialCategory,
            commercialArea,
            defaultAccountingAccount: acctResolved,
        });
    }
    return lines;
}

// Fallback por si no llega config externa de egresos
const PROVIDER_TABLE_PAGE_SIZES = [10, 25, 50, 100] as const;

const DEFAULT_EXPENSE_CATEGORIES_FALLBACK = [
    "Insumos Médicos", "Farmacia", "Alimentos", "Servicios Básicos", 
    "Mantenimiento", "Alquileres", "Publicidad", "Software", 
    "Consultoría", "Seguros", "Impuestos", "Comisiones Bancarias", 
    "Activos Fijos", "Otros"
];

export function ProviderManager({ 
    providers, 
    onUpdateProviders, 
    userRole = 'admin', 
    config,
    systemSettings,
    onUpdateSystemSettings,
    openSimplePettyOnMount = false,
    onSimplePettyOpenHandled,
    chartOfAccounts = [],
    pettyCashCommercialCategories,
}: ProviderManagerProps) {
    
    // --- Resolución de Listas (Prioridad: SystemSettings > Defaults) ---
    const providerCategories = getProviderCategories(systemSettings);
    const areas = getProviderAreas(systemSettings);

    // Solo usamos este estado local si NO se provee `config` (fallback para egresos)
    const [localExpenseCategories, setLocalExpenseCategories] = useState<string[]>(DEFAULT_EXPENSE_CATEGORIES_FALLBACK);
    
    // --- Estados de UI ---
    const [isEditing, setIsEditing] = useState(false);
    const [isSavingProvider, setIsSavingProvider] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [currentProvider, setCurrentProvider] = useState<Partial<Provider>>({});
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [importPreview, setImportPreview] = useState<{
        toCreate: Provider[];
        toUpdate: Provider[];
        sampleNew: string[];
        sampleExisting: string[];
        fileDupes: number;
        errors: number;
        invalidCatalog: number;
        invalidRuc: number;
        invalidPettyMotive: number;
        invalidExpenseClassification: number;
        chartCodeNotFound: number;
    } | null>(null);
    const [importApplying, setImportApplying] = useState(false);
    const [clientSearch, setClientSearch] = useState('');
    const [providerTablePage, setProviderTablePage] = useState(1);
    const [providerTablePageSize, setProviderTablePageSize] = useState<number>(25);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [selectAllMatching, setSelectAllMatching] = useState(false);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const useServerPaging = getGrooflowBackend() === 'rest';
    const serverList = useServerPagedList<Provider>('providers', {
        initialPageSize: 25,
        enabled: useServerPaging,
    });
    const searchTerm = useServerPaging ? serverList.search : clientSearch;
    const setSearchTerm = useServerPaging ? serverList.setSearch : setClientSearch;
    const [isSimplePettyOpen, setIsSimplePettyOpen] = useState(false);
    const [simplePetty, setSimplePetty] = useState({
        docType: 'RUC' as 'RUC' | 'DNI' | 'CE',
        ruc: '',
        name: '',
        type: 'Mercaderia' as NonNullable<Provider['type']>,
        category: 'Otros',
        area: '',
        accountingAccount: '',
    });
    
    // --- Estados para el Modal de Configuración ---
    const [configTab, setConfigTab] = useState<'commercial' | 'financial' | 'areas'>('commercial');
    const [newItemValue, setNewItemValue] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Derivamos las opciones de egresos desde la config global si existe ---
    const expenseOptions = useMemo(() => {
        if (config) {
            const options: { category: string; concepts: string[] }[] = [];
            Object.entries(config).forEach(([catName, def]) => {
                if (def.type === 'expense') {
                    options.push({
                        category: catName,
                        concepts: getConceptsFlat(def).map((c) => c.name),
                    });
                }
            });
            return { type: 'grouped', data: options };
        } else {
            return { type: 'flat', data: localExpenseCategories };
        }
    }, [config, localExpenseCategories]);

    const expenseClassificationValidKeys = useMemo(() => {
        const set = getAllFlowClassificationValidKeys(config);
        if (!config) {
            for (const x of localExpenseCategories) {
                if (x.trim()) set.add(x.trim());
            }
        }
        return set;
    }, [config, localExpenseCategories]);

    /** Muestra en plantilla Excel: primer concepto de egreso (nombre legible). */
    const templateSampleExpenseConcept = useMemo(() => {
        if (!config) return localExpenseCategories[0] ?? 'Otros';
        for (const [catName, def] of Object.entries(config)) {
            if (def.type === 'expense') {
                const subs = getSubcategories(def, catName);
                const c0 = subs[0]?.concepts[0];
                if (c0) return c0.name;
            }
        }
        return 'Otros';
    }, [config, localExpenseCategories]);

    // --- Helper para obtener la lista activa en el modal de configuración ---
    const getActiveList = () => {
        switch(configTab) {
            case 'commercial': return providerCategories;
            case 'financial': return config ? [] : localExpenseCategories; // Si hay config externa, esto no se usa
            case 'areas': return areas;
        }
    };

    // --- Lógica de Configuración (CRUD de listas con persistencia) ---
    const updateSettings = (newCategories?: string[], newAreas?: string[]) => {
        if (!systemSettings || !onUpdateSystemSettings) {
            toast.error("No se puede guardar la configuración (Error de Sistema)");
            return;
        }

        const updatedSettings: SystemSettings = {
            ...systemSettings,
            providers: {
                categories: newCategories || providerCategories,
                areas: newAreas || areas
            }
        };
        onUpdateSystemSettings(updatedSettings);
    };

    const handleAddItem = () => {
        if (!newItemValue.trim()) return;
        const value = newItemValue.trim();
        
        switch(configTab) {
            case 'commercial':
                if (providerCategories.includes(value)) return toast.error("Ya existe esta categoría");
                updateSettings([...providerCategories, value], undefined);
                break;
                
            case 'areas':
                if (areas.includes(value)) return toast.error("Ya existe esta área");
                updateSettings(undefined, [...areas, value]);
                break;

            case 'financial':
                if (config) {
                    toast.error("Las categorías financieras se gestionan desde Configuración > Operaciones");
                    return;
                }
                if (localExpenseCategories.includes(value)) return toast.error("Ya existe esta clasificación");
                setLocalExpenseCategories([...localExpenseCategories, value]); // Local state fallback
                break;
        }
        setNewItemValue('');
        toast.success("Elemento agregado");
    };

    const handleDeleteItem = async (item: string) => {
        if (!(await appConfirm(`¿Eliminar "${item}" de la lista?`, { title: 'Eliminar de catálogo', confirmLabel: 'Eliminar' }))) return;
        
        switch(configTab) {
            case 'commercial':
                updateSettings(providerCategories.filter(i => i !== item), undefined);
                break;
            case 'areas':
                updateSettings(undefined, areas.filter(i => i !== item));
                break;
            case 'financial':
                if (config) return;
                setLocalExpenseCategories(prev => prev.filter(i => i !== item));
                break;
        }
    };

    // --- Lógica Principal (Importación, Guardado, etc) ---

    const handleDownloadTemplate = () => {
        const sampleCat = providerCategories[0] ?? 'Otros';
        const sampleArea = areas[0] ?? 'Administración';
        const firstExpenseConcept = templateSampleExpenseConcept;

        const m0 = pettyCashCommercialCategories[0] || 'Insumos';
        const m1 = pettyCashCommercialCategories[1] || m0;
        const motiveWithAccountExample = `${m0}:651010101; ${m1}`;

        const baseRowMercaderia = {
            Categoría: sampleCat,
            Área: sampleArea,
            'Tipo (Mercaderia|Servicios|Médico Externo)': 'Mercaderia',
            'Especialidad (solo Médico Externo)': '',
            'Clasif. flujo caja (reporte)': firstExpenseConcept,
            'Días crédito': 30,
            Email: 'ventas@ejemplo.com',
            Teléfono: '987654321',
            Contacto: 'Juan Pérez',
            Banco: 'BCP',
            'Cuenta bancaria / CCI': '191-12345678-0-01',
            [`Cuenta contable gasto (NIVEL ${CHART_OPERATIVE_LEVEL})`]: '',
            'Cuenta sugerida (compras)': '',
            'Cuenta sugerida (honorarios)': '',
            'Módulo caja chica (Sí/No)': 'Sí',
            'Módulo compras (Sí/No)': 'Sí',
            'Módulo honorarios (Sí/No)': 'Sí',
            'Motivos caja (Motivo1:cuenta1; Motivo2; …)': motiveWithAccountExample,
        };

        const rowMedicoExterno = {
            'Razón Social': 'Dra. Veterinaria Outsourcing SAC',
            'Número documento': '20555123456',
            'Tipo documento (RUC|DNI|CE)': 'RUC',
            ...baseRowMercaderia,
            'Tipo (Mercaderia|Servicios|Médico Externo)': 'Médico Externo',
            'Especialidad (solo Médico Externo)': 'Cirugía / hospitalización',
            'Módulo caja chica (Sí/No)': 'No',
            'Motivos caja (Motivo1:cuenta1; Motivo2; …)': '',
        };

        const templateData = [
            {
                'Razón Social': 'Distribuidora Ejemplo S.A.C.',
                'Número documento': '20123456789',
                'Tipo documento (RUC|DNI|CE)': 'RUC',
                ...baseRowMercaderia,
            },
            {
                'Razón Social': 'Pérez Sánchez Juan (persona / R.H.)',
                'Número documento': '40123456',
                'Tipo documento (RUC|DNI|CE)': 'DNI',
                ...baseRowMercaderia,
            },
            {
                'Razón Social': 'Proveedor CE (ejemplo extranjería)',
                'Número documento': '091234567',
                'Tipo documento (RUC|DNI|CE)': 'CE',
                ...baseRowMercaderia,
            },
            rowMedicoExterno,
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const nivelLabel = CHART_OPERATIVE_LEVEL;
        const instructions = XLSX.utils.aoa_to_sheet([
            ['GrooFlow — plantilla importación masiva proveedores (v2, hojas Proveedores + Instrucciones)'],
            [''],
            ['1. Obligatorios en cada fila'],
            ['   • Razón social (o alias Nombre / Proveedor / Supplier / Business Name).'],
            ['   • Número de documento: solo dígitos; RUC=11, DNI=8, CE=9. Formato TEXTO en Excel evita pérdida de ceros.'],
            ['   • Categoría comercial: debe coincidir EXACTAMENTE con Finanzas / Config → Contabilidad → categorías.'],
            ['   • Área: opcional; si tiene valor debe existir en el mismo catálogo.'],
            [''],
            ['2. Inferencia tipo documento'],
            ['   • Si «Tipo documento (RUC|DNI|CE)» está vacío, se deduce por longitud (11=RUC, 8=DNI, 9=CE).'],
            [''],
            ['3. Clasificación flujo de caja'],
            [
                `   • Columna recomendada: «Clasif. flujo caja (reporte)». Si existe Config → Operaciones (egresos), el texto debe coincidir con un concepto definido.`,
            ],
            ['   • Si queda vacía se usa por defecto «Otros» (solo si no hay whitelist estricto con otro comportamiento esperado).'],
            [''],
            [`4. Cuentas del plan (${nivelLabel} típico operativo gastos)`],
            [
                `   • Columna principal «Cuenta contable gasto (NIVEL ${nivelLabel})» (alias incl. «Cuenta contable (gasto N5)». Si cambia nivel en tu plan PCGE/Starsoft, sigue usando el nivel que importaste en Plan de cuentas).`,
            ],
            [
                `   • Códigos pueden llevar formato con o sin puntos; al guardar se alinean con el plan cargado cuando hay coincidencia por dígitos.`,
            ],
            ['   • Cuentas sugeridas (compras / honorarios): opcional; mismo criterio.'],
            [''],
            ['5. Ámbitos (uso en app)'],
            [
                `   • Módulo caja chica / compras / honorarios (Sí/No): sí, s, 1, x → activo; no, n, 0 → excluye. Vacío = Sí en los tres.`,
            ],
            [''],
            ['6. Motivos de caja chica (lista en una celda)'],
            [
                '   • Ej.: «Farmacia; Insumos:651010101» separando MOTIVOS con punto y coma o salto de línea.',
            ],
            ['   • Cada pareja: Motivo:cuentaNivel o Motivo|cuenta. El MOTIVO debe existir en el catálogo (Config → Contabilidad) si ese catálogo está definido.'],
            [''],
            ['Columna (principal)', 'Descripción y alias compatibles'],
            [''],
            [
                'Razón Social / Nombre',
                'Nombre fiscal o comercial. Alias: Nombre, Proveedor, Supplier, Razón Social, Business Name.',
            ],
            [
                'Número documento',
                'Solo dígitos. Alias: Documento, RUC (legado), Nº documento, Tax ID (si son solo dígitos).',
            ],
            ['Tipo documento (RUC|DNI|CE)', 'Valores: RUC, DNI o CE (o vacío para inferencia). Alias: Tipo de documento.'],
            ['Categoría', 'Catálogo comercial. Alias: Categoría (Comercial), Categoria.'],
            ['Área', 'Área interna. Alias: Area.'],
            ['Tipo (Mercaderia|Servicios|Médico Externo)', 'Valor exacto típico. Alias: Tipo, Tipo proveedor.'],
            ['Especialidad (solo Médico Externo)', 'Opcional si no es Médico Externo. Alias: Especialidad.'],
            [
                'Clasif. flujo caja (reporte)',
                'Coincide con conceptos egreso en Operaciones cuando aplica. Alias: Clasif. Financiera, Clasificación flujo caja.',
            ],
            ['Días crédito', 'Entero. Alias: Días Crédito, Días de crédito.'],
            ['Email', 'Alias: Correo, E-mail.'],
            ['Teléfono', 'Alias: Telefono, Celular.'],
            ['Contacto', 'Alias: Persona de contacto.'],
            ['Banco', 'Nombre entidad financiera.'],
            ['Cuenta bancaria / CCI', 'Alias: CCI, Cuenta, Número de cuenta / CCI (legado CSV).'],
            [
                `Cuenta contable gasto (NIVEL ${nivelLabel})`,
                `Principal en esta plantilla. Alias: Cuenta contable (gasto N5), Cuenta de gastos, CODIGO CUENTA GASTO.`,
            ],
            ['Cuenta sugerida (compras)', 'Alias: Cuenta compras, Cuenta de compras, CUENTA COMPRAS.'],
            ['Cuenta sugerida (honorarios)', 'Alias: Cuenta honorarios.'],
            [
                'Módulo caja / compras / honorarios',
                'Tres columnas: «Módulo caja chica (Sí/No)», «Módulo compras (Sí/No)», «Módulo honorarios (Sí/No)». Ver fila de ejemplo «Médico Externo».',
            ],
            ['Motivos caja (...)', 'Alias también: Motivos caja chica, Motivos rendición (mismo formato).'],
        ]);

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Proveedores');
        XLSX.utils.book_append_sheet(workbook, instructions, 'Instrucciones');
        XLSX.writeFile(workbook, `plantilla_importacion_proveedores_grooflow_v2.xlsx`);
        toast.success('Plantilla descargada (Proveedores + Instrucciones, v2)');
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            void (async () => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName =
                    workbook.SheetNames.find(
                        (n) =>
                            n.toLowerCase().includes('proveed') && !n.toLowerCase().includes('instruc'),
                    ) || workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

                if (jsonData.length === 0) {
                    toast.error("El archivo está vacío (use la hoja con datos de proveedores)");
                    return;
                }

                const toCreate: Provider[] = [];
                const toUpdate: Provider[] = [];
                const seenInFile = new Set<string>();
                let fileDupes = 0;
                let errors = 0;
                let invalidCatalog = 0;
                let invalidRuc = 0;
                let invalidPettyMotive = 0;
                let invalidExpenseClassification = 0;
                let chartCodeNotFound = 0;

                const hasPettyCat =
                    Array.isArray(pettyCashCommercialCategories) && pettyCashCommercialCategories.length > 0;

                jsonData.forEach((row, rowIndex) => {
                    const name = getImportCell(
                        row,
                        'Razón Social',
                        'Razon Social',
                        'Nombre',
                        'Proveedor',
                        'Supplier',
                        'Supplier Name',
                        'Business Name',
                    );
                    const docNumRaw = getImportCell(
                        row,
                        'Número documento',
                        'Número de documento',
                        'Nº documento',
                        'RUC',
                        'Documento',
                        'Documento tributario',
                        'ID',
                        'Tax ID',
                    );
                    const tipoDocRaw = getImportCell(
                        row,
                        'Tipo documento (RUC|DNI|CE)',
                        'Tipo documento',
                        'Tipo de documento',
                        'Documento tipo',
                    );
                    const parsedDoc = parseImportDocument(docNumRaw, tipoDocRaw);

                    if (!name || !docNumRaw) {
                        errors++;
                        return;
                    }
                    if (!parsedDoc) {
                        invalidRuc++;
                        return;
                    }
                    const { digits: ruc, docType: importDocType } = parsedDoc;

                    if (seenInFile.has(ruc)) {
                        fileDupes++;
                        return;
                    }
                    seenInFile.add(ruc);

                    const existing = providers.find((p) => p.ruc.replace(/\D/g, '') === ruc);

                    const cCat = getImportCell(
                        row,
                        'Categoría',
                        'Categoria',
                        'Categoría (Comercial)',
                    );
                    const cArea = getImportCell(row, 'Área', 'Area');
                    const catRaw = cCat != null ? String(cCat).trim() : '';
                    const areaRaw = cArea != null ? String(cArea).trim() : '';
                    if (!catRaw || !providerCategories.includes(catRaw)) {
                        invalidCatalog++;
                        return;
                    }
                    if (areaRaw && !areas.includes(areaRaw)) {
                        invalidCatalog++;
                        return;
                    }

                    const rowSeed = `${Date.now()}-${rowIndex}`;

                    const type = parseProviderTypeFromImport(
                        getImportCell(
                            row,
                            'Tipo (Mercaderia|Servicios|Médico Externo)',
                            'Tipo',
                            'Tipo proveedor',
                        ),
                    );
                    const specialty = String(
                        getImportCell(
                            row,
                            'Especialidad (solo Médico Externo)',
                            'Especialidad',
                        ) || '',
                    ).trim();

                    const defExp = getImportCell(
                        row,
                        'Clasif. flujo caja (reporte)',
                        'Clasif. Financiera',
                        'Clasificación flujo caja',
                        'Clasificación flujo de caja',
                    );
                    const defExpTrimmed =
                        defExp != null && String(defExp).trim() !== '' ? String(defExp).trim() : '';
                    let defaultExpenseCategory = defExpTrimmed || 'Otros';
                    if (expenseClassificationValidKeys.size > 0 && defExpTrimmed !== '') {
                        if (!expenseClassificationValidKeys.has(defExpTrimmed)) {
                            invalidExpenseClassification++;
                            return;
                        }
                    }

                    const dCredit = getImportCell(
                        row,
                        'Días crédito',
                        'Días Crédito',
                        'Días de crédito',
                    );
                    const defaultCreditDays = Number(dCredit) || 0;

                    const email = String(
                        getImportCell(row, 'Email', 'Correo', 'E-mail', 'Email facturación') || '',
                    ).trim();
                    const phone = String(
                        getImportCell(row, 'Teléfono', 'Telefono', 'Celular') || '',
                    ).trim();
                    const contactName = String(
                        getImportCell(row, 'Contacto', 'Persona de contacto') || '',
                    ).trim();
                    const bankName = String(
                        getImportCell(row, 'Banco') || '',
                    ).trim();
                    const bankAccount = String(
                        getImportCell(
                            row,
                            'Cuenta bancaria / CCI',
                            'Cuenta',
                            'CCI',
                            'Cuenta Bancaria / CCI',
                        ) || '',
                    ).trim();

                    const nivelCol = `Cuenta contable gasto (NIVEL ${CHART_OPERATIVE_LEVEL})`;
                    const accountingAcc = getImportCell(
                        row,
                        nivelCol,
                        'Cuenta contable (gasto N5)',
                        'Cuenta contable (gasto)',
                        'Cuenta de gasto',
                        'CUENTA GASTOS',
                        'CODIGO CUENTA GASTO',
                    );
                    const accountingAccountResolved = accountingAcc
                        ? resolveChartCodeForImport(chartOfAccounts, accountingAcc)
                        : undefined;

                    const dPur = getImportCell(
                        row,
                        'Cuenta sugerida (compras)',
                        'Cuenta compras',
                        'CUENTA COMPRAS',
                        'Cuenta de compras',
                    );
                    const dFee = getImportCell(
                        row,
                        'Cuenta sugerida (honorarios)',
                        'Cuenta honorarios',
                        'CUENTA HONORARIOS',
                    );
                    const defaultPurchaseAccountResolved = dPur ? resolveChartCodeForImport(chartOfAccounts, dPur) : undefined;
                    const defaultProfessionalFeeAccountResolved = dFee
                        ? resolveChartCodeForImport(chartOfAccounts, dFee)
                        : undefined;

                    if (
                        chartOfAccounts.length > 0 &&
                        accountingAcc != null &&
                        String(accountingAcc).trim() !== '' &&
                        !findChartEntryByCode(chartOfAccounts, String(accountingAcc))
                    ) {
                        chartCodeNotFound++;
                    }

                    const modCc = getImportCell(
                        row,
                        'Módulo caja chica (Sí/No)',
                        'Caja chica módulo',
                    );
                    const modPc = getImportCell(
                        row,
                        'Módulo compras (Sí/No)',
                        'Módulo compra',
                    );
                    const modH = getImportCell(
                        row,
                        'Módulo honorarios (Sí/No)',
                    );
                    const usageContexts = {
                        pettyCash: parseImportBoolean(modCc, true),
                        purchases: parseImportBoolean(modPc, true),
                        professionalFees: parseImportBoolean(modH, true),
                    };

                    const motiveCell = getImportCell(
                        row,
                        'Motivos caja (Motivo1:cuenta1; Motivo2; …)',
                        'Motivos caja chica (Motivo1:cuenta1; Motivo2; …)',
                        'Motivos caja chica',
                        'Motivos caja',
                        'Motivos rendición',
                        'Motivos caja chica (texto)',
                    );
                    const pettyLines = parsePettyLinesFromImport(motiveCell, rowSeed, chartOfAccounts);
                    if (hasPettyCat && pettyLines.length > 0) {
                        for (const line of pettyLines) {
                            if (!pettyCashCommercialCategories.includes(line.commercialCategory)) {
                                invalidPettyMotive++;
                                return;
                            }
                            if (!line.commercialArea || !areas.includes(line.commercialArea)) {
                                invalidPettyMotive++;
                                return;
                            }
                        }
                    }

                    const provider: Provider = {
                        id: existing?.id ?? `prov-imp-${Date.now()}-${rowIndex}-${Math.random().toString(36).slice(2, 9)}`,
                        name: String(name).trim(),
                        ruc,
                        docIdentityType: importDocType,
                        type,
                        category: catRaw,
                        area: areaRaw || undefined,
                        specialty: type === 'Médico Externo' ? specialty : undefined,
                        defaultExpenseCategory,
                        defaultCreditDays,
                        email,
                        phone,
                        contactName,
                        bankName,
                        bankAccount,
                        totalPurchased: existing?.totalPurchased ?? 0,
                        accountingAccount: accountingAccountResolved,
                        defaultPurchaseAccount: defaultPurchaseAccountResolved,
                        defaultProfessionalFeeAccount: defaultProfessionalFeeAccountResolved,
                        usageContexts,
                        pettyExpenseLines: pettyLines.length > 0 ? pettyLines : undefined,
                        registeredVia: existing?.registeredVia ?? 'full',
                    };
                    if (existing) {
                        toUpdate.push(provider);
                    } else {
                        toCreate.push(provider);
                    }
                });

                if (fileDupes > 0) {
                    toast.warning(
                        `${fileDupes} fila(s) duplicadas en el archivo (mismo documento) se omitieron`,
                    );
                }
                if (errors > 0) {
                    toast.error(
                        `${errors} fila(s) sin razón social o sin número de documento legible`,
                    );
                }
                if (invalidRuc > 0) {
                    toast.error(
                        `${invalidRuc} fila(s) con documento inválido: RUC=11, DNI=8, CE=9 dígitos. Indique "Tipo documento" o deje en blanco para inferir por longitud. Use formato texto en Excel.`,
                    );
                }
                if (invalidCatalog > 0) {
                    toast.error(
                        `${invalidCatalog} fila(s) omitida(s): categoría inexistente o área inválida (si fue informada) en el catálogo (Config. → Contabilidad).`,
                    );
                }
                if (invalidPettyMotive > 0) {
                    toast.error(
                        `${invalidPettyMotive} fila(s) omitida(s): motivo/área de caja chica inválido. Use motivo y área del catálogo (ej. Motivo@Área:cuenta o Motivo|Área|cuenta).`,
                    );
                }
                if (invalidExpenseClassification > 0) {
                    toast.error(
                        `${invalidExpenseClassification} fila(s): «Clasif. flujo caja» no coincide con ningún concepto de egreso de Config → Operaciones. Use el texto exacto o deje vacío para «Otros» cuando aplique.`,
                    );
                }
                if (chartCodeNotFound > 0) {
                    toast.warning(
                        `${chartCodeNotFound} fila(s): la cuenta contable principal no coincide con ninguna cuenta activa del plan importado. Se guardó código normalizado; revise en Proveedores o en Plan de cuentas.`,
                    );
                }

                if (toCreate.length === 0 && toUpdate.length === 0) {
                    toast.error('No hay filas válidas para importar.');
                    return;
                }

                setImportPreview({
                    toCreate,
                    toUpdate,
                    sampleNew: toCreate.slice(0, 8).map((p) => p.name),
                    sampleExisting: toUpdate.slice(0, 8).map((p) => p.name),
                    fileDupes,
                    errors,
                    invalidCatalog,
                    invalidRuc,
                    invalidPettyMotive,
                    invalidExpenseClassification,
                    chartCodeNotFound,
                });
                setIsImportOpen(false);
            } catch (error) {
                toast.error('Error al procesar el archivo Excel');
            }
            if (fileInputRef.current) fileInputRef.current.value = '';
            })();
        };
        reader.readAsArrayBuffer(file);
    };

    const applyImportPreview = async () => {
        if (!importPreview) return;
        setImportApplying(true);
        try {
            const byId = new Map(providers.map((p) => [p.id, p]));
            for (const updated of importPreview.toUpdate) {
                byId.set(updated.id, updated);
            }
            const merged = [...byId.values(), ...importPreview.toCreate];
            const saved = await Promise.resolve(onUpdateProviders(merged));
            if (saved === false) {
                toast.error(
                    'No se pudo guardar la importación en la nube (revisa conexión o que termine la sincronización inicial). La lista local no se modificó.',
                );
                return;
            }
            const parts: string[] = [];
            if (importPreview.toCreate.length > 0) {
                parts.push(`${importPreview.toCreate.length} nuevo(s)`);
            }
            if (importPreview.toUpdate.length > 0) {
                parts.push(`${importPreview.toUpdate.length} actualizado(s)`);
            }
            toast.success(`Plantilla aplicada: ${parts.join(' · ')}.`);
            setImportPreview(null);
            if (useServerPaging) {
                void serverList.reload();
            }
        } finally {
            setImportApplying(false);
        }
    };

    /**
     * Categoría comercial: obligatoria solo si el proveedor participa en caja chica.
     * Área opcional; si se informa debe existir en catálogo.
     */
    const validateCommercialCatalogFields = (
        category: string | undefined,
        area: string | undefined,
        options: { requireCategory: boolean }
    ): boolean => {
        if (providerCategories.length === 0 || areas.length === 0) {
            toast.error('Configure al menos una categoría y un área en Configuración → Contabilidad.');
            return false;
        }
        const cat = (category ?? '').trim();
        const ar = (area ?? '').trim();
        if (options.requireCategory && !cat) {
            toast.error('La categoría comercial es obligatoria cuando el proveedor participa en caja chica.');
            return false;
        }
        if (cat && !providerCategories.includes(cat)) {
            toast.error('Seleccione una categoría comercial válida del catálogo');
            return false;
        }
        if (ar && !areas.includes(ar)) {
            toast.error('Seleccione un área válida del catálogo');
            return false;
        }
        return true;
    };

    const addPettyExpenseLine = () => {
        const first = pettyCashCommercialCategories[0] || '';
        const firstArea = areas[0] || '';
        setCurrentProvider((p) => ({
            ...p,
            pettyExpenseLines: [
                ...(p.pettyExpenseLines || []),
                {
                    id: `pel-${Date.now()}`,
                    commercialCategory: first,
                    commercialArea: firstArea,
                    defaultAccountingAccount: undefined,
                },
            ],
        }));
    };

    const updatePettyLine = (id: string, patch: Partial<ProviderPettyExpenseLine>) => {
        setCurrentProvider((p) => ({
            ...p,
            pettyExpenseLines: (p.pettyExpenseLines || []).map((l) => (l.id === id ? { ...l, ...patch } : l)),
        }));
    };

    const removePettyLine = (id: string) => {
        setCurrentProvider((p) => ({
            ...p,
            pettyExpenseLines: (p.pettyExpenseLines || []).filter((l) => l.id !== id),
        }));
    };

    const handleSave = async () => {
        if (isSavingProvider) return;
        if (!currentProvider.name || !currentProvider.ruc) {
            toast.error('El nombre y el número de documento son obligatorios');
            return;
        }

        const rucRaw = String(currentProvider.ruc ?? '').replace(/\D/g, '');
        const docT = resolveProviderDocIdentityType(
            currentProvider.docIdentityType as ProviderDocIdentityType | undefined,
            rucRaw
        );
        const rucNorm = normalizeDocIdentityDigits(rucRaw, docT);
        const need = getDocIdentityDigitLimit(docT);
        if (rucNorm.length !== need) {
            toast.error(`El ${docT} debe tener exactamente ${need} dígitos numéricos`);
            return;
        }

        const uc = {
            pettyCash: currentProvider.usageContexts?.pettyCash !== false,
            purchases: currentProvider.usageContexts?.purchases !== false,
            professionalFees: currentProvider.usageContexts?.professionalFees !== false,
        };
        const requireCommercialCategory = uc.pettyCash;

        if (
            !validateCommercialCatalogFields(currentProvider.category, currentProvider.area, {
                requireCategory: requireCommercialCategory,
            })
        ) {
            return;
        }

        const basePl = (currentProvider.pettyExpenseLines || [])
            .filter((l) => l.commercialCategory?.trim())
            .map((l) => ({
                ...l,
                commercialCategory: l.commercialCategory.trim(),
                commercialArea: l.commercialArea?.trim() || undefined,
                defaultAccountingAccount: l.defaultAccountingAccount?.trim() || undefined,
            }));

        let pl: typeof basePl = [];
        if (uc.pettyCash) {
            pl = basePl;
            const plKeys = pl.map((l) => `${l.commercialCategory.trim()}::${(l.commercialArea || '').trim()}`);
            if (plKeys.length !== new Set(plKeys).size) {
                toast.error('Cada combinación "motivo + área" debe ser única en la lista');
                return;
            }
            for (const l of pl) {
                if (!pettyCashCommercialCategories.includes(l.commercialCategory)) {
                    toast.error(`Motivo "${l.commercialCategory}" no figura en el catálogo de caja chica.`);
                    return;
                }
                if (!l.commercialArea?.trim()) {
                    toast.error(`Seleccione un área para el motivo "${l.commercialCategory}".`);
                    return;
                }
                if (!areas.includes(l.commercialArea)) {
                    toast.error(`Área "${l.commercialArea}" no figura en el catálogo comercial.`);
                    return;
                }
            }
        }

        const categoryStored = (currentProvider.category ?? '').trim();
        setIsSavingProvider(true);
        try {
            if (currentProvider.id) {
                const updated = providers.map((p) =>
                    p.id === currentProvider.id
                        ? ({
                              ...p,
                              ...currentProvider,
                              ruc: rucNorm,
                              docIdentityType: docT,
                              category: categoryStored,
                              area: currentProvider.area?.trim() || undefined,
                              pettyExpenseLines: pl,
                              usageContexts: uc,
                              defaultPurchaseAccount: undefined,
                              defaultProfessionalFeeAccount: undefined,
                          } as Provider)
                        : p
                );
                const saved = await Promise.resolve(onUpdateProviders(updated));
                if (saved === false) return;
                if (useServerPaging) await serverList.reload();
                toast.success('Proveedor actualizado');
            } else {
                if (providers.some((p) => providerDocDigitsEqual(p.ruc, rucNorm))) {
                    toast.error('Ya existe un proveedor con este número de documento');
                    return;
                }

                const newProvider: Provider = {
                    id: `prov-${Date.now()}`,
                    name: currentProvider.name!,
                    ruc: rucNorm,
                    docIdentityType: docT,
                    type: currentProvider.type || 'Mercaderia',
                    specialty: currentProvider.specialty || '',
                    category: categoryStored || 'Otros',
                    area: currentProvider.area?.trim() || undefined,
                    defaultExpenseCategory: currentProvider.defaultExpenseCategory || 'Otros',
                    defaultCreditDays: Number(currentProvider.defaultCreditDays) || 0,
                    email: currentProvider.email || '',
                    phone: currentProvider.phone || '',
                    contactName: currentProvider.contactName || '',
                    bankName: currentProvider.bankName || '',
                    bankAccount: currentProvider.bankAccount || '',
                    totalPurchased: 0,
                    accountingAccount: currentProvider.accountingAccount?.trim() || undefined,
                    preferredCurrency: currentProvider.preferredCurrency || 'PEN',
                    leadTimeDays:
                      currentProvider.leadTimeDays != null
                        ? Number(currentProvider.leadTimeDays)
                        : undefined,
                    minimumOrderAmount:
                      currentProvider.minimumOrderAmount != null
                        ? Number(currentProvider.minimumOrderAmount)
                        : undefined,
                    paymentTermsLabel: currentProvider.paymentTermsLabel?.trim() || undefined,
                    supplierScore:
                      currentProvider.supplierScore != null
                        ? Number(currentProvider.supplierScore)
                        : undefined,
                    scoreQuality:
                      currentProvider.scoreQuality != null
                        ? Number(currentProvider.scoreQuality)
                        : undefined,
                    scoreFulfillment:
                      currentProvider.scoreFulfillment != null
                        ? Number(currentProvider.scoreFulfillment)
                        : undefined,
                    scorePrice:
                      currentProvider.scorePrice != null
                        ? Number(currentProvider.scorePrice)
                        : undefined,
                    scoreDelivery:
                      currentProvider.scoreDelivery != null
                        ? Number(currentProvider.scoreDelivery)
                        : undefined,
                    isPreferredSupplier: currentProvider.isPreferredSupplier === true,
                    pettyExpenseLines: pl,
                    usageContexts: uc,
                    defaultPurchaseAccount: undefined,
                    defaultProfessionalFeeAccount: undefined,
                };
                const savedCreate = await Promise.resolve(onUpdateProviders([...providers, newProvider]));
                if (savedCreate === false) return;
                if (useServerPaging) await serverList.reload();
                toast.success('Proveedor registrado');
            }
            setIsEditing(false);
            setCurrentProvider({});
        } finally {
            setIsSavingProvider(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (
            !(await appConfirm(
                'Esto no borrará las facturas históricas, pero eliminará al proveedor del directorio.',
                { title: '¿Eliminar proveedor?', confirmLabel: 'Eliminar' },
            ))
        ) {
            return;
        }
        const saved = await Promise.resolve(onUpdateProviders(providers.filter((p) => p.id !== id)));
        if (saved === false) return;
        if (useServerPaging) await serverList.reload();
        toast.info('Proveedor eliminado');
    };

    const openSimplePettyDialog = () => {
        setSimplePetty({
            docType: 'RUC',
            ruc: '',
            name: '',
            type: 'Mercaderia',
            category: providerCategories[0] || 'Otros',
            area: '',
            accountingAccount: '',
        });
        setIsSimplePettyOpen(true);
    };

    useEffect(() => {
        if (!openSimplePettyOnMount) return;
        openSimplePettyDialog();
        onSimplePettyOpenHandled?.();
    }, [openSimplePettyOnMount]);

    const handleSaveSimplePetty = async () => {
        if (!simplePetty.name.trim()) {
            toast.error('Ingrese la razón social');
            return;
        }
        const docT = resolveProviderDocIdentityType(simplePetty.docType, simplePetty.ruc);
        const rucNorm = normalizeDocIdentityDigits(simplePetty.ruc, docT);
        const docLimit = getDocIdentityDigitLimit(docT);
        if (rucNorm.length !== docLimit) {
            toast.error(`El ${docT} debe tener ${docLimit} dígitos numéricos`);
            return;
        }
        if (!validateCommercialCatalogFields(simplePetty.category, simplePetty.area, { requireCategory: true })) {
            return;
        }
        if (providers.some((p) => providerDocDigitsEqual(p.ruc, rucNorm))) {
            toast.error(`Ya existe un proveedor con este ${docT}`);
            return;
        }
        const acct = simplePetty.accountingAccount.trim();
        const newProvider: Provider = {
            id: `prov-${Date.now()}`,
            name: simplePetty.name.trim(),
            ruc: rucNorm,
            docIdentityType: docT,
            type: simplePetty.type,
            category: simplePetty.category.trim(),
            area: simplePetty.area.trim() || undefined,
            defaultExpenseCategory: acct || simplePetty.category,
            accountingAccount: acct || undefined,
            registeredVia: 'petty_cash_simple',
            defaultCreditDays: 0,
            specialty: '',
            email: '',
            phone: '',
            contactName: '',
            bankName: '',
            bankAccount: '',
            totalPurchased: 0,
            pettyExpenseLines: [],
            usageContexts: { pettyCash: true, purchases: true, professionalFees: true },
        };
        const saved = await Promise.resolve(onUpdateProviders([...providers, newProvider]));
        if (saved === false) return;
        if (useServerPaging) await serverList.reload();
        setIsSimplePettyOpen(false);
        toast.success('Proveedor registrado (caja chica)', {
            description:
                'Contabilidad debe completar "Motivos caja chica" en Editar; hasta entonces no se podrán registrar egresos.',
        });
    };

    const startEdit = (provider?: Provider) => {
        if (provider) {
            const rawCat = provider.category != null ? String(provider.category).trim() : '';
            const cat =
                rawCat && providerCategories.includes(rawCat)
                    ? rawCat
                    : '';
            const ar =
                provider.area && areas.includes(provider.area)
                    ? provider.area
                    : '';
            const docT = inferDocIdentityTypeFromSaved(provider);
            const migratedFlow = migrateLegacyFlowClassification(provider.defaultExpenseCategory, config);
            setCurrentProvider({
                ...provider,
                category: cat,
                area: ar,
                docIdentityType: docT,
                ruc: normalizeDocIdentityDigits(provider.ruc || '', docT),
                defaultExpenseCategory: migratedFlow ?? provider.defaultExpenseCategory,
                pettyExpenseLines: provider.pettyExpenseLines?.length
                    ? provider.pettyExpenseLines.map((l) => ({ ...l }))
                    : [],
                usageContexts: mergeProviderUsageContexts(provider.usageContexts),
            });
        } else {
            setCurrentProvider({
                category: '',
                area: '',
                defaultCreditDays: 0,
                defaultExpenseCategory: undefined,
                type: 'Mercaderia',
                docIdentityType: 'RUC',
                ruc: '',
                pettyExpenseLines: [],
                usageContexts: { pettyCash: true, purchases: true, professionalFees: true },
            });
        }
        setIsEditing(true);
    };

    const filteredProviders = useMemo(
        () =>
            providers.filter(
                (p) =>
                    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    p.ruc.includes(searchTerm) ||
                    String(p.category ?? '')
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase()),
            ),
        [providers, searchTerm],
    );

    const providerTotalFiltered = useServerPaging ? serverList.filtered : filteredProviders.length;
    const providerTablePageSizeSafe = useServerPaging ? serverList.pageSize : providerTablePageSize;
    const providerTotalPages = useServerPaging
        ? serverList.totalPages
        : Math.max(1, Math.ceil(providerTotalFiltered / providerTablePageSizeSafe));
    const providerTablePageSafe = useServerPaging
        ? serverList.page
        : Math.min(providerTablePage, providerTotalPages);
    const paginatedProviders = useMemo(() => {
        if (useServerPaging) return serverList.items;
        const start = (providerTablePageSafe - 1) * providerTablePageSizeSafe;
        return filteredProviders.slice(start, start + providerTablePageSizeSafe);
    }, [
        useServerPaging,
        serverList.items,
        filteredProviders,
        providerTablePageSafe,
        providerTablePageSizeSafe,
    ]);

    const pageIds = paginatedProviders.map((p) => p.id);
    const allPageSelected =
        pageIds.length > 0 && (selectAllMatching || pageIds.every((id) => selectedIds.has(id)));
    const somePageSelected = pageIds.some((id) => selectedIds.has(id));
    const selectedCount = selectAllMatching ? providerTotalFiltered : selectedIds.size;

    const togglePageSelection = (checked: boolean) => {
        setSelectAllMatching(false);
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (checked) pageIds.forEach((id) => next.add(id));
            else pageIds.forEach((id) => next.delete(id));
            return next;
        });
    };

    const toggleOne = (id: string, checked: boolean) => {
        setSelectAllMatching(false);
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    const handleSelectAllMatching = async () => {
        if (useServerPaging) {
            try {
                const data = await fetchServerListPage<Provider>('providers', {
                    search: searchTerm,
                    idsOnly: true,
                    pageSize: 25,
                });
                setSelectedIds(new Set(data.ids ?? []));
                setSelectAllMatching(true);
            } catch (e) {
                toast.error(e instanceof Error ? e.message : 'No se pudo seleccionar todo');
            }
            return;
        }
        setSelectedIds(new Set(filteredProviders.map((p) => p.id)));
        setSelectAllMatching(true);
    };

    const handleBulkDelete = async () => {
        if (selectedCount <= 0) return;
        if (
            !(await appConfirm(
                selectAllMatching
                    ? `¿Eliminar ${selectedCount} proveedor(es) de la búsqueda?`
                    : `¿Eliminar ${selectedCount} proveedor(es) seleccionado(s)?`,
                { title: 'Eliminar proveedores', confirmLabel: 'Eliminar' },
            ))
        ) {
            return;
        }
        setBulkDeleting(true);
        try {
            const q = searchTerm.toLowerCase();
            const drop = new Set(
                selectAllMatching
                    ? providers
                          .filter(
                              (p) =>
                                  p.name.toLowerCase().includes(q) ||
                                  p.ruc.includes(searchTerm) ||
                                  String(p.category ?? '').toLowerCase().includes(q),
                          )
                          .map((p) => p.id)
                    : [...selectedIds],
            );
            if (useServerPaging) {
                await deleteServerListItems('providers', {
                    ids: [...selectedIds],
                    allMatching: selectAllMatching,
                    search: searchTerm,
                });
            }
            const saved = await Promise.resolve(onUpdateProviders(providers.filter((p) => !drop.has(p.id))));
            if (saved === false) return;
            toast.info(`${drop.size} proveedor(es) eliminado(s)`);
            if (useServerPaging) await serverList.reload();
            setSelectedIds(new Set());
            setSelectAllMatching(false);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
        } finally {
            setBulkDeleting(false);
        }
    };

    const providerRangeStart =
        providerTotalFiltered === 0 ? 0 : (providerTablePageSafe - 1) * providerTablePageSizeSafe + 1;
    const providerRangeEnd = Math.min(providerTablePageSafe * providerTablePageSizeSafe, providerTotalFiltered);

    useEffect(() => {
        setSelectedIds(new Set());
        setSelectAllMatching(false);
        setProviderTablePage(1);
    }, [searchTerm]);

    useEffect(() => {
        setProviderTablePage((p) => Math.min(p, providerTotalPages));
    }, [providerTotalPages]);

    const simplePettyAccountOptions = useMemo(
      () =>
        chartSelectOptionsWithOrphanExpenseClasses(chartOfAccounts, simplePetty.accountingAccount, {
          useLevel: CHART_OPERATIVE_LEVEL,
        }),
      [chartOfAccounts, simplePetty.accountingAccount]
    );

    const editProviderAccountOptions = useMemo(
      () =>
        chartSelectOptionsWithOrphanExpenseClasses(chartOfAccounts, currentProvider.accountingAccount, {
          useLevel: CHART_OPERATIVE_LEVEL,
        }),
      [chartOfAccounts, currentProvider.accountingAccount]
    );

    const patchUsage = (p: Partial<Provider['usageContexts']>) => {
        const base = mergeProviderUsageContexts(currentProvider.usageContexts);
        setCurrentProvider({
            ...currentProvider,
            usageContexts: { ...base, ...p },
        });
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-150 -mt-2" data-testid="providers-module">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-border/60 pb-3">
                <div className="space-y-0.5 min-w-0">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Users className="w-7 h-7 text-primary shrink-0" />
                        Directorio de Proveedores
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Gestiona tus contactos comerciales, condiciones de crédito y cuentas bancarias.
                    </p>
                </div>
                <div className="flex gap-2 items-center">
                    {(userRole === 'admin' || userRole === 'manager') && (
                        <Button 
                            variant="outline" 
                            onClick={() => setIsSettingsOpen(true)}
                            className="text-muted-foreground hover:text-foreground"
                            title="Configurar Listas"
                        >
                            <Settings className="w-4 h-4 mr-2" /> Configuración
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                        <Upload className="w-4 h-4 mr-2" /> Importar Excel
                    </Button>
                    <Button variant="secondary" onClick={openSimplePettyDialog} title="Registro corto para gastos de caja chica" data-testid="providers-simple-petty-open">
                        <Wallet className="w-4 h-4 mr-2" /> Caja chica (rápido)
                    </Button>
                    <Button onClick={() => startEdit()} className="bg-primary text-primary-foreground shadow-sm hover:shadow-md transition-all" data-testid="providers-new">
                        <Plus className="w-4 h-4 mr-2" /> Nuevo Proveedor
                    </Button>
                </div>
            </div>

            {/* --- CONFIGURATION MODAL --- */}
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-primary"/>
                            Configuración de Listas
                        </DialogTitle>
                        <DialogDescription>
                            Administra las opciones disponibles en los formularios. El catálogo maestro de categorías y áreas se configura en <strong>Configuración → Contabilidad</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Navigation Buttons for Config */}
                    <div className="flex space-x-2 border-b pb-2 mb-4">
                        <Button 
                            variant={configTab === 'commercial' ? "default" : "ghost"} 
                            size="sm"
                            onClick={() => setConfigTab('commercial')}
                            className="flex items-center gap-2"
                        >
                            <Building2 className="w-4 h-4"/> Categorías Comerciales
                        </Button>
                        <Button 
                            variant={configTab === 'areas' ? "default" : "ghost"} 
                            size="sm"
                            onClick={() => setConfigTab('areas')}
                            className="flex items-center gap-2"
                        >
                            <List className="w-4 h-4"/> Áreas
                        </Button>
                        {/* Only show Financial tab if NO external config is provided */}
                        {!config && (
                            <Button 
                                variant={configTab === 'financial' ? "default" : "ghost"} 
                                size="sm"
                                onClick={() => setConfigTab('financial')}
                                className="flex items-center gap-2"
                            >
                                <Wallet className="w-4 h-4"/> Flujo de Caja
                            </Button>
                        )}
                    </div>

                    {/* List Management Area */}
                    <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                        <div className="flex gap-2">
                            <Input 
                                placeholder="Escribe un nuevo elemento..." 
                                value={newItemValue}
                                onChange={(e) => setNewItemValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                            />
                            <Button onClick={handleAddItem} disabled={!newItemValue.trim()}>
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                Elementos Activos ({getActiveList().length})
                            </h4>
                            <div className="bg-muted/30 rounded-lg p-2 space-y-1">
                                {getActiveList().map((item, idx) => (
                                    <div key={`${configTab}-${idx}`} className="flex justify-between items-center p-2 bg-card border rounded hover:border-primary/50 transition-colors group">
                                        <span className="text-sm font-medium">{item}</span>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => handleDeleteItem(item)}
                                        >
                                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                                {getActiveList().length === 0 && (
                                    <p className="text-sm text-center text-muted-foreground py-4 italic">
                                        La lista está vacía.
                                    </p>
                                )}
                            </div>
                        </div>
                        {config && (
                             <div className="bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 p-3 rounded-md text-xs flex items-start gap-2">
                                <Landmark className="w-4 h-4 mt-0.5 shrink-0" />
                                <p>Las categorías de flujo de caja se sincronizan automáticamente desde el módulo de Configuración Global.</p>
                             </div>
                        )}
                    </div>
                    
                    <DialogFooter>
                        <Button onClick={() => setIsSettingsOpen(false)}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isSimplePettyOpen} onOpenChange={setIsSimplePettyOpen}>
                <DialogContent
                    className="w-[97vw] sm:max-w-[800px] h-auto max-h-[calc(100vh-2rem)] overflow-y-auto border-border/60 bg-background/95 text-foreground shadow-[0_32px_100px_rgba(0,0,0,0.45)] backdrop-blur-sm"
                    data-testid="providers-simple-petty-dialog"
                >
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                            <Wallet className="w-5 h-5 text-primary" />
                            Proveedor para caja chica
                        </DialogTitle>
                        <DialogDescription>
                            Formulario corto. El proveedor queda en el mismo directorio; puede ampliar datos con <strong>Editar</strong> cuando lo necesite.
                        </DialogDescription>
                    </DialogHeader>
                    <Alert className="border-amber-600/50 bg-amber-950/20">
                        <Info className="h-4 w-4" />
                        <AlertTitle className="text-sm">Caja chica y motivos de gasto</AlertTitle>
                        <AlertDescription className="text-xs max-w-full">
                            <p className="m-0 text-pretty leading-relaxed text-muted-foreground">
                                Para que el equipo pueda <strong className="text-foreground/90">registrar egresos</strong> contra
                                este proveedor, <strong className="text-foreground/90">Contabilidad</strong> debe abrir{' '}
                                <strong className="text-foreground/90">Editar proveedor</strong> y definir al menos un{' '}
                                <strong className="text-foreground/90">motivo (caja chica)</strong> y la cuenta 62/63/64/65 asociada.
                            </p>
                        </AlertDescription>
                    </Alert>
                    <div className="grid gap-4 sm:grid-cols-2 py-2">
                        <div className="space-y-4 rounded-lg border border-border/50 bg-muted/20 p-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identidad y nombre</p>
                        <div className="space-y-2">
                            <Label>Tipo de identidad</Label>
                            <Select
                                value={simplePetty.docType}
                                onValueChange={(val: 'RUC' | 'DNI' | 'CE') =>
                                    setSimplePetty((s) => ({
                                        ...s,
                                        docType: val,
                                        ruc: normalizeDocIdentityDigits(s.ruc, val),
                                    }))
                                }
                            >
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
                        <div className="space-y-2">
                            <Label>{simplePetty.docType} <span className="text-red-500">*</span></Label>
                            <Input
                                className="font-mono"
                                data-testid="provider-simple-ruc"
                                placeholder={`${getDocIdentityDigitLimit(simplePetty.docType)} dígitos`}
                                value={simplePetty.ruc}
                                onChange={(e) =>
                                    setSimplePetty((s) => ({
                                        ...s,
                                        ruc: normalizeDocIdentityDigits(e.target.value, s.docType),
                                    }))
                                }
                            />
                            <p className="text-[10px] text-muted-foreground text-right">
                                {simplePetty.ruc.length}/{getDocIdentityDigitLimit(simplePetty.docType)} dígitos
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>Razón social <span className="text-red-500">*</span></Label>
                            <Input
                                data-testid="provider-simple-name"
                                value={simplePetty.name}
                                onChange={(e) => setSimplePetty((s) => ({ ...s, name: e.target.value }))}
                                placeholder="Razón social"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Tipo de proveedor</Label>
                            <Select
                                value={simplePetty.type}
                                onValueChange={(val: NonNullable<Provider['type']>) =>
                                    setSimplePetty((s) => ({ ...s, type: val }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Mercaderia">Mercadería</SelectItem>
                                    <SelectItem value="Servicios">Servicios</SelectItem>
                                    <SelectItem value="Médico Externo">Médico Externo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        </div>
                        <div className="space-y-4 rounded-lg border border-border/50 bg-muted/20 p-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Clasificación y cuenta</p>
                        <div className="space-y-2">
                            <Label>
                                Categoría (comercial) <span className="text-red-500">*</span>
                            </Label>
                            <Select
                                value={simplePetty.category}
                                onValueChange={(val) => setSimplePetty((s) => ({ ...s, category: val }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {providerCategories.map((c) => (
                                        <SelectItem key={c} value={c}>
                                            {c}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Área (opcional)</Label>
                            <Select
                                value={simplePetty.area || '__none__'}
                                onValueChange={(val) =>
                                    setSimplePetty((s) => ({ ...s, area: val === '__none__' ? '' : val }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Sin área predeterminada" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">— Sin área predeterminada —</SelectItem>
                                    {areas.map((a) => (
                                        <SelectItem key={a} value={a}>
                                            {a}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Cuenta contable (gasto)</Label>
                            {chartOfAccounts.length > 0 ? (
                                <Select
                                    value={simplePetty.accountingAccount || '__none__'}
                                    onValueChange={(v) =>
                                        setSimplePetty((s) => ({
                                            ...s,
                                            accountingAccount: v === '__none__' ? '' : v,
                                        }))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Elegir del plan (NIVEL 5)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">— Manual / después —</SelectItem>
                                        {simplePettyAccountOptions.map((o) => (
                                            <SelectItem key={o.value} value={o.value}>
                                                {o.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    value={simplePetty.accountingAccount}
                                    onChange={(e) =>
                                        setSimplePetty((s) => ({ ...s, accountingAccount: e.target.value }))
                                    }
                                    placeholder="Código de cuenta (importa plan en Contabilidad)"
                                />
                            )}
                            <p className="text-[10px] text-muted-foreground">
                                Solo cuentas <strong>62 / 63 / 64 / 65</strong>, <strong>NIVEL {CHART_OPERATIVE_LEVEL}</strong>{' '}
                                (gastos). Asientos y flujo.
                            </p>
                        </div>
                        </div>
                    </div>
                    <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button variant="outline" className="h-11" onClick={() => setIsSimplePettyOpen(false)}>
                            Cancelar
                        </Button>
                        <Button className="h-11 min-w-[140px] font-semibold" onClick={handleSaveSimplePetty} data-testid="provider-simple-save">Guardar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Import Dialog (Existing) */}
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Importación Masiva de Proveedores</DialogTitle>
                        <DialogDescription className="text-left space-y-2">
                            <span className="block">
                                Sube un archivo <strong>.xlsx</strong>. Usa la plantilla: incluye hoja de datos
                                &quot;Proveedores&quot; (todos los campos del directorio) y hoja <strong>Instrucciones</strong>
                                con el detalle y alias de columnas.
                            </span>
                            <span className="block text-xs text-muted-foreground">
                                Mínimo obligatorio: <strong>Razón social</strong>, <strong>documento</strong> (RUC 11 / DNI 8 / CE
                                9 dígitos, recomendado formato texto en Excel), <strong>Categoría</strong> (texto idéntico al
                                catálogo en Finanzas → Config). <strong>Área</strong> opcional; si se informa, debe existir en
                                el catálogo. Si el documento ya existe, se <strong>actualizarán todos los campos</strong>; si no,
                                se creará un proveedor nuevo. Plantilla: <code className="text-[10px]">plantilla_importacion_proveedores_grooflow_v2.xlsx</code>.
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="space-y-2 border-l-4 border-primary/20 pl-4 bg-muted/50 p-3 rounded-r-md">
                            <h4 className="font-medium text-sm flex items-center gap-2"><FileDown className="w-4 h-4 text-primary"/> Paso 1: Descargar Plantilla</h4>
                            <Button variant="secondary" size="sm" onClick={handleDownloadTemplate} className="mt-2 w-full">
                                Descargar Plantilla .xlsx
                            </Button>
                        </div>

                        <div className="space-y-2 border-l-4 border-primary/20 pl-4 bg-muted/50 p-3 rounded-r-md">
                            <h4 className="font-medium text-sm flex items-center gap-2"><Upload className="w-4 h-4 text-primary"/> Paso 2: Subir Datos</h4>
                            <Button onClick={handleImportClick} className="w-full mt-2">
                                Seleccionar Archivo
                            </Button>
                        </div>
                    </div>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={handleFileChange} 
                        accept=".xlsx, .xls" 
                    />
                </DialogContent>
            </Dialog>

            <Dialog
                open={importPreview != null}
                onOpenChange={(open) => {
                    if (!open && !importApplying) setImportPreview(null);
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Confirmar importación de plantilla</DialogTitle>
                        <DialogDescription>
                            Revisa el resumen antes de aplicar los cambios. Los proveedores existentes se actualizarán
                            con todos los campos de la plantilla; los nuevos se registrarán.
                        </DialogDescription>
                    </DialogHeader>
                    {importPreview ? (
                        <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 dark:border-emerald-500/30 dark:bg-emerald-950/30">
                                    <p className="text-xs text-muted-foreground">Nuevos</p>
                                    <p className="text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                                        {importPreview.toCreate.length}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-500/30 dark:bg-amber-950/30">
                                    <p className="text-xs text-muted-foreground">Ya registrados (actualizar)</p>
                                    <p className="text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                                        {importPreview.toUpdate.length}
                                    </p>
                                </div>
                            </div>

                            {importPreview.sampleNew.length > 0 ? (
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground">Ejemplos de nuevos</p>
                                    <ul className="max-h-24 overflow-y-auto rounded-md border bg-muted/30 px-3 py-2 text-xs space-y-0.5">
                                        {importPreview.sampleNew.map((n) => (
                                            <li key={`new-${n}`} className="truncate">
                                                {n}
                                            </li>
                                        ))}
                                        {importPreview.toCreate.length > importPreview.sampleNew.length ? (
                                            <li className="text-muted-foreground">
                                                … y {importPreview.toCreate.length - importPreview.sampleNew.length} más
                                            </li>
                                        ) : null}
                                    </ul>
                                </div>
                            ) : null}

                            {importPreview.sampleExisting.length > 0 ? (
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground">
                                        Ejemplos ya registrados (se actualizarán)
                                    </p>
                                    <ul className="max-h-24 overflow-y-auto rounded-md border bg-muted/30 px-3 py-2 text-xs space-y-0.5">
                                        {importPreview.sampleExisting.map((n) => (
                                            <li key={`ex-${n}`} className="truncate">
                                                {n}
                                            </li>
                                        ))}
                                        {importPreview.toUpdate.length > importPreview.sampleExisting.length ? (
                                            <li className="text-muted-foreground">
                                                … y {importPreview.toUpdate.length - importPreview.sampleExisting.length} más
                                            </li>
                                        ) : null}
                                    </ul>
                                </div>
                            ) : null}

                            <Alert>
                                <Info className="h-4 w-4" />
                                <AlertTitle className="text-sm">Resumen</AlertTitle>
                                <AlertDescription className="text-sm">
                                    {importPreview.toCreate.length} nuevo(s) · {importPreview.toUpdate.length}{' '}
                                    actualización(es). Confirma para guardar en el catálogo.
                                </AlertDescription>
                            </Alert>
                        </div>
                    ) : null}
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={importApplying}
                            onClick={() => setImportPreview(null)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            disabled={importApplying || !importPreview}
                            onClick={() => void applyImportPreview()}
                        >
                            {importApplying ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Guardando…
                                </>
                            ) : (
                                'Confirmar y guardar'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit/Create Dialog */}
            <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogContent
                    className="w-[97vw] sm:max-w-[980px] max-h-[calc(100vh-2rem)] overflow-y-auto border-border/60 bg-background/95 text-foreground shadow-[0_32px_100px_rgba(0,0,0,0.45)] backdrop-blur-sm"
                >
                    <DialogHeader>
                        <DialogTitle className="text-xl flex items-center gap-2">
                            {currentProvider.id ? <Edit2 className="w-5 h-5 text-primary"/> : <Plus className="w-5 h-5 text-primary"/>}
                            {currentProvider.id ? 'Editar Ficha de Proveedor' : 'Registrar Nuevo Proveedor'}
                        </DialogTitle>
                        <DialogDescription>
                            Completa la información fiscal y comercial del proveedor.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 py-2">
                        {/* Columna izquierda: fisco + caja chica */}
                        <div className="space-y-4 min-w-0">
                            <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-4">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Datos generales
                            </h3>
                            
                            <div className="space-y-2">
                                <Label>
                                    Tipo de documento <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={currentProvider.docIdentityType || 'RUC'}
                                    onValueChange={(val: ProviderDocIdentityType) => {
                                        const ruc = normalizeDocIdentityDigits(
                                            currentProvider.ruc || '',
                                            val,
                                        );
                                        setCurrentProvider({ ...currentProvider, docIdentityType: val, ruc });
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="RUC">RUC (11 dígitos)</SelectItem>
                                        <SelectItem value="DNI">DNI (8 dígitos)</SelectItem>
                                        <SelectItem value="CE">CE (9 dígitos)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>
                                    Número de documento <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    value={currentProvider.ruc || ''}
                                    onChange={(e) => {
                                        const dt = (currentProvider.docIdentityType ||
                                            'RUC') as ProviderDocIdentityType;
                                        const val = normalizeDocIdentityDigits(e.target.value, dt);
                                        setCurrentProvider({ ...currentProvider, ruc: val });
                                    }}
                                    placeholder={
                                        (currentProvider.docIdentityType || 'RUC') === 'DNI'
                                            ? '12345678'
                                            : (currentProvider.docIdentityType || 'RUC') === 'CE'
                                              ? '123456789'
                                              : '20123456789'
                                    }
                                    className="font-mono"
                                />
                                <p className="text-[10px] text-muted-foreground text-right">
                                    {currentProvider.ruc?.length || 0}/
                                    {getDocIdentityDigitLimit(
                                        (currentProvider.docIdentityType || 'RUC') as ProviderDocIdentityType,
                                    )}{' '}
                                    dígitos
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>Razón Social <span className="text-red-500">*</span></Label>
                                <Input 
                                    value={currentProvider.name || ''} 
                                    onChange={e => setCurrentProvider({...currentProvider, name: e.target.value})}
                                    placeholder="Ej: Distribuidora Vet SAC"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Tipo de Proveedor <span className="text-red-500">*</span></Label>
                                <Select 
                                    value={currentProvider.type || 'Mercaderia'} 
                                    onValueChange={(val: any) => setCurrentProvider({...currentProvider, type: val})}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona tipo..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Mercaderia">Mercadería</SelectItem>
                                        <SelectItem value="Servicios">Servicios</SelectItem>
                                        <SelectItem value="Médico Externo">Médico Externo</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {currentProvider.type === 'Médico Externo' && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                    <Label>Especialidad / Rol</Label>
                                    <Input 
                                        value={currentProvider.specialty || ''} 
                                        onChange={e => setCurrentProvider({...currentProvider, specialty: e.target.value})}
                                        placeholder="Ej: Cardiólogo, Groomer..."
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>
                                    Categoría (Comercial)
                                    {currentProvider.usageContexts?.pettyCash !== false ? (
                                        <span className="text-red-500"> *</span>
                                    ) : (
                                        <span className="text-muted-foreground font-normal text-xs">
                                            {' '}
                                            (opcional si no participa en caja chica)
                                        </span>
                                    )}
                                </Label>
                                <Select
                                    value={
                                        currentProvider.category != null &&
                                        String(currentProvider.category).trim() !== ''
                                            ? String(currentProvider.category)
                                            : '__none__'
                                    }
                                    onValueChange={(val) =>
                                        setCurrentProvider({
                                            ...currentProvider,
                                            category: val === '__none__' ? '' : val,
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona categoría..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">— Sin categoría —</SelectItem>
                                        {providerCategories.map((cat) => (
                                            <SelectItem key={cat} value={cat}>
                                                {cat}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Área (opcional)</Label>
                                <Select 
                                    value={currentProvider.area || '__none__'} 
                                    onValueChange={(val) =>
                                        setCurrentProvider({
                                            ...currentProvider,
                                            area: val === '__none__' ? '' : val,
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Sin área predeterminada" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">— Sin área predeterminada —</SelectItem>
                                        {areas.map(area => (
                                            <SelectItem key={area} value={area}>{area}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Cuenta contable (gasto)</Label>
                                {chartOfAccounts.length > 0 ? (
                                    <Select
                                        value={currentProvider.accountingAccount || '__none__'}
                                        onValueChange={(v) =>
                                            setCurrentProvider({
                                                ...currentProvider,
                                                accountingAccount: v === '__none__' ? undefined : v,
                                            })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Del plan (NIVEL 5)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">— Sin asignar —</SelectItem>
                                            {editProviderAccountOptions.map((o) => (
                                                <SelectItem key={o.value} value={o.value}>
                                                    {o.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Input
                                        value={currentProvider.accountingAccount || ''}
                                        onChange={(e) =>
                                            setCurrentProvider({
                                                ...currentProvider,
                                                accountingAccount: e.target.value.trim() || undefined,
                                            })
                                        }
                                        placeholder="Código (importa plan en Contabilidad)"
                                        className="font-mono"
                                    />
                                )}
                                    <p className="text-[10px] text-muted-foreground">
                                    Solo <strong>62 / 63 / 64 / 65</strong>, nivel {CHART_OPERATIVE_LEVEL}. Asientos y
                                    caja chica. Plan en <strong>Contabilidad</strong>.
                                </p>
                            </div>
                            </div>

                            <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-3">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <div>
                                        <Label className="text-sm">Caja chica: motivos permitidos</Label>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                            Al registrar un gasto, la cuenta sugerida sale de la combinación motivo + área.
                                            Una fila = un motivo + área + cuenta (62/63/64/65).
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        onClick={addPettyExpenseLine}
                                        disabled={pettyCashCommercialCategories.length === 0 || areas.length === 0}
                                    >
                                        <Plus className="h-3.5 w-3.5 mr-1" />
                                        Añadir motivo
                                    </Button>
                                </div>
                                {pettyCashCommercialCategories.length === 0 ? (
                                    <p className="text-xs text-amber-700 dark:text-amber-300">
                                        No hay catálogo de “motivo caja chica” en el sistema. Revise Configuración → Contabilidad.
                                    </p>
                                ) : null}
                                {areas.length === 0 ? (
                                    <p className="text-xs text-amber-700 dark:text-amber-300">
                                        No hay áreas comerciales configuradas. Revise Configuración → Contabilidad.
                                    </p>
                                ) : null}
                                <div className="space-y-2">
                                    {(currentProvider.pettyExpenseLines || []).map((line) => {
                                        const accOpts = chartSelectOptionsWithOrphanExpenseClasses(
                                            chartOfAccounts,
                                            line.defaultAccountingAccount,
                                            { useLevel: CHART_OPERATIVE_LEVEL }
                                        );
                                        return (
                                            <div
                                                key={line.id}
                                                className="flex flex-col sm:flex-row gap-2 sm:items-end border rounded-md p-2 bg-background"
                                            >
                                                <div className="flex-1 space-y-1 min-w-0">
                                                    <Label className="text-xs">Motivo (categoría caja chica)</Label>
                                                    <Select
                                                        value={line.commercialCategory}
                                                        onValueChange={(v) =>
                                                            updatePettyLine(line.id, { commercialCategory: v })
                                                        }
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Elegir…" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {pettyCashCommercialCategories.map((c) => (
                                                                <SelectItem key={c} value={c}>
                                                                    {c}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="flex-1 space-y-1 min-w-0">
                                                    <Label className="text-xs">
                                                        Área <span className="text-destructive">*</span>
                                                    </Label>
                                                    <Select
                                                        value={line.commercialArea || ''}
                                                        onValueChange={(v) =>
                                                            updatePettyLine(line.id, { commercialArea: v })
                                                        }
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Elegir área…" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {areas.map((a) => (
                                                                <SelectItem key={a} value={a}>
                                                                    {a}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="flex-1 space-y-1 min-w-0">
                                                    <Label className="text-xs">Cuenta sugerida (opcional)</Label>
                                                    {chartOfAccounts.length > 0 ? (
                                                        <Select
                                                            value={line.defaultAccountingAccount || '__none__'}
                                                            onValueChange={(v) =>
                                                                updatePettyLine(line.id, {
                                                                    defaultAccountingAccount:
                                                                        v === '__none__' ? undefined : v,
                                                                })
                                                            }
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Cuenta" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="__none__">— Sin definir —</SelectItem>
                                                                {accOpts.map((o) => (
                                                                    <SelectItem key={o.value} value={o.value}>
                                                                        {o.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    ) : (
                                                        <Input
                                                            className="font-mono"
                                                            value={line.defaultAccountingAccount || ''}
                                                            onChange={(e) =>
                                                                updatePettyLine(line.id, {
                                                                    defaultAccountingAccount:
                                                                        e.target.value.trim() || undefined,
                                                                })
                                                            }
                                                            placeholder="Código 62/63/64/65"
                                                        />
                                                    )}
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="shrink-0"
                                                    onClick={() => removePettyLine(line.id)}
                                                    title="Quitar"
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                                {(currentProvider.pettyExpenseLines || []).length === 0 ? (
                                    <p className="text-[10px] text-muted-foreground italic">
                                        Sin filas: no se podrá elegir motivo al registrar caja chica para este RUC. Use “Añadir
                                        motivo” o pida a Contabilidad completar.
                                    </p>
                                ) : null}
                            </div>
                        </div>

                        {/* Columna derecha: flujo de caja + comercial */}
                        <div className="space-y-4 min-w-0">
                            <div className="p-3 bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/50 rounded-lg shadow-sm">
                                <div className="space-y-2">
                                    <Label className="text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5 text-sm font-medium">
                                        <Landmark className="w-3.5 h-3.5 shrink-0" />
                                        Clasificación flujo de caja
                                    </Label>
                                    <Select 
                                        value={currentProvider.defaultExpenseCategory || ''} 
                                        onValueChange={(val) => setCurrentProvider({...currentProvider, defaultExpenseCategory: val})}
                                    >
                                        <SelectTrigger className="border-indigo-200 dark:border-indigo-800 focus:ring-indigo-500 bg-background/90">
                                            <SelectValue placeholder="Clasificación financiera..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {config ? (
                                                Object.entries(config).flatMap(([topName, def]) => {
                                                    if (def.type !== 'expense') return [];
                                                    const subs = getSubcategories(def, topName);
                                                    return subs.map((sub) => (
                                                        <SelectGroup key={`${topName}::${sub.id}`}>
                                                            <SelectLabel className="text-xs font-normal">
                                                                {topName} — {sub.name}
                                                            </SelectLabel>
                                                            {sub.concepts.map((c) => {
                                                                const val = encodeFlowClassification({
                                                                    v: 2,
                                                                    cat: topName,
                                                                    subId: sub.id,
                                                                    conceptId: c.id,
                                                                });
                                                                return (
                                                                    <SelectItem key={val} value={val}>
                                                                        {c.name}
                                                                    </SelectItem>
                                                                );
                                                            })}
                                                        </SelectGroup>
                                                    ));
                                                })
                                            ) : (
                                                (expenseOptions.data as string[]).map((cat) => (
                                                    <SelectItem key={cat} value={cat}>
                                                        {cat}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-muted-foreground">
                                        Agrupa los gastos para el reporte financiero.
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-3">
                                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Ámbito por módulo
                                </h3>
                                <p className="text-[10px] text-muted-foreground leading-snug">
                                    Marque en qué flujos participa el proveedor. La cuenta contable usada en Caja Chica,
                                    Compras y Honorarios es la <strong>Cuenta de gasto general</strong> definida arriba.
                                </p>
                                <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <Checkbox
                                            checked={currentProvider.usageContexts?.pettyCash !== false}
                                            onCheckedChange={(c) => patchUsage({ pettyCash: c === true })}
                                        />
                                        <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                                        Caja chica
                                    </label>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <Checkbox
                                            checked={currentProvider.usageContexts?.purchases !== false}
                                            onCheckedChange={(c) => patchUsage({ purchases: c === true })}
                                        />
                                        <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                                        Requisición / compras
                                    </label>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <Checkbox
                                            checked={currentProvider.usageContexts?.professionalFees !== false}
                                            onCheckedChange={(c) => patchUsage({ professionalFees: c === true })}
                                        />
                                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                        Honorarios
                                    </label>
                                </div>
                                <div className="rounded-md border border-cyan-500/25 bg-cyan-500/5 p-2.5 text-[11px] text-cyan-700 dark:text-cyan-300">
                                    Cuenta contable unificada: el sistema usará <strong>Cuenta de gasto general</strong> en todos
                                    los módulos para este proveedor.
                                </div>
                            </div>

                            <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-4">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Datos comerciales
                            </h3>
                            
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-2">
                                    <Label>Crédito (Días)</Label>
                                    <div className="relative">
                                        <Clock className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            type="number"
                                            className="pl-8"
                                            value={currentProvider.defaultCreditDays || 0} 
                                            onChange={e => setCurrentProvider({...currentProvider, defaultCreditDays: parseInt(e.target.value)})}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Banco</Label>
                                    <Input 
                                        value={currentProvider.bankName || ''} 
                                        onChange={e => setCurrentProvider({...currentProvider, bankName: e.target.value})}
                                        placeholder="Ej: BCP"
                                    />
                                </div>
                            </div>

                            <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-3 space-y-3">
                                <div>
                                    <h4 className="text-xs font-semibold text-cyan-800 dark:text-cyan-300 uppercase tracking-wider">
                                        Abastecimiento / compras
                                    </h4>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        Datos para comparación de proveedores. Los precios por producto se gestionan en{' '}
                                        <strong>Productos → pestaña Proveedores</strong>.
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Moneda preferida</Label>
                                        <Select
                                            value={currentProvider.preferredCurrency || 'PEN'}
                                            onValueChange={(v) =>
                                                setCurrentProvider({
                                                    ...currentProvider,
                                                    preferredCurrency: v as 'PEN' | 'USD',
                                                })
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="PEN">PEN</SelectItem>
                                                <SelectItem value="USD">USD</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Lead time (días)</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            value={currentProvider.leadTimeDays ?? ''}
                                            onChange={(e) =>
                                                setCurrentProvider({
                                                    ...currentProvider,
                                                    leadTimeDays: e.target.value
                                                        ? Number(e.target.value)
                                                        : undefined,
                                                })
                                            }
                                            placeholder="Ej: 2"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Pedido mínimo (monto)</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={currentProvider.minimumOrderAmount ?? ''}
                                            onChange={(e) =>
                                                setCurrentProvider({
                                                    ...currentProvider,
                                                    minimumOrderAmount: e.target.value
                                                        ? Number(e.target.value)
                                                        : undefined,
                                                })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Forma de pago</Label>
                                        <Input
                                            value={currentProvider.paymentTermsLabel || ''}
                                            onChange={(e) =>
                                                setCurrentProvider({
                                                    ...currentProvider,
                                                    paymentTermsLabel: e.target.value,
                                                })
                                            }
                                            placeholder="Ej: Contado / 30 días"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Score total (0–100)</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={currentProvider.supplierScore ?? ''}
                                            onChange={(e) =>
                                                setCurrentProvider({
                                                    ...currentProvider,
                                                    supplierScore: e.target.value
                                                        ? Number(e.target.value)
                                                        : undefined,
                                                })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-1 flex items-end pb-1">
                                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                                            <Checkbox
                                                checked={currentProvider.isPreferredSupplier === true}
                                                onCheckedChange={(c) =>
                                                    setCurrentProvider({
                                                        ...currentProvider,
                                                        isPreferredSupplier: c === true,
                                                    })
                                                }
                                            />
                                            Preferido (directorio)
                                        </label>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {(
                                        [
                                            ['scoreQuality', 'Calidad'],
                                            ['scoreFulfillment', 'Cumplimiento'],
                                            ['scorePrice', 'Precio'],
                                            ['scoreDelivery', 'Entrega'],
                                        ] as const
                                    ).map(([key, label]) => (
                                        <div key={key} className="space-y-1">
                                            <Label className="text-[10px]">{label}</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={100}
                                                className="h-8 text-xs"
                                                value={currentProvider[key] ?? ''}
                                                onChange={(e) =>
                                                    setCurrentProvider({
                                                        ...currentProvider,
                                                        [key]: e.target.value
                                                            ? Number(e.target.value)
                                                            : undefined,
                                                    })
                                                }
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Cuenta Bancaria / CCI</Label>
                                <div className="relative">
                                    <CreditCard className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        className="pl-8 font-mono text-sm"
                                        value={currentProvider.bankAccount || ''} 
                                        onChange={e => setCurrentProvider({...currentProvider, bankAccount: e.target.value})}
                                        placeholder="000-000-000..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Email Facturación</Label>
                                <Input 
                                    value={currentProvider.email || ''} 
                                    onChange={e => setCurrentProvider({...currentProvider, email: e.target.value})}
                                    placeholder="facturacion@empresa.com"
                                />
                            </div>
                             <div className="space-y-2">
                                <Label>Teléfono Contacto</Label>
                                <Input 
                                    value={currentProvider.phone || ''} 
                                    onChange={e => setCurrentProvider({...currentProvider, phone: e.target.value})}
                                    placeholder="999 888 777"
                                />
                            </div>
                             <div className="space-y-2">
                                <Label>Contacto</Label>
                                <Input 
                                    value={currentProvider.contactName || ''} 
                                    onChange={e => setCurrentProvider({...currentProvider, contactName: e.target.value})}
                                    placeholder="Nombre del vendedor"
                                />
                            </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsEditing(false)} className="h-11" disabled={isSavingProvider}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSavingProvider}
                            className="h-11 min-w-[200px] font-semibold bg-primary text-primary-foreground"
                        >
                            {isSavingProvider ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando…
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" /> Guardar proveedor
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-2 bg-card p-2 rounded-lg border border-border md:w-1/2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                <Search className="w-4 h-4 text-muted-foreground ml-2" />
                <Input 
                    data-testid="providers-search"
                    placeholder="Buscar por nombre, RUC o categoría..." 
                    className="border-none shadow-none focus-visible:ring-0 bg-transparent"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="text-muted-foreground hover:text-foreground mr-2">
                        <XCircle className="w-4 h-4" />
                    </button>
                )}
            </div>
            {selectedCount > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="destructive" size="sm" className="gap-1.5 font-semibold shadow-sm" disabled={bulkDeleting} onClick={() => void handleBulkDelete()}>
                        {bulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Eliminar ({selectedCount})
                    </Button>
                    {!selectAllMatching && providerTotalFiltered > pageIds.length ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => void handleSelectAllMatching()}>
                            Seleccionar los {providerTotalFiltered} de la búsqueda
                        </Button>
                    ) : null}
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setSelectedIds(new Set()); setSelectAllMatching(false); }}>
                        Limpiar
                    </Button>
                </div>
            ) : null}
            </div>

            {/* Providers Table */}
            <Card className="overflow-hidden border-t-4 border-t-primary/20 shadow-md" data-testid="providers-list">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead className="w-10">
                                <Checkbox
                                    checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                                    onCheckedChange={(v) => togglePageSelection(v === true)}
                                    aria-label="Seleccionar página"
                                />
                            </TableHead>
                            <TableHead className="w-[300px]">Proveedor</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead className="w-[130px] min-w-0">Módulos</TableHead>
                            <TableHead>Área</TableHead>
                            <TableHead>Contacto</TableHead>
                            <TableHead>Condiciones</TableHead>
                            <TableHead className="text-right">Compras Históricas</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {providerTotalFiltered === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        {useServerPaging && serverList.loading ? (
                                            <>
                                                <Loader2 className="w-8 h-8 opacity-40 animate-spin" />
                                                <p>Cargando proveedores…</p>
                                            </>
                                        ) : (
                                            <>
                                                <Search className="w-8 h-8 opacity-20" />
                                                <p>No se encontraron proveedores que coincidan con tu búsqueda.</p>
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedProviders.map(provider => (
                                <TableRow key={provider.id} className="group hover:bg-muted/50 transition-colors">
                                    <TableCell>
                                        <Checkbox
                                            checked={selectAllMatching || selectedIds.has(provider.id)}
                                            onCheckedChange={(v) => toggleOne(provider.id, v === true)}
                                            aria-label={`Seleccionar ${provider.name}`}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                                {provider.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-medium text-foreground">{provider.name}</div>
                                                <div className="text-xs text-muted-foreground font-mono">
                                                    {getProviderDocumentLabel(provider)}: {provider.ruc}
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <Badge variant="outline" className="bg-background font-normal text-muted-foreground w-fit">
                                                {String(provider.category ?? '').trim() || '—'}
                                            </Badge>
                                            {provider.defaultExpenseCategory && (
                                                <span
                                                    className="text-[10px] text-indigo-600 bg-indigo-50 px-1 rounded w-fit flex items-center gap-0.5"
                                                    title="Clasificación flujo de caja"
                                                >
                                                    <Landmark className="w-2.5 h-2.5" />
                                                    {resolveFlowClassificationShortLabel(
                                                        provider.defaultExpenseCategory,
                                                        config
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {(() => {
                                            const m = mergeProviderUsageContexts(provider.usageContexts);
                                            return (
                                                <div className="flex flex-wrap gap-1">
                                                    {m.pettyCash && (
                                                        <Badge
                                                            variant="outline"
                                                            className="font-normal text-[10px] px-1.5 py-0 h-5"
                                                            title="Caja chica"
                                                        >
                                                            CC
                                                        </Badge>
                                                    )}
                                                    {m.purchases && (
                                                        <Badge
                                                            variant="outline"
                                                            className="font-normal text-[10px] px-1.5 py-0 h-5"
                                                            title="Requisición / compras"
                                                        >
                                                            Comp.
                                                        </Badge>
                                                    )}
                                                    {m.professionalFees && (
                                                        <Badge
                                                            variant="outline"
                                                            className="font-normal text-[10px] px-1.5 py-0 h-5"
                                                            title="Recibos por honorarios"
                                                        >
                                                            Hon.
                                                        </Badge>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </TableCell>
                                    <TableCell className="text-sm font-medium text-foreground">
                                        {provider.area || '-'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1 text-xs">
                                            {provider.contactName && <span className="flex items-center gap-1 text-foreground/80"><User className="w-3 h-3 text-muted-foreground"/> {provider.contactName}</span>}
                                            {provider.email && <span className="flex items-center gap-1 text-foreground/70"><Mail className="w-3 h-3 text-muted-foreground"/> {provider.email}</span>}
                                            {provider.phone && <span className="flex items-center gap-1 text-foreground/70"><Phone className="w-3 h-3 text-muted-foreground"/> {provider.phone}</span>}
                                            {!provider.email && !provider.phone && !provider.contactName && <span className="italic text-muted-foreground opacity-50">Sin datos de contacto</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1">
                                            {provider.defaultCreditDays > 0 ? (
                                                <div className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded w-fit">
                                                    <Clock className="w-3 h-3" /> {provider.defaultCreditDays} días
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded w-fit">
                                                    <CheckCircle2 className="w-3 h-3" /> Contado
                                                </div>
                                            )}
                                            {provider.bankName && (
                                                <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1 truncate max-w-[150px]" title={`${provider.bankName}: ${provider.bankAccount}`}>
                                                    <CreditCard className="w-3 h-3"/>
                                                    {provider.bankName}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-medium">
                                        {provider.totalPurchased != null
                                          ? formatCurrencyEs(provider.totalPurchased)
                                          : formatCurrencyEs(0)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(provider)} title="Editar">
                                                <Edit2 className="w-4 h-4 text-muted-foreground hover:text-primary" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(provider.id)} title="Eliminar">
                                                <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                {providerTotalFiltered > 0 && (
                    <div className="flex flex-col sm:flex-row flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/25 px-4 py-3">
                        <p className="text-sm text-muted-foreground order-2 sm:order-1">
                            Mostrando{' '}
                            <span className="font-medium text-foreground">
                                {providerRangeStart}–{providerRangeEnd}
                            </span>{' '}
                            de <span className="font-medium text-foreground">{providerTotalFiltered}</span> proveedor
                            {providerTotalFiltered !== 1 ? 'es' : ''}
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 order-1 sm:order-2 w-full sm:w-auto">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">Por página</span>
                                <Select
                                    value={String(providerTablePageSizeSafe)}
                                    onValueChange={(v) => {
                                        const n = Number(v);
                                        if (useServerPaging) serverList.setPageSize(n);
                                        else {
                                            setProviderTablePageSize(n);
                                            setProviderTablePage(1);
                                        }
                                    }}
                                >
                                    <SelectTrigger className="h-8 w-[88px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PROVIDER_TABLE_PAGE_SIZES.map((n) => (
                                            <SelectItem key={n} value={String(n)}>
                                                {n}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-1 px-2"
                                    disabled={providerTablePageSafe <= 1}
                                    onClick={() =>
                                        useServerPaging
                                            ? serverList.setPage(Math.max(1, providerTablePageSafe - 1))
                                            : setProviderTablePage((p) => Math.max(1, p - 1))
                                    }
                                    aria-label="Página anterior"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    <span className="hidden sm:inline">Anterior</span>
                                </Button>
                                <span className="text-xs text-muted-foreground tabular-nums px-2 min-w-[5.5rem] text-center">
                                    {providerTablePageSafe} / {providerTotalPages}
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-1 px-2"
                                    disabled={providerTablePageSafe >= providerTotalPages}
                                    onClick={() =>
                                        useServerPaging
                                            ? serverList.setPage(Math.min(providerTotalPages, providerTablePageSafe + 1))
                                            : setProviderTablePage((p) => Math.min(providerTotalPages, p + 1))
                                    }
                                    aria-label="Página siguiente"
                                >
                                    <span className="hidden sm:inline">Siguiente</span>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}