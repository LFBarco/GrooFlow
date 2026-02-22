import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  FileText, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Upload, 
  Plus,
  Search,
  Filter,
  DollarSign,
  Briefcase,
  Download,
  FileSpreadsheet,
  X,
  Loader2,
  ArrowRight,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Wallet,
  CreditCard,
  Clock
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger 
} from '../../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Provider } from '../../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid, AreaChart, Area, LineChart, Line } from 'recharts';
import { read, utils } from 'xlsx';

interface FeeReceipt {
  id: string;
  professionalId: string;
  professionalName: string;
  receiptNumber: string;
  issueDate: Date;
  dueDate: Date;
  amount: number;
  description: string;
  status: 'pending' | 'approved' | 'requested_payment' | 'paid' | 'rejected';
  fileUrl?: string;
  location?: string;
  paymentDate?: Date;
  paymentRequestedAt?: Date;
}

const MOCK_RECEIPTS: FeeReceipt[] = [
  {
    id: 'rx-001',
    professionalId: 'prof-1',
    professionalName: 'Dr. Carlos Mendez',
    receiptNumber: 'E001-45',
    issueDate: new Date(2024, 2, 10),
    dueDate: new Date(2024, 2, 25),
    amount: 1500.00,
    description: 'Servicios de Cardiología - Marzo 1ra Quincena',
    status: 'pending',
    location: 'Principal'
  },
  {
    id: 'rx-002',
    professionalId: 'prof-1',
    professionalName: 'Dr. Carlos Mendez',
    receiptNumber: 'E001-44',
    issueDate: new Date(2024, 1, 25),
    dueDate: new Date(2024, 2, 10),
    amount: 2000.00,
    description: 'Servicios de Cardiología - Febrero 2da Quincena',
    status: 'paid',
    location: 'Norte'
  },
  {
    id: 'rx-003',
    professionalId: 'prof-2',
    professionalName: 'Dra. Ana Torres',
    receiptNumber: 'E001-12',
    issueDate: new Date(2024, 2, 12),
    dueDate: new Date(2024, 2, 27),
    amount: 1200.00,
    description: 'Cirugía de Tejidos Blandos - Caso "Max"',
    status: 'approved',
    location: 'Principal'
  }
];

interface ProfessionalFeesModuleProps {
  providers?: Provider[];
  onUpdateProviders?: (providers: Provider[]) => void;
  onSendToTreasury?: (receipts: FeeReceipt[]) => void;
}

export const ProfessionalFeesModule: React.FC<ProfessionalFeesModuleProps> = ({ 
  providers = [], 
  onUpdateProviders,
  onSendToTreasury
}) => {
  const [activeTab, setActiveTab] = useState<'professionals' | 'detail' | 'analytics'>('detail');
  const [searchTerm, setSearchTerm] = useState('');
  const [receipts, setReceipts] = useState<FeeReceipt[]>(MOCK_RECEIPTS);
  
  // Derivamos la lista de profesionales desde los proveedores de tipo 'Médico Externo'
  const professionals = useMemo(() => {
    return providers.filter(p => p.type === 'Médico Externo');
  }, [providers]);

  // States for Modals
  const [isNewProfessionalOpen, setIsNewProfessionalOpen] = useState(false);
  const [isUploadRxHOpen, setIsUploadRxHOpen] = useState(false);

  // New Professional Form State
  const [newProf, setNewProf] = useState({
    name: '',
    role: '',
    ruc: '',
    email: ''
  });

  // Bulk Upload State
  const [uploadMode, setUploadMode] = useState<'single' | 'bulk'>('single');
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selection and Filtering State
  const [selectedReceipts, setSelectedReceipts] = useState<string[]>([]);
  const [professionalFilter, setProfessionalFilter] = useState<string>('all');
  const [hidePaid, setHidePaid] = useState(false);

  // Single Receipt Form State
  const [singleReceiptForm, setSingleReceiptForm] = useState({
    professionalId: '',
    receiptNumber: '',
    amount: '',
    issueDate: format(new Date(), 'yyyy-MM-dd'),
    dueDate: format(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    description: '',
    location: 'Principal'
  });

  const handleRegisterSingleReceipt = () => {
    if (!singleReceiptForm.professionalId || !singleReceiptForm.receiptNumber || !singleReceiptForm.amount) {
      toast.error("Complete los campos obligatorios (Profesional, N° Recibo, Monto)");
      return;
    }

    const professional = professionals.find(p => p.id === singleReceiptForm.professionalId);
    
    const newReceipt: FeeReceipt = {
      id: `rx-${Date.now()}`,
      professionalId: singleReceiptForm.professionalId,
      professionalName: professional?.name || 'Profesional Externo',
      receiptNumber: singleReceiptForm.receiptNumber,
      issueDate: new Date(singleReceiptForm.issueDate),
      dueDate: new Date(singleReceiptForm.dueDate),
      amount: parseFloat(singleReceiptForm.amount),
      description: singleReceiptForm.description,
      status: 'pending',
      location: singleReceiptForm.location
    };

    setReceipts(prev => [newReceipt, ...prev]);
    toast.success("Recibo registrado exitosamente");
    setIsUploadRxHOpen(false);
    // Reset form
    setSingleReceiptForm({
      professionalId: '',
      receiptNumber: '',
      amount: '',
      issueDate: format(new Date(), 'yyyy-MM-dd'),
      dueDate: format(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      description: '',
      location: 'Principal'
    });
  };

  const [visibleColumns, setVisibleColumns] = useState({
    fechaEmision: true,
    tipoDocEmitido: false,
    nroDocEmitido: true,
    estadoDocEmitido: false,
    tipoDocEmisor: false,
    nroDocEmisor: false,
    razonSocial: true,
    socialEmisor: false, // New column H
    tipoRenta: false,
    gratis: false, // Renamed from gratuito
    descripcion: true,
    observacion: false,
    sede: false,
    moneda: false,
    rentaBruta: true,
    impuesto: false,
    rentaNeta: false,
    montoPendiente: true,
    // Campos adicionales del sistema para gestión
    fechaVencimiento: true,
    estadoPago: true
  });

  const filteredReceipts = receipts.filter(r => 
    (professionalFilter === 'all' || r.professionalId === professionalFilter) &&
    (!hidePaid || r.status !== 'paid') &&
    (r.professionalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedReceipts(filteredReceipts.map(r => r.id));
    } else {
      setSelectedReceipts([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedReceipts(prev => [...prev, id]);
    } else {
      setSelectedReceipts(prev => prev.filter(rId => rId !== id));
    }
  };

  const handleBulkAction = (action: 'approve' | 'reject' | 'request_payment') => {
    if (selectedReceipts.length === 0) return;

    if (action === 'request_payment') {
      const toSend = receipts.filter(r => selectedReceipts.includes(r.id) && (r.status === 'pending' || r.status === 'approved'));
      if (toSend.length === 0) {
        toast.error("Seleccione recibos pendientes o aprobados para solicitar pago.");
        return;
      }
      const now = new Date();
      setReceipts(prev => prev.map(r => {
        if (selectedReceipts.includes(r.id) && (r.status === 'pending' || r.status === 'approved')) {
          return { ...r, status: 'requested_payment' as const, paymentRequestedAt: now };
        }
        return r;
      }));
      onSendToTreasury?.(toSend.map(r => ({ ...r, status: 'requested_payment' as const, paymentRequestedAt: now })));
      toast.success(`${toSend.length} recibos enviados a Tesorería - Mesa de Pagos`);
      setSelectedReceipts([]);
      return;
    }

    setReceipts(prev => prev.map(r => {
      if (selectedReceipts.includes(r.id)) {
        if (r.status === 'paid' || r.status === 'requested_payment') return r;
        return { 
          ...r, 
          status: action === 'approve' ? 'approved' : 'rejected' 
        };
      }
      return r;
    }));

    const actionText = action === 'approve' ? 'Aprobados' : 'Rechazados';
    toast.success(`${selectedReceipts.length} recibos ${actionText} exitosamente.`);
    setSelectedReceipts([]);
  };

  const isAllSelected = filteredReceipts.length > 0 && selectedReceipts.length === filteredReceipts.length;
  const isIndeterminate = selectedReceipts.length > 0 && selectedReceipts.length < filteredReceipts.length;

  const filteredProfessionals = professionals.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.specialty && p.specialty.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const agingData = useMemo(() => {
    const now = new Date();
    const buckets = { '0-30 días': 0, '31-60 días': 0, '61-90 días': 0, '> 90 días': 0 };
    
    receipts.filter(r => r.status === 'pending' || r.status === 'approved').forEach(r => {
       const dueDate = new Date(r.dueDate);
       const diffTime = Math.abs(now.getTime() - dueDate.getTime());
       const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
       const isOverdue = dueDate < now;
       const daysOverdue = isOverdue ? diffDays : 0;

       if (daysOverdue <= 30) buckets['0-30 días'] += r.amount;
       else if (daysOverdue <= 60) buckets['31-60 días'] += r.amount;
       else if (daysOverdue <= 90) buckets['61-90 días'] += r.amount;
       else buckets['> 90 días'] += r.amount;
    });

    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [receipts]);

  const debtBySpecialist = useMemo(() => {
     const debt: Record<string, number> = {};
     receipts.filter(r => r.status === 'pending' || r.status === 'approved').forEach(r => {
        const prof = professionals.find(p => p.id === r.professionalId);
        const spec = prof?.specialty || 'Sin Especialidad';
        debt[spec] = (debt[spec] || 0) + r.amount;
     });
     
     // Transform to array for chart
     return Object.entries(debt)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
  }, [receipts, professionals]);

  const analyticsSummary = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // KPI Data
    const totalPaidYTD = receipts
      .filter(r => r.status === 'paid' && r.issueDate.getFullYear() === currentYear)
      .reduce((acc, curr) => acc + curr.amount, 0);

    const pendingAmount = receipts
      .filter(r => r.status === 'pending' || r.status === 'approved')
      .reduce((acc, curr) => acc + curr.amount, 0);
      
    // Find top earner (paid receipts)
    const earningsByProf: Record<string, number> = {};
    receipts.filter(r => r.status === 'paid').forEach(r => {
       earningsByProf[r.professionalName] = (earningsByProf[r.professionalName] || 0) + r.amount;
    });
    const topEarnerEntry = Object.entries(earningsByProf).sort((a, b) => b[1] - a[1])[0];
    const topEarner = topEarnerEntry ? { name: topEarnerEntry[0], amount: topEarnerEntry[1] } : { name: 'N/A', amount: 0 };

    // Monthly Trend (Last 6 months)
    const trendData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = format(d, 'MMM', { locale: es });
      const monthYear = d.getFullYear();
      const monthIndex = d.getMonth();
      
      const monthlyPaid = receipts
        .filter(r => r.status === 'paid' && r.issueDate.getMonth() === monthIndex && r.issueDate.getFullYear() === monthYear)
        .reduce((acc, curr) => acc + curr.amount, 0);
        
      const monthlyPending = receipts
        .filter(r => (r.status === 'pending' || r.status === 'approved') && r.issueDate.getMonth() === monthIndex && r.issueDate.getFullYear() === monthYear)
        .reduce((acc, curr) => acc + curr.amount, 0);
        
      trendData.push({
        name: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        pagado: monthlyPaid,
        pendiente: monthlyPending
      });
    }

    return { totalPaidYTD, pendingAmount, topEarner, trendData };
  }, [receipts]);

  const COLORS = ['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'];

  const getStatusColor = (status: FeeReceipt['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'approved': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'requested_payment': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'paid': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'rejected': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const getStatusLabel = (status: FeeReceipt['status']) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'approved': return 'Aprobado';
      case 'requested_payment': return 'Solicitud Enviada';
      case 'paid': return 'Pagado';
      case 'rejected': return 'Rechazado';
      default: return status;
    }
  };

  // --- Handlers ---

  const handleCreateProfessional = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProf.name || !newProf.ruc) {
      toast.error("Nombre y RUC son obligatorios");
      return;
    }

    if (!onUpdateProviders) {
      toast.error("Error de sistema: No se puede guardar el proveedor.");
      return;
    }

    const newProvider: Provider = {
      id: `prof-${Date.now()}`,
      name: newProf.name,
      ruc: newProf.ruc,
      email: newProf.email,
      type: 'Médico Externo',
      specialty: newProf.role || 'Colaborador Externo',
      category: 'Servicios', // Categoría comercial default
      defaultCreditDays: 0,
      totalPurchased: 0
    };

    onUpdateProviders([...providers, newProvider]);
    setIsNewProfessionalOpen(false);
    setNewProf({ name: '', role: '', ruc: '', email: '' });
    toast.success("Profesional registrado exitosamente en el Directorio");
    setActiveTab('professionals');
  };

  const handleDownloadTemplate = () => {
    // Headers based on A-R columns requested
    const headers = [
      "Fecha de Emisión",                                      // Col A
      "Tipo de documento emitido",                             // Col B
      "Documento N.º emitido",                                 // Col C
      "Estado Doc. Emitido",                                   // Col D
      "Tipo de Doc. Emisor",                                   // Col E
      "N.º Doc. Emisor",                                       // Col F
      "Apellidos y Nombres, Denominación o Razón",             // Col G
      "Social del Emisor",                                     // Col H
      "Tipo de Renta",                                         // Col I
      "Gratis",                                                // Col J
      "Descripción",                                           // Col K
      "Observación",                                           // Col L
      "Sede",                                                  // Col M
      "Moneda de Operación",                                   // Col N
      "Renta Bruta",                                           // Col O
      "Impuesto a la Renta",                                   // Col P
      "Renta Neta",                                            // Col Q
      "Monto Neto Pendiente de Pago"                           // Col R
    ];
    
    const exampleRow = [
      "2024-03-01",
      "Recibo por Honorarios",
      "E001-123",
      "Emitido",
      "RUC",
      "10123456789",
      "Dr. Juan Perez",
      "", // Social del Emisor (Empty for person, or part of company name)
      "Renta de 4ta Categoría",
      "NO",
      "Servicios Médicos Marzo",
      "",
      "Principal",
      "PEN",
      "1500.00",
      "120.00",
      "1380.00",
      "1380.00"
    ];

    const csvContent = "data:text/csv;charset=utf-8," + 
      headers.map(h => `"${h}"`).join(",") + "\n" + 
      exampleRow.map(c => `"${c}"`).join(",");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "plantilla_carga_masiva_rxh.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Plantilla descargada correctamente");
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(file => 
      file.name.endsWith('.csv') || 
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls')
    );
    setFiles(prev => [...prev, ...validFiles]);
  };

  const handleProcessUpload = async () => {
    setIsProcessing(true);
    let processedCount = 0;
    let ignoredCount = 0;
    const newReceipts: FeeReceipt[] = [];

    try {
      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = read(arrayBuffer);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON with headers
        // raw: false forces everything to string which is safer for RUCs like "0123" not becoming 123
        const jsonData = utils.sheet_to_json<any>(worksheet, { raw: false });

        for (const row of jsonData) {
          // 1. Get RUC and Receipt Number
          // Map to new column names (A-R structure)
          // "N.º Doc. Emisor" (Col F) for RUC
          // "Documento N.º emitido" (Col C) for Receipt Number
          const ruc = String(row['N.º Doc. Emisor'] || row['Nro. Doc. Emisor'] || '').trim();
          const receiptNumber = String(row['Documento N.º emitido'] || row['Nro. Doc. Emitido'] || '').trim();
          
          if (!ruc || !receiptNumber) {
            continue; // Skip invalid rows
          }

          // 2. Validate Professional by RUC
          const professional = professionals.find(p => p.ruc === ruc);
          
          if (!professional) {
            console.log(`Ignored receipt ${receiptNumber}: Professional with RUC ${ruc} not found.`);
            ignoredCount++;
            continue;
          }

          // 3. Validate Duplicate Receipt (Same Professional + Same Receipt Number)
          const isDuplicate = receipts.some(r => 
            r.receiptNumber === receiptNumber && r.professionalId === professional.id
          ) || newReceipts.some(r => 
             r.receiptNumber === receiptNumber && r.professionalId === professional.id
          );

          if (isDuplicate) {
            console.log(`Ignored duplicate receipt ${receiptNumber} for ${professional.name}`);
            ignoredCount++;
            continue;
          }

          // 4. Parse Date and Amount
          let issueDate = new Date();
          const rawDate = row['Fecha de Emisión'];
          if (rawDate) {
             const parsedDate = new Date(rawDate);
             if (!isNaN(parsedDate.getTime())) {
                issueDate = parsedDate;
             }
          }

          // Clean currency string (e.g. "S/ 1,500.00" -> 1500.00)
          // Using 'Renta Bruta' (Col O) or 'Monto Neto Pendiente de Pago' (Col R)
          const amountStr = String(row['Renta Bruta'] || row['Monto Neto Pendiente de Pago'] || '0')
            .replace(/[^\d.-]/g, ''); 
          const amount = parseFloat(amountStr);

          // 5. Add to valid list
          newReceipts.push({
            id: `rx-bulk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            professionalId: professional.id,
            professionalName: professional.name, // Usually we take name from DB, but CSV has "Apellidos y Nombres..." in Col G
            receiptNumber: receiptNumber,
            issueDate: issueDate,
            dueDate: new Date(issueDate.getTime() + (15 * 24 * 60 * 60 * 1000)), // Default 15 days due
            amount: amount || 0,
            description: row['Descripción'] || 'Importación Masiva',
            status: 'pending',
            location: row['Sede'] || 'Principal'
          });
          
          processedCount++;
        }
      }

      if (newReceipts.length > 0) {
        setReceipts(prev => [...prev, ...newReceipts]);
        toast.success(`Se importaron ${processedCount} recibos correctamente.`);
      }

      if (ignoredCount > 0) {
        toast.warning(`${ignoredCount} registros ignorados (Profesional no encontrado o duplicados).`);
      } else if (processedCount === 0 && files.length > 0) {
        toast.error("No se encontraron registros válidos para importar.");
      }

    } catch (error) {
      console.error("Error processing upload:", error);
      toast.error("Error al procesar el archivo. Verifique el formato.");
    } finally {
      setIsProcessing(false);
      setIsUploadRxHOpen(false);
      setFiles([]);
    }
  };

  // Helper to calculate pending amount for a professional
  const getPendingAmount = (profId: string) => {
    return receipts
      .filter(r => r.professionalId === profId && (r.status === 'pending' || r.status === 'approved'))
      .reduce((acc, curr) => acc + curr.amount, 0);
  };

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Briefcase className="w-8 h-8 text-violet-500" />
            Honorarios Profesionales
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestión de Recibos por Honorarios (RxH) y pagos a terceros.
          </p>
        </div>
        
        <div className="flex gap-2">
           <Dialog open={isUploadRxHOpen} onOpenChange={setIsUploadRxHOpen}>
             <DialogTrigger asChild>
               <Button className="bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20">
                 <Upload className="w-4 h-4 mr-2" />
                 Subir RxH
               </Button>
             </DialogTrigger>
             <DialogContent className="sm:max-w-[600px] bg-card border-border">
               <DialogHeader>
                 <DialogTitle>Carga de Recibos por Honorarios</DialogTitle>
                 <DialogDescription>
                   Sube tus recibos individuales o utiliza la carga masiva para múltiples documentos.
                 </DialogDescription>
               </DialogHeader>

               <div className="flex space-x-1 bg-muted/20 p-1 rounded-lg mb-4">
                  <button
                    onClick={() => setUploadMode('single')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                      uploadMode === 'single' 
                        ? 'bg-background text-foreground shadow-sm' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Individual
                  </button>
                  <button
                    onClick={() => setUploadMode('bulk')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                      uploadMode === 'bulk' 
                        ? 'bg-background text-foreground shadow-sm' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Carga Masiva (Excel/CSV)
                  </button>
               </div>

               {uploadMode === 'single' ? (
                 <div className="space-y-4 py-4">
                    <div className="grid gap-2">
                      <Label>Profesional</Label>
                      <select 
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={singleReceiptForm.professionalId}
                        onChange={(e) => setSingleReceiptForm({...singleReceiptForm, professionalId: e.target.value})}
                      >
                        <option value="">Seleccione un profesional...</option>
                        {professionals.map(p => (
                          <option key={p.id} value={p.id}>{p.name} - {p.ruc}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="grid gap-2">
                         <Label>N° Recibo (Serie-Numero)</Label>
                         <Input 
                            placeholder="E001-XXXX" 
                            value={singleReceiptForm.receiptNumber}
                            onChange={(e) => setSingleReceiptForm({...singleReceiptForm, receiptNumber: e.target.value})}
                         />
                       </div>
                       <div className="grid gap-2">
                         <Label>Monto Total (S/)</Label>
                         <Input 
                            type="number" 
                            placeholder="0.00" 
                            value={singleReceiptForm.amount}
                            onChange={(e) => setSingleReceiptForm({...singleReceiptForm, amount: e.target.value})}
                         />
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="grid gap-2">
                         <Label>Fecha Emisión</Label>
                         <Input 
                            type="date" 
                            value={singleReceiptForm.issueDate}
                            onChange={(e) => setSingleReceiptForm({...singleReceiptForm, issueDate: e.target.value})}
                         />
                       </div>
                       <div className="grid gap-2">
                         <Label>Fecha Vencimiento</Label>
                         <Input 
                            type="date" 
                            value={singleReceiptForm.dueDate}
                            onChange={(e) => setSingleReceiptForm({...singleReceiptForm, dueDate: e.target.value})}
                         />
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="grid gap-2">
                         <Label>Sede</Label>
                         <select 
                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={singleReceiptForm.location}
                            onChange={(e) => setSingleReceiptForm({...singleReceiptForm, location: e.target.value})}
                         >
                            <option value="Principal">Principal</option>
                            <option value="Norte">Norte</option>
                            <option value="Sur">Sur</option>
                            <option value="Este">Este</option>
                         </select>
                       </div>
                       <div className="grid gap-2">
                         {/* Espacio para futuro campo o Moneda */}
                       </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Descripción del Servicio</Label>
                      <Input 
                        placeholder="Ej. Servicios de cardiología..." 
                        value={singleReceiptForm.description}
                        onChange={(e) => setSingleReceiptForm({...singleReceiptForm, description: e.target.value})}
                      />
                    </div>
                    <div className="pt-2">
                        <Button 
                          className="w-full bg-violet-600 hover:bg-violet-700"
                          onClick={handleRegisterSingleReceipt}
                        >
                          Registrar Recibo
                        </Button>
                    </div>
                 </div>
               ) : (
                 <div className="space-y-4 py-2">
                    <div 
                      className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-violet-500/50 hover:bg-violet-500/5 transition-all"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleFileDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                       <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          multiple 
                          accept=".csv,.xlsx,.xls"
                          onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
                        />
                       <div className="w-12 h-12 bg-violet-500/10 text-violet-500 rounded-full flex items-center justify-center mb-3">
                         <FileSpreadsheet className="w-6 h-6" />
                       </div>
                       <p className="text-sm font-medium text-foreground mb-1">Arrastra tus archivos aquí</p>
                       <p className="text-xs text-muted-foreground">Soporta .xlsx, .csv</p>
                    </div>

                    {files.length > 0 && (
                      <div className="bg-muted/30 rounded-lg p-3 max-h-[150px] overflow-y-auto space-y-2">
                        {files.map((f, i) => (
                           <div key={i} className="flex items-center justify-between text-sm p-2 bg-background border border-border rounded-md">
                              <div className="flex items-center gap-2 truncate">
                                <FileText className="w-4 h-4 text-violet-400" />
                                <span className="truncate">{f.name}</span>
                              </div>
                              <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))}>
                                <X className="w-4 h-4 text-muted-foreground hover:text-red-400" />
                              </button>
                           </div>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2">
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         className="text-xs text-muted-foreground hover:text-violet-400"
                         onClick={handleDownloadTemplate}
                        >
                         <Download className="w-3 h-3 mr-1.5" />
                         Descargar Plantilla
                       </Button>
                       
                       <Button 
                         onClick={handleProcessUpload} 
                         disabled={files.length === 0 || isProcessing}
                         className="bg-violet-600 hover:bg-violet-700 text-white"
                       >
                         {isProcessing ? (
                           <>
                             <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                             Procesando...
                           </>
                         ) : (
                           <>
                             Procesar Archivos
                             <ArrowRight className="w-4 h-4 ml-2" />
                           </>
                         )}
                       </Button>
                    </div>
                 </div>
               )}
             </DialogContent>
           </Dialog>

           <Dialog open={isNewProfessionalOpen} onOpenChange={setIsNewProfessionalOpen}>
             <DialogTrigger asChild>
               <Button variant="outline" className="border-violet-500/20 hover:bg-violet-500/10 text-violet-500">
                 <Plus className="w-4 h-4 mr-2" />
                 Nuevo Profesional
               </Button>
             </DialogTrigger>
             <DialogContent className="sm:max-w-[425px] bg-card border-border">
               <DialogHeader>
                 <DialogTitle>Registrar Nuevo Profesional</DialogTitle>
                 <DialogDescription>
                   Añade un nuevo médico o colaborador externo al directorio.
                 </DialogDescription>
               </DialogHeader>
               <form onSubmit={handleCreateProfessional} className="grid gap-4 py-4">
                 <div className="grid gap-2">
                   <Label htmlFor="name">Nombre Completo</Label>
                   <Input 
                      id="name" 
                      value={newProf.name}
                      onChange={(e) => setNewProf({...newProf, name: e.target.value})}
                      placeholder="Ej. Dr. Juan Perez" 
                      className="col-span-3" 
                    />
                 </div>
                 <div className="grid gap-2">
                   <Label htmlFor="role">Especialidad / Rol</Label>
                   <Input 
                      id="role" 
                      value={newProf.role}
                      onChange={(e) => setNewProf({...newProf, role: e.target.value})}
                      placeholder="Ej. Cardiólogo" 
                      className="col-span-3" 
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                       <Label htmlFor="ruc">RUC (10/20)</Label>
                       <Input 
                          id="ruc" 
                          value={newProf.ruc}
                          onChange={(e) => setNewProf({...newProf, ruc: e.target.value})}
                          placeholder="10..." 
                        />
                    </div>
                    <div className="grid gap-2">
                       <Label htmlFor="email">Email</Label>
                       <Input 
                          id="email" 
                          type="email"
                          value={newProf.email}
                          onChange={(e) => setNewProf({...newProf, email: e.target.value})}
                          placeholder="correo@ejemplo.com" 
                        />
                    </div>
                 </div>
                 <div className="flex justify-end pt-4">
                    <Button type="submit" className="bg-violet-600 hover:bg-violet-700">Guardar Registro</Button>
                 </div>
               </form>
             </DialogContent>
           </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border-violet-500/10 bg-violet-500/5 backdrop-blur-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Pendiente</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">S/ {receipts.filter(r => r.status === 'pending' || r.status === 'approved').reduce((acc, curr) => acc + curr.amount, 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h3>
            </div>
            <div className="p-2 bg-violet-500/10 rounded-lg">
              <DollarSign className="w-5 h-5 text-violet-500" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-violet-400">
            <AlertCircle className="w-3 h-3 mr-1" />
            {receipts.filter(r => r.status === 'pending').length} recibos por aprobar
          </div>
        </Card>

        <Card className="p-4 border-emerald-500/10 bg-emerald-500/5 backdrop-blur-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pagado este Mes</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">S/ {receipts.filter(r => r.status === 'paid' && r.issueDate.getMonth() === new Date().getMonth()).reduce((acc, curr) => acc + curr.amount, 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h3>
            </div>
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
          <div className="mt-4 text-xs text-emerald-400">
            +12% vs mes anterior
          </div>
        </Card>

        <Card className="p-4 border-blue-500/10 bg-blue-500/5 backdrop-blur-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Profesionales Activos</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{professionals.length}</h3>
            </div>
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
          </div>
          <div className="mt-4 text-xs text-blue-400">
            En directorio global
          </div>
        </Card>
      </div>

      {/* Tabs & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-border pb-4">
        <div className="flex space-x-1 bg-muted/20 p-1 rounded-lg overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('detail')}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'detail' 
                ? 'bg-background text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            }`}
          >
            Gestión de Recibos
          </button>
          <button
            onClick={() => setActiveTab('professionals')}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'professionals' 
                ? 'bg-background text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            }`}
          >
            Profesionales
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'analytics' 
                ? 'bg-background text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            }`}
          >
            Analítica
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar..." 
            className="pl-9 h-9 bg-background/50 border-border/50 focus:border-violet-500/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'professionals' ? (
          <motion.div
            key="professionals"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredProfessionals.length > 0 ? (
              filteredProfessionals.map((prof) => (
                <Card key={prof.id} className="p-4 hover:border-violet-500/30 transition-all flex flex-col justify-between h-full">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-white font-bold text-sm">
                          {prof.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground text-sm">{prof.name}</h3>
                          <p className="text-xs text-muted-foreground">{prof.specialty || 'Sin especialidad'}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-green-500 border-green-500/20 bg-green-500/5">
                        Activo
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 text-xs text-muted-foreground mb-4">
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span>RUC:</span>
                        <span className="font-mono text-foreground">{prof.ruc}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span>Email:</span>
                        <span className="text-foreground truncate max-w-[150px]">{prof.email || '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-border/50">
                     <div className="flex justify-between items-center mb-3">
                       <span className="text-xs text-muted-foreground">Pendiente de Pago</span>
                       <span className="font-bold text-lg font-mono text-foreground">
                         S/ {getPendingAmount(prof.id).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                       </span>
                     </div>
                     <Button className="w-full bg-violet-600/10 hover:bg-violet-600/20 text-violet-500 border border-violet-600/20">
                       Ver Detalle
                     </Button>
                  </div>
                </Card>
              ))
            ) : (
              <div className="col-span-full py-10 text-center text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No hay profesionales registrados.</p>
                <p className="text-xs mt-1">Agrega uno nuevo o marca proveedores como "Médico Externo".</p>
              </div>
            )}
          </motion.div>
        ) : activeTab === 'detail' ? (
          <motion.div
            key="detail"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {/* Filter and Bulk Actions Bar */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-4 bg-muted/20 p-2 rounded-lg border border-border">
              <div className="flex items-center gap-2 w-full md:w-auto">
                 <Filter className="w-4 h-4 text-muted-foreground" />
                 <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Filtrar por:</span>
                 <select 
                    className="h-9 w-[200px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={professionalFilter}
                    onChange={(e) => setProfessionalFilter(e.target.value)}
                 >
                    <option value="all">Todos los Profesionales</option>
                    {professionals.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                 </select>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
                 {/* Toggle para ocultar pagados */}
                 <label className="flex items-center gap-1.5 cursor-pointer select-none">
                   <input
                     type="checkbox"
                     className="w-3.5 h-3.5 rounded accent-violet-500"
                     checked={hidePaid}
                     onChange={e => setHidePaid(e.target.checked)}
                   />
                   <span className="text-xs text-muted-foreground">Ocultar pagados</span>
                 </label>

                 {selectedReceipts.length > 0 ? (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-5">
                       <span className="text-xs font-medium bg-violet-100 text-violet-700 px-2 py-1 rounded-full border border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800">
                          {selectedReceipts.length} seleccionados
                       </span>
                       <Button 
                         size="sm" 
                         className="h-8 text-xs bg-orange-600 hover:bg-orange-700 text-white"
                         onClick={() => handleBulkAction('request_payment')}
                       >
                         <ArrowRight className="w-3 h-3 mr-1.5" />
                         Solicitar Pago
                       </Button>
                       <Button 
                         size="sm" 
                         className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                         onClick={() => handleBulkAction('approve')}
                       >
                         <CheckCircle2 className="w-3 h-3 mr-1.5" />
                         Aprobar
                       </Button>
                       <Button 
                         size="sm" 
                         variant="outline"
                         className="h-8 text-xs border-red-500/20 text-red-600 hover:bg-red-500/10"
                         onClick={() => handleBulkAction('reject')}
                       >
                         <X className="w-3 h-3 mr-1.5" />
                         Rechazar
                       </Button>
                    </div>
                 ) : (
                    <div className="text-xs text-muted-foreground italic">
                       Seleccione recibos para acciones masivas
                    </div>
                 )}

                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="ml-2">
                        Columnas <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-[300px] h-[400px] overflow-y-auto">
                  <DropdownMenuLabel>Columnas de la Plantilla</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.fechaEmision}
                    onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, fechaEmision: !!checked }))}
                  >
                    (A) Fecha de Emisión
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.tipoDocEmitido}
                    onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, tipoDocEmitido: !!checked }))}
                  >
                    (B) Tipo Doc. Emitido
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.nroDocEmitido}
                    onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, nroDocEmitido: !!checked }))}
                  >
                    (C) Documento N.º emitido
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.estadoDocEmitido}
                    onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, estadoDocEmitido: !!checked }))}
                  >
                    (D) Estado Doc. Emitido
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.tipoDocEmisor}
                    onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, tipoDocEmisor: !!checked }))}
                  >
                    (E) Tipo de Doc. Emisor
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.nroDocEmisor}
                    onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, nroDocEmisor: !!checked }))}
                  >
                    (F) N.º Doc. Emisor
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.razonSocial}
                    onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, razonSocial: !!checked }))}
                  >
                    (G) Apellidos y Nombres...
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.socialEmisor}
                    onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, socialEmisor: !!checked }))}
                  >
                    (H) Social del Emisor
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.tipoRenta}
                    onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, tipoRenta: !!checked }))}
                  >
                    (I) Tipo de Renta
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.gratis}
                    onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, gratis: !!checked }))}
                  >
                    (J) Gratis
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.descripcion}
                    onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, descripcion: !!checked }))}
                  >
                    (K) Descripción
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.observacion}
                    onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, observacion: !!checked }))}
                  >
                    (L) Observación
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.sede}
                    onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, sede: !!checked }))}
                  >
                    (M) Sede
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.moneda}
                    onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, moneda: !!checked }))}
                  >
                    (N) Moneda de Operación
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.rentaBruta}
                    onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, rentaBruta: !!checked }))}
                  >
                    (O) Renta Bruta
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.impuesto}
                    onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, impuesto: !!checked }))}
                  >
                    (P) Impuesto a la Renta
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.rentaNeta}
                    onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, rentaNeta: !!checked }))}
                  >
                    (Q) Renta Neta
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.montoPendiente}
                    onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, montoPendiente: !!checked }))}
                  >
                    (R) Monto Neto Pendiente
                  </DropdownMenuCheckboxItem>

                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Gestión Interna</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.fechaVencimiento}
                    onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, fechaVencimiento: !!checked }))}
                  >
                    Fecha Vencimiento
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.estadoPago}
                    onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, estadoPago: !!checked }))}
                  >
                    Estado de Pago
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <Card className="overflow-hidden border border-border">
              <div className="overflow-x-auto">
                <Table className="whitespace-nowrap">
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      {/* Checkbox Header */}
                      <TableHead className="w-[40px]">
                        <input 
                           type="checkbox"
                           className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                           checked={isAllSelected}
                           ref={input => { if (input) input.indeterminate = isIndeterminate; }}
                           onChange={(e) => handleSelectAll(e.target.checked)}
                        />
                      </TableHead>

                      {/* Columnas de Plantilla */}
                      {visibleColumns.fechaEmision && <TableHead>F. Emisión</TableHead>}
                      {visibleColumns.tipoDocEmitido && <TableHead>Tipo Doc.</TableHead>}
                      {visibleColumns.nroDocEmitido && <TableHead>N° Recibo</TableHead>}
                      {visibleColumns.estadoDocEmitido && <TableHead>Est. Doc.</TableHead>}
                      {visibleColumns.tipoDocEmisor && <TableHead>Tipo Emisor</TableHead>}
                      {visibleColumns.nroDocEmisor && <TableHead>RUC Emisor</TableHead>}
                      {visibleColumns.razonSocial && <TableHead>Razón Social / Nombres</TableHead>}
                      {visibleColumns.socialEmisor && <TableHead>Social</TableHead>}
                      {visibleColumns.tipoRenta && <TableHead>Tipo Renta</TableHead>}
                      {visibleColumns.gratis && <TableHead>Gratis</TableHead>}
                      {visibleColumns.descripcion && <TableHead>Descripción</TableHead>}
                      {visibleColumns.observacion && <TableHead>Observación</TableHead>}
                      {visibleColumns.sede && <TableHead>Sede</TableHead>}
                      {visibleColumns.moneda && <TableHead>Moneda</TableHead>}
                      {visibleColumns.rentaBruta && <TableHead className="text-right">Renta Bruta</TableHead>}
                      {visibleColumns.impuesto && <TableHead className="text-right">Impuesto (8%)</TableHead>}
                      {visibleColumns.rentaNeta && <TableHead className="text-right">Renta Neta</TableHead>}
                      {visibleColumns.montoPendiente && <TableHead className="text-right">Monto Pendiente</TableHead>}
                      
                      {/* Columnas Sistema */}
                      {visibleColumns.fechaVencimiento && <TableHead>Vencimiento (Sys)</TableHead>}
                      {visibleColumns.estadoPago && <TableHead>Estado Pago (Sys)</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReceipts.map((receipt) => {
                      const prof = professionals.find(p => p.id === receipt.professionalId);
                      const rentaBruta = receipt.amount;
                      const impuesto = rentaBruta * 0.08;
                      const rentaNeta = rentaBruta - impuesto;

                      return (
                        <TableRow 
                          key={receipt.id}
                          className={selectedReceipts.includes(receipt.id) ? "bg-violet-50/50 hover:bg-violet-50" : "hover:bg-muted/30"}
                        >
                          {/* Checkbox Cell */}
                          <TableCell className="w-[40px]">
                            <input 
                               type="checkbox"
                               className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                               checked={selectedReceipts.includes(receipt.id)}
                               onChange={(e) => handleSelectRow(receipt.id, e.target.checked)}
                            />
                          </TableCell>

                          {visibleColumns.fechaEmision && <TableCell>{format(receipt.issueDate, 'dd/MM/yyyy')}</TableCell>}
                          {visibleColumns.tipoDocEmitido && <TableCell className="text-xs">R. Honorarios</TableCell>}
                          {visibleColumns.nroDocEmitido && <TableCell className="font-mono text-xs">{receipt.receiptNumber}</TableCell>}
                          {visibleColumns.estadoDocEmitido && <TableCell className="text-xs">Emitido</TableCell>}
                          {visibleColumns.tipoDocEmisor && <TableCell className="text-xs">RUC</TableCell>}
                          {visibleColumns.nroDocEmisor && <TableCell className="font-mono text-xs">{prof?.ruc || '-'}</TableCell>}
                          {visibleColumns.razonSocial && <TableCell className="font-medium text-xs">{receipt.professionalName}</TableCell>}
                          {visibleColumns.socialEmisor && <TableCell className="text-xs">-</TableCell>}
                          {visibleColumns.tipoRenta && <TableCell className="text-xs">4ta Categ.</TableCell>}
                          {visibleColumns.gratis && <TableCell className="text-xs">NO</TableCell>}
                          {visibleColumns.descripcion && <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate" title={receipt.description}>
                            {receipt.description}
                          </TableCell>}
                          {visibleColumns.observacion && <TableCell className="text-xs text-muted-foreground">-</TableCell>}
                          {visibleColumns.sede && <TableCell className="text-xs">{receipt.location || 'Principal'}</TableCell>}
                          {visibleColumns.moneda && <TableCell className="text-xs">PEN</TableCell>}
                          {visibleColumns.rentaBruta && <TableCell className="text-right font-mono text-xs">
                            {rentaBruta.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                          </TableCell>}
                          {visibleColumns.impuesto && <TableCell className="text-right font-mono text-xs text-red-400">
                            {impuesto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                          </TableCell>}
                          {visibleColumns.rentaNeta && <TableCell className="text-right font-mono text-xs font-medium">
                            {rentaNeta.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                          </TableCell>}
                          {visibleColumns.montoPendiente && <TableCell className="text-right font-mono text-xs font-medium">
                            {rentaNeta.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                          </TableCell>}

                          {/* Sistema */}
                          {visibleColumns.fechaVencimiento && <TableCell className={receipt.dueDate < new Date() && receipt.status === 'pending' ? 'text-red-500 font-medium text-xs' : 'text-xs'}>
                            {format(receipt.dueDate, 'dd/MM/yyyy')}
                          </TableCell>}
                          {visibleColumns.estadoPago && <TableCell>
                            {receipt.status === 'pending' ? (
                               <div className="flex gap-1">
                                  <Button size="icon" variant="ghost" className="h-6 w-6 text-orange-500 hover:bg-orange-500/10 hover:text-orange-600" title="Solicitar Pago" onClick={e => { e.stopPropagation(); handleBulkAction('request_payment'); setSelectedReceipts([receipt.id]); }}>
                                     <ArrowRight className="w-4 h-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-6 w-6 text-green-500 hover:bg-green-500/10 hover:text-green-600" title="Aprobar" onClick={e => { e.stopPropagation(); setSelectedReceipts([receipt.id]); handleBulkAction('approve'); }}>
                                     <CheckCircle2 className="w-4 h-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500 hover:bg-red-500/10 hover:text-red-600" title="Rechazar" onClick={e => { e.stopPropagation(); setSelectedReceipts([receipt.id]); handleBulkAction('reject'); }}>
                                     <X className="w-4 h-4" />
                                  </Button>
                               </div>
                            ) : receipt.status === 'approved' ? (
                               <div className="flex gap-1 items-center">
                                 <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/20 flex items-center gap-1 w-fit">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Aprobado
                                 </Badge>
                                 <Button size="icon" variant="ghost" className="h-6 w-6 text-orange-500 hover:bg-orange-500/10" title="Solicitar Pago" onClick={e => { e.stopPropagation(); setSelectedReceipts([receipt.id]); handleBulkAction('request_payment'); }}>
                                    <ArrowRight className="w-3 h-3" />
                                 </Button>
                               </div>
                            ) : receipt.status === 'requested_payment' ? (
                               <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-500 border-orange-500/20 flex items-center gap-1 w-fit">
                                  <Clock className="w-3 h-3" />
                                  En Mesa de Pagos
                               </Badge>
                            ) : receipt.status === 'paid' ? (
                               <div className="flex flex-col gap-0.5">
                                 <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20 flex items-center gap-1 w-fit">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Pagado
                                 </Badge>
                                 {receipt.paymentDate && <span className="text-[9px] text-muted-foreground">{format(receipt.paymentDate, 'dd/MM/yyyy')}</span>}
                               </div>
                            ) : (
                               <Badge variant="outline" className={`text-[10px] ${getStatusColor(receipt.status)}`}>
                                   {getStatusLabel(receipt.status)}
                               </Badge>
                            )}
                          </TableCell>}
                        </TableRow>
                      );
                    })}
                    {filteredReceipts.length === 0 && (
                       <TableRow>
                          <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="text-center py-8 text-muted-foreground">
                             No se encontraron registros
                          </TableCell>
                       </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
             {/* KPI Cards */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               <Card className="p-4 border-violet-500/10 bg-gradient-to-br from-violet-500/5 to-transparent">
                  <div className="flex justify-between items-start mb-2">
                     <p className="text-sm font-medium text-muted-foreground">Total Pagado (Año Actual)</p>
                     <div className="p-2 bg-violet-500/10 rounded-lg">
                        <Wallet className="w-4 h-4 text-violet-500" />
                     </div>
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">S/ {analyticsSummary.totalPaidYTD.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h3>
                  <div className="flex items-center mt-2 text-xs text-green-500">
                     <TrendingUp className="w-3 h-3 mr-1" />
                     <span>+12% vs año anterior</span>
                  </div>
               </Card>

               <Card className="p-4 border-orange-500/10 bg-gradient-to-br from-orange-500/5 to-transparent">
                  <div className="flex justify-between items-start mb-2">
                     <p className="text-sm font-medium text-muted-foreground">Pendiente de Pago</p>
                     <div className="p-2 bg-orange-500/10 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-orange-500" />
                     </div>
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">S/ {analyticsSummary.pendingAmount.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h3>
                  <div className="flex items-center mt-2 text-xs text-orange-500">
                     <span>Por vencer en 30 días</span>
                  </div>
               </Card>

               <Card className="p-4 border-blue-500/10 bg-gradient-to-br from-blue-500/5 to-transparent">
                  <div className="flex justify-between items-start mb-2">
                     <p className="text-sm font-medium text-muted-foreground">Mayor Facturación</p>
                     <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Users className="w-4 h-4 text-blue-500" />
                     </div>
                  </div>
                  <h3 className="text-lg font-bold text-foreground truncate" title={analyticsSummary.topEarner.name}>{analyticsSummary.topEarner.name}</h3>
                  <p className="text-sm font-mono text-muted-foreground mt-1">S/ {analyticsSummary.topEarner.amount.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
               </Card>

               <Card className="p-4 border-emerald-500/10 bg-gradient-to-br from-emerald-500/5 to-transparent">
                  <div className="flex justify-between items-start mb-2">
                     <p className="text-sm font-medium text-muted-foreground">Eficiencia de Pago</p>
                     <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                     </div>
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">95%</h3>
                  <div className="flex items-center mt-2 text-xs text-emerald-500">
                     <span>Pagos a tiempo</span>
                  </div>
               </Card>
             </div>

             {/* Charts Row 1: Trend */}
             <Card className="p-6 border-violet-500/10">
                <div className="flex justify-between items-center mb-6">
                   <div>
                      <h3 className="font-semibold text-foreground flex items-center gap-2">
                         <TrendingUp className="w-4 h-4 text-violet-500" />
                         Tendencia de Pagos vs Pendientes (Últimos 6 meses)
                      </h3>
                      <p className="text-sm text-muted-foreground">Comparativa mensual de flujo de caja</p>
                   </div>
                </div>
                <div className="h-[300px] w-full">
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analyticsSummary.trendData}>
                         <defs>
                            <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                               <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                               <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                            </linearGradient>
                         </defs>
                         <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.1} />
                         <XAxis dataKey="name" fontSize={12} stroke="#888" />
                         <YAxis fontSize={12} stroke="#888" tickFormatter={(val) => `S/ ${val}`} />
                         <Tooltip 
                            contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333' }}
                            formatter={(value: number) => [`S/ ${value.toLocaleString()}`, '']}
                         />
                         <Legend />
                         <Area type="monotone" dataKey="pagado" name="Pagado" stroke="#10b981" fillOpacity={1} fill="url(#colorPaid)" />
                         <Area type="monotone" dataKey="pendiente" name="Pendiente" stroke="#f59e0b" fillOpacity={1} fill="url(#colorPending)" />
                      </AreaChart>
                   </ResponsiveContainer>
                </div>
             </Card>

             {/* Charts Row 2: Distributions */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6 border-violet-500/10">
                   <h3 className="font-semibold mb-4 text-foreground flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-violet-500" />
                      Anticuamiento de Deuda (Aging)
                   </h3>
                   <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={agingData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.1} />
                            <XAxis dataKey="name" fontSize={12} stroke="#888" />
                            <YAxis fontSize={12} stroke="#888" tickFormatter={(val) => `S/ ${val}`} />
                            <Tooltip 
                               contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333' }}
                               formatter={(value: number) => [`S/ ${value.toLocaleString()}`, 'Monto']}
                            />
                            <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Monto por vencer" />
                         </BarChart>
                      </ResponsiveContainer>
                   </div>
                </Card>

                <Card className="p-6 border-violet-500/10">
                   <h3 className="font-semibold mb-4 text-foreground flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-violet-500" />
                      Deuda por Especialidad
                   </h3>
                   <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                            <Pie
                               data={debtBySpecialist}
                               cx="50%"
                               cy="50%"
                               labelLine={false}
                               label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                               outerRadius={80}
                               fill="#8884d8"
                               dataKey="value"
                            >
                               {debtBySpecialist.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                               ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => [`S/ ${value.toLocaleString()}`, 'Deuda']} />
                            <Legend />
                         </PieChart>
                      </ResponsiveContainer>
                   </div>
                </Card>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
