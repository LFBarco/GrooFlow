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
    CheckCircle2,
    Printer,
    Search,
    UserCircle
} from 'lucide-react';
import { format, startOfWeek, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { PettyCashTransaction, PettyCashSettings, User } from '../../types';

// --- Helper to get week number safely ---
const getWeekStr = (date: Date) => format(date, 'w');

const CATEGORIES: Record<string, { label: string, color: string }> = {
    'Movilidad': { label: 'Movilidad / Taxi', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    'Refrigerio': { label: 'Alimentación', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    'Insumos Limpieza': { label: 'Insumos Limpieza', color: 'bg-green-100 text-green-700 border-green-200' },
    'Material Oficina': { label: 'Útiles de Oficina', color: 'bg-purple-100 text-purple-700 border-purple-200' },
    'Mantenimiento Menor': { label: 'Mantenimiento', color: 'bg-slate-100 text-slate-700 border-slate-200' },
    'Otros': { label: 'Otros', color: 'bg-gray-100 text-gray-700 border-gray-200' }
};

interface PettyCashManagerProps {
    transactions: PettyCashTransaction[];
    onUpdateTransactions: (txs: PettyCashTransaction[]) => void;
    settings: PettyCashSettings;
    users: User[];
    currentUser: User;
}

export function PettyCashManager({ transactions, onUpdateTransactions, settings, users, currentUser }: PettyCashManagerProps) {
    const [selectedWeek, setSelectedWeek] = useState<string>(getWeekStr(new Date()));
    const [searchTerm, setSearchTerm] = useState('');

    // Custodian Management
    const custodians = useMemo(() => users.filter(u => 
        (u.pettyCashLimit && u.pettyCashLimit > 0) || 
        ['admin', 'manager', 'assistant'].includes(u.role)
    ), [users]);
    
    // Determine default custodian
    const defaultCustodianId = useMemo(() => {
        // If current user is a custodian, select them
        if (custodians.find(c => c.id === currentUser.id)) return currentUser.id;
        // Else select first custodian
        if (custodians.length > 0) return custodians[0].id;
        return '';
    }, [currentUser, custodians]);

    const [selectedCustodianId, setSelectedCustodianId] = useState<string>(defaultCustodianId);

    // Update selectedCustodianId when default changes (e.g. data loaded)
    useEffect(() => {
        if (!selectedCustodianId && defaultCustodianId) {
            setSelectedCustodianId(defaultCustodianId);
        }
    }, [defaultCustodianId, selectedCustodianId]);

    const selectedCustodian = users.find(u => u.id === selectedCustodianId);
    const currentLimit = selectedCustodian?.pettyCashLimit || settings.totalFundLimit;

    // Filter transactions by custodian
    const custodianTransactions = useMemo(() => {
        if (!selectedCustodianId) return transactions;
        return transactions.filter(t => t.custodianId === selectedCustodianId);
    }, [transactions, selectedCustodianId]);

    // Weekly Calculations
    const currentWeekExpenses = useMemo(() => {
        return custodianTransactions.filter(e => e.weekNumber.toString() === selectedWeek.toString());
    }, [custodianTransactions, selectedWeek]);

    const weeklyTotal = currentWeekExpenses
        .filter(t => t.status !== 'voided' && t.status !== 'rejected')
        .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    const currentBalance = currentLimit - weeklyTotal;

    const handleCloseWeek = () => {
        toast.success(`Semana ${selectedWeek} cerrada`, {
            description: "Se ha generado el reporte de reposición por S/ " + weeklyTotal.toFixed(2)
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Custodian Selector (Visible for Admins or if multiple custodians exist) */}
            {custodians.length > 0 && (
                <div className="flex items-center justify-between bg-card p-4 rounded-lg border shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <UserCircle className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm">Responsable de Caja Chica</h3>
                            <p className="text-xs text-muted-foreground">Gestionando fondo de:</p>
                        </div>
                    </div>
                    <Select value={selectedCustodianId} onValueChange={setSelectedCustodianId}>
                        <SelectTrigger className="w-[250px]">
                            <SelectValue placeholder="Seleccionar Responsable" />
                        </SelectTrigger>
                        <SelectContent>
                            {custodians.map(c => (
                                <SelectItem key={c.id} value={c.id}>
                                    {c.name} (Fondo: S/ {c.pettyCashLimit})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
            
            {custodians.length === 0 && (
                 <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <AlertCircle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-yellow-700">
                                No hay usuarios configurados con fondo de caja chica. Por favor, asigne límites en Configuración &gt; Contabilidad.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Header Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-primary/10 to-background border-primary/20 shadow-md">
                    <CardHeader className="pb-2">
                        <CardDescription>Saldo Disponible ({selectedCustodian?.name.split(' ')[0]})</CardDescription>
                        <CardTitle className="text-4xl font-bold text-primary">
                            S/ {currentBalance.toFixed(2)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="w-full bg-muted/50 h-2 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-500 ${
                                    (currentBalance / currentLimit) < (settings.alertThreshold / 100) 
                                    ? 'bg-red-500' 
                                    : 'bg-primary'
                                }`} 
                                style={{ width: `${Math.max(0, (currentBalance / currentLimit) * 100)}%` }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 text-right">
                            Base del Fondo: S/ {currentLimit}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Gastado esta Semana (Sem {selectedWeek})</CardDescription>
                        <CardTitle className="text-3xl font-bold text-foreground">
                            S/ {weeklyTotal.toFixed(2)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <TrendingDown className="w-4 h-4 text-red-500" />
                            <span>{currentWeekExpenses.length} movimientos registrados</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="flex flex-col justify-center items-center text-center p-6 border-dashed border-2">
                    <Button size="lg" className="w-full mb-2" variant="outline" onClick={() => window.print()}>
                        <Printer className="w-4 h-4 mr-2" />
                        Imprimir Rendición
                    </Button>
                    <p className="text-xs text-muted-foreground">
                        Genera PDF para firma y reposición de dinero.
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
                        
                        <div className="flex items-center gap-2">
                            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                                <SelectTrigger className="w-[160px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={getWeekStr(new Date())}>Semana Actual ({getWeekStr(new Date())})</SelectItem>
                                    <SelectItem value={getWeekStr(subWeeks(new Date(), 1))}>Semana Pasada ({getWeekStr(subWeeks(new Date(), 1))})</SelectItem>
                                    <SelectItem value={getWeekStr(subWeeks(new Date(), 2))}>Hace 2 Semanas</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <TabsContent value="details" className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar por descripción o solicitante..." 
                                    className="pl-9"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Button variant="outline" size="icon">
                                <Filter className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="border rounded-md overflow-hidden bg-card">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Sede</TableHead>
                                        <TableHead>Descripción</TableHead>
                                        <TableHead>Categoría</TableHead>
                                        <TableHead>Solicitante</TableHead>
                                        <TableHead className="text-right">Monto</TableHead>
                                        <TableHead className="text-center">Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {currentWeekExpenses
                                        .filter(e => 
                                            e.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                            e.requester.toLowerCase().includes(searchTerm.toLowerCase())
                                        )
                                        .map((expense) => (
                                        <TableRow key={expense.id}>
                                            <TableCell className="font-medium text-xs">
                                                {format(new Date(expense.date), "dd MMM HH:mm", { locale: es })}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="text-xs font-normal">
                                                    {expense.location || 'Principal'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium text-sm">{expense.description}</div>
                                                {expense.receiptNumber && (
                                                    <div className="text-[10px] text-muted-foreground">Ref: {expense.receiptNumber}</div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`font-normal ${CATEGORIES[expense.category]?.color || ''}`}>
                                                    {CATEGORIES[expense.category]?.label || expense.category}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{expense.requester}</TableCell>
                                            <TableCell className="text-right font-bold">
                                                S/ {expense.amount.toFixed(2)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {expense.status === 'approved' ? (
                                                    <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                                                ) : (
                                                    <div className="w-3 h-3 rounded-full bg-yellow-400 mx-auto" title="Pendiente de Auditoría" />
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {currentWeekExpenses.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                No hay gastos registrados en esta semana para {selectedCustodian?.name}.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>

                    <TabsContent value="summary">
                        <Card className="border-dashed">
                            <CardHeader>
                                <CardTitle>Rendición de Caja Chica ({selectedCustodian?.name}) - Semana {selectedWeek}</CardTitle>
                                <CardDescription>
                                    Resumen para solicitud de reembolso y cuadre de caja.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center py-2 border-b">
                                        <span className="text-muted-foreground">Fondo Inicial Asignado</span>
                                        <span className="font-medium">S/ {currentLimit.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b">
                                        <span className="text-muted-foreground">Total Gastos (Sustentados)</span>
                                        <span className="font-bold text-red-500">- S/ {weeklyTotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b bg-muted/20 px-2 rounded">
                                        <span className="font-medium">Saldo Final Calculado</span>
                                        <span className="font-bold text-primary">S/ {currentBalance.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-sm font-medium mb-3">Desglose por Categoría</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {Object.entries(CATEGORIES).map(([catKey, catVal]) => {
                                            const catTotal = currentWeekExpenses
                                                .filter(e => e.category === catKey)
                                                .reduce((acc, curr) => acc + curr.amount, 0);
                                            
                                            if (catTotal === 0) return null;

                                            return (
                                                <div key={catKey} className="border rounded p-3 text-center bg-card">
                                                    <div className="text-xs text-muted-foreground mb-1">{catVal.label}</div>
                                                    <div className="font-bold text-lg">S/ {catTotal.toFixed(2)}</div>
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
        </div>
    );
}