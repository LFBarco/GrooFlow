import { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Provider, SystemSettings } from '../../types';
import { ConfigStructure } from '../../data/initialData';
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
    Landmark, Settings, List, Wallet, Users 
} from 'lucide-react';
import { toast } from 'sonner';

interface ProviderManagerProps {
    providers: Provider[];
    onUpdateProviders: (providers: Provider[]) => void;
    userRole?: string;
    config?: ConfigStructure; // Configuración global inyectada (Flujo de Caja)
    systemSettings?: SystemSettings; // Configuración persistente del sistema
    onUpdateSystemSettings?: (settings: SystemSettings) => void;
}

// Datos iniciales por defecto (si no se han configurado o migrado)
const DEFAULT_PROVIDER_CATEGORIES = [
    "Farmacia", "Insumos Médicos", "Servicios Básicos", "Mantenimiento", 
    "Alquileres", "Laboratorio", "Marketing", "Otros"
];

// Fallback por si no llega config externa de egresos
const DEFAULT_EXPENSE_CATEGORIES_FALLBACK = [
    "Insumos Médicos", "Farmacia", "Alimentos", "Servicios Básicos", 
    "Mantenimiento", "Alquileres", "Publicidad", "Software", 
    "Consultoría", "Seguros", "Impuestos", "Comisiones Bancarias", 
    "Activos Fijos", "Otros"
];

const DEFAULT_AREAS = [
    "Dirección General", "Administración", "Logística", "Ventas", 
    "Recursos Humanos", "Sistemas", "Operaciones", "Mantenimiento"
];

export function ProviderManager({ 
    providers, 
    onUpdateProviders, 
    userRole = 'admin', 
    config,
    systemSettings,
    onUpdateSystemSettings
}: ProviderManagerProps) {
    
    // --- Resolución de Listas (Prioridad: SystemSettings > Defaults) ---
    const providerCategories = systemSettings?.providers?.categories || DEFAULT_PROVIDER_CATEGORIES;
    const areas = systemSettings?.providers?.areas || DEFAULT_AREAS;

    // Solo usamos este estado local si NO se provee `config` (fallback para egresos)
    const [localExpenseCategories, setLocalExpenseCategories] = useState<string[]>(DEFAULT_EXPENSE_CATEGORIES_FALLBACK);
    
    // --- Estados de UI ---
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [currentProvider, setCurrentProvider] = useState<Partial<Provider>>({});
    const [isImportOpen, setIsImportOpen] = useState(false);
    
    // --- Estados para el Modal de Configuración ---
    const [configTab, setConfigTab] = useState<'commercial' | 'financial' | 'areas'>('commercial');
    const [newItemValue, setNewItemValue] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Derivamos las opciones de egresos desde la config global si existe ---
    const expenseOptions = useMemo(() => {
        if (config) {
            // Estructura agrupada: [{ category: 'Servicios', concepts: ['Luz', 'Agua'] }]
            const options: { category: string, concepts: string[] }[] = [];
            Object.entries(config).forEach(([catName, def]) => {
                if (def.type === 'expense') {
                    options.push({
                        category: catName,
                        concepts: def.concepts.map(c => c.name)
                    });
                }
            });
            return { type: 'grouped', data: options };
        } else {
            // Lista plana local (fallback)
            return { type: 'flat', data: localExpenseCategories };
        }
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

    const handleDeleteItem = (item: string) => {
        if (!confirm(`¿Eliminar "${item}" de la lista?`)) return;
        
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
        const templateData = [
            {
                "Razón Social": "Distribuidora Ejemplo S.A.C.",
                "RUC": "20123456789",
                "Categoría": "Farmacia",
                "Área": "Logística",
                "Clasif. Financiera": "Farmacia",
                "Días Crédito": 30,
                "Email": "ventas@ejemplo.com",
                "Teléfono": "987654321",
                "Contacto": "Juan Perez",
                "Banco": "BCP",
                "Cuenta": "191-12345678-0-01"
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla Proveedores");
        XLSX.writeFile(workbook, "plantilla_importacion_proveedores.xlsx");
        toast.success("Plantilla descargada correctamente");
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length === 0) {
                    toast.error("El archivo está vacío");
                    return;
                }

                const newProviders: Provider[] = [];
                let duplicates = 0;
                let errors = 0;

                jsonData.forEach((row: any) => {
                    const name = row['Nombre'] || row['Razón Social'] || row['Proveedor'];
                    const ruc = row['RUC'] || row['ID'] || row['Documento'];
                    
                    if (!name || !ruc) {
                        errors++;
                        return;
                    }

                    if (providers.some(p => p.ruc === String(ruc))) {
                        duplicates++;
                        return;
                    }

                    const provider: Provider = {
                        id: `prov-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        name: String(name),
                        ruc: String(ruc),
                        category: row['Categoría'] || 'Otros',
                        area: row['Área'] || '',
                        defaultExpenseCategory: row['Clasif. Financiera'] || 'Otros',
                        defaultCreditDays: Number(row['Días Crédito']) || 0,
                        email: row['Email'] || row['Correo'] || '',
                        phone: row['Teléfono'] || row['Celular'] || '',
                        contactName: row['Contacto'] || '',
                        bankName: row['Banco'] || '',
                        bankAccount: row['Cuenta'] || row['CCI'] || '',
                        totalPurchased: 0
                    };
                    newProviders.push(provider);
                });

                if (newProviders.length > 0) {
                    onUpdateProviders([...providers, ...newProviders]);
                    toast.success(`Se importaron ${newProviders.length} proveedores correctamente`);
                    setIsImportOpen(false);
                }
                
                if (duplicates > 0) toast.warning(`${duplicates} proveedores ya existían (por RUC) y se omitieron`);
                if (errors > 0) toast.error(`${errors} filas no tenían Nombre o RUC válido`);

            } catch (error) {
                toast.error("Error al procesar el archivo Excel");
            }
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsArrayBuffer(file);
    };

    const validateRUC = (ruc: string) => {
        return /^\d{11}$/.test(ruc);
    };

    const handleSave = () => {
        if (!currentProvider.name || !currentProvider.ruc) {
            toast.error("El nombre y RUC son obligatorios");
            return;
        }

        if (!validateRUC(currentProvider.ruc)) {
            toast.error("El RUC debe tener 11 dígitos numéricos");
            return;
        }

        if (currentProvider.id) {
            // Edit
            const updated = providers.map(p => p.id === currentProvider.id ? { ...p, ...currentProvider } as Provider : p);
            onUpdateProviders(updated);
            toast.success("Proveedor actualizado");
        } else {
            // Create
            if (providers.some(p => p.ruc === currentProvider.ruc)) {
                toast.error("Ya existe un proveedor con este RUC");
                return;
            }

            const newProvider: Provider = {
                id: `prov-${Date.now()}`,
                name: currentProvider.name!,
                ruc: currentProvider.ruc!,
                type: currentProvider.type || 'Mercaderia',
                specialty: currentProvider.specialty || '',
                category: currentProvider.category || 'Otros',
                area: currentProvider.area || '',
                defaultExpenseCategory: currentProvider.defaultExpenseCategory || 'Otros',
                defaultCreditDays: Number(currentProvider.defaultCreditDays) || 0,
                email: currentProvider.email || '',
                phone: currentProvider.phone || '',
                contactName: currentProvider.contactName || '',
                bankName: currentProvider.bankName || '',
                bankAccount: currentProvider.bankAccount || '',
                totalPurchased: 0
            };
            onUpdateProviders([...providers, newProvider]);
            toast.success("Proveedor registrado");
        }
        setIsEditing(false);
        setCurrentProvider({});
    };

    const handleDelete = (id: string) => {
        if (confirm('¿Estás seguro? Esto no borrará las facturas históricas, pero eliminará al proveedor del directorio.')) {
            onUpdateProviders(providers.filter(p => p.id !== id));
            toast.info("Proveedor eliminado");
        }
    };

    const startEdit = (provider?: Provider) => {
        if (provider) {
            setCurrentProvider({ ...provider });
        } else {
            setCurrentProvider({ category: 'Otros', defaultCreditDays: 0, defaultExpenseCategory: 'Otros' });
        }
        setIsEditing(true);
    };

    const filteredProviders = providers.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.ruc.includes(searchTerm) ||
        p.category?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Users className="w-8 h-8 text-primary" />
                        Directorio de Proveedores
                    </h2>
                    <p className="text-muted-foreground">
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
                    <Button onClick={() => startEdit()} className="bg-primary text-primary-foreground shadow-sm hover:shadow-md transition-all">
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
                            Administra las opciones disponibles en los formularios.
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

            {/* Import Dialog (Existing) */}
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Importación Masiva de Proveedores</DialogTitle>
                        <DialogDescription>
                            Sube un archivo Excel (.xlsx) con la lista de proveedores.
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

            {/* Edit/Create Dialog */}
            <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogContent className="sm:max-w-[700px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl flex items-center gap-2">
                            {currentProvider.id ? <Edit2 className="w-5 h-5 text-primary"/> : <Plus className="w-5 h-5 text-primary"/>}
                            {currentProvider.id ? 'Editar Ficha de Proveedor' : 'Registrar Nuevo Proveedor'}
                        </DialogTitle>
                        <DialogDescription>
                            Completa la información fiscal y comercial del proveedor.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                        {/* Columna Izquierda: Datos Fiscales */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Datos Generales</h3>
                            
                            <div className="space-y-2">
                                <Label>RUC <span className="text-red-500">*</span></Label>
                                <Input 
                                    value={currentProvider.ruc || ''} 
                                    onChange={e => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                                        setCurrentProvider({...currentProvider, ruc: val});
                                    }}
                                    placeholder="20123456789"
                                    className="font-mono"
                                />
                                <p className="text-[10px] text-muted-foreground text-right">{currentProvider.ruc?.length || 0}/11 dígitos</p>
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
                                <Label>Categoría (Comercial)</Label>
                                <Select 
                                    value={currentProvider.category} 
                                    onValueChange={(val) => setCurrentProvider({...currentProvider, category: val})}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona categoría..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {providerCategories.map(cat => (
                                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Área</Label>
                                <Select 
                                    value={currentProvider.area} 
                                    onValueChange={(val) => setCurrentProvider({...currentProvider, area: val})}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona área..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {areas.map(area => (
                                            <SelectItem key={area} value={area}>{area}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 rounded-md mt-2">
                                <div className="space-y-2">
                                    <Label className="text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                                        <Landmark className="w-3.5 h-3.5" />
                                        Clasificación Flujo de Caja
                                    </Label>
                                    <Select 
                                        value={currentProvider.defaultExpenseCategory} 
                                        onValueChange={(val) => setCurrentProvider({...currentProvider, defaultExpenseCategory: val})}
                                    >
                                        <SelectTrigger className="border-indigo-200 dark:border-indigo-800 focus:ring-indigo-500">
                                            <SelectValue placeholder="Clasificación financiera..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {expenseOptions.type === 'grouped' ? (
                                                (expenseOptions.data as {category: string, concepts: string[]}[]).map(group => (
                                                    <SelectGroup key={group.category}>
                                                        <SelectLabel>{group.category}</SelectLabel>
                                                        {group.concepts.map(concept => (
                                                            <SelectItem key={concept} value={concept}>{concept}</SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                ))
                                            ) : (
                                                (expenseOptions.data as string[]).map(cat => (
                                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-muted-foreground">
                                        Agrupa los gastos para el reporte financiero.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Columna Derecha: Datos Comerciales */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">Datos Comerciales</h3>
                            
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

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
                        <Button onClick={handleSave} className="bg-primary text-primary-foreground">
                            <Save className="w-4 h-4 mr-2"/> Guardar Proveedor
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Filter Bar */}
            <div className="flex items-center gap-2 bg-card p-2 rounded-lg border border-border md:w-1/2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                <Search className="w-4 h-4 text-muted-foreground ml-2" />
                <Input 
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

            {/* Providers Table */}
            <Card className="overflow-hidden border-t-4 border-t-primary/20 shadow-md">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead className="w-[300px]">Proveedor</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead>Área</TableHead>
                            <TableHead>Contacto</TableHead>
                            <TableHead>Condiciones</TableHead>
                            <TableHead className="text-right">Compras Históricas</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredProviders.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <Search className="w-8 h-8 opacity-20" />
                                        <p>No se encontraron proveedores que coincidan con tu búsqueda.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredProviders.map(provider => (
                                <TableRow key={provider.id} className="group hover:bg-muted/50 transition-colors">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                                {provider.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-medium text-foreground">{provider.name}</div>
                                                <div className="text-xs text-muted-foreground font-mono">RUC: {provider.ruc}</div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <Badge variant="outline" className="bg-background font-normal text-muted-foreground w-fit">
                                                {provider.category || 'Otros'}
                                            </Badge>
                                            {provider.defaultExpenseCategory && (
                                                <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1 rounded w-fit flex items-center gap-0.5" title="Clasificación Financiera">
                                                    <Landmark className="w-2.5 h-2.5" />
                                                    {provider.defaultExpenseCategory}
                                                </span>
                                            )}
                                        </div>
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
                                        S/ {provider.totalPurchased?.toLocaleString('es-PE', { minimumFractionDigits: 2 }) || '0.00'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
            </Card>
        </div>
    );
}