import { useState } from 'react';
import { User } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '../ui/dialog';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuLabel, 
    DropdownMenuSeparator, 
    DropdownMenuTrigger 
} from "../ui/dropdown-menu";
import { toast } from 'sonner';
import { 
    Users, 
    Settings, 
    Plus, 
    Search, 
    RefreshCw, 
    Info, 
    Shield, 
    MoreVertical, 
    Trash2, 
    Edit 
} from 'lucide-react';

import { Role } from './types';
import { RoleConfigDialog } from './RoleConfigDialog';

interface UserManagerProps {
    users: User[];
    roles: Role[];
    onUpdateRoles: (roles: Role[]) => void;
    onUpdateUser: (user: User) => void;
    onAddUser: (user: User) => void;
    onDeleteUser: (userId: string) => void;
}

export function UserManager({ users, roles, onUpdateRoles, onUpdateUser, onAddUser, onDeleteUser }: UserManagerProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');

    // Ensure uniqueness of users to prevent duplicate key errors
    const uniqueUsers = users.filter((user, index, self) => 
        index === self.findIndex((u) => u.id === user.id)
    );
    
    // Dialog States
    const [isNewUserOpen, setIsNewUserOpen] = useState(false);
    const [isEditUserOpen, setIsEditUserOpen] = useState(false);
    const [isRolesConfigOpen, setIsRolesConfigOpen] = useState(false);

    // Form State
    const [currentUserForm, setCurrentUserForm] = useState<Partial<User>>({
        name: '',
        role: 'manager',
        initials: '',
        email: ''
    });

    // Contar usuarios reales por rol
    const roleCounts = uniqueUsers.reduce((acc, user) => {
        const roleKey = user.role; 
        acc[roleKey] = (acc[roleKey] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const openNewUserDialog = () => {
        setCurrentUserForm({
            name: '',
            role: 'manager',
            initials: '',
            email: ''
        });
        setIsNewUserOpen(true);
    };

    const openEditUserDialog = (user: User) => {
        setCurrentUserForm({ ...user });
        setIsEditUserOpen(true);
    };

    const handleCreateUser = () => {
        if (!currentUserForm.name || !currentUserForm.initials || !currentUserForm.role) {
            toast.error("Complete todos los campos obligatorios");
            return;
        }

        const user: User = {
            id: `usr-${Math.random().toString(36).substr(2, 5)}`,
            name: currentUserForm.name,
            role: currentUserForm.role as User['role'], // Type assertion safe due to role being string now
            initials: currentUserForm.initials.toUpperCase(),
            email: currentUserForm.email || `${currentUserForm.initials.toLowerCase()}@grooflow.com`
        };

        onAddUser(user);
        setIsNewUserOpen(false);
        toast.success("Usuario creado exitosamente");
    };

    const handleUpdateUser = () => {
         if (!currentUserForm.id || !currentUserForm.name || !currentUserForm.initials || !currentUserForm.role) {
            toast.error("Error al actualizar usuario");
            return;
        }

        const user: User = {
            id: currentUserForm.id,
            name: currentUserForm.name,
            role: currentUserForm.role as User['role'],
            initials: currentUserForm.initials.toUpperCase(),
            email: currentUserForm.email
        };

        onUpdateUser(user);
        setIsEditUserOpen(false);
        toast.success("Usuario actualizado exitosamente");
    };

    const confirmDeleteUser = (userId: string) => {
        if (confirm("¿Está seguro de que desea eliminar este usuario? Esta acción no se puede deshacer.")) {
            onDeleteUser(userId);
            toast.success("Usuario eliminado");
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Users className="w-8 h-8 text-orange-500" />
                        Gestión de Usuarios
                    </h2>
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <span>{uniqueUsers.length} usuarios registrados</span>
                        <span>•</span>
                        <span className="text-green-600 font-medium">{uniqueUsers.length} activos</span>
                        <span>•</span>
                        <span>0 inactivos</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5 ml-1">
                            <RefreshCw className="w-3 h-3" />
                        </Button>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" className="gap-2" onClick={() => setIsRolesConfigOpen(true)}>
                        <Settings className="w-4 h-4" />
                        Configurar Roles
                    </Button>
                    <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={openNewUserDialog}>
                        <Plus className="w-4 h-4" />
                        Nuevo Usuario
                    </Button>
                </div>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                <div>
                    <h4 className="font-semibold text-blue-900 text-sm">Sistema de Permisos por Rol</h4>
                    <p className="text-blue-700 text-sm mt-0.5">
                        Cada usuario tiene acceso solo a los módulos asignados a su rol. Los Super Administradores tienen acceso completo.
                    </p>
                </div>
            </div>

            {/* Roles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {roles.map((role) => (
                    <Card 
                        key={role.id} 
                        className={`${role.bgColor} border ${role.borderColor} shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
                        onClick={() => setRoleFilter(role.id)}
                    >
                        <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                                <Shield className={`w-5 h-5 ${role.color}`} />
                                <Badge variant="secondary" className="bg-white/80 font-mono text-xs">
                                    {roleCounts[role.id] || 0}
                                </Badge>
                            </div>
                            <h3 className="font-semibold text-sm mb-1 text-slate-900">{role.name}</h3>
                            <p className="text-xs text-slate-500 leading-snug">
                                {role.description}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Search & Filter Section */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 space-y-2 w-full">
                            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Search className="w-4 h-4" />
                                Buscar usuario
                            </label>
                            <Input 
                                placeholder="Buscar por nombre, email o ID..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-background"
                            />
                        </div>
                        <div className="w-full md:w-[200px] space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Rol</label>
                            <Select value={roleFilter} onValueChange={setRoleFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Todos los roles" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los roles</SelectItem>
                                    {roles.map(role => (
                                        <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-full md:w-[200px] space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Estado</label>
                            <Select defaultValue="all">
                                <SelectTrigger>
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    <SelectItem value="active">Activos</SelectItem>
                                    <SelectItem value="inactive">Inactivos</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Users Table (Preview) */}
                    <div className="mt-6 border rounded-md overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>Usuario</TableHead>
                                    <TableHead>Rol</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Último Acceso</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {uniqueUsers.filter(u => 
                                    u.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
                                    (roleFilter === 'all' || u.role === roleFilter)
                                ).map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200">
                                                    {user.initials}
                                                </div>
                                                <div>
                                                    <div className="font-medium">{user.name}</div>
                                                    <div className="text-xs text-muted-foreground">ID: {user.id}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="capitalize">
                                                {roles.find(r => r.id === user.role)?.name || user.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 shadow-none">
                                                Activo
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            Hace 2 minutos
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => openEditUserDialog(user)}>
                                                        <Edit className="w-4 h-4 mr-2" />
                                                        Editar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="text-red-600" onClick={() => confirmDeleteUser(user.id)}>
                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                        Eliminar
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {uniqueUsers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            No se encontraron usuarios.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* DIALOG: Nuevo Usuario */}
            <Dialog open={isNewUserOpen} onOpenChange={setIsNewUserOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Registrar Nuevo Usuario</DialogTitle>
                        <DialogDescription>
                            Ingrese los datos del nuevo colaborador para darle acceso al sistema.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nombre Completo</Label>
                                <Input 
                                    placeholder="Ej. Juan Pérez" 
                                    value={currentUserForm.name}
                                    onChange={(e) => setCurrentUserForm({...currentUserForm, name: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Iniciales (Firma)</Label>
                                <Input 
                                    placeholder="JP" 
                                    maxLength={3}
                                    className="uppercase"
                                    value={currentUserForm.initials}
                                    onChange={(e) => setCurrentUserForm({...currentUserForm, initials: e.target.value?.toUpperCase()})}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Correo Electrónico</Label>
                            <Input 
                                type="email" 
                                placeholder="juan@grooflow.com" 
                                value={currentUserForm.email}
                                onChange={(e) => setCurrentUserForm({...currentUserForm, email: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Rol Asignado</Label>
                            <Select 
                                value={currentUserForm.role} 
                                onValueChange={(v: any) => setCurrentUserForm({...currentUserForm, role: v})}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione un rol" />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map(role => (
                                        <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsNewUserOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreateUser}>Crear Usuario</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* DIALOG: Editar Usuario */}
             <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Editar Usuario</DialogTitle>
                        <DialogDescription>
                            Modifique los datos del usuario.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nombre Completo</Label>
                                <Input 
                                    placeholder="Ej. Juan Pérez" 
                                    value={currentUserForm.name}
                                    onChange={(e) => setCurrentUserForm({...currentUserForm, name: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Iniciales (Firma)</Label>
                                <Input 
                                    placeholder="JP" 
                                    maxLength={3}
                                    className="uppercase"
                                    value={currentUserForm.initials}
                                    onChange={(e) => setCurrentUserForm({...currentUserForm, initials: e.target.value?.toUpperCase()})}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Correo Electrónico</Label>
                            <Input 
                                type="email" 
                                placeholder="juan@grooflow.com" 
                                value={currentUserForm.email}
                                onChange={(e) => setCurrentUserForm({...currentUserForm, email: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Rol Asignado</Label>
                            <Select 
                                value={currentUserForm.role} 
                                onValueChange={(v: any) => setCurrentUserForm({...currentUserForm, role: v})}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione un rol" />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map(role => (
                                        <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditUserOpen(false)}>Cancelar</Button>
                        <Button onClick={handleUpdateUser}>Guardar Cambios</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Role Configuration Dialog (Replaces Old Dialogs) */}
            <RoleConfigDialog 
                open={isRolesConfigOpen} 
                onOpenChange={setIsRolesConfigOpen}
                roles={roles}
                onSaveRoles={onUpdateRoles}
                userCounts={roleCounts}
            />
        </div>
    );
}