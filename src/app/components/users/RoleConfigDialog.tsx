import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { Role, SYSTEM_MODULES, COLOR_OPTIONS } from './types';
import { Shield, Plus, Trash2, Save, Check, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface RoleConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    roles: Role[];
    onSaveRoles: (roles: Role[]) => void;
    userCounts: Record<string, number>;
}

export function RoleConfigDialog({ open, onOpenChange, roles: initialRoles, onSaveRoles, userCounts }: RoleConfigDialogProps) {
    const [roles, setRoles] = useState<Role[]>(initialRoles);
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const [hasChanges, setHasChanges] = useState(false);

    // Sync when modal opens
    useEffect(() => {
        if (open) {
            setRoles(JSON.parse(JSON.stringify(initialRoles))); // Deep copy
            setSelectedRoleId(initialRoles[0]?.id || null);
            setHasChanges(false);
        }
    }, [open, initialRoles]);

    const selectedRole = roles.find(r => r.id === selectedRoleId);

    const handleAddRole = () => {
        const newRole: Role = {
            id: `role_${Date.now()}`,
            name: 'Nuevo Rol',
            description: 'Descripción del nuevo rol',
            color: 'text-slate-600 dark:text-slate-400',
            bgColor: 'bg-slate-50 dark:bg-slate-800',
            borderColor: 'border-slate-200 dark:border-slate-700',
            isSystem: false,
            permissions: SYSTEM_MODULES.reduce((acc, module) => ({ ...acc, [module]: false }), {})
        };
        setRoles([...roles, newRole]);
        setSelectedRoleId(newRole.id);
        setHasChanges(true);
    };

    const handleDeleteRole = (roleId: string) => {
        if (userCounts[roleId] && userCounts[roleId] > 0) {
            toast.error("No se puede eliminar un rol que tiene usuarios asignados");
            return;
        }
        
        const roleToDelete = roles.find(r => r.id === roleId);
        if (roleToDelete?.isSystem) {
            toast.error("No se pueden eliminar roles del sistema");
            return;
        }

        if (confirm("¿Eliminar este rol permanentemente?")) {
            const newRoles = roles.filter(r => r.id !== roleId);
            setRoles(newRoles);
            if (selectedRoleId === roleId) {
                setSelectedRoleId(newRoles[0]?.id || null);
            }
            setHasChanges(true);
        }
    };

    const updateSelectedRole = (updates: Partial<Role>) => {
        if (!selectedRole) return;
        
        setRoles(roles.map(r => 
            r.id === selectedRoleId ? { ...r, ...updates } : r
        ));
        setHasChanges(true);
    };

    const togglePermission = (module: string) => {
        if (!selectedRole) return;
        const currentPerms = selectedRole.permissions || {};
        updateSelectedRole({
            permissions: {
                ...currentPerms,
                [module]: !currentPerms[module]
            }
        });
    };

    const handleSave = () => {
        onSaveRoles(roles);
        setHasChanges(false);
        toast.success("Configuración de roles guardada");
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden gap-0 bg-background text-foreground">
                <div className="p-6 pb-4 border-b">
                    <DialogHeader>
                        <DialogTitle>Configuración Avanzada de Roles</DialogTitle>
                        <DialogDescription>
                            Gestione los niveles de acceso y permisos de su organización.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar: Role List */}
                    <div className="w-64 bg-muted/30 border-r flex flex-col dark:bg-muted/10">
                        <div className="p-4 border-b bg-muted/50">
                             <Button onClick={handleAddRole} className="w-full gap-2 bg-background border-dashed text-muted-foreground hover:bg-muted hover:border-border shadow-sm border" variant="outline">
                                <Plus className="w-4 h-4" /> Nuevo Rol
                             </Button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <div className="p-3 space-y-2">
                                {roles.map(role => (
                                    <div 
                                        key={role.id}
                                        onClick={() => setSelectedRoleId(role.id)}
                                        className={`
                                            w-full p-3 rounded-lg text-left text-sm transition-all cursor-pointer border
                                            flex items-center gap-3
                                            ${selectedRoleId === role.id 
                                                ? 'bg-background border-primary/50 shadow-sm ring-1 ring-primary/20 dark:ring-primary/40' 
                                                : 'hover:bg-muted/50 border-transparent hover:border-border'}
                                        `}
                                    >
                                        <div className={`w-8 h-8 rounded-full ${role.bgColor} border ${role.borderColor} flex items-center justify-center shrink-0`}>
                                             <Shield className={`w-4 h-4 ${role.color}`} />
                                        </div>
                                        <div className="overflow-hidden">
                                            <div className="font-medium truncate text-foreground">{role.name}</div>
                                            <div className="text-[10px] text-muted-foreground truncate">{userCounts[role.id] || 0} usuarios</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Main Content: Role Editor */}
                    <div className="flex-1 flex flex-col bg-background overflow-hidden">
                        {selectedRole ? (
                            <div className="flex-1 flex flex-col h-full overflow-hidden">
                                {/* Editor Header */}
                                <div className="p-6 pb-4 border-b flex justify-between items-start shrink-0">
                                    <div>
                                        <h2 className="text-xl font-semibold flex items-center gap-2">
                                            {selectedRole.name}
                                            {selectedRole.isSystem && <Badge variant="secondary" className="gap-1"><Lock className="w-3 h-3"/> Sistema</Badge>}
                                        </h2>
                                        <p className="text-sm text-muted-foreground mt-1">ID: {selectedRole.id}</p>
                                    </div>
                                    {!selectedRole.isSystem && (
                                        <Button 
                                            variant="ghost" 
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDeleteRole(selectedRole.id)}
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" /> Eliminar Rol
                                        </Button>
                                    )}
                                </div>

                                <div className="flex-1 overflow-y-auto">
                                    <div className="p-6 space-y-8 pb-20">
                                        {/* General Info */}
                                        <section className="space-y-4">
                                            <h3 className="text-sm font-medium text-foreground uppercase tracking-wider">Información General</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Nombre del Rol</Label>
                                                    <Input 
                                                        value={selectedRole.name} 
                                                        onChange={(e) => updateSelectedRole({ name: e.target.value })}
                                                        disabled={selectedRole.isSystem} 
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Etiqueta de Color</Label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {COLOR_OPTIONS.map(color => (
                                                            <button
                                                                key={color.name}
                                                                onClick={() => updateSelectedRole({ 
                                                                    color: color.text, 
                                                                    bgColor: color.bg, 
                                                                    borderColor: color.border 
                                                                })}
                                                                className={`
                                                                    w-6 h-6 rounded-full border-2 transition-all
                                                                    ${color.bg} ${color.border}
                                                                    ${selectedRole.color === color.text ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-600 scale-110' : 'hover:scale-110'}
                                                                `}
                                                                title={color.name}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="col-span-2 space-y-2">
                                                    <Label>Descripción</Label>
                                                    <Textarea 
                                                        value={selectedRole.description} 
                                                        onChange={(e) => updateSelectedRole({ description: e.target.value })}
                                                        className="resize-none h-20"
                                                    />
                                                </div>
                                            </div>
                                        </section>

                                        <Separator />

                                        {/* Permissions Matrix */}
                                        <section className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-medium text-foreground uppercase tracking-wider">Permisos de Módulo</h3>
                                                <Button variant="ghost" size="sm" onClick={() => {
                                                    const allTrue = SYSTEM_MODULES.every(m => selectedRole.permissions?.[m]);
                                                    const newPerms = SYSTEM_MODULES.reduce((acc, m) => ({...acc, [m]: !allTrue}), {});
                                                    updateSelectedRole({ permissions: newPerms });
                                                }}>
                                                    {SYSTEM_MODULES.every(m => selectedRole.permissions?.[m]) ? 'Desmarcar todo' : 'Marcar todo'}
                                                </Button>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {SYSTEM_MODULES.map(module => {
                                                    const isEnabled = selectedRole.permissions?.[module];
                                                    return (
                                                        <div 
                                                            key={module}
                                                            onClick={() => togglePermission(module)}
                                                            className={`
                                                                flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all
                                                                ${isEnabled ? 'bg-primary/5 dark:bg-primary/10 border-primary/20' : 'bg-muted/30 border-border hover:border-primary/30'}
                                                            `}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`
                                                                    w-8 h-8 rounded-md flex items-center justify-center
                                                                    ${isEnabled ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}
                                                                `}>
                                                                    <Check className={`w-4 h-4 transition-transform ${isEnabled ? 'scale-100' : 'scale-0'}`} />
                                                                </div>
                                                                <span className={`font-medium ${isEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                                    {module}
                                                                </span>
                                                            </div>
                                                            <Switch checked={!!isEnabled} onCheckedChange={() => togglePermission(module)} />
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </section>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                                <Shield className="w-16 h-16 mb-4 opacity-20" />
                                <p>Seleccione un rol para editar</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t bg-muted/30 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={!hasChanges} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                        <Save className="w-4 h-4" /> Guardar Cambios
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}