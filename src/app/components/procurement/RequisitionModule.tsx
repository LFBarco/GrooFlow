import React, { useState } from 'react';
import { 
    Requisition, 
    RequisitionItem, 
    RequisitionStatus, 
    User 
} from '../../types';
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from '../ui/table';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription,
    DialogFooter
} from '../ui/dialog';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '../ui/select';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { 
    Plus, 
    Filter, 
    Eye, 
    CheckCircle, 
    Truck, 
    Package, 
    Trash2,
    UserCog,
    Building2,
    Calendar,
    AlertCircle,
    Info
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

// --- MOCK DATA ---
const MOCK_LOCATIONS = ['Sede Principal', 'Sede Norte', 'Sede Sur', 'Sede Este', 'Sede Oeste'];
const MOCK_CATEGORIES = ['Médico', 'Grooming', 'Limpieza', 'Oficina', 'Otros'];
const MOCK_UNITS = ['und', 'caja', 'paquete', 'litro', 'galón', 'millar'];

const INITIAL_REQUISITIONS: Requisition[] = [
    {
        id: 'REQ-001',
        location: 'Sede Norte',
        requesterId: 'u1',
        requesterName: 'Juan Admin',
        date: new Date(2023, 10, 15),
        status: 'submitted',
        priority: 'high',
        items: [
            { id: 'i1', name: 'Guantes Nitrilo M', quantity: 10, unit: 'caja', category: 'Médico', status: 'pending' },
            { id: 'i2', name: 'Alcohol 96°', quantity: 5, unit: 'litro', category: 'Médico', status: 'pending' },
            { id: 'i3', name: 'Shampoo Hipoalergénico', quantity: 2, unit: 'galón', category: 'Grooming', status: 'pending' }
        ]
    },
    {
        id: 'REQ-002',
        location: 'Sede Sur',
        requesterId: 'u2',
        requesterName: 'Maria Admin',
        date: new Date(2023, 10, 16),
        status: 'approved',
        priority: 'medium',
        approvalDate: new Date(2023, 10, 16),
        approverId: 'admin1',
        items: [
            { id: 'i4', name: 'Papel Toalla', quantity: 20, approvedQuantity: 15, unit: 'paquete', category: 'Limpieza', status: 'approved' },
            { id: 'i5', name: 'Cloro', quantity: 10, approvedQuantity: 10, unit: 'galón', category: 'Limpieza', status: 'approved' }
        ]
    }
];

interface RequisitionModuleProps {
    currentUser: User;
    users: User[];
    visibleSedes?: string[];
}

export function RequisitionModule({ currentUser, users, visibleSedes }: RequisitionModuleProps) {
    // State
    const [activeTab, setActiveTab] = useState('my_requisitions');
    const [requisitions, setRequisitions] = useState<Requisition[]>(INITIAL_REQUISITIONS);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [selectedRequisition, setSelectedRequisition] = useState<Requisition | null>(null);

    // Filter state
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [locationFilter, setLocationFilter] = useState<string>('all');

    // Form State (New Requisition)
    const [newItemName, setNewItemName] = useState('');
    const [newItemQuantity, setNewItemQuantity] = useState('');
    const [newItemUnit, setNewItemUnit] = useState('und');
    const [newItemCategory, setNewItemCategory] = useState('Médico');
    const [currentItems, setCurrentItems] = useState<RequisitionItem[]>([]);
    const [reqPriority, setReqPriority] = useState<'low' | 'medium' | 'high'>('medium');

    // Helper: Status Badge Color (Cyber Theme)
    const getStatusBadge = (status: RequisitionStatus) => {
        switch (status) {
            case 'draft': return <Badge variant="outline" className="border-slate-600 text-slate-400 bg-slate-800/50">Borrador</Badge>;
            case 'submitted': return <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30">Enviado</Badge>;
            case 'approved': return <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30">Aprobado</Badge>;
            case 'rejected': return <Badge className="bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30">Rechazado</Badge>;
            case 'ordered': return <Badge className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 hover:bg-yellow-500/30">Ordenado</Badge>;
            case 'received': return <Badge className="bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30">Recibido</Badge>;
            default: return <Badge variant="outline" className="border-slate-600 text-slate-400">{status}</Badge>;
        }
    };

    // --- ACTIONS ---

    const handleAddItemToForm = () => {
        if (!newItemName || !newItemQuantity) {
            toast.error('Complete nombre y cantidad');
            return;
        }

        const qty = parseInt(newItemQuantity);
        if (isNaN(qty) || qty <= 0) {
            toast.error('La cantidad debe ser mayor a 0');
            return;
        }

        const newItem: RequisitionItem = {
            id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            name: newItemName,
            quantity: qty,
            unit: newItemUnit,
            category: newItemCategory as any,
            status: 'pending'
        };

        setCurrentItems([...currentItems, newItem]);
        setNewItemName('');
        setNewItemQuantity('');
    };

    const handleRemoveItemFromForm = (id: string) => {
        setCurrentItems(currentItems.filter(i => i.id !== id));
    };

    const handleSubmitRequisition = () => {
        if (currentItems.length === 0) {
            toast.error('Agregue al menos un ítem');
            return;
        }

        const newReq: Requisition = {
            id: `REQ-${Date.now().toString().slice(-6)}`,
            location: currentUser.location || 'Sede Principal',
            requesterId: currentUser.id,
            requesterName: currentUser.name,
            date: new Date(),
            status: 'submitted', // Direct to submitted for demo
            priority: reqPriority,
            items: currentItems
        };

        setRequisitions([newReq, ...requisitions]);
        setIsCreateModalOpen(false);
        setCurrentItems([]);
        toast.success('Requerimiento enviado exitosamente');
    };

    const handleOpenReview = (req: Requisition) => {
        // Clone to avoid direct mutation
        setSelectedRequisition(JSON.parse(JSON.stringify(req)));
        setIsReviewModalOpen(true);
    };

    const handleUpdateReviewItem = (itemId: string, field: keyof RequisitionItem, value: any) => {
        if (!selectedRequisition) return;
        
        const updatedItems = selectedRequisition.items.map(item => {
            if (item.id === itemId) {
                return { ...item, [field]: value };
            }
            return item;
        });

        setSelectedRequisition({ ...selectedRequisition, items: updatedItems });
    };

    const handleRemoveReviewItem = (itemId: string) => {
        if (!selectedRequisition) return;
        const updatedItems = selectedRequisition.items.filter(i => i.id !== itemId);
        setSelectedRequisition({ ...selectedRequisition, items: updatedItems });
    };

    const handleAddReviewItem = () => {
        // Logic to add item during review (Manager role)
        if (!selectedRequisition) return;
        
        const newItem: RequisitionItem = {
            id: `added-${Date.now()}`,
            name: 'Nuevo Item (Jefa Compras)',
            quantity: 1,
            unit: 'und',
            category: 'Otros',
            status: 'approved',
            approvedQuantity: 1
        };
        
        setSelectedRequisition({
            ...selectedRequisition,
            items: [...selectedRequisition.items, newItem]
        });
    };

    const handleApproveRequisition = () => {
        if (!selectedRequisition) return;

        // Auto-approve quantities if not set
        const approvedItems = selectedRequisition.items.map(item => ({
            ...item,
            approvedQuantity: item.approvedQuantity ?? item.quantity,
            status: 'approved'
        }));

        const updatedReq: Requisition = {
            ...selectedRequisition,
            items: approvedItems as RequisitionItem[],
            status: 'approved',
            approverId: currentUser.id,
            approvalDate: new Date()
        };

        setRequisitions(requisitions.map(r => r.id === updatedReq.id ? updatedReq : r));
        setIsReviewModalOpen(false);
        toast.success('Requerimiento Aprobado', {
            description: 'Se ha generado la notificación para el área de compras.'
        });
    };

    const handleReceiveRequisition = (reqId: string) => {
        setRequisitions(requisitions.map(r => 
            r.id === reqId 
            ? { ...r, status: 'received', receivedDate: new Date(), receivedBy: currentUser.name } 
            : r
        ));
        toast.success('Mercadería marcada como Recibida');
    };

    // Filter Logic — also respect visibleSedes access
    const filteredRequisitions = requisitions.filter(req => {
        if (statusFilter !== 'all' && req.status !== statusFilter) return false;
        if (locationFilter !== 'all' && req.location !== locationFilter) return false;
        // Sede access filter
        if (visibleSedes && visibleSedes.length > 0 && req.location) {
            if (!visibleSedes.includes(req.location) && !req.location.includes(visibleSedes.join(''))) return false;
        }
        return true;
    });

    const myRequisitions = requisitions.filter(r => {
        if (currentUser.role === 'admin' || currentUser.role === 'super_admin' || currentUser.allSedes) return true;
        if (r.requesterId === currentUser.id) return true;
        // Also show requisitions from user's sedes
        if (visibleSedes && r.location && visibleSedes.some(s => r.location.includes(s))) return true;
        return false;
    });

    // Common style classes
    const cardBg = "bg-[#1A1826] border border-white/5 shadow-xl";
    const inputBg = "bg-[#0D0B1E] border-white/10 text-slate-200 placeholder:text-slate-600";
    const tableHeader = "text-slate-400 hover:text-slate-200";
    const tableRow = "hover:bg-white/5 border-white/5";

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div /> 
                <div className="flex items-center gap-2">
                    <Button onClick={() => setIsCreateModalOpen(true)} className="bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-400/20 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                        <Plus className="mr-2 h-4 w-4" />
                        Nuevo Requerimiento
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px] bg-[#0D0B1E] border border-white/10 p-1">
                    <TabsTrigger value="my_requisitions" className="data-[state=active]:bg-[#22203A] data-[state=active]:text-cyan-400 text-slate-400">Mis Requerimientos</TabsTrigger>
                    <TabsTrigger value="procurement_manage" className="data-[state=active]:bg-[#22203A] data-[state=active]:text-cyan-400 text-slate-400">Gestión de Compras</TabsTrigger>
                </TabsList>

                {/* TAB: MIS REQUERIMIENTOS (SEDE ADMIN) */}
                <TabsContent value="my_requisitions" className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {myRequisitions.map(req => (
                            <Card key={req.id} className={`${cardBg} hover:border-cyan-500/30 transition-all duration-300 group`}>
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-200 group-hover:text-cyan-300 transition-colors">
                                                {req.id}
                                                {getStatusBadge(req.status)}
                                            </CardTitle>
                                            <CardDescription className="flex items-center gap-1 mt-1 text-slate-500">
                                                <Calendar className="w-3 h-3" />
                                                {format(req.date, 'dd/MM/yyyy')}
                                            </CardDescription>
                                        </div>
                                        {req.priority === 'high' && (
                                            <Badge variant="destructive" className="flex items-center gap-1 bg-red-500/20 text-red-400 border-red-500/30">
                                                <AlertCircle className="w-3 h-3" /> Urgente
                                            </Badge>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        <div className="text-sm text-slate-400">
                                            <p className="font-medium mb-1 text-slate-300">Items solicitados:</p>
                                            <ul className="list-disc list-inside text-slate-500">
                                                {req.items.slice(0, 3).map(i => (
                                                    <li key={i.id}>{i.quantity} {i.unit} - {i.name}</li>
                                                ))}
                                                {req.items.length > 3 && <li>... y {req.items.length - 3} más</li>}
                                            </ul>
                                        </div>
                                        
                                        {req.status === 'approved' && (
                                            <div className="bg-green-500/10 p-3 rounded-md border border-green-500/20">
                                                <p className="text-green-400 text-sm font-medium flex items-center gap-2">
                                                    <CheckCircle className="w-4 h-4" /> Aprobado por Compras
                                                </p>
                                                <p className="text-xs text-green-500/70 mt-1">
                                                    Tus insumos están en proceso de compra/envío.
                                                </p>
                                            </div>
                                        )}

                                        {req.status === 'approved' && (
                                            <Button 
                                                variant="outline" 
                                                className="w-full border-green-500/30 text-green-400 hover:bg-green-500/10 hover:text-green-300 mt-2 bg-transparent"
                                                onClick={() => handleReceiveRequisition(req.id)}
                                            >
                                                <Truck className="w-4 h-4 mr-2" />
                                                Confirmar Recepción
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* TAB: GESTION DE COMPRAS (JEFA DE COMPRAS) */}
                <TabsContent value="procurement_manage" className="space-y-4 mt-4">
                    <div className="flex gap-4 mb-4">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className={`w-[180px] ${inputBg}`}>
                                <Filter className="w-4 h-4 mr-2 text-slate-400" />
                                <SelectValue placeholder="Estado" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1A1826] border-white/10 text-slate-200">
                                <SelectItem value="all">Todos los estados</SelectItem>
                                <SelectItem value="submitted">Pendientes</SelectItem>
                                <SelectItem value="approved">Aprobados</SelectItem>
                                <SelectItem value="received">Recibidos</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={locationFilter} onValueChange={setLocationFilter}>
                            <SelectTrigger className={`w-[180px] ${inputBg}`}>
                                <Building2 className="w-4 h-4 mr-2 text-slate-400" />
                                <SelectValue placeholder="Sede" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1A1826] border-white/10 text-slate-200">
                                <SelectItem value="all">Todas las sedes</SelectItem>
                                {(visibleSedes || MOCK_LOCATIONS).map(loc => (
                                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className={`rounded-xl border border-white/5 overflow-hidden ${cardBg}`}>
                        <Table>
                            <TableHeader className="bg-white/5">
                                <TableRow className="border-white/5 hover:bg-transparent">
                                    <TableHead className={tableHeader}>ID</TableHead>
                                    <TableHead className={tableHeader}>Fecha</TableHead>
                                    <TableHead className={tableHeader}>Sede</TableHead>
                                    <TableHead className={tableHeader}>Solicitante</TableHead>
                                    <TableHead className={tableHeader}>Items</TableHead>
                                    <TableHead className={tableHeader}>Prioridad</TableHead>
                                    <TableHead className={tableHeader}>Estado</TableHead>
                                    <TableHead className={`text-right ${tableHeader}`}>Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRequisitions.map((req) => (
                                    <TableRow key={req.id} className={tableRow}>
                                        <TableCell className="font-medium text-slate-200">{req.id}</TableCell>
                                        <TableCell className="text-slate-400">{format(req.date, 'dd/MM/yyyy')}</TableCell>
                                        <TableCell className="text-slate-300">{req.location}</TableCell>
                                        <TableCell className="text-slate-400">{req.requesterName}</TableCell>
                                        <TableCell className="text-slate-300">{req.items.length}</TableCell>
                                        <TableCell>
                                            {req.priority === 'high' ? (
                                                <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">Alta</Badge>
                                            ) : (
                                                <span className="text-slate-500 capitalize">{req.priority}</span>
                                            )}
                                        </TableCell>
                                        <TableCell>{getStatusBadge(req.status)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => handleOpenReview(req)} className="text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10">
                                                <Eye className="w-4 h-4 mr-1" /> Revisar
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
            </Tabs>

            {/* MODAL: NUEVO REQUERIMIENTO */}
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogContent className="sm:max-w-[700px] bg-[#1A1826] border-white/10 text-slate-200">
                    <DialogHeader>
                        <DialogTitle className="text-slate-100">Nuevo Requerimiento de Sede</DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Agregue los insumos necesarios para su sede.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label className="text-slate-300">Prioridad</Label>
                                <Select value={reqPriority} onValueChange={(val: any) => setReqPriority(val)}>
                                    <SelectTrigger className={inputBg}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#1A1826] border-white/10 text-slate-200">
                                        <SelectItem value="low">Baja</SelectItem>
                                        <SelectItem value="medium">Media</SelectItem>
                                        <SelectItem value="high">Alta</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-300">Sede</Label>
                                <Input value={currentUser['location'] || 'Sede Principal'} disabled className="bg-slate-800/50 border-white/5 text-slate-400" />
                            </div>
                        </div>

                        <div className="border border-white/10 rounded-md p-4 bg-white/5 space-y-4">
                            <h4 className="text-sm font-medium flex items-center gap-2 text-cyan-400">
                                <Package className="w-4 h-4" /> Agregar Item
                            </h4>
                            <div className="grid grid-cols-12 gap-3">
                                <div className="col-span-4">
                                    <Input 
                                        placeholder="Nombre del producto..." 
                                        value={newItemName}
                                        onChange={(e) => setNewItemName(e.target.value)}
                                        className={inputBg}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <Input 
                                        type="number" 
                                        placeholder="Cant." 
                                        value={newItemQuantity}
                                        onChange={(e) => setNewItemQuantity(e.target.value)}
                                        className={inputBg}
                                    />
                                </div>
                                <div className="col-span-3">
                                    <Select value={newItemUnit} onValueChange={setNewItemUnit}>
                                        <SelectTrigger className={inputBg}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#1A1826] border-white/10 text-slate-200">
                                            {MOCK_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-3">
                                    <Select value={newItemCategory} onValueChange={setNewItemCategory}>
                                        <SelectTrigger className={inputBg}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#1A1826] border-white/10 text-slate-200">
                                            {MOCK_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Button onClick={handleAddItemToForm} variant="secondary" className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600">
                                <Plus className="w-4 h-4 mr-2" /> Agregar a la lista
                            </Button>
                        </div>

                        {currentItems.length > 0 && (
                            <div className="border border-white/10 rounded-md overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-white/5">
                                        <TableRow className="border-white/5 hover:bg-transparent">
                                            <TableHead className={tableHeader}>Producto</TableHead>
                                            <TableHead className={tableHeader}>Cant.</TableHead>
                                            <TableHead className={tableHeader}>Cat.</TableHead>
                                            <TableHead className={tableHeader}></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {currentItems.map(item => (
                                            <TableRow key={item.id} className={tableRow}>
                                                <TableCell className="text-slate-200">{item.name}</TableCell>
                                                <TableCell className="text-slate-300">{item.quantity} {item.unit}</TableCell>
                                                <TableCell className="text-slate-400">{item.category}</TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItemFromForm(item.id)}>
                                                        <Trash2 className="w-4 h-4 text-red-400 hover:text-red-300" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateModalOpen(false)} className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white bg-transparent">Cancelar</Button>
                        <Button onClick={handleSubmitRequisition} className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/20">
                            Enviar Solicitud
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL: REVISIÓN (JEFA DE COMPRAS) */}
            <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
                <DialogContent className="sm:max-w-[800px] bg-[#1A1826] border-white/10 text-slate-200">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-100">
                            <UserCog className="w-5 h-5 text-purple-400" />
                            Revisión de Requerimiento: {selectedRequisition?.id}
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Valide, modifique o agregue items antes de aprobar.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedRequisition && (
                        <div className="space-y-4 py-2">
                            <div className="flex gap-4 text-sm text-slate-300 bg-white/5 p-3 rounded-md border border-white/5">
                                <div><strong className="text-slate-400">Sede:</strong> {selectedRequisition.location}</div>
                                <div><strong className="text-slate-400">Solicitante:</strong> {selectedRequisition.requesterName}</div>
                                <div><strong className="text-slate-400">Prioridad:</strong> {selectedRequisition.priority}</div>
                            </div>

                            <Table>
                                <TableHeader>
                                    <TableRow className="border-white/5 hover:bg-transparent">
                                        <TableHead className={`w-[30%] ${tableHeader}`}>Producto</TableHead>
                                        <TableHead className={tableHeader}>Solicitado</TableHead>
                                        <TableHead className={tableHeader}>Aprobado</TableHead>
                                        <TableHead className={tableHeader}>Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedRequisition.items.map((item) => (
                                        <TableRow key={item.id} className={tableRow}>
                                            <TableCell className="font-medium text-slate-200">
                                                {item.name}
                                                <div className="text-xs text-slate-500">{item.category}</div>
                                            </TableCell>
                                            <TableCell className="text-slate-400">{item.quantity} {item.unit}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Input 
                                                        type="number" 
                                                        className={`w-20 h-8 ${inputBg}`}
                                                        value={item.approvedQuantity ?? item.quantity}
                                                        onChange={(e) => handleUpdateReviewItem(item.id, 'approvedQuantity', parseInt(e.target.value))}
                                                    />
                                                    <span className="text-xs text-slate-500">{item.unit}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                    onClick={() => handleRemoveReviewItem(item.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            
                            <Button variant="outline" size="sm" onClick={handleAddReviewItem} className="w-full border-dashed border-slate-600 text-slate-400 hover:text-slate-200 hover:bg-white/5 bg-transparent">
                                <Plus className="w-4 h-4 mr-2" /> Agregar Item Adicional
                            </Button>

                            <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-md text-yellow-200/80 text-sm flex items-start gap-2">
                                <Info className="w-5 h-5 shrink-0 text-yellow-500/80" />
                                <p>
                                    Al aprobar, este requerimiento pasará al módulo de <strong className="text-yellow-100">Solicitudes de Compra</strong> para la gestión con proveedores.
                                </p>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsReviewModalOpen(false)} className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white bg-transparent">Cancelar</Button>
                        <Button 
                            onClick={handleApproveRequisition} 
                            className="bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20"
                            disabled={selectedRequisition?.status === 'approved'}
                        >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Aprobar y Generar Solicitud
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
