import { useState } from 'react';
import { ConfigStructure, TransactionType, ConceptDefinition, Flexibility } from '../../data/initialData';
import { SystemSettings } from '../../types';
import { Plus, Trash2, Settings, Edit2, Check, X, CalendarClock, Lock, Unlock, Store, Calculator, ShieldCheck, HardDrive, Receipt, ShieldAlert, UserCircle, Upload, ImageIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from "../ui/badge";

import { User } from '../../types';

interface ConfigPanelProps {
  config: ConfigStructure;
  onUpdateConfig: (newConfig: ConfigStructure) => void;
  systemSettings: SystemSettings;
  onUpdateSystemSettings: (newSettings: SystemSettings) => void;
  onStressTest?: () => void;
  onResetData?: () => void;
  users: User[];
  onUpdateUsers: (users: User[]) => void;
}

export function ConfigPanel({ config, onUpdateConfig, systemSettings, onUpdateSystemSettings, onStressTest, onResetData, users, onUpdateUsers }: ConfigPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(Object.keys(config)[0]);
  
  // Category State
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<TransactionType>('expense');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');

  // Concept State
  const [newConceptName, setNewConceptName] = useState('');
  const [newConceptFlex, setNewConceptFlex] = useState<Flexibility>('flexible');
  const [newConceptDay, setNewConceptDay] = useState<string>(''); 

  const [editingConceptId, setEditingConceptId] = useState<string | null>(null);
  const [editConceptName, setEditConceptName] = useState('');
  const [editConceptDay, setEditConceptDay] = useState<string>('');
  const [editConceptFlex, setEditConceptFlex] = useState<Flexibility>('flexible');

  // --- Category Actions ---
  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    if (config[newCategoryName]) {
      toast.error("La categoría ya existe");
      return;
    }
    const updated = { 
      ...config, 
      [newCategoryName.trim()]: { type: newCategoryType, concepts: [] } 
    };
    onUpdateConfig(updated);
    setSelectedCategory(newCategoryName.trim());
    setNewCategoryName('');
    toast.success("Categoría creada");
  };

  const handleDeleteCategory = (cat: string) => {
    if (Object.keys(config).length <= 1) {
      toast.error("Debe haber al menos una categoría");
      return;
    }
    const { [cat]: _, ...rest } = config;
    onUpdateConfig(rest);
    if (selectedCategory === cat) {
      setSelectedCategory(Object.keys(rest)[0]);
    }
    toast.success("Categoría eliminada");
  };

  const startEditingCategory = (cat: string) => {
    setEditingCategory(cat);
    setEditCategoryName(cat);
  };

  const saveCategoryName = () => {
    if (!editingCategory || !editCategoryName.trim()) return;
    if (editCategoryName !== editingCategory && config[editCategoryName]) {
      toast.error("Ya existe una categoría con ese nombre");
      return;
    }

    const newConfig: ConfigStructure = {};
    Object.keys(config).forEach(key => {
      if (key === editingCategory) {
        newConfig[editCategoryName.trim()] = config[key];
      } else {
        newConfig[key] = config[key];
      }
    });

    onUpdateConfig(newConfig);
    if (selectedCategory === editingCategory) {
      setSelectedCategory(editCategoryName.trim());
    }
    setEditingCategory(null);
    toast.success("Categoría renombrada");
  };

  // --- Concept Actions ---
  const handleAddConcept = () => {
    if (!selectedCategory || !newConceptName.trim()) return;
    
    const currentConcepts = config[selectedCategory].concepts;
    if (currentConcepts.some(c => c.name.toLowerCase() === newConceptName.trim().toLowerCase())) {
      toast.error("El concepto ya existe");
      return;
    }

    const newDef: ConceptDefinition = {
      id: Math.random().toString(36).substr(2, 9),
      name: newConceptName.trim(),
      flexibility: newConceptFlex,
      defaultDay: newConceptDay ? parseInt(newConceptDay) : undefined
    };

    const updated = {
      ...config,
      [selectedCategory]: {
        ...config[selectedCategory],
        concepts: [...currentConcepts, newDef]
      }
    };
    onUpdateConfig(updated);
    setNewConceptName('');
    setNewConceptDay('');
    toast.success("Concepto agregado");
  };

  const handleDeleteConcept = (cat: string, conceptId: string) => {
    const updated = {
      ...config,
      [cat]: {
        ...config[cat],
        concepts: config[cat].concepts.filter(c => c.id !== conceptId)
      }
    };
    onUpdateConfig(updated);
    toast.success("Concepto eliminado");
  };

  const startEditingConcept = (concept: ConceptDefinition) => {
    setEditingConceptId(concept.id);
    setEditConceptName(concept.name);
    setEditConceptFlex(concept.flexibility);
    setEditConceptDay(concept.defaultDay ? concept.defaultDay.toString() : '');
  };

  const saveConcept = (cat: string) => {
    if (!editingConceptId || !editConceptName.trim()) return;

    const currentConcepts = config[cat].concepts;
    const updatedConcepts = currentConcepts.map(c => {
      if (c.id === editingConceptId) {
        return {
          ...c,
          name: editConceptName.trim(),
          flexibility: editConceptFlex,
          defaultDay: editConceptDay ? parseInt(editConceptDay) : undefined
        };
      }
      return c;
    });
    
    const updated = {
      ...config,
      [cat]: {
        ...config[cat],
        concepts: updatedConcepts
      }
    };

    onUpdateConfig(updated);
    setEditingConceptId(null);
    toast.success("Concepto actualizado");
  };

  // --- System Settings Actions ---
  const updatePettyCash = (field: keyof typeof systemSettings.pettyCash, value: any) => {
    onUpdateSystemSettings({
      ...systemSettings,
      pettyCash: {
        ...systemSettings.pettyCash,
        [field]: value
      }
    });
  };

  // --- User Limit Actions ---
  const handleUpdateUserLimit = (userId: string, newLimit: number) => {
    const updatedUsers = users.map(user => {
      if (user.id === userId) {
        return { ...user, pettyCashLimit: newLimit };
      }
      return user;
    });
    onUpdateUsers(updatedUsers);
    toast.success("Límite de caja chica actualizado");
  };

  return (
    <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 border-b pb-4">
        <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Settings className="w-8 h-8 text-orange-500" />
            Configuración del Sistema
        </h2>
        <p className="text-muted-foreground">Administra la configuración general de tu negocio</p>
      </div>

      <Tabs defaultValue="operations" className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent space-x-6">
          <TabsTrigger 
            value="business" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
          >
            Negocio
          </TabsTrigger>
          <TabsTrigger 
            value="operations" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
          >
            Operaciones
          </TabsTrigger>
          <TabsTrigger 
            value="accounting" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
          >
            Contabilidad
          </TabsTrigger>
          <TabsTrigger 
            value="system" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
          >
            Sistema
          </TabsTrigger>
          <TabsTrigger 
            value="security" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
          >
            Seguridad
          </TabsTrigger>
          <TabsTrigger 
            value="debug" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-red-500 font-bold"
          >
            Stress Test
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 py-6">
          {/* TAB: NEGOCIO */}
          <TabsContent value="business">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="w-5 h-5" />
                    Información del Negocio
                  </CardTitle>
                  <CardDescription>Datos básicos de la empresa. Los cambios se reflejan en todo el sistema.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nombre Comercial</Label>
                    <Input 
                      value={systemSettings.businessName} 
                      onChange={(e) => onUpdateSystemSettings({...systemSettings, businessName: e.target.value})} 
                      placeholder="Ej: Mi Veterinaria"
                    />
                    <p className="text-xs text-muted-foreground">Este nombre aparece en el sidebar, cabecera y reportes.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Moneda Principal</Label>
                    <Select 
                      value={systemSettings.currency} 
                      onValueChange={(val) => onUpdateSystemSettings({...systemSettings, currency: val})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PEN">Soles (PEN)</SelectItem>
                        <SelectItem value="USD">Dólares (USD)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Logo Upload Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    Logo del Negocio
                  </CardTitle>
                  <CardDescription>Sube el logotipo de tu empresa. Se mostrará en el sidebar y cabecera.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Preview */}
                  <div className="flex items-start gap-6">
                    <div 
                      className="relative w-24 h-24 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 transition-all duration-300 group"
                      style={{ 
                        background: systemSettings.businessLogo 
                          ? 'transparent' 
                          : 'linear-gradient(135deg, rgba(34,211,238,0.08) 0%, rgba(139,92,246,0.08) 100%)',
                        border: '2px dashed rgba(34,211,238,0.25)',
                        boxShadow: systemSettings.businessLogo ? '0 0 20px rgba(34,211,238,0.1)' : 'none'
                      }}
                    >
                      {systemSettings.businessLogo ? (
                        <>
                          <img 
                            src={systemSettings.businessLogo} 
                            alt="Logo" 
                            className="w-full h-full object-cover"
                          />
                          {/* Remove overlay */}
                          <button
                            onClick={() => {
                              onUpdateSystemSettings({...systemSettings, businessLogo: undefined});
                              toast.success("Logo eliminado");
                            }}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300 cursor-pointer"
                          >
                            <Trash2 className="w-5 h-5 text-red-400" />
                          </button>
                        </>
                      ) : (
                        <div className="text-center">
                          <ImageIcon className="w-8 h-8 mx-auto" style={{ color: 'rgba(34,211,238,0.3)' }} />
                          <span className="text-[10px] mt-1 block" style={{ color: 'rgba(255,255,255,0.25)' }}>Sin logo</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-3">
                      <div>
                        <label 
                          htmlFor="logo-upload"
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                          style={{
                            background: 'linear-gradient(135deg, rgba(34,211,238,0.12) 0%, rgba(139,92,246,0.12) 100%)',
                            border: '1px solid rgba(34,211,238,0.25)',
                            color: '#22d3ee',
                            boxShadow: '0 0 12px rgba(34,211,238,0.08)'
                          }}
                        >
                          <Upload className="w-4 h-4" />
                          <span className="text-sm font-medium">{systemSettings.businessLogo ? 'Cambiar Logo' : 'Subir Logo'}</span>
                        </label>
                        <input
                          id="logo-upload"
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            
                            // Validate file size (max 2MB)
                            if (file.size > 2 * 1024 * 1024) {
                              toast.error("El archivo es muy grande", {
                                description: "El logo debe pesar menos de 2MB."
                              });
                              return;
                            }
                            
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const dataUrl = ev.target?.result as string;
                              onUpdateSystemSettings({...systemSettings, businessLogo: dataUrl});
                              toast.success("Logo actualizado correctamente", {
                                description: "El logo se muestra en el sidebar y cabecera."
                              });
                            };
                            reader.readAsDataURL(file);
                            // Reset input so same file can be re-selected
                            e.target.value = '';
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Formatos: PNG, JPG, SVG, WebP</p>
                        <p className="text-xs text-muted-foreground">Tamaño máximo: 2MB</p>
                        <p className="text-xs text-muted-foreground">Recomendado: imagen cuadrada 256×256px</p>
                      </div>
                      {systemSettings.businessLogo && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 px-3 text-xs"
                          onClick={() => {
                            onUpdateSystemSettings({...systemSettings, businessLogo: undefined});
                            toast.success("Logo eliminado");
                          }}
                        >
                          <Trash2 className="w-3 h-3 mr-1.5" />
                          Eliminar Logo
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB: OPERACIONES (Categorías y Conceptos) */}
          <TabsContent value="operations" className="h-full">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
              {/* Sidebar: Categories */}
              <Card className="md:col-span-1 flex flex-col h-full border-border bg-card">
                <CardHeader className="pb-3 border-b border-border">
                  <CardTitle className="text-lg flex items-center text-foreground">
                    <Settings className="w-5 h-5 mr-2 text-primary" />
                    Categorías
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">Grupos del flujo</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden pt-4">
                  <div className="flex flex-col gap-2 p-3 bg-muted/30 rounded-lg border border-border">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Nueva Categoría</span>
                    <Input 
                      placeholder="Nombre..." 
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="bg-background"
                    />
                    <div className="flex gap-2">
                      <Select value={newCategoryType} onValueChange={(v: TransactionType) => setNewCategoryType(v)}>
                        <SelectTrigger className="w-[140px] bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="income">Ingreso</SelectItem>
                          <SelectItem value="expense">Egreso</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button className="flex-1" onClick={handleAddCategory}>
                        <Plus className="h-4 w-4 mr-2" />
                        Crear
                      </Button>
                    </div>
                  </div>
                  
                  <ScrollArea className="flex-1 pr-2">
                    <div className="space-y-1">
                      {Object.entries(config).map(([cat, def]) => (
                        <div 
                          key={cat}
                          className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors border border-transparent ${
                            selectedCategory === cat 
                              ? 'bg-primary/10 text-primary border-primary/20 font-medium' 
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                          onClick={() => setSelectedCategory(cat)}
                        >
                          {editingCategory === cat ? (
                            <div className="flex items-center flex-1 gap-2" onClick={e => e.stopPropagation()}>
                              <Input 
                                value={editCategoryName} 
                                onChange={e => setEditCategoryName(e.target.value)}
                                className="h-8 text-sm"
                                autoFocus
                              />
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-green-500" onClick={saveCategoryName}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => setEditingCategory(null)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center truncate flex-1">
                                <div className={`w-2 h-2 rounded-full mr-2 ${def.type === 'income' ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className="truncate">{cat}</span>
                              </div>
                              <div className="flex items-center opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditingCategory(cat);
                                  }}
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if(confirm(`¿Eliminar "${cat}"?`)) handleDeleteCategory(cat);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Main: Concepts */}
              <Card className="md:col-span-2 flex flex-col h-full border-border bg-card">
                <CardHeader className="pb-3 border-b border-border">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-lg text-foreground">
                        {selectedCategory || 'Selecciona una categoría'}
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Configura el comportamiento y fechas de tus conceptos
                      </CardDescription>
                    </div>
                    {selectedCategory && (
                      <div className={`px-3 py-1 rounded-full text-xs font-medium border ${
                        config[selectedCategory].type === 'income' 
                          ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                          : 'bg-red-500/10 text-red-500 border-red-500/20'
                      }`}>
                        {config[selectedCategory].type === 'income' ? 'INGRESO' : 'EGRESO'}
                      </div>
                    )}
                  </div>
                </CardHeader>
                
                {selectedCategory && (
                  <CardContent className="flex-1 flex flex-col gap-4 pt-6 overflow-hidden">
                    {/* New Concept Form */}
                    <div className="flex gap-2 items-end p-3 bg-muted/20 rounded-md border border-border">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Nombre del Concepto</Label>
                        <Input 
                          placeholder={`Ej: Alquiler, Sueldos...`}
                          value={newConceptName}
                          onChange={(e) => setNewConceptName(e.target.value)}
                          className="bg-background"
                        />
                      </div>
                      <div className="w-[120px] space-y-1">
                        <Label className="text-xs">Tipo</Label>
                        <Select value={newConceptFlex} onValueChange={(v: Flexibility) => setNewConceptFlex(v)}>
                          <SelectTrigger className="bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">Fijo</SelectItem>
                            <SelectItem value="flexible">Flexible</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-[80px] space-y-1">
                        <Label className="text-xs">Día (1-31)</Label>
                        <Input 
                          type="number" 
                          min="1" 
                          max="31" 
                          placeholder="--" 
                          value={newConceptDay}
                          onChange={e => setNewConceptDay(e.target.value)}
                          className="bg-background"
                        />
                      </div>
                      <Button onClick={handleAddConcept}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <ScrollArea className="flex-1">
                      <div className="grid grid-cols-1 gap-2">
                          {config[selectedCategory].concepts.map((concept) => (
                            <div 
                              key={concept.id}
                              className="group flex items-center justify-between p-3 bg-muted/10 border border-border rounded-md hover:border-primary/30 transition-all"
                            >
                              {editingConceptId === concept.id ? (
                                <div className="flex items-center flex-1 gap-2">
                                  <Input 
                                    value={editConceptName} 
                                    onChange={e => setEditConceptName(e.target.value)}
                                    className="flex-1 h-8 text-sm"
                                    autoFocus
                                  />
                                  <Select value={editConceptFlex} onValueChange={(v: Flexibility) => setEditConceptFlex(v)}>
                                      <SelectTrigger className="w-[100px] h-8 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="fixed">Fijo</SelectItem>
                                        <SelectItem value="flexible">Flexible</SelectItem>
                                      </SelectContent>
                                  </Select>
                                  <Input 
                                      type="number"
                                      className="w-[60px] h-8 text-sm"
                                      value={editConceptDay}
                                      onChange={e => setEditConceptDay(e.target.value)}
                                      placeholder="Día"
                                  />
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-green-500" onClick={() => saveConcept(selectedCategory)}>
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => setEditingConceptId(null)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-3">
                                    <div className={`p-1.5 rounded-md ${concept.flexibility === 'fixed' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                                        {concept.flexibility === 'fixed' ? <Lock className="w-3 h-3"/> : <Unlock className="w-3 h-3"/>}
                                    </div>
                                    <div>
                                      <p className="text-sm text-foreground font-medium">{concept.name}</p>
                                      <div className="flex items-center text-xs text-muted-foreground gap-2">
                                        <span className="capitalize">{concept.flexibility === 'fixed' ? 'Pago Fijo' : 'Pago Flexible'}</span>
                                        {concept.defaultDay && (
                                          <span className="flex items-center bg-muted px-1.5 py-0.5 rounded text-foreground">
                                            <CalendarClock className="w-3 h-3 mr-1" />
                                            Día {concept.defaultDay}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                                      onClick={() => startEditingConcept(concept)}
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => handleDeleteConcept(selectedCategory, concept.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* TAB: CONTABILIDAD (Caja Chica) */}
          <TabsContent value="accounting">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="w-5 h-5" />
                    Caja Chica (Fondo Fijo)
                  </CardTitle>
                  <CardDescription>
                    Configura los límites y alertas del fondo operativo semanal.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Monto Total del Fondo (S/)</Label>
                      <Input 
                        type="number" 
                        value={systemSettings.pettyCash.totalFundLimit}
                        onChange={(e) => updatePettyCash('totalFundLimit', parseFloat(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">Monto base que se repone semanalmente.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Tope por Gasto (S/)</Label>
                      <Input 
                        type="number" 
                        value={systemSettings.pettyCash.maxTransactionAmount}
                        onChange={(e) => updatePettyCash('maxTransactionAmount', parseFloat(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">Máximo permitido por movimiento único.</p>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Alerta de Saldo Bajo (%)</Label>
                        <p className="text-xs text-muted-foreground">Notificar cuando quede menos del...</p>
                      </div>
                      <div className="w-[100px] flex items-center gap-2">
                        <Input 
                          type="number" 
                          className="text-right"
                          value={systemSettings.pettyCash.alertThreshold}
                          onChange={(e) => updatePettyCash('alertThreshold', parseFloat(e.target.value))}
                        />
                        <span className="text-sm">%</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Exigir Recibo desde (S/)</Label>
                        <p className="text-xs text-muted-foreground">Gastos mayores a este monto requieren foto.</p>
                      </div>
                      <div className="w-[100px] flex items-center gap-2">
                        <span className="text-sm">S/</span>
                        <Input 
                          type="number" 
                          className="text-right"
                          value={systemSettings.pettyCash.requireReceiptAbove}
                          onChange={(e) => updatePettyCash('requireReceiptAbove', parseFloat(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="w-5 h-5" />
                    Cierres y Rendiciones
                  </CardTitle>
                  <CardDescription>
                    Programación de cortes administrativos.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="space-y-2">
                      <Label>Día de Cierre Sugerido</Label>
                      <Select 
                        value={systemSettings.pettyCash.weeklyClosingDay.toString()} 
                        onValueChange={(val) => updatePettyCash('weeklyClosingDay', parseInt(val))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Lunes</SelectItem>
                          <SelectItem value="2">Martes</SelectItem>
                          <SelectItem value="3">Miércoles</SelectItem>
                          <SelectItem value="4">Jueves</SelectItem>
                          <SelectItem value="5">Viernes</SelectItem>
                          <SelectItem value="6">Sábado</SelectItem>
                          <SelectItem value="0">Domingo</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">El sistema recordará hacer la rendición este día.</p>
                   </div>
                </CardContent>
              </Card>

              {/* NEW CARD: User Limits */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCircle className="w-5 h-5" />
                    Asignación de Fondos por Usuario
                  </CardTitle>
                  <CardDescription>
                    Define el monto máximo que puede manejar cada usuario en su caja chica personal.
                    Si se deja en 0, se usará el límite global del sistema.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Usuario</TableHead>
                          <TableHead>Rol</TableHead>
                          <TableHead className="text-right">Fondo Asignado (S/)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.filter(u => u.role === 'manager' || u.role === 'admin' || u.role === 'assistant').map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span>{user.name}</span>
                                <span className="text-xs text-muted-foreground">{user.email}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{user.role}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end items-center gap-2">
                                <span className="text-sm text-muted-foreground">S/</span>
                                <Input 
                                  type="number" 
                                  className="w-[100px] text-right"
                                  placeholder="0.00"
                                  value={user.pettyCashLimit || ''}
                                  onChange={(e) => handleUpdateUserLimit(user.id, parseFloat(e.target.value) || 0)}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB: SISTEMA */}
          <TabsContent value="system">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="w-5 h-5" />
                  Preferencias del Sistema
                </CardTitle>
                <CardDescription>Opciones generales de la plataforma.</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-8 text-muted-foreground italic">
                Próximamente: Configuración de notificaciones, usuarios y respaldos.
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: SEGURIDAD */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" />
                  Seguridad y Accesos
                </CardTitle>
                <CardDescription>Gestión de roles y auditoría.</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-8 text-muted-foreground italic">
                Próximamente: Historial de accesos y configuración de doble factor.
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="debug">
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <ShieldAlert className="w-5 h-5" />
                  Zona de Pruebas de Estrés
                </CardTitle>
                <CardDescription>
                  Herramientas para desarrolladores y pruebas de carga.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-background rounded-lg border border-red-200 space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground">Generación Masiva de Datos</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Esto inyectará 1000 transacciones, 500 facturas y 20 usuarios en el sistema actual para verificar el rendimiento.
                    </p>
                    <div className="flex gap-4">
                      <Button 
                        variant="destructive" 
                        onClick={() => {
                          if (confirm("¿Estás seguro? Esto mezclará datos de prueba con tus datos actuales.")) {
                            onStressTest?.();
                          }
                        }}
                      >
                        Ejecutar Prueba de Carga (Stress Test)
                      </Button>
                      <Button 
                        variant="outline" 
                        className="text-red-500 border-red-200 hover:bg-red-50"
                        onClick={() => {
                          if (confirm("¡CUIDADO! Esto borrará TODAS las transacciones, facturas y datos. ¿Estás seguro?")) {
                            onResetData?.();
                          }
                        }}
                      >
                        Limpiar Todos los Datos
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
