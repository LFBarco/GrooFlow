import { useState, useRef } from 'react';
import { ConfigStructure, TransactionType, ConceptDefinition, SubcategoryDefinition, Flexibility, getSubcategories, subcategoryId } from '../../data/initialData';
import { SystemSettings, type PettyCashRenditionPrintSettings } from '../../types';
import { mergePettyCashRenditionPrint } from '../../data/initialData';
import { Plus, Trash2, Settings, Edit2, Check, X, CalendarClock, Lock, Unlock, Store, Calculator, ShieldCheck, HardDrive, Receipt, ShieldAlert, UserCircle, Upload, ImageIcon, Tags } from 'lucide-react';
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
import { Textarea } from "../ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from "../ui/badge";

import { User } from '../../types';
import { getSedesCatalogEntries } from '../../utils/sedesCatalog';
import { getProviderAreas, getProviderCategories } from '../../utils/providerCatalog';
import { MapPin, Globe, Building2 as Building2Icon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface ConfigPanelProps {
  config: ConfigStructure;
  onUpdateConfig: (newConfig: ConfigStructure) => void;
  systemSettings: SystemSettings;
  onUpdateSystemSettings: (newSettings: SystemSettings) => void;
  onStressTest?: () => void;
  onResetData?: () => void;
  users: User[];
  onUpdateUsers: (users: User[]) => void;
  currentUser?: User;
  /** Renombrar categoría/área comercial: sincroniza proveedores y caja chica. */
  onApplyProviderCategoryRename?: (from: string, to: string) => void;
  onApplyProviderAreaRename?: (from: string, to: string) => void;
  onApplyProviderCategoryRemoved?: (removed: string, replacement: string) => void;
  onApplyProviderAreaRemoved?: (removed: string, replacement: string) => void;
}

export function ConfigPanel({
  config,
  onUpdateConfig,
  systemSettings,
  onUpdateSystemSettings,
  onStressTest,
  onResetData,
  users,
  onUpdateUsers,
  currentUser,
  onApplyProviderCategoryRename,
  onApplyProviderAreaRename,
  onApplyProviderCategoryRemoved,
  onApplyProviderAreaRemoved,
}: ConfigPanelProps) {
  const reportRenditionLogoInputRef = useRef<HTMLInputElement>(null);
  const isSystemAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';
  const isSuperAdminOnly = currentUser?.role === 'super_admin';
  const catalogEntries = getSedesCatalogEntries(systemSettings);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(Object.keys(config)[0]);

  const [newCommercialCategory, setNewCommercialCategory] = useState('');
  const [newCommercialArea, setNewCommercialArea] = useState('');
  const [catalogRename, setCatalogRename] = useState<
    null | { kind: 'category' | 'area'; original: string; draft: string }
  >(null);
  
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

  // Subcategory state
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [editingSubcategoryId, setEditingSubcategoryId] = useState<string | null>(null);
  const [editSubcategoryName, setEditSubcategoryName] = useState('');

  /** Ensure category has subcategories array (convert from legacy concepts if needed). */
  const ensureSubcategories = (catName: string): SubcategoryDefinition[] => {
    const def = config[catName];
    if (!def) return [];
    if (def.subcategories?.length) return def.subcategories;
    return [{ id: 'general', name: catName || 'General', concepts: def.concepts ?? [] }];
  };

  const writeSubcategories = (catName: string, subcategories: SubcategoryDefinition[]) => {
    onUpdateConfig({
      ...config,
      [catName]: { ...config[catName], subcategories, concepts: undefined }
    });
  };

  // --- Category Actions ---
  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    if (config[newCategoryName]) {
      toast.error("La categoría ya existe");
      return;
    }
    const updated = { 
      ...config, 
      [newCategoryName.trim()]: { 
        type: newCategoryType, 
        subcategories: [{ id: 'general', name: 'General', concepts: [] }] 
      } 
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

  // --- Subcategory Actions ---
  const handleAddSubcategory = () => {
    if (!selectedCategory || !newSubcategoryName.trim()) return;
    const subs = ensureSubcategories(selectedCategory);
    if (subs.some(s => s.name.toLowerCase() === newSubcategoryName.trim().toLowerCase())) {
      toast.error("Ya existe una subcategoría con ese nombre");
      return;
    }
    const newSub: SubcategoryDefinition = {
      id: subcategoryId(newSubcategoryName.trim()),
      name: newSubcategoryName.trim(),
      concepts: []
    };
    writeSubcategories(selectedCategory, [...subs, newSub]);
    setNewSubcategoryName('');
    toast.success("Subcategoría agregada");
  };

  const handleDeleteSubcategory = (cat: string, subId: string) => {
    const subs = ensureSubcategories(cat).filter(s => s.id !== subId);
    if (subs.length === 0) {
      toast.error("Debe quedar al menos una subcategoría");
      return;
    }
    writeSubcategories(cat, subs);
    toast.success("Subcategoría eliminada");
  };

  const startEditingSubcategory = (sub: SubcategoryDefinition) => {
    setEditingSubcategoryId(sub.id);
    setEditSubcategoryName(sub.name);
  };

  const saveSubcategoryName = () => {
    if (!selectedCategory || !editingSubcategoryId || !editSubcategoryName.trim()) return;
    const subs = ensureSubcategories(selectedCategory);
    const updated = subs.map(s =>
      s.id === editingSubcategoryId ? { ...s, name: editSubcategoryName.trim() } : s
    );
    writeSubcategories(selectedCategory, updated);
    setEditingSubcategoryId(null);
    toast.success("Subcategoría actualizada");
  };

  // --- Concept Actions (per subcategory) ---
  const handleAddConcept = (subId: string) => {
    if (!selectedCategory || !newConceptName.trim()) return;
    const subs = ensureSubcategories(selectedCategory);
    const sub = subs.find(s => s.id === subId);
    if (!sub) return;
    if (sub.concepts.some(c => c.name.toLowerCase() === newConceptName.trim().toLowerCase())) {
      toast.error("El concepto ya existe en esta subcategoría");
      return;
    }
    const newDef: ConceptDefinition = {
      id: newConceptName.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 32) + '-' + Date.now().toString(36),
      name: newConceptName.trim(),
      flexibility: newConceptFlex,
      defaultDay: newConceptDay ? parseInt(newConceptDay) : undefined
    };
    const updatedSubs = subs.map(s =>
      s.id === subId ? { ...s, concepts: [...s.concepts, newDef] } : s
    );
    writeSubcategories(selectedCategory, updatedSubs);
    setNewConceptName('');
    setNewConceptDay('');
    toast.success("Concepto agregado");
  };

  const handleDeleteConcept = (cat: string, subId: string, conceptId: string) => {
    const subs = ensureSubcategories(cat);
    const updatedSubs = subs.map(s =>
      s.id === subId ? { ...s, concepts: s.concepts.filter(c => c.id !== conceptId) } : s
    );
    writeSubcategories(cat, updatedSubs);
    toast.success("Concepto eliminado");
  };

  const startEditingConcept = (concept: ConceptDefinition) => {
    setEditingConceptId(concept.id);
    setEditConceptName(concept.name);
    setEditConceptFlex(concept.flexibility);
    setEditConceptDay(concept.defaultDay ? concept.defaultDay.toString() : '');
  };

  const saveConcept = (cat: string, subId: string) => {
    if (!editingConceptId || !editConceptName.trim()) return;
    const subs = ensureSubcategories(cat);
    const updatedSubs = subs.map(s => {
      if (s.id !== subId) return s;
      return {
        ...s,
        concepts: s.concepts.map(c =>
          c.id === editingConceptId
            ? { ...c, name: editConceptName.trim(), flexibility: editConceptFlex, defaultDay: editConceptDay ? parseInt(editConceptDay) : undefined }
            : c
        )
      };
    });
    writeSubcategories(cat, updatedSubs);
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

  const renditionMerged = mergePettyCashRenditionPrint(systemSettings.pettyCash.renditionPrint);
  const patchRenditionPrint = (patch: Partial<PettyCashRenditionPrintSettings>) => {
    updatePettyCash('renditionPrint', { ...renditionMerged, ...patch });
  };

  const handleReportRenditionLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Seleccione un archivo de imagen');
      e.target.value = '';
      return;
    }
    if (file.size > 450 * 1024) {
      toast.error('La imagen no debe superar 450 KB');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const m = mergePettyCashRenditionPrint(systemSettings.pettyCash.renditionPrint);
      updatePettyCash('renditionPrint', { ...m, reportLogoDataUrl: dataUrl });
      toast.success('Logo del reporte de rendición actualizado');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const providerCategoriesList = getProviderCategories(systemSettings);
  const providerAreasList = getProviderAreas(systemSettings);

  const persistProviderCatalog = (next: { categories?: string[]; areas?: string[] }) => {
    const prev = systemSettings.providers ?? { categories: providerCategoriesList, areas: providerAreasList };
    onUpdateSystemSettings({
      ...systemSettings,
      providers: {
        categories: next.categories ?? prev.categories ?? providerCategoriesList,
        areas: next.areas ?? prev.areas ?? providerAreasList,
      },
    });
  };

  const addCommercialCategory = () => {
    const v = newCommercialCategory.trim();
    if (!v) return;
    if (providerCategoriesList.includes(v)) {
      toast.error('Esa categoría ya existe');
      return;
    }
    persistProviderCatalog({ categories: [...providerCategoriesList, v] });
    setNewCommercialCategory('');
    toast.success('Categoría agregada');
  };

  const addCommercialArea = () => {
    const v = newCommercialArea.trim();
    if (!v) return;
    if (providerAreasList.includes(v)) {
      toast.error('Esa área ya existe');
      return;
    }
    persistProviderCatalog({ areas: [...providerAreasList, v] });
    setNewCommercialArea('');
    toast.success('Área agregada');
  };

  const deleteCommercialCategory = (name: string) => {
    if (!confirm(`¿Eliminar la categoría "${name}"? Los registros que la usen pasarán a otra categoría.`)) return;
    const next = providerCategoriesList.filter((c) => c !== name);
    if (next.length === 0) {
      toast.error('Debe existir al menos una categoría');
      return;
    }
    const replacement = next[0]!;
    onApplyProviderCategoryRemoved?.(name, replacement);
    persistProviderCatalog({ categories: next });
    toast.success('Categoría eliminada');
  };

  const deleteCommercialArea = (name: string) => {
    if (!confirm(`¿Eliminar el área "${name}"? Los registros que la usen se reasignarán.`)) return;
    const next = providerAreasList.filter((a) => a !== name);
    if (next.length === 0) {
      toast.error('Debe existir al menos un área');
      return;
    }
    const replacement = next[0]!;
    onApplyProviderAreaRemoved?.(name, replacement);
    persistProviderCatalog({ areas: next });
    toast.success('Área eliminada');
  };

  const saveCatalogRename = () => {
    if (!catalogRename) return;
    const d = catalogRename.draft.trim();
    const o = catalogRename.original;
    if (!d) {
      toast.error('Nombre vacío');
      return;
    }
    const list = catalogRename.kind === 'category' ? providerCategoriesList : providerAreasList;
    if (d !== o && list.includes(d)) {
      toast.error('Ya existe un elemento con ese nombre');
      return;
    }
    if (catalogRename.kind === 'category') {
      const next = providerCategoriesList.map((c) => (c === o ? d : c));
      onApplyProviderCategoryRename?.(o, d);
      persistProviderCatalog({ categories: next });
    } else {
      const next = providerAreasList.map((c) => (c === o ? d : c));
      onApplyProviderAreaRename?.(o, d);
      persistProviderCatalog({ areas: next });
    }
    setCatalogRename(null);
    toast.success('Nombre actualizado');
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

      <Tabs defaultValue="business" className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent overflow-x-auto flex-nowrap space-x-2 sm:space-x-6 shrink-0">
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
            value="sedes" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
          >
            Sedes
          </TabsTrigger>
          <TabsTrigger 
            value="debug" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-red-500 font-bold"
          >
            Stress Test
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-h-0 overflow-auto py-6">
          {/* TAB: NEGOCIO */}
          <TabsContent value="business" className="mt-0 outline-none data-[state=inactive]:hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="w-5 h-5" />
                    Información del Negocio
                  </CardTitle>
                  <CardDescription>
                    Datos básicos de la empresa. Solo el administrador del sistema puede modificar esta sección; los cambios se replican para todos los usuarios (sidebar, cabecera, reportes).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nombre Comercial</Label>
                    <Input 
                      value={systemSettings.businessName} 
                      onChange={(e) => onUpdateSystemSettings({...systemSettings, businessName: e.target.value})} 
                      placeholder="Ej: Mi Veterinaria"
                      disabled={!isSystemAdmin}
                    />
                    <p className="text-xs text-muted-foreground">Este nombre aparece en el sidebar, cabecera y reportes.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Moneda Principal</Label>
                    <Select 
                      value={systemSettings.currency} 
                      onValueChange={(val) => onUpdateSystemSettings({...systemSettings, currency: val})}
                      disabled={!isSystemAdmin}
                    >
                      <SelectTrigger disabled={!isSystemAdmin}>
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
                  <CardDescription>
                    Sube el logotipo de tu empresa. Solo el administrador puede cambiarlo; se muestra en el sidebar y cabecera para todos los usuarios.
                  </CardDescription>
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
                            type="button"
                            onClick={() => {
                              if (!isSystemAdmin) return;
                              onUpdateSystemSettings({...systemSettings, businessLogo: undefined});
                              toast.success("Logo eliminado");
                            }}
                            disabled={!isSystemAdmin}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300 cursor-pointer disabled:pointer-events-none"
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
                          disabled={!isSystemAdmin}
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
          <TabsContent value="operations" className="mt-0 outline-none h-full data-[state=inactive]:hidden">
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
                
                {selectedCategory && (() => {
                  const subs = ensureSubcategories(selectedCategory);
                  return (
                  <CardContent className="flex-1 flex flex-col gap-4 pt-6 overflow-hidden">
                    {/* Add Subcategory */}
                    <div className="flex gap-2 items-end p-3 bg-muted/20 rounded-md border border-border">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Nueva subcategoría</Label>
                        <Input 
                          placeholder="Ej: Agua, Luz, Alquiler..."
                          value={newSubcategoryName}
                          onChange={(e) => setNewSubcategoryName(e.target.value)}
                          className="bg-background"
                        />
                      </div>
                      <Button onClick={handleAddSubcategory} variant="secondary">
                        <Plus className="h-4 w-4 mr-1" /> Agregar
                      </Button>
                    </div>

                    {/* Subcategories and their concepts */}
                    <ScrollArea className="flex-1">
                      <div className="grid grid-cols-1 gap-4">
                        {subs.map((sub) => (
                          <div key={sub.id} className="border border-border rounded-lg overflow-hidden bg-muted/5">
                            {/* Subcategory header */}
                            <div className="flex items-center justify-between p-3 bg-muted/20 border-b border-border">
                              {editingSubcategoryId === sub.id ? (
                                <div className="flex items-center gap-2 flex-1">
                                  <Input 
                                    value={editSubcategoryName} 
                                    onChange={e => setEditSubcategoryName(e.target.value)}
                                    className="h-8 flex-1"
                                    autoFocus
                                  />
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-green-500" onClick={saveSubcategoryName}>
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => setEditingSubcategoryId(null)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <span className="font-medium text-sm">{sub.name}</span>
                                  <div className="flex items-center gap-1">
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEditingSubcategory(sub)}>
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </Button>
                                    {subs.length > 1 && (
                                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteSubcategory(selectedCategory, sub.id)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                            {/* Add concept form for this subcategory */}
                            <div className="flex gap-2 items-end p-2 border-b border-border/50 bg-background/50">
                              <Input 
                                placeholder="Concepto (ej: Benavides, Miraflores...)"
                                value={newConceptName}
                                onChange={(e) => setNewConceptName(e.target.value)}
                                className="flex-1 h-8 text-sm"
                              />
                              <Select value={newConceptFlex} onValueChange={(v: Flexibility) => setNewConceptFlex(v)}>
                                <SelectTrigger className="w-[90px] h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="fixed">Fijo</SelectItem>
                                  <SelectItem value="flexible">Flex</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input type="number" min={1} max={31} placeholder="Día" value={newConceptDay} onChange={e => setNewConceptDay(e.target.value)} className="w-14 h-8 text-sm" />
                              <Button size="sm" onClick={() => handleAddConcept(sub.id)}>
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            {/* Concept list for this subcategory */}
                            <div className="p-2 space-y-1">
                              {sub.concepts.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-2 px-2">Sin conceptos. Añade uno arriba.</p>
                              ) : (
                                sub.concepts.map((concept) => (
                                  <div key={concept.id} className="group flex items-center justify-between p-2 rounded-md hover:bg-muted/20 transition-all">
                                    {editingConceptId === concept.id ? (
                                      <div className="flex items-center flex-1 gap-2">
                                        <Input value={editConceptName} onChange={e => setEditConceptName(e.target.value)} className="flex-1 h-8 text-sm" autoFocus />
                                        <Select value={editConceptFlex} onValueChange={(v: Flexibility) => setEditConceptFlex(v)}>
                                          <SelectTrigger className="w-[90px] h-8 text-xs"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="fixed">Fijo</SelectItem>
                                            <SelectItem value="flexible">Flex</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <Input type="number" className="w-14 h-8 text-sm" value={editConceptDay} onChange={e => setEditConceptDay(e.target.value)} placeholder="Día" />
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-500" onClick={() => saveConcept(selectedCategory, sub.id)}><Check className="h-4 w-4" /></Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => setEditingConceptId(null)}><X className="h-4 w-4" /></Button>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="flex items-center gap-2">
                                          <div className={`p-1 rounded ${concept.flexibility === 'fixed' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                                            {concept.flexibility === 'fixed' ? <Lock className="w-3 h-3"/> : <Unlock className="w-3 h-3"/>}
                                          </div>
                                          <span className="text-sm font-medium">{concept.name}</span>
                                          {concept.defaultDay && <span className="text-xs text-muted-foreground">Día {concept.defaultDay}</span>}
                                        </div>
                                        <div className="flex items-center opacity-0 group-hover:opacity-100">
                                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEditingConcept(concept)}><Edit2 className="h-3.5 w-3.5" /></Button>
                                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteConcept(selectedCategory, sub.id, concept.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                  );
                })()}
              </Card>
            </div>
          </TabsContent>

          {/* TAB: CONTABILIDAD (Caja Chica) */}
          <TabsContent value="accounting" className="mt-0 outline-none data-[state=inactive]:hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tags className="w-5 h-5" />
                    Catálogo comercial — Categorías y áreas
                  </CardTitle>
                  <CardDescription>
                    Listas usadas en <strong>Proveedores</strong>, <strong>Caja chica</strong> (motivo y área solicitante) y formularios relacionados. Agregar, editar nombre o eliminar (con reasignación automática en datos).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold">Categorías</h4>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Nueva categoría"
                          value={newCommercialCategory}
                          onChange={(e) => setNewCommercialCategory(e.target.value)}
                          disabled={!isSystemAdmin}
                          onKeyDown={(e) => e.key === 'Enter' && addCommercialCategory()}
                        />
                        <Button type="button" onClick={addCommercialCategory} disabled={!isSystemAdmin}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="border rounded-md overflow-hidden max-h-[280px] overflow-y-auto">
                        <Table>
                          <TableHeader className="bg-muted/50 sticky top-0">
                            <TableRow>
                              <TableHead>Nombre</TableHead>
                              <TableHead className="w-[100px] text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {providerCategoriesList.map((c) => (
                              <TableRow key={c}>
                                <TableCell className="font-medium">{c}</TableCell>
                                <TableCell className="text-right space-x-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={!isSystemAdmin}
                                    onClick={() =>
                                      setCatalogRename({ kind: 'category', original: c, draft: c })
                                    }
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    disabled={!isSystemAdmin || providerCategoriesList.length <= 1}
                                    onClick={() => deleteCommercialCategory(c)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold">Áreas</h4>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Nueva área"
                          value={newCommercialArea}
                          onChange={(e) => setNewCommercialArea(e.target.value)}
                          disabled={!isSystemAdmin}
                          onKeyDown={(e) => e.key === 'Enter' && addCommercialArea()}
                        />
                        <Button type="button" onClick={addCommercialArea} disabled={!isSystemAdmin}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="border rounded-md overflow-hidden max-h-[280px] overflow-y-auto">
                        <Table>
                          <TableHeader className="bg-muted/50 sticky top-0">
                            <TableRow>
                              <TableHead>Nombre</TableHead>
                              <TableHead className="w-[100px] text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {providerAreasList.map((a) => (
                              <TableRow key={a}>
                                <TableCell className="font-medium">{a}</TableCell>
                                <TableCell className="text-right space-x-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={!isSystemAdmin}
                                    onClick={() => setCatalogRename({ kind: 'area', original: a, draft: a })}
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    disabled={!isSystemAdmin || providerAreasList.length <= 1}
                                    onClick={() => deleteCommercialArea(a)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                  {!isSystemAdmin && (
                    <p className="text-xs text-muted-foreground mt-4">
                      Solo administradores pueden modificar el catálogo.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="w-5 h-5" />
                    Caja Chica (Fondo Fijo)
                  </CardTitle>
                  <CardDescription>
                    Configura los límites y alertas del fondo operativo semanal. Solo el administrador del sistema puede modificar; se aplica para todos los usuarios.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Monto Total del Fondo (S/)</Label>
                      <Input 
                        type="number" 
                        min={0}
                        step={1}
                        value={systemSettings.pettyCash.totalFundLimit ?? ''}
                        onChange={(e) => updatePettyCash('totalFundLimit', parseFloat(e.target.value) || 0)}
                        disabled={!isSystemAdmin}
                      />
                      <p className="text-xs text-muted-foreground">Monto base que se repone semanalmente.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Tope por Gasto (S/)</Label>
                      <Input 
                        type="number" 
                        min={0}
                        step={1}
                        value={systemSettings.pettyCash.maxTransactionAmount ?? ''}
                        onChange={(e) => updatePettyCash('maxTransactionAmount', parseFloat(e.target.value) || 0)}
                        disabled={!isSystemAdmin}
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
                          min={0}
                          max={100}
                          className="text-right"
                          value={systemSettings.pettyCash.alertThreshold ?? ''}
                          onChange={(e) => updatePettyCash('alertThreshold', parseFloat(e.target.value) || 0)}
                          disabled={!isSystemAdmin}
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
                          min={0}
                          className="text-right"
                          value={systemSettings.pettyCash.requireReceiptAbove ?? ''}
                          onChange={(e) => updatePettyCash('requireReceiptAbove', parseFloat(e.target.value) || 0)}
                          disabled={!isSystemAdmin}
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
                        disabled={!isSystemAdmin}
                      >
                        <SelectTrigger disabled={!isSystemAdmin}>
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

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="w-5 h-5" />
                    Formato de impresión — Rendición de caja chica
                  </CardTitle>
                  <CardDescription>
                    Solo el <strong>super administrador</strong> puede editar esta plantilla. Define cómo se verá el PDF/HTML al imprimir la rendición desde Caja Chica.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Título del documento</Label>
                      <Input
                        value={renditionMerged.documentTitle}
                        onChange={(e) => patchRenditionPrint({ documentTitle: e.target.value })}
                        disabled={!isSuperAdminOnly}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Subtítulo</Label>
                      <Input
                        value={renditionMerged.subtitle}
                        onChange={(e) => patchRenditionPrint({ subtitle: e.target.value })}
                        disabled={!isSuperAdminOnly}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Pie legal / declaración</Label>
                    <Textarea
                      rows={3}
                      value={renditionMerged.footerLegal}
                      onChange={(e) => patchRenditionPrint({ footerLegal: e.target.value })}
                      disabled={!isSuperAdminOnly}
                      className="resize-y min-h-[72px]"
                    />
                  </div>
                  <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      <Label>Logo en el reporte (PDF / impresión)</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Imagen PNG o JPEG (máx. 450 KB). Si no configura un logo aquí, se usará el de{' '}
                      <strong>Identidad del negocio</strong> cuando exista.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      {renditionMerged.reportLogoDataUrl ? (
                        <img
                          src={renditionMerged.reportLogoDataUrl}
                          alt="Vista previa logo rendición"
                          className="h-16 max-w-[200px] rounded border bg-background object-contain p-1"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin logo específico de rendición.</span>
                      )}
                      <input
                        ref={reportRenditionLogoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={handleReportRenditionLogoFile}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={!isSuperAdminOnly}
                        onClick={() => reportRenditionLogoInputRef.current?.click()}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Subir imagen
                      </Button>
                      {renditionMerged.reportLogoDataUrl ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!isSuperAdminOnly}
                          onClick={() => patchRenditionPrint({ reportLogoDataUrl: undefined })}
                        >
                          Quitar logo
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
                    {(
                      [
                        ['showCategoryBreakdown', 'Desglose por categoría'],
                        ['showSignaturesBlock', 'Bloque de firmas'],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between gap-2 rounded-md border p-3">
                        <Label className="text-sm cursor-pointer">{label}</Label>
                        <Switch
                          checked={!!renditionMerged[key]}
                          onCheckedChange={(v) => patchRenditionPrint({ [key]: v } as Partial<PettyCashRenditionPrintSettings>)}
                          disabled={!isSuperAdminOnly}
                        />
                      </div>
                    ))}
                  </div>
                  {!isSuperAdminOnly && (
                    <p className="text-xs text-muted-foreground">
                      Inicie sesión como super administrador para modificar la plantilla.
                    </p>
                  )}
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
                        {users.filter(u => u.role !== 'super_admin').map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span>{user.name}</span>
                                <span className="text-xs text-muted-foreground">{user.email || '-'}</span>
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
                                  min={0}
                                  step={1}
                                  className="w-[120px] text-right"
                                  placeholder="0"
                                  value={user.pettyCashLimit !== undefined && user.pettyCashLimit !== null ? user.pettyCashLimit : ''}
                                  onChange={(e) => handleUpdateUserLimit(user.id, parseFloat(e.target.value) || 0)}
                                  disabled={!isSystemAdmin}
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
          <TabsContent value="system" className="mt-0 outline-none data-[state=inactive]:hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="w-5 h-5" />
                    Preferencias del Sistema
                  </CardTitle>
                  <CardDescription>Opciones generales de la plataforma.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    <p>Configuración de notificaciones y preferencias se gestiona desde el Centro de Alertas y desde cada módulo.</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCircle className="w-5 h-5" />
                    Usuarios y Accesos
                  </CardTitle>
                  <CardDescription>Gestión de usuarios, roles y sedes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Para crear usuarios, asignar roles y restablecer contraseñas, usa la sección <strong>Usuarios y Roles</strong> en el menú principal.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    La asignación de sedes por usuario se configura en la pestaña <strong>Sedes</strong> de esta misma pantalla.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="w-5 h-5" />
                    Respaldo de Datos
                  </CardTitle>
                  <CardDescription>Exportar y respaldar la información del sistema.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Los datos se sincronizan con la nube (Supabase). Para exportar transacciones o reportes, utiliza las opciones de <strong>Exportar</strong> en Flujo de Caja, Transacciones y Reportes.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB: SEGURIDAD */}
          <TabsContent value="security" className="mt-0 outline-none data-[state=inactive]:hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5" />
                    Seguridad y Accesos
                  </CardTitle>
                  <CardDescription>Gestión de roles y contraseñas.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium text-foreground">Roles y permisos</h4>
                    <p className="text-sm text-muted-foreground">
                      Los roles se configuran en <strong>Usuarios y Roles</strong>. Desde ahí puedes editar permisos por módulo (Dashboard, Alertas, Tesorería, Transacciones, Caja Chica, Requerimientos, Compras, etc.).
                    </p>
                  </div>
                  <div className="space-y-2 pt-4 border-t border-border">
                    <h4 className="font-medium text-foreground">Restablecer contraseña</h4>
                    <p className="text-sm text-muted-foreground">
                      El Super Administrador puede asignar o restablecer la contraseña de cualquier usuario desde <strong>Usuarios y Roles</strong> → menú del usuario → <strong>Restablecer contraseña</strong>. La nueva contraseña se aplica en Supabase de forma inmediata.
                    </p>
                  </div>
                  <div className="space-y-2 pt-4 border-t border-border">
                    <h4 className="font-medium text-foreground">Historial de accesos</h4>
                    <p className="text-sm text-muted-foreground">
                      El último acceso de cada usuario se muestra en la tabla de Usuarios y Roles. Historial detallado de sesiones estará disponible en futuras versiones.
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    Tu sesión
                  </CardTitle>
                  <CardDescription>Información de la sesión actual.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Para cambiar tu propia contraseña o ver tu perfil, haz clic en tu nombre o avatar en la barra lateral y elige <strong>Mi perfil</strong> o <strong>Cerrar sesión</strong>.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB: SEDES */}
          <TabsContent value="sedes" className="mt-0 outline-none data-[state=inactive]:hidden">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-cyan-500" />
                    Gestión de Sedes y Accesos
                  </CardTitle>
                  <CardDescription>
                    Asigna sedes a los usuarios del sistema. Los usuarios solo verán datos de sus sedes asignadas.
                    Usuarios con "Todas las Sedes" tienen acceso global.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Usuario</TableHead>
                          <TableHead>Rol</TableHead>
                          <TableHead>Acceso</TableHead>
                          <TableHead>Sedes Asignadas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                  {user.initials}
                                </div>
                                <div>
                                  <div className="font-medium text-sm">{user.name}</div>
                                  <div className="text-xs text-muted-foreground">{user.email || '-'}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{user.role}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={user.allSedes === true || user.role === 'super_admin' || user.role === 'admin'}
                                  disabled={user.role === 'super_admin' || user.role === 'admin'}
                                  onCheckedChange={(checked) => {
                                    onUpdateUsers(users.map(u => u.id === user.id ? { ...u, allSedes: checked, sedes: checked ? [] : (u.sedes || []) } : u));
                                    toast.success(`Acceso de ${user.name} actualizado`);
                                  }}
                                />
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  {(user.allSedes || user.role === 'super_admin' || user.role === 'admin') 
                                    ? <><Globe className="w-3 h-3 text-cyan-400" /> Todas las sedes</>
                                    : <><Building2Icon className="w-3 h-3 text-muted-foreground" /> Sedes específicas</>
                                  }
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {(user.allSedes || user.role === 'super_admin' || user.role === 'admin') ? (
                                <span className="text-xs text-cyan-400 font-medium">Acceso Global</span>
                              ) : (
                                <div className="flex flex-wrap gap-1 max-w-[320px]">
                                  {catalogEntries.map(({ name: sede, enabled }) => {
                                    const isAssigned = user.sedes?.includes(sede) ?? false;
                                    if (!enabled && !isAssigned) return null;
                                    if (!enabled && isAssigned) {
                                      return (
                                        <span
                                          key={sede}
                                          className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium"
                                          title="Sede deshabilitada en catálogo; asignación conservada"
                                        >
                                          {sede} (off)
                                        </span>
                                      );
                                    }
                                    return (
                                      <button
                                        key={sede}
                                        type="button"
                                        onClick={() => {
                                          const currentSedes = user.sedes || [];
                                          const newSedes = isAssigned
                                            ? currentSedes.filter(s => s !== sede)
                                            : [...currentSedes, sede];
                                          onUpdateUsers(users.map(u => u.id === user.id ? { ...u, sedes: newSedes } : u));
                                        }}
                                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                                          isAssigned
                                            ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 font-medium'
                                            : 'bg-transparent text-muted-foreground border-border hover:border-cyan-500/30 hover:text-cyan-400'
                                        }`}
                                      >
                                        {sede}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Solo las sedes <strong>habilitadas</strong> se pueden asignar o quitar con un clic. Las deshabilitadas en el catálogo siguen visibles si el usuario ya las tenía.
                  </p>
                </CardContent>
              </Card>

              {/* System Sedes List */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2Icon className="w-4 h-4 text-cyan-500" />
                    Sedes del Sistema
                  </CardTitle>
                  <CardDescription>Lista de sedes configuradas en el sistema.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {catalogEntries.map(({ name: sede, enabled }) => (
                      <div
                        key={sede}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm ${
                          enabled
                            ? 'border-border bg-muted/20'
                            : 'border-dashed border-muted-foreground/40 bg-muted/10 opacity-80'
                        }`}
                      >
                        <MapPin className={`w-3.5 h-3.5 ${enabled ? 'text-cyan-400' : 'text-muted-foreground'}`} />
                        <span>{sede}</span>
                        {!enabled && (
                          <span className="text-[10px] uppercase text-muted-foreground">deshabilitada</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Para crear o renombrar sedes use <strong>Usuarios y Roles → Configurar Sedes</strong>. La lista de aquí se actualiza automáticamente.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="debug" className="mt-0 outline-none data-[state=inactive]:hidden">
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

      <Dialog open={!!catalogRename} onOpenChange={(open) => !open && setCatalogRename(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Editar {catalogRename?.kind === 'category' ? 'categoría' : 'área'}
            </DialogTitle>
            <DialogDescription>Cambiar el nombre actualizará el catálogo y los datos vinculados.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Nuevo nombre</Label>
            <Input
              value={catalogRename?.draft ?? ''}
              onChange={(e) =>
                setCatalogRename((prev) =>
                  prev ? { ...prev, draft: e.target.value } : prev
                )
              }
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCatalogRename(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={saveCatalogRename} disabled={!isSystemAdmin}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
