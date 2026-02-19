import { useMemo, useState } from 'react';
import { Transaction, InvoiceDraft } from '../../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
    ShieldAlert, 
    Trash2, 
    CheckCircle, 
    AlertTriangle, 
    FileWarning, 
    Eye, 
    Activity, 
    History, 
    User, 
    Calendar,
    ArrowUpRight,
    Search,
    Download,
    Filter
} from 'lucide-react';
import { format, isFuture, isWeekend, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Input } from '../ui/input';
import { Progress } from '../ui/progress';

interface AuditPanelProps {
  transactions: Transaction[];
  invoices: InvoiceDraft[];
  onDeleteTransaction: (id: string) => void;
  onDeleteInvoice: (id: string) => void;
}

// Mock Audit Log Data
const MOCK_AUDIT_LOGS = Array.from({ length: 15 }).map((_, i) => ({
    id: `log-${i}`,
    user: i % 3 === 0 ? 'Admin' : 'Contabilidad',
    action: i % 4 === 0 ? 'Eliminación' : i % 4 === 1 ? 'Edición' : 'Creación',
    entity: i % 2 === 0 ? 'Transacción' : 'Factura',
    details: i % 4 === 0 ? 'Eliminó registro duplicado #TRX-99' : 'Actualizó monto de factura #F001',
    date: subDays(new Date(), i),
    severity: i % 4 === 0 ? 'high' : 'low'
}));

export function AuditPanel({ transactions, invoices, onDeleteTransaction, onDeleteInvoice }: AuditPanelProps) {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');

  // --- LOGIC: Find Duplicate Transactions ---
  const duplicateTransactions = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    transactions.forEach(t => {
      const description = t.description || '';
      const key = `${t.type}|${t.amount}|${format(new Date(t.date), 'yyyy-MM-dd')}|${description.toLowerCase().trim()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    });

    const duplicates: Transaction[][] = [];
    groups.forEach((group) => {
      if (group.length > 1) duplicates.push(group);
    });
    return duplicates;
  }, [transactions]);

  // --- LOGIC: Find Duplicate Invoices ---
  const duplicateInvoices = useMemo(() => {
    const groups = new Map<string, InvoiceDraft[]>();
    invoices.forEach(inv => {
        if (!inv.invoiceNumber || inv.invoiceNumber.length < 3) return;
        const provider = inv.provider || '';
        const invoiceNumber = inv.invoiceNumber || '';
        const key = `${provider.toLowerCase().trim()}|${invoiceNumber.toLowerCase().trim()}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(inv);
    });

    const duplicates: InvoiceDraft[][] = [];
    groups.forEach((group) => {
        if (group.length > 1) duplicates.push(group);
    });
    return duplicates;
  }, [invoices]);

  // --- LOGIC: Anomalies / Gaps ---
  const suspiciousTransactions = useMemo(() => {
      return transactions.filter(t => {
          const date = new Date(t.date);
          const reasons: string[] = [];

          // Rule 1: High Amount without description details
          if (t.amount > 1000 && (t.description?.length || 0) < 5) reasons.push('Monto alto / Poca info');
          // Rule 2: Missing Category
          if (!t.category || t.category === 'Uncategorized') reasons.push('Sin Categoría');
          // Rule 3: Expense without subcategory
          if (t.type === 'expense' && (!t.subcategory || t.subcategory === 'General')) reasons.push('Sin Subcategoría');
          // Rule 4: Future Date
          if (isFuture(date)) reasons.push('Fecha Futura');
          // Rule 5: Round Numbers (Suspicious for expenses)
          if (t.type === 'expense' && t.amount > 100 && t.amount % 100 === 0) reasons.push('Monto Redondo (¿Estimación?)');
          // Rule 6: Weekend Transaction (Warning only)
          if (isWeekend(date)) reasons.push('Transacción en Fin de Semana');

          // Attach reasons temporarily (hacky but works for display)
          if (reasons.length > 0) {
              (t as any)._auditReasons = reasons;
              return true;
          }
          return false;
      });
  }, [transactions]);

  const handleResolveDuplicateTransaction = (group: Transaction[]) => {
      const [keep, ...remove] = group;
      remove.forEach(t => onDeleteTransaction(t.id));
      toast.success(`Se han eliminado ${remove.length} duplicados.`);
  };

  const formatMoney = (amount: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount);

  // Health Score Calculation
  const healthScore = Math.max(0, 100 - (duplicateTransactions.length * 5) - (duplicateInvoices.length * 10) - (suspiciousTransactions.length * 2));
  
  const getScoreColor = (score: number) => {
      if (score >= 90) return 'text-green-500';
      if (score >= 70) return 'text-yellow-500';
      return 'text-red-500';
  };

  const getScoreBarColor = (score: number) => {
      if (score >= 90) return 'bg-green-500';
      if (score >= 70) return 'bg-yellow-500';
      return 'bg-red-500';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 p-1">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <ShieldAlert className="w-8 h-8 text-primary" />
                Auditoría y Calidad de Datos
            </h2>
            <p className="text-muted-foreground">
                Monitoreo continuo de integridad, duplicados y anomalías financieras.
            </p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline">
                <Download className="w-4 h-4 mr-2" /> Exportar Reporte
            </Button>
            <Button>
                <Activity className="w-4 h-4 mr-2" /> Ejecutar Análisis
            </Button>
        </div>
      </div>

      {/* Health Score Banner */}
      <Card className="bg-muted/30 border-primary/10">
          <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="relative flex items-center justify-center w-32 h-32 shrink-0">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
                            <circle 
                                cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" strokeWidth="8" 
                                className={getScoreColor(healthScore)}
                                strokeDasharray={`${2 * Math.PI * 40}`}
                                strokeDashoffset={`${2 * Math.PI * 40 * (1 - healthScore / 100)}`}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-3xl font-bold ${getScoreColor(healthScore)}`}>{healthScore}</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Score</span>
                        </div>
                  </div>
                  <div className="space-y-2 flex-1 w-full">
                      <div className="flex justify-between items-end">
                          <h3 className="font-semibold text-lg">Salud de la Base de Datos</h3>
                          <span className="text-sm text-muted-foreground">Estado: {healthScore >= 90 ? 'Óptimo' : healthScore >= 70 ? 'Aceptable' : 'Crítico'}</span>
                      </div>
                      <Progress value={healthScore} className="h-2" indicatorClassName={getScoreBarColor(healthScore)} />
                      <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                              <div className={`w-2 h-2 rounded-full ${duplicateTransactions.length === 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              {duplicateTransactions.length} Duplicados TRX
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                              <div className={`w-2 h-2 rounded-full ${duplicateInvoices.length === 0 ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                              {duplicateInvoices.length} Facturas Duplicadas
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                              <div className={`w-2 h-2 rounded-full ${suspiciousTransactions.length === 0 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                              {suspiciousTransactions.length} Anomalías
                          </div>
                      </div>
                  </div>
              </div>
          </CardContent>
      </Card>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[800px] mb-4">
            <TabsTrigger value="overview">Visión General</TabsTrigger>
            <TabsTrigger value="duplicates" className="gap-2">
                Duplicados 
                {(duplicateTransactions.length > 0 || duplicateInvoices.length > 0) && (
                    <Badge variant="destructive" className="h-5 px-1.5">{duplicateTransactions.length + duplicateInvoices.length}</Badge>
                )}
            </TabsTrigger>
            <TabsTrigger value="anomalies" className="gap-2">
                Anomalías
                {suspiciousTransactions.length > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 bg-yellow-100 text-yellow-700">{suspiciousTransactions.length}</Badge>
                )}
            </TabsTrigger>
            <TabsTrigger value="activity">Historial de Actividad</TabsTrigger>
        </TabsList>

        {/* --- OVERVIEW TAB --- */}
        <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Registros Totales</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{transactions.length}</div>
                        <p className="text-xs text-muted-foreground">+20.1% respecto al mes anterior</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Facturas Procesadas</CardTitle>
                        <FileWarning className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{invoices.length}</div>
                        <p className="text-xs text-muted-foreground">Última: hace 2 horas</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Errores Pendientes</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-500">{duplicateTransactions.length + duplicateInvoices.length + suspiciousTransactions.length}</div>
                        <p className="text-xs text-muted-foreground">Requieren atención inmediata</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Últimas Alertas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {duplicateTransactions.length > 0 && (
                             <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-800">
                                <ShieldAlert className="w-5 h-5 text-red-500 mt-0.5" />
                                <div>
                                    <h4 className="font-medium text-sm text-red-700 dark:text-red-400">Posibles duplicados detectados</h4>
                                    <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">
                                        Hay {duplicateTransactions.length} grupos de transacciones idénticas que deberían revisarse.
                                    </p>
                                    <Button variant="link" size="sm" className="px-0 text-red-700 h-auto mt-2" onClick={() => setSelectedTab('duplicates')}>
                                        Revisar Duplicados <ArrowUpRight className="w-3 h-3 ml-1" />
                                    </Button>
                                </div>
                             </div>
                        )}
                        {suspiciousTransactions.length > 0 && (
                             <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-100 dark:border-yellow-800">
                                <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                                <div>
                                    <h4 className="font-medium text-sm text-yellow-700 dark:text-yellow-400">Anomalías en registros</h4>
                                    <p className="text-xs text-yellow-600/80 dark:text-yellow-400/80 mt-1">
                                        {suspiciousTransactions.length} transacciones tienen datos incompletos o sospechosos.
                                    </p>
                                    <Button variant="link" size="sm" className="px-0 text-yellow-700 h-auto mt-2" onClick={() => setSelectedTab('anomalies')}>
                                        Ver Detalles <ArrowUpRight className="w-3 h-3 ml-1" />
                                    </Button>
                                </div>
                             </div>
                        )}
                         {duplicateTransactions.length === 0 && suspiciousTransactions.length === 0 && (
                             <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                                 <CheckCircle className="w-10 h-10 text-green-500 mb-2 opacity-50" />
                                 <p>Todo se ve excelente.</p>
                             </div>
                         )}
                    </CardContent>
                </Card>
                
                {/* Recent Activity Mini-Feed */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Actividad Reciente</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {MOCK_AUDIT_LOGS.slice(0, 5).map(log => (
                                <div key={log.id} className="flex items-center gap-3 text-sm">
                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                        <User className="w-4 h-4 text-muted-foreground" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-foreground truncate">{log.details}</p>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>{log.user}</span>
                                            <span>•</span>
                                            <span>{format(log.date, 'dd MMM', { locale: es })}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>

        {/* --- DUPLICATES TAB --- */}
        <TabsContent value="duplicates" className="space-y-6">
            {/* Transactions Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                     <h3 className="text-lg font-semibold flex items-center gap-2">
                        Transacciones Duplicadas
                        <Badge variant={duplicateTransactions.length > 0 ? "destructive" : "outline"}>{duplicateTransactions.length}</Badge>
                     </h3>
                </div>
                
                {duplicateTransactions.length === 0 ? (
                    <Card className="bg-muted/20 border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <CheckCircle className="w-12 h-12 text-green-500 mb-2 opacity-80" />
                            <p>No hay transacciones duplicadas</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {duplicateTransactions.map((group, idx) => (
                            <Card key={idx} className="border-red-200 bg-red-50/10">
                                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                                    <div>
                                        <CardTitle className="text-base text-red-500 flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4" /> Grupo Duplicado #{idx + 1}
                                        </CardTitle>
                                        <CardDescription>
                                            Mismo monto ({formatMoney(group[0].amount)}) y fecha ({format(new Date(group[0].date), 'dd/MM/yyyy')})
                                        </CardDescription>
                                    </div>
                                    <Button 
                                        variant="destructive" 
                                        size="sm" 
                                        onClick={() => handleResolveDuplicateTransaction(group)}
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Limpiar Duplicados
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    <div className="rounded-md border bg-background">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[100px]">ID</TableHead>
                                                    <TableHead>Descripción</TableHead>
                                                    <TableHead>Categoría</TableHead>
                                                    <TableHead className="text-right">Hora Registro</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {group.map(t => (
                                                    <TableRow key={t.id}>
                                                        <TableCell className="font-mono text-xs">{t.id.slice(0, 6)}...</TableCell>
                                                        <TableCell>{t.description}</TableCell>
                                                        <TableCell>{t.category} / {t.subcategory}</TableCell>
                                                        <TableCell className="text-right text-xs text-muted-foreground">
                                                            {/* Mock time since we only have date usually */}
                                                            {format(new Date(), 'HH:mm')} 
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Invoices Section */}
            <div className="space-y-4 pt-4 border-t">
                 <h3 className="text-lg font-semibold flex items-center gap-2">
                    Facturas con Numeración Conflictiva
                    <Badge variant={duplicateInvoices.length > 0 ? "destructive" : "outline"}>{duplicateInvoices.length}</Badge>
                 </h3>
                 
                 {duplicateInvoices.length === 0 ? (
                    <Card className="bg-muted/20 border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <CheckCircle className="w-12 h-12 text-green-500 mb-2 opacity-80" />
                            <p>No hay facturas duplicadas</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {duplicateInvoices.map((group, idx) => (
                            <Card key={idx} className="border-orange-200 bg-orange-50/10">
                                <CardHeader>
                                    <CardTitle className="text-base text-orange-600 flex items-center gap-2">
                                        <FileWarning className="w-4 h-4" /> Factura #{group[0].invoiceNumber}
                                    </CardTitle>
                                    <CardDescription>Proveedor: {group[0].provider}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableBody>
                                            {group.map(inv => (
                                                <TableRow key={inv.id}>
                                                    <TableCell className="font-medium">{inv.id}</TableCell>
                                                    <TableCell>{format(new Date(inv.issueDate), 'dd/MM/yyyy')}</TableCell>
                                                    <TableCell className="text-right">{formatMoney(inv.total)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" onClick={() => onDeleteInvoice(inv.id)} className="text-red-500 hover:text-red-700">
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </TabsContent>

        {/* --- ANOMALIES TAB --- */}
        <TabsContent value="anomalies">
             <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Detección de Anomalías</CardTitle>
                        <CardDescription>El sistema aplica reglas heurísticas para encontrar errores potenciales.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-muted-foreground" />
                        <Input 
                            placeholder="Filtrar..." 
                            className="w-[200px]"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Descripción</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Regla Activada</TableHead>
                                <TableHead className="text-right">Monto</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {suspiciousTransactions
                                .filter(t => t.description?.toLowerCase().includes(searchTerm.toLowerCase()) || (t as any)._auditReasons.join(',').toLowerCase().includes(searchTerm.toLowerCase()))
                                .map(t => (
                                <TableRow key={t.id}>
                                    <TableCell className="font-mono text-xs">{format(new Date(t.date), 'dd/MM/yyyy')}</TableCell>
                                    <TableCell>
                                        <div className="font-medium">{t.description || 'Sin descripción'}</div>
                                        <div className="text-xs text-muted-foreground">{t.category || 'N/A'}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={t.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                                            {t.type === 'income' ? 'Ingreso' : 'Egreso'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {(t as any)._auditReasons?.map((reason: string, i: number) => (
                                                <Badge key={i} variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200 text-[10px]">
                                                    {reason}
                                                </Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">{formatMoney(t.amount)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" className="h-8 w-8">
                                            <Eye className="w-4 h-4 text-muted-foreground" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {suspiciousTransactions.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                        No se encontraron anomalías.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
             </Card>
        </TabsContent>

        {/* --- ACTIVITY LOG TAB --- */}
        <TabsContent value="activity">
            <Card>
                <CardHeader>
                    <CardTitle>Historial de Auditoría</CardTitle>
                    <CardDescription>Registro inmutable de acciones realizadas en el sistema.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="relative border-l border-muted ml-4 space-y-6 pb-4">
                        {MOCK_AUDIT_LOGS.map((log, index) => (
                            <div key={log.id} className="ml-6 relative group">
                                <span className={`absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full border bg-background ${
                                    log.severity === 'high' ? 'border-red-500 text-red-500' : 
                                    log.severity === 'medium' ? 'border-yellow-500 text-yellow-500' : 'border-muted text-muted-foreground'
                                }`}>
                                    <span className={`h-2 w-2 rounded-full ${
                                        log.severity === 'high' ? 'bg-red-500' : 
                                        log.severity === 'medium' ? 'bg-yellow-500' : 'bg-muted-foreground'
                                    }`} />
                                </span>
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                                    <p className="text-sm font-medium leading-none">{log.details}</p>
                                    <time className="text-xs text-muted-foreground">{format(log.date, 'PPP p', { locale: es })}</time>
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1"><User className="w-3 h-3"/> {log.user}</span>
                                    <span>•</span>
                                    <span className="uppercase tracking-wider font-semibold">{log.action}</span>
                                    <span>•</span>
                                    <Badge variant="outline" className="text-[10px] h-4 py-0">{log.entity}</Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
                <CardFooter className="border-t pt-4">
                    <Button variant="ghost" className="w-full text-muted-foreground">Cargar más registros</Button>
                </CardFooter>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}