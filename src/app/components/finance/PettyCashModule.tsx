import React, { useState, useEffect } from 'react';
import { PettyCashManager } from './PettyCashManager';
import { CashMovements } from './CashMovements';
import { PettyCashAnalytics } from './PettyCashAnalytics';
import { PettyCashTransaction, PettyCashSettings, User } from '../../types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Wallet, TrendingUp, BarChart2, Plus, Info, Receipt, User as UserIcon, Building2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface PettyCashModuleProps {
    transactions: PettyCashTransaction[];
    onUpdateTransactions: (txs: PettyCashTransaction[]) => void;
    settings: PettyCashSettings;
    users: User[];
    currentUser: User;
    visibleSedes?: string[];
}

const getWeekStr = (date: Date) => format(date, 'w');

const AREAS = [
    'Administración',
    'Logística',
    'Ventas',
    'Marketing',
    'Recursos Humanos',
    'Operaciones',
    'Tecnología',
    'Dirección Médica'
];

const MOCK_PROVIDERS: Record<string, string> = {
    '20601234567': 'VETERINARIA CENTRAL SAC',
    '10456789012': 'JUAN PEREZ (SERVICIOS GENERALES)',
    '20559988776': 'DISTRIBUIDORA DEL NORTE EIRL'
};

export function PettyCashModule({ 
    transactions, 
    onUpdateTransactions, 
    settings, 
    users, 
    currentUser,
    visibleSedes
}: PettyCashModuleProps) {
    const [activeTab, setActiveTab] = useState('manager');
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

    // Form States
    const [amountBI, setAmountBI] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<string>('Otros');
    const [classification, setClassification] = useState<string>('Boleta'); // Classification
    const [docType, setDocType] = useState<string>('RUC');
    const [docNumber, setDocNumber] = useState('');
    const [providerName, setProviderName] = useState('');
    const [area, setArea] = useState<string>('');
    const [isExtraExpense, setIsExtraExpense] = useState(false);
    
    // Sede: defaults to first visible sede of the user
    const defaultSede = currentUser.sedes?.[0] || currentUser.location || visibleSedes?.[0] || 'Principal';
    const [location, setLocation] = useState<string>(defaultSede);

    // Calculated fields
    const igv = amountBI ? (parseFloat(amountBI) * 0.18) : 0;
    const total = amountBI ? (parseFloat(amountBI) + igv) : 0;

    // Auto-fill provider name
    useEffect(() => {
        if (docNumber && MOCK_PROVIDERS[docNumber]) {
            setProviderName(MOCK_PROVIDERS[docNumber]);
        } else if (docNumber.length >= 8) {
            // Reset if not found but let user type?
            // For now, if mock not found, keep empty or user typed
        }
    }, [docNumber]);

    const handleRegisterExpense = () => {
        if (!amountBI || !description || !area || !docNumber || !providerName) {
            toast.error("Por favor complete los campos obligatorios");
            return; 
        }

        const numAmountBI = parseFloat(amountBI);
        
        if (isNaN(numAmountBI) || numAmountBI <= 0) {
            toast.error("Ingrese un monto válido");
            return;
        }

        if (total > settings.maxTransactionAmount && !isExtraExpense) {
             // Maybe warn?
        }
        
        if (total > 300) {
             toast.warning("Gasto mayor a S/ 300 requiere aprobación.", {
                 description: "El gasto se registrará pero quedará pendiente de validación extra."
             });
        }

        const newExpense: PettyCashTransaction = {
            id: `pc-${Date.now()}`,
            date: new Date(),
            amount: total, // Total amount deducted
            amountBI: numAmountBI,
            igv: igv,
            description,
            category: category as any, // "Motivo" maps to Category
            requester: currentUser.name, // Automatic
            receiptNumber: docNumber, // Using Doc Number as Receipt Number
            receiptType: classification as any,
            docType: docType as any,
            docNumber: docNumber,
            providerName: providerName,
            area: area,
            isExtraExpense: isExtraExpense,
            status: total > 300 ? 'pending_audit' : 'pending_audit', // Logic for approval
            weekNumber: getWeekStr(new Date()),
            custodianId: currentUser.id,
            type: 'expense',
            location: location
        };

        onUpdateTransactions([newExpense, ...transactions]);
        
        // Reset Form
        setAmountBI('');
        setDescription('');
        setDocNumber('');
        setProviderName('');
        // setArea(''); // Keep area for convenience? No, reset.
        setArea('');
        setIsExtraExpense(false);
        setClassification('Boleta');
        setDocType('RUC');
        
        setIsExpenseModalOpen(false);
        toast.success("Gasto registrado correctamente", {
            description: `Total: S/ ${total.toFixed(2)} (${classification})`
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
                    <TabsList className="grid w-full grid-cols-3 sm:w-[400px]">
                        <TabsTrigger value="manager" className="flex items-center gap-2">
                            <Wallet className="w-4 h-4" />
                            <span className="hidden sm:inline">Mi Caja / Sede</span>
                            <span className="sm:hidden">Caja</span>
                        </TabsTrigger>
                        <TabsTrigger value="consolidated" className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            <span className="hidden sm:inline">Consolidado</span>
                            <span className="sm:hidden">Global</span>
                        </TabsTrigger>
                        <TabsTrigger value="analytics" className="flex items-center gap-2">
                            <BarChart2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Analítica</span>
                            <span className="sm:hidden">Data</span>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
                
                <Button 
                    onClick={() => setIsExpenseModalOpen(true)}
                    className="bg-cyan-500 hover:bg-cyan-600 text-black font-medium"
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
                    
                    <div className="grid gap-4 py-4">
                        {/* Config Section */}
                        <div className="grid grid-cols-2 gap-4 p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                            <div className="space-y-2 col-span-2 sm:col-span-1">
                                <Label className="text-xs font-medium text-slate-400">Sede</Label>
                                {visibleSedes && visibleSedes.length === 1 ? (
                                    <div className="flex items-center h-10 px-3 rounded-md border border-slate-700 bg-slate-800/50 text-slate-300 text-sm">
                                        <Building2 className="w-4 h-4 mr-2 text-cyan-500" />
                                        {location}
                                    </div>
                                ) : (
                                    <Select value={location} onValueChange={setLocation}>
                                        <SelectTrigger className="bg-[#22203A] border-[#3D3B5C] text-white">
                                            <SelectValue placeholder="Seleccionar Sede" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#22203A] border-[#3D3B5C] text-white">
                                            {(visibleSedes || ['Principal']).map(s => (
                                                <SelectItem key={s} value={s}>{s}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                            
                            <div className="space-y-2 col-span-2 sm:col-span-1">
                                <Label htmlFor="area" className="text-xs font-medium text-slate-400">Área Solicitante</Label>
                                <Select value={area} onValueChange={setArea}>
                                    <SelectTrigger className="bg-[#22203A] border-[#3D3B5C] text-white">
                                        <SelectValue placeholder="Seleccionar Área" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#22203A] border-[#3D3B5C] text-white">
                                        {AREAS.map(a => (
                                            <SelectItem key={a} value={a}>{a}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2 col-span-2 sm:col-span-1">
                                <Label htmlFor="category" className="text-xs font-medium text-slate-400">Motivo</Label>
                                <Select value={category} onValueChange={setCategory}>
                                    <SelectTrigger className="bg-[#22203A] border-[#3D3B5C] text-white">
                                        <SelectValue placeholder="Seleccionar Motivo" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#22203A] border-[#3D3B5C] text-white">
                                        <SelectItem value="Movilidad">Movilidad / Taxi</SelectItem>
                                        <SelectItem value="Refrigerio">Alimentación</SelectItem>
                                        <SelectItem value="Insumos Limpieza">Insumos Limpieza</SelectItem>
                                        <SelectItem value="Material Oficina">Útiles de Oficina</SelectItem>
                                        <SelectItem value="Mantenimiento Menor">Mantenimiento</SelectItem>
                                        <SelectItem value="Otros">Otros</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2 col-span-2 sm:col-span-1 flex flex-col justify-end pb-1">
                                <div className="flex items-center justify-between border border-[#3D3B5C] bg-[#22203A] rounded-md p-2">
                                    <Label htmlFor="extra-expense" className="text-sm font-medium text-white cursor-pointer">¿Gasto Extra?</Label>
                                    <Switch 
                                        id="extra-expense" 
                                        checked={isExtraExpense} 
                                        onCheckedChange={setIsExtraExpense}
                                        className="data-[state=checked]:bg-cyan-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Document Details Section */}
                        <div className="space-y-3 pt-2">
                            <Label className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Detalles del Documento</Label>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-slate-400">Clasificación</Label>
                                    <Select value={classification} onValueChange={setClassification}>
                                        <SelectTrigger className="bg-[#22203A] border-[#3D3B5C] text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#22203A] border-[#3D3B5C] text-white">
                                            <SelectItem value="Boleta">Boleta</SelectItem>
                                            <SelectItem value="Factura">Factura</SelectItem>
                                            <SelectItem value="RXH">Recibo por Honorarios</SelectItem>
                                            <SelectItem value="Recibo Simple">Recibo Simple</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-slate-400">Tipo Documento</Label>
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

                            <div className="grid grid-cols-12 gap-4">
                                <div className="col-span-4 space-y-2">
                                    <Label htmlFor="docNumber" className="text-xs font-medium text-slate-400">N° Documento</Label>
                                    <Input 
                                        id="docNumber" 
                                        value={docNumber}
                                        onChange={(e) => setDocNumber(e.target.value)}
                                        placeholder="Ej. 2060..." 
                                        className="bg-[#22203A] border-[#3D3B5C] text-white placeholder:text-slate-600" 
                                    />
                                </div>
                                <div className="col-span-8 space-y-2">
                                    <Label htmlFor="providerName" className="text-xs font-medium text-slate-400">Nombre / Razón Social</Label>
                                    <Input 
                                        id="providerName" 
                                        value={providerName}
                                        onChange={(e) => setProviderName(e.target.value)}
                                        placeholder="Ingrese nombre..." 
                                        className="bg-[#22203A] border-[#3D3B5C] text-white placeholder:text-slate-600" 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Financials Section */}
                        <div className="space-y-3 pt-2">
                            <Label className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Detalles Económicos</Label>
                            
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="amountBI" className="text-xs font-medium text-slate-400">Monto BI (Base)</Label>
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
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="igv" className="text-xs font-medium text-slate-400">IGV (18%)</Label>
                                    <div className="relative">
                                        <span className="absolute left-2.5 top-2.5 text-slate-500 text-xs">S/</span>
                                        <Input 
                                            id="igv" 
                                            value={igv.toFixed(2)}
                                            readOnly
                                            className="pl-7 bg-slate-800/50 border-slate-700 text-slate-400 font-mono cursor-not-allowed" 
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="total" className="text-xs font-medium text-cyan-400">Total a Pagar</Label>
                                    <div className="relative">
                                        <span className="absolute left-2.5 top-2.5 text-cyan-500 text-xs font-bold">S/</span>
                                        <Input 
                                            id="total" 
                                            value={total.toFixed(2)}
                                            readOnly
                                            className="pl-7 bg-cyan-950/30 border-cyan-900/50 text-cyan-400 font-bold font-mono" 
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description" className="text-xs font-medium text-slate-400">Descripción del Gasto</Label>
                                <Textarea 
                                    id="description" 
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Detalle el motivo del gasto..." 
                                    className="bg-[#22203A] border-[#3D3B5C] text-white placeholder:text-slate-600 min-h-[60px]" 
                                />
                            </div>
                        </div>

                        <Button 
                            className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-bold mt-4"
                            onClick={handleRegisterExpense}
                        >
                            Registrar Salida
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
                    />
                )}

                {activeTab === 'consolidated' && (
                    <CashMovements transactions={transactions} />
                )}

                {activeTab === 'analytics' && (
                    <PettyCashAnalytics transactions={transactions} />
                )}
            </div>
        </div>
    );
}