import { useState, useMemo } from 'react';
import { 
    AlertTriangle, 
    AlertCircle, 
    CheckCircle2, 
    Info, 
    X, 
    Bell,
    CheckCheck,
    ArrowRight,
    Settings,
    LayoutDashboard,
    List,
    Filter,
    Search,
    Trash2,
    Calendar,
    BarChart3,
    PieChart,
    Activity,
    Shield
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { SystemAlert, AlertSeverity, AlertThresholds } from "../../types";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Input } from "../ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    Cell
} from 'recharts';

interface AlertsCenterProps {
    alerts: SystemAlert[];
    onMarkAsRead: (id: string) => void;
    onMarkAllAsRead: () => void;
    onNavigate: (view: string) => void;
    thresholds: AlertThresholds;
    onUpdateThresholds: (t: AlertThresholds) => void;
}

export function AlertsCenter({ 
    alerts, 
    onMarkAsRead, 
    onMarkAllAsRead, 
    onNavigate,
    thresholds,
    onUpdateThresholds
}: AlertsCenterProps) {
    const [viewMode, setViewMode] = useState<'dashboard' | 'list' | 'settings'>('dashboard');
    const [filterSeverity, setFilterSeverity] = useState<AlertSeverity | 'all'>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    // const [thresholds, setThresholds] = useState<AlertThresholds>(INITIAL_THRESHOLDS); // Eliminado para usar props

    // --- Lógica de Filtrado ---
    const filteredAlerts = useMemo(() => {
        return alerts.filter(a => {
            const matchesSeverity = filterSeverity === 'all' || a.severity === filterSeverity;
            const matchesCategory = filterCategory === 'all' || a.category === filterCategory;
            const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                  a.message.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesSeverity && matchesCategory && matchesSearch;
        });
    }, [alerts, filterSeverity, filterCategory, searchQuery]);

    // --- Métricas para el Dashboard ---
    const metrics = useMemo(() => {
        const total = alerts.length;
        const unread = alerts.filter(a => !a.read).length;
        const critical = alerts.filter(a => a.severity === 'critical').length;
        const resolved = alerts.filter(a => a.read).length; // Asumimos leída como "atendida" para este KPI
        
        // Datos para gráficos
        const bySeverity = [
            { name: 'Crítico', value: alerts.filter(a => a.severity === 'critical').length, color: '#fb7185' },
            { name: 'Advertencia', value: alerts.filter(a => a.severity === 'warning').length, color: '#fbbf24' },
            { name: 'Info', value: alerts.filter(a => a.severity === 'info').length, color: '#22d3ee' },
        ];

        const byCategory = [
            { name: 'Financiero', value: alerts.filter(a => a.category === 'financial').length },
            { name: 'Operativo', value: alerts.filter(a => a.category === 'operational').length },
            { name: 'RRHH', value: alerts.filter(a => a.category === 'hr').length },
            { name: 'Sistema', value: alerts.filter(a => a.category === 'system').length },
        ];

        return { total, unread, critical, resolved, bySeverity, byCategory };
    }, [alerts]);

    // --- Render Helpers ---
    const getSeverityIcon = (severity: AlertSeverity) => {
        switch (severity) {
            case 'critical': return <AlertTriangle className="h-5 w-5" style={{ color: '#fb7185' }} />;
            case 'warning': return <AlertCircle className="h-5 w-5" style={{ color: '#fbbf24' }} />;
            case 'success': return <CheckCircle2 className="h-5 w-5" style={{ color: '#34d399' }} />;
            case 'info': return <Info className="h-5 w-5" style={{ color: '#22d3ee' }} />;
        }
    };

    const getSeverityColor = (severity: AlertSeverity, read: boolean) => {
        if (read) return 'opacity-50';
        switch (severity) {
            case 'critical': return 'dark:bg-rose-900/15 dark:border-rose-500/25';
            case 'warning': return 'dark:bg-amber-900/15 dark:border-amber-500/25';
            case 'success': return 'dark:bg-emerald-900/15 dark:border-emerald-500/25';
            case 'info': return 'dark:bg-cyan-900/15 dark:border-cyan-500/25';
        }
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            
            {/* 1. Header & Navigation */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl"
              style={{ background: 'linear-gradient(145deg, #1A1826 0%, #161424 100%)', border: '1px solid rgba(251,113,133,0.15)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}
            >
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.2)' }}>
                        <Shield className="h-8 w-8" style={{ color: '#fb7185', filter: 'drop-shadow(0 0 8px rgba(251,113,133,0.5))' }} />
                    </div>
                    <div>
                        <h2 className="font-bold tracking-tight" style={{ color: '#F0EEFF', fontSize: '1.4rem' }}>Centro de Control</h2>
                        <p className="text-sm" style={{ color: '#6b5fa5' }}>Monitorización inteligente de riesgos y anomalías</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {([
                      { mode: 'dashboard', icon: LayoutDashboard, label: 'Resumen' },
                      { mode: 'list', icon: List, label: 'Listado' },
                      { mode: 'settings', icon: Settings, label: 'Config.' },
                    ] as const).map(({ mode, icon: Icon, label }) => (
                      <button key={mode}
                        onClick={() => setViewMode(mode)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200"
                        style={{
                          background: viewMode === mode ? 'rgba(251,113,133,0.12)' : 'transparent',
                          color: viewMode === mode ? '#fb7185' : '#6b5fa5',
                          border: viewMode === mode ? '1px solid rgba(251,113,133,0.22)' : '1px solid transparent',
                        }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                        {mode === 'list' && metrics.unread > 0 && (
                          <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                            style={{ background: 'rgba(251,113,133,0.2)', color: '#fb7185' }}
                          >{metrics.unread}</span>
                        )}
                      </button>
                    ))}
                </div>
            </div>

            {/* 2. Content Views */}
            
            {/* --- DASHBOARD VIEW --- */}
            {viewMode === 'dashboard' && (
                <div className="space-y-6">
                    {/* KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Alertas Activas</CardTitle>
                                <Activity className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{metrics.total}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {metrics.unread} sin leer
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="border-l-4 border-l-red-500">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-red-600 dark:text-red-400">Críticas</CardTitle>
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{metrics.critical}</div>
                                <p className="text-xs text-muted-foreground mt-1">Requieren acción inmediata</p>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Eficiencia</CardTitle>
                                <CheckCheck className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {metrics.total > 0 ? ((metrics.resolved / metrics.total) * 100).toFixed(0) : 0}%
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Tasa de resolución</p>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Última Actualización</CardTitle>
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-sm pt-1">Hace unos instantes</div>
                                <p className="text-xs text-muted-foreground mt-1">Monitorización en tiempo real</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="col-span-1">
                            <CardHeader>
                                <CardTitle className="text-lg">Distribución por Severidad</CardTitle>
                                <CardDescription>Panorama de riesgos actuales</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={metrics.bySeverity} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(139,92,246,0.1)" />
                                        <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#6b5fa5' }} dy={6} />
                                        <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#6b5fa5' }} width={24} />
                                        <Tooltip 
                                            cursor={{ fill: 'rgba(139,92,246,0.06)' }}
                                            contentStyle={{ backgroundColor: '#22203A', border: '1px solid #3D3B5C', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', color: '#E4E0FF' }}
                                            itemStyle={{ color: '#E4E0FF', fontSize: '12px' }}
                                        />
                                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                            {metrics.bySeverity.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} opacity={0.9} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card className="col-span-1">
                             <CardHeader>
                                <CardTitle className="text-lg">Alertas por Categoría</CardTitle>
                                <CardDescription>Áreas de impacto detectadas</CardDescription>
                            </CardHeader>
                             <CardContent className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={metrics.byCategory} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 6" horizontal={false} stroke="rgba(139,92,246,0.1)" />
                                        <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#6b5fa5' }} />
                                        <YAxis dataKey="name" type="category" width={90} fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#6b5fa5' }} />
                                        <Tooltip 
                                            cursor={{ fill: 'rgba(139,92,246,0.06)' }}
                                            contentStyle={{ backgroundColor: '#22203A', border: '1px solid #3D3B5C', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', color: '#E4E0FF' }}
                                            itemStyle={{ color: '#E4E0FF', fontSize: '12px' }}
                                        />
                                        <Bar dataKey="value" fill="#c084fc" radius={[0, 4, 4, 0]} barSize={20} opacity={0.85} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Recent Critical Alerts */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">Alertas Críticas Recientes</CardTitle>
                                <CardDescription>Atención prioritaria requerida</CardDescription>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setViewMode('list')}>
                                Ver todas
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {alerts.filter(a => a.severity === 'critical').slice(0, 3).map(alert => (
                                    <div key={alert.id} className="flex items-center justify-between p-4 border rounded-lg bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30">
                                        <div className="flex items-center gap-4">
                                            <AlertTriangle className="h-5 w-5 text-red-500" />
                                            <div>
                                                <h4 className="font-semibold text-sm">{alert.title}</h4>
                                                <p className="text-sm text-muted-foreground">{alert.message}</p>
                                            </div>
                                        </div>
                                        {alert.actionLink && (
                                            <Button size="sm" variant="secondary" onClick={() => onNavigate(alert.actionLink!)}>
                                                Revisar
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                {alerts.filter(a => a.severity === 'critical').length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2 opacity-50" />
                                        <p>No hay alertas críticas pendientes.</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* --- LIST VIEW --- */}
            {viewMode === 'list' && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[calc(100vh-220px)]">
                    {/* Filters Sidebar */}
                    <Card className="md:col-span-3 h-full flex flex-col">
                        <CardHeader>
                            <CardTitle className="text-sm">Filtros</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 flex-1">
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground uppercase">Búsqueda</Label>
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="Buscar..." 
                                        className="pl-8" 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground uppercase">Severidad</Label>
                                <div className="space-y-1">
                                    {['all', 'critical', 'warning', 'info'].map((sev) => (
                                        <Button
                                            key={sev}
                                            variant={filterSeverity === sev ? 'secondary' : 'ghost'}
                                            className="w-full justify-start text-sm"
                                            onClick={() => setFilterSeverity(sev as any)}
                                        >
                                            {sev === 'all' && 'Todas'}
                                            {sev === 'critical' && <><AlertTriangle className="mr-2 h-4 w-4 text-red-500"/> Críticas</>}
                                            {sev === 'warning' && <><AlertCircle className="mr-2 h-4 w-4 text-amber-500"/> Advertencias</>}
                                            {sev === 'info' && <><Info className="mr-2 h-4 w-4 text-blue-500"/> Informativas</>}
                                            <span className="ml-auto text-xs text-muted-foreground">
                                                {sev === 'all' ? alerts.length : alerts.filter(a => a.severity === sev).length}
                                            </span>
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground uppercase">Categoría</Label>
                                <div className="space-y-1">
                                    {['all', 'financial', 'operational', 'hr', 'system'].map((cat) => (
                                        <Button
                                            key={cat}
                                            variant={filterCategory === cat ? 'secondary' : 'ghost'}
                                            className="w-full justify-start text-sm capitalize"
                                            onClick={() => setFilterCategory(cat)}
                                        >
                                            {cat === 'all' ? 'Todas' : 
                                             cat === 'financial' ? 'Financiera' :
                                             cat === 'operational' ? 'Operativa' :
                                             cat === 'hr' ? 'RRHH' : 'Sistema'}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Alerts Feed */}
                    <Card className="md:col-span-9 h-full flex flex-col">
                        <CardHeader className="flex flex-row items-center justify-between py-4 border-b">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-base">Listado de Alertas</CardTitle>
                                <Badge variant="secondary">{filteredAlerts.length}</Badge>
                            </div>
                            <Button variant="outline" size="sm" onClick={onMarkAllAsRead}>
                                <CheckCheck className="mr-2 h-4 w-4" />
                                Marcar todo leído
                            </Button>
                        </CardHeader>
                        
                        <ScrollArea className="flex-1 p-4">
                            <div className="space-y-3">
                                {filteredAlerts.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                                        <CheckCircle2 className="h-16 w-16 text-emerald-500/20 mb-4" />
                                        <h3 className="text-lg font-medium text-foreground">Sin alertas activas</h3>
                                        <p>No se encontraron notificaciones con los filtros actuales.</p>
                                    </div>
                                ) : (
                                    filteredAlerts.map(alert => (
                                        <div 
                                            key={alert.id}
                                            className={`
                                                relative flex gap-4 p-4 rounded-lg border transition-all hover:shadow-md
                                                ${getSeverityColor(alert.severity, alert.read)}
                                            `}
                                        >
                                            <div className="mt-1 shrink-0">
                                                {getSeverityIcon(alert.severity)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-4 mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className={`font-semibold text-sm ${alert.read ? 'text-muted-foreground' : 'text-foreground'}`}>
                                                            {alert.title}
                                                        </h4>
                                                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                                                            {alert.category === 'hr' ? 'RRHH' : 
                                                             alert.category === 'financial' ? 'Finanzas' :
                                                             alert.category === 'operational' ? 'Ops' : 'Sistema'}
                                                        </Badge>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {formatDistanceToNow(new Date(alert.date), { addSuffix: true, locale: es })}
                                                    </span>
                                                </div>
                                                
                                                <p className={`text-sm mb-3 ${alert.read ? 'text-muted-foreground/80' : 'text-muted-foreground'}`}>
                                                    {alert.message}
                                                </p>

                                                <div className="flex items-center gap-3">
                                                    {alert.actionLink && (
                                                        <Button 
                                                            size="sm" 
                                                            variant={alert.severity === 'critical' ? 'default' : 'secondary'}
                                                            className="h-7 text-xs"
                                                            onClick={() => onNavigate(alert.actionLink!)}
                                                        >
                                                            {alert.actionLabel || 'Ver detalles'}
                                                            <ArrowRight className="ml-1.5 h-3 w-3" />
                                                        </Button>
                                                    )}
                                                    {!alert.read && (
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost" 
                                                            className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                                            onClick={() => onMarkAsRead(alert.id)}
                                                        >
                                                            Marcar como leída
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                            {!alert.read && (
                                                <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-primary animate-pulse" />
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </Card>
                </div>
            )}

            {/* --- SETTINGS VIEW --- */}
            {viewMode === 'settings' && (
                <div className="max-w-4xl mx-auto w-full">
                    <Card>
                        <CardHeader>
                            <CardTitle>Configuración del Motor de Alertas</CardTitle>
                            <CardDescription>Ajusta la sensibilidad de las notificaciones automáticas.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-red-500" />
                                    Alertas Financieras
                                </h3>
                                
                                <div className="grid gap-6 border p-4 rounded-lg">
                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <Label>Vencimiento de Facturas (Días de anticipación)</Label>
                                            <span className="font-mono text-sm">{thresholds.invoiceDueDays} días</span>
                                        </div>
                                        <Slider 
                                            value={[thresholds.invoiceDueDays]} 
                                            min={1} max={30} step={1}
                                            onValueChange={([val]) => onUpdateThresholds({...thresholds, invoiceDueDays: val})}
                                        />
                                        <p className="text-xs text-muted-foreground">Generar alerta "Por Vencer" X días antes de la fecha límite.</p>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <Label>Desviación de Presupuesto (%)</Label>
                                            <span className="font-mono text-sm">{thresholds.spendingSpikePercent}%</span>
                                        </div>
                                        <Slider 
                                            value={[thresholds.spendingSpikePercent]} 
                                            min={5} max={100} step={5}
                                            onValueChange={([val]) => onUpdateThresholds({...thresholds, spendingSpikePercent: val})}
                                        />
                                        <p className="text-xs text-muted-foreground">Alertar si una categoría gasta X% más que su promedio trimestral.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-blue-500" />
                                    Alertas Operativas
                                </h3>
                                
                                <div className="grid gap-6 border p-4 rounded-lg">
                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <Label>Solicitudes Estancadas (Días)</Label>
                                            <span className="font-mono text-sm">{thresholds.staleRequestDays} días</span>
                                        </div>
                                        <Slider 
                                            value={[thresholds.staleRequestDays]} 
                                            min={1} max={14} step={1}
                                            onValueChange={([val]) => onUpdateThresholds({...thresholds, staleRequestDays: val})}
                                        />
                                        <p className="text-xs text-muted-foreground">Alertar si una solicitud de compra lleva más de X días pendiente.</p>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <Label>Saldo Mínimo Caja Chica (%)</Label>
                                            <span className="font-mono text-sm">{thresholds.pettyCashLowBalance}%</span>
                                        </div>
                                        <Slider 
                                            value={[thresholds.pettyCashLowBalance]} 
                                            min={5} max={50} step={5}
                                            onValueChange={([val]) => onUpdateThresholds({...thresholds, pettyCashLowBalance: val})}
                                        />
                                        <p className="text-xs text-muted-foreground">Alertar cuando el fondo fijo baje del X% de su capacidad.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button onClick={() => setViewMode('dashboard')}>
                                    Guardar Cambios
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}