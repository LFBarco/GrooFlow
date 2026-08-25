import { useState, useEffect } from 'react';
import { User } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuLabel, 
    DropdownMenuSeparator, 
    DropdownMenuTrigger 
} from "../ui/dropdown-menu";
import { toast } from 'sonner';
import { validatePasswordClient } from '../../utils/userSessionGuard';
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
    Edit,
    KeyRound,
    Clock,
    Mail,
    Eye,
    EyeOff,
    UserCheck,
    UserX,
    Copy,
    CheckCheck,
    Building2,
    Globe
} from 'lucide-react';
import { Switch } from '../ui/switch';

import { Role } from './types';
import { RoleConfigDialog } from './RoleConfigDialog';
import { SedeConfigDialog } from './SedeConfigDialog';
import { repository } from '../../services/api';
import { describeAuthOrNetworkError } from '../../utils/authErrors';
import { isSupabaseBackend } from '../../config/backend';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

import type { SedesCatalogSaveResult } from '../../utils/sedesCatalog';
import type { SedeCatalogEntry } from '../../types';

interface UserManagerProps {
    users: User[];
    roles: Role[];
    /** Solo sedes habilitadas (nuevas asignaciones). */
    sedesCatalog: string[];
    /** Todas las sedes del catálogo (para validar asignaciones al renombrar). */
    knownSedeNames: string[];
    sedesCatalogEntries: SedeCatalogEntry[];
    onSaveSedesCatalog: (result: SedesCatalogSaveResult) => void;
    onUpdateRoles: (roles: Role[]) => Promise<boolean> | boolean | void;
    onUpdateUser: (user: User) => void;
    onAddUser: (user: User) => void;
    onDeleteUser: (userId: string) => void | Promise<void>;
    onRefreshUsers?: () => void | Promise<void>;
}

export function UserManager({
    users,
    roles,
    sedesCatalog,
    knownSedeNames,
    sedesCatalogEntries,
    onSaveSedesCatalog,
    onUpdateRoles,
    onUpdateUser,
    onAddUser,
    onDeleteUser,
    onRefreshUsers,
}: UserManagerProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const uniqueUsers = users.filter((user, index, self) => 
        index === self.findIndex((u) => u.id === user.id)
    );
    
    const [isNewUserOpen, setIsNewUserOpen] = useState(false);
    const [isEditUserOpen, setIsEditUserOpen] = useState(false);
    const [isRolesConfigOpen, setIsRolesConfigOpen] = useState(false);
    const [isSedesConfigOpen, setIsSedesConfigOpen] = useState(false);
    const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [copiedUserId, setCopiedUserId] = useState<string | null>(null);

    const [currentUserForm, setCurrentUserForm] = useState<Partial<User> & { password?: string; confirmPassword?: string }>({
        name: '',
        role: roles[1]?.id || 'manager',
        initials: '',
        email: '',
        password: '',
        confirmPassword: '',
        status: 'active',
        allSedes: true,
        sedes: []
    });
    
    const [resetPasswordForm, setResetPasswordForm] = useState<{ userId: string; newPassword: string; confirmPassword: string }>({
        userId: '',
        newPassword: '',
        confirmPassword: ''
    });

    // Quitar del formulario solo nombres que ya no existen en el catálogo (p. ej. tras renombrar)
    const knownSedeNamesKey = knownSedeNames.join('\u001f');
    useEffect(() => {
        setCurrentUserForm((f) => ({
            ...f,
            sedes: f.sedes?.filter((s) => knownSedeNames.includes(s)) ?? [],
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps -- comparar por contenido del catálogo
    }, [knownSedeNamesKey]);

    const roleCounts = uniqueUsers.reduce((acc, user) => {
        const roleKey = user.role; 
        acc[roleKey] = (acc[roleKey] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const openNewUserDialog = () => {
        setCurrentUserForm({
            name: '',
            role: roles[1]?.id || 'manager',
            initials: '',
            email: '',
            password: '',
            confirmPassword: '',
            status: 'active',
            allSedes: true,
            sedes: []
        });
        setShowPassword(false);
        setIsNewUserOpen(true);
    };

    const openEditUserDialog = (user: User) => {
        setCurrentUserForm({ ...user, password: '', confirmPassword: '' });
        setIsEditUserOpen(true);
    };

    const openResetPasswordDialog = (user: User) => {
        setResetPasswordForm({ userId: user.id, newPassword: '', confirmPassword: '' });
        setIsResetPasswordOpen(true);
    };

    const autoGenerateInitials = (name: string) => {
        const parts = name.trim().split(' ').filter(Boolean);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return '';
    };

    const handleCreateUser = async () => {
        if (!currentUserForm.name || !currentUserForm.email || !currentUserForm.role) {
            toast.error("Complete todos los campos obligatorios (Nombre, Email y Rol)");
            return;
        }
        const pwdErr = validatePasswordClient(currentUserForm.password || '');
        if (pwdErr) {
            toast.error(pwdErr);
            return;
        }
        if (currentUserForm.password !== currentUserForm.confirmPassword) {
            toast.error("Las contraseñas no coinciden");
            return;
        }
        const emailNorm = (currentUserForm.email || '').trim().toLowerCase();
        if (uniqueUsers.some(u => (u.email || '').trim().toLowerCase() === emailNorm)) {
            toast.error("Ya existe un usuario con ese correo electrónico");
            return;
        }

        setIsCreating(true);
        try {
            const authUser = await repository.auth.createUser(
                currentUserForm.email!,
                currentUserForm.password!,
                currentUserForm.name!
            );

            const initials = currentUserForm.initials || autoGenerateInitials(currentUserForm.name!);

            const user: User = {
                id: authUser.id,
                name: currentUserForm.name!,
                role: currentUserForm.role as User['role'],
                initials: initials.toUpperCase(),
                email: currentUserForm.email!,
                status: 'active',
                allSedes: currentUserForm.allSedes ?? true,
                sedes: currentUserForm.allSedes ? [] : (currentUserForm.sedes || []),
            };

            onAddUser(user);
            setIsNewUserOpen(false);
            const sedeInfo = user.allSedes ? 'todas las sedes' : (user.sedes?.join(', ') || 'sin sede');
            if (authUser.existing) {
                toast.info(`Usuario "${user.name}" vinculado al sistema`, {
                    description: `El correo ya existía en Auth. Se usó su cuenta (${user.email}). ${sedeInfo}`,
                });
            } else {
                toast.success(`Usuario "${user.name}" creado exitosamente`, {
                    description: `Correo: ${user.email} | Acceso: ${sedeInfo}`,
                });
            }
        } catch (error: unknown) {
            console.error('Error creating user:', error);
            toast.error('Error al crear el usuario: ' + describeAuthOrNetworkError(error));
        } finally {
            setIsCreating(false);
        }
    };

    const handleUpdateUser = () => {
        if (!currentUserForm.id || !currentUserForm.name || !currentUserForm.role) {
            toast.error("Error al actualizar usuario");
            return;
        }

        const user: User = {
            id: currentUserForm.id,
            name: currentUserForm.name,
            role: currentUserForm.role as User['role'],
            initials: (currentUserForm.initials || autoGenerateInitials(currentUserForm.name)).toUpperCase(),
            email: currentUserForm.email,
            status: currentUserForm.status || 'active',
            lastLogin: currentUserForm.lastLogin,
            pettyCashLimit: currentUserForm.pettyCashLimit,
            pettyCashFundEnabled:
                currentUserForm.pettyCashFundEnabled ??
                uniqueUsers.find((u) => u.id === currentUserForm.id)?.pettyCashFundEnabled,
            location: currentUserForm.location,
            allSedes: currentUserForm.allSedes ?? true,
            sedes: currentUserForm.allSedes ? [] : (currentUserForm.sedes || []),
        };

        onUpdateUser(user);
        setIsEditUserOpen(false);
    };

    const handleResetPassword = async () => {
        const pwdErr = validatePasswordClient(resetPasswordForm.newPassword || '');
        if (pwdErr) {
            toast.error(pwdErr);
            return;
        }
        if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
            toast.error("Las contraseñas no coinciden");
            return;
        }

        const targetUser = uniqueUsers.find(u => u.id === resetPasswordForm.userId);
        if (!targetUser) return;

        if (!targetUser.email) {
            toast.error("Este usuario no tiene correo; no se puede restablecer contraseña en Supabase.");
            return;
        }

        try {
            await repository.auth.updateUserPassword(targetUser.email, resetPasswordForm.newPassword);
            toast.success(`Contraseña de "${targetUser.name}" restablecida`, {
                description: "La contraseña se actualizó en Supabase. El usuario debe usarla en su próximo acceso."
            });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "No se pudo actualizar la contraseña");
            return;
        }
        setIsResetPasswordOpen(false);
    };

    const handleToggleStatus = (user: User) => {
        const newStatus: 'active' | 'inactive' = user.status === 'inactive' ? 'active' : 'inactive';
        onUpdateUser({ ...user, status: newStatus });
    };

    const handleRefreshUsers = async () => {
        if (!onRefreshUsers) return;
        setIsRefreshing(true);
        try {
            await onRefreshUsers();
            toast.success('Lista de usuarios actualizada');
        } catch {
            toast.error('No se pudo actualizar la lista de usuarios');
        } finally {
            setIsRefreshing(false);
        }
    };

    const confirmDeleteUser = async (userId: string, userName: string) => {
        if (confirm(`¿Está seguro de que desea eliminar al usuario "${userName}"? Se desactivará su acceso y se quitará del sistema.`)) {
            try {
                await onDeleteUser(userId);
                toast.success("Usuario eliminado");
            } catch (err) {
                toast.error(err instanceof Error ? err.message : "No se pudo eliminar el usuario");
            }
        }
    };

    const copyCredentials = (user: User) => {
        const text = `Usuario: ${user.name}\nEmail: ${user.email || 'N/A'}\nRol: ${roles.find(r => r.id === user.role)?.name || user.role}`;
        navigator.clipboard.writeText(text).then(() => {
            setCopiedUserId(user.id);
            setTimeout(() => setCopiedUserId(null), 2000);
        });
    };

    const formatLastLogin = (lastLogin?: string) => {
        if (!lastLogin) return 'Nunca';
        try {
            return formatDistanceToNow(new Date(lastLogin), { addSuffix: true, locale: es });
        } catch {
            return 'Desconocido';
        }
    };

    const activeCount = uniqueUsers.filter(u => u.status !== 'inactive').length;
    const inactiveCount = uniqueUsers.filter(u => u.status === 'inactive').length;

    const filteredUsers = uniqueUsers.filter(u => {
        const matchSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchRole = roleFilter === 'all' || u.role === roleFilter;
        const matchStatus = statusFilter === 'all' || 
            (statusFilter === 'active' && u.status !== 'inactive') ||
            (statusFilter === 'inactive' && u.status === 'inactive');
        return matchSearch && matchRole && matchStatus;
    });

    return (
        <div className="space-y-4 animate-in fade-in duration-150 -mt-2">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-border/60 pb-3" data-testid="user-manager-header">
                <div className="space-y-0.5 min-w-0">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Users className="w-7 h-7 text-orange-500 shrink-0" />
                        Gestión de Usuarios
                    </h2>
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <span>{uniqueUsers.length} usuarios registrados</span>
                        <span>•</span>
                        <span className="text-green-600 font-medium">{activeCount} activos</span>
                        <span>•</span>
                        <span className="text-slate-500">{inactiveCount} inactivos</span>
                        {onRefreshUsers ? (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 ml-1"
                                title="Actualizar lista"
                                disabled={isRefreshing}
                                onClick={() => void handleRefreshUsers()}
                                data-testid="user-manager-refresh"
                            >
                                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                            </Button>
                        ) : null}
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" className="gap-2" onClick={() => setIsRolesConfigOpen(true)}>
                        <Settings className="w-4 h-4" />
                        Configurar Roles
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={() => setIsSedesConfigOpen(true)}>
                        <Building2 className="w-4 h-4" />
                        Configurar Sedes
                    </Button>
                    <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={openNewUserDialog}>
                        <Plus className="w-4 h-4" />
                        Nuevo Usuario
                    </Button>
                </div>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-4 flex items-start gap-3 dark:bg-blue-900/10 dark:border-blue-800">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                <div>
                    <h4 className="font-semibold text-blue-900 dark:text-blue-300 text-sm">Acceso controlado por Super Administrador</h4>
                    <p className="text-blue-700 dark:text-blue-400 text-sm mt-0.5">
                        Solo el Super Administrador puede crear cuentas. Cada usuario recibe su correo y contraseña de acceso. Los módulos visibles se sincronizan con el rol asignado.
                    </p>
                </div>
            </div>

            {/* Roles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {roles.map((role) => (
                    <Card 
                        key={role.id} 
                        className={`${role.bgColor} border ${role.borderColor} shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
                        onClick={() => setRoleFilter(roleFilter === role.id ? 'all' : role.id)}
                    >
                        <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                                <Shield className={`w-5 h-5 ${role.color}`} />
                                <Badge variant="secondary" className="bg-white/80 font-mono text-xs dark:bg-black/30">
                                    {roleCounts[role.id] || 0}
                                </Badge>
                            </div>
                            <h3 className="font-semibold text-sm mb-1 text-slate-900 dark:text-slate-100">{role.name}</h3>
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
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
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

                    {/* Users Table */}
                    <div className="mt-6 border rounded-md overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>Usuario</TableHead>
                                    <TableHead>Rol</TableHead>
                                    <TableHead>Sede(s)</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5" />
                                            Último Acceso
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.map((user) => (
                                    <TableRow key={user.id} className={user.status === 'inactive' ? 'opacity-60' : ''}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-sm">
                                                    {user.initials}
                                                </div>
                                                <div>
                                                    <div className="font-medium">{user.name}</div>
                                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Mail className="w-3 h-3" />
                                                        {user.email || 'Sin correo'}
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="capitalize">
                                                {roles.find(r => r.id === user.role)?.name || user.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {user.allSedes || !user.sedes?.length ? (
                                                <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                                    <Globe className="w-3.5 h-3.5" />
                                                    Todas
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap gap-1">
                                                    {user.sedes.map(s => {
                                                        const entry = sedesCatalogEntries.find(e => e.name === s);
                                                        const off = entry && !entry.enabled;
                                                        return (
                                                            <Badge
                                                                key={s}
                                                                variant="secondary"
                                                                className={`text-xs py-0 h-5 ${off ? 'opacity-80 border-amber-500/40 text-amber-900 dark:text-amber-200' : ''}`}
                                                            >
                                                                {s}{off ? ' · off' : ''}
                                                            </Badge>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {user.status === 'inactive' ? (
                                                <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-slate-300 shadow-none dark:bg-slate-800 dark:text-slate-400">
                                                    Inactivo
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 shadow-none dark:bg-green-900/20 dark:text-green-400">
                                                    Activo
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            <div className="flex items-center gap-1.5">
                                                {user.lastLogin ? (
                                                    <>
                                                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                                                        {formatLastLogin(user.lastLogin)}
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                                        <span className="text-slate-400">Nunca</span>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-52">
                                                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => openEditUserDialog(user)}>
                                                        <Edit className="w-4 h-4 mr-2" />
                                                        Editar datos
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => openResetPasswordDialog(user)}>
                                                        <KeyRound className="w-4 h-4 mr-2" />
                                                        Restablecer contraseña
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => copyCredentials(user)}>
                                                        {copiedUserId === user.id ? (
                                                            <CheckCheck className="w-4 h-4 mr-2 text-green-500" />
                                                        ) : (
                                                            <Copy className="w-4 h-4 mr-2" />
                                                        )}
                                                        Copiar datos de acceso
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => handleToggleStatus(user)}>
                                                        {user.status === 'inactive' ? (
                                                            <>
                                                                <UserCheck className="w-4 h-4 mr-2 text-green-600" />
                                                                <span className="text-green-700">Activar usuario</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <UserX className="w-4 h-4 mr-2 text-amber-600" />
                                                                <span className="text-amber-700">Desactivar usuario</span>
                                                            </>
                                                        )}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem 
                                                        className="text-red-600" 
                                                        onClick={() => confirmDeleteUser(user.id, user.name)}
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                        Eliminar usuario
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredUsers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            No se encontraron usuarios con los filtros aplicados.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* DIALOG: Nuevo Usuario */}
            <Dialog
                open={isNewUserOpen}
                onOpenChange={(open) => {
                    setIsNewUserOpen(open);
                    if (!open) setIsCreating(false);
                }}
            >
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <KeyRound className="w-5 h-5 text-blue-600" />
                            Registrar Nuevo Usuario
                        </DialogTitle>
                        <DialogDescription>
                            El Super Administrador asigna el correo y la contraseña de acceso. El usuario podrá ingresar con estas credenciales.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nombre Completo <span className="text-red-500">*</span></Label>
                                <Input 
                                    placeholder="Ej. Juan Pérez" 
                                    value={currentUserForm.name}
                                    onChange={(e) => {
                                        const name = e.target.value;
                                        setCurrentUserForm(prev => ({
                                            ...prev, 
                                            name,
                                            initials: prev.initials || autoGenerateInitials(name)
                                        }));
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Iniciales</Label>
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
                            <Label className="flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                                Correo Electrónico <span className="text-red-500">*</span>
                            </Label>
                            <Input 
                                type="email" 
                                placeholder="juan@empresa.com" 
                                value={currentUserForm.email}
                                onChange={(e) => setCurrentUserForm({...currentUserForm, email: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Rol Asignado <span className="text-red-500">*</span></Label>
                            <Select 
                                value={currentUserForm.role} 
                                onValueChange={(v: any) => setCurrentUserForm({...currentUserForm, role: v})}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione un rol" />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map(role => (
                                        <SelectItem key={role.id} value={role.id}>
                                            <div className="flex items-center gap-2">
                                                <Shield className={`w-3.5 h-3.5 ${role.color}`} />
                                                {role.name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {currentUserForm.role && (
                                <p className="text-xs text-muted-foreground">
                                    Módulos con acceso: {
                                        Object.entries(roles.find(r => r.id === currentUserForm.role)?.permissions || {})
                                            .filter(([, v]) => v)
                                            .map(([k]) => k)
                                            .join(', ') || 'Ninguno'
                                    }
                                </p>
                            )}
                        </div>
                        {/* Sede Access Section */}
                        <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
                            <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-1.5 text-sm font-medium">
                                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                                    Acceso a Sedes
                                </Label>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                        {currentUserForm.allSedes ? 'Todas las sedes' : 'Sedes específicas'}
                                    </span>
                                    <Switch
                                        checked={!!currentUserForm.allSedes}
                                        onCheckedChange={(v) => setCurrentUserForm({...currentUserForm, allSedes: v, sedes: v ? [] : currentUserForm.sedes})}
                                    />
                                </div>
                            </div>
                            {!currentUserForm.allSedes && (
                                <div className="space-y-2">
                                    <p className="text-xs text-muted-foreground">Selecciona sedes (solo las habilitadas en el catálogo):</p>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {sedesCatalog.map(sede => {
                                            const isSelected = currentUserForm.sedes?.includes(sede);
                                            return (
                                                <button
                                                    key={sede}
                                                    type="button"
                                                    onClick={() => {
                                                        const curr = currentUserForm.sedes || [];
                                                        const updated = isSelected
                                                            ? curr.filter(s => s !== sede)
                                                            : [...curr, sede];
                                                        setCurrentUserForm({...currentUserForm, sedes: updated});
                                                    }}
                                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all ${
                                                        isSelected
                                                            ? 'bg-blue-600 text-white border-blue-600'
                                                            : 'border-border text-muted-foreground hover:border-blue-400 hover:text-foreground'
                                                    }`}
                                                >
                                                    <Building2 className="w-3 h-3" />
                                                    {sede}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="border-t pt-4 space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
                                <KeyRound className="w-4 h-4" />
                                Credenciales de Acceso
                            </div>
                            <div className="space-y-2">
                                <Label>Contraseña <span className="text-red-500">*</span></Label>
                                <div className="relative">
                                    <Input 
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Mínimo 8 caracteres, letra y número" 
                                        value={currentUserForm.password}
                                        onChange={(e) => setCurrentUserForm({...currentUserForm, password: e.target.value})}
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Confirmar Contraseña <span className="text-red-500">*</span></Label>
                                <div className="relative">
                                    <Input 
                                        type={showConfirmPassword ? "text" : "password"}
                                        placeholder="Repita la contraseña" 
                                        value={currentUserForm.confirmPassword}
                                        onChange={(e) => setCurrentUserForm({...currentUserForm, confirmPassword: e.target.value})}
                                        className={`pr-10 ${currentUserForm.confirmPassword && currentUserForm.password !== currentUserForm.confirmPassword ? 'border-red-400' : ''}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {currentUserForm.confirmPassword && currentUserForm.password !== currentUserForm.confirmPassword && (
                                    <p className="text-xs text-red-500">Las contraseñas no coinciden</p>
                                )}
                            </div>
                        </div>
                        {isSupabaseBackend() ? (
                        <p className="text-[10px] text-muted-foreground break-all rounded-md bg-muted/30 px-2 py-1.5">
                            <span className="font-medium">Proyecto en uso:</span> {import.meta.env.VITE_SUPABASE_URL}
                            {' '}— Debe coincidir con <strong>Project URL</strong> en Supabase → Settings → API.
                        </p>
                        ) : null}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsNewUserOpen(false)}>Cancelar</Button>
                        <Button 
                            onClick={handleCreateUser} 
                            disabled={isCreating}
                            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {isCreating ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Creando...
                                </>
                            ) : (
                                <>
                                    <Plus className="w-4 h-4" />
                                    Crear Usuario
                                </>
                            )}
                        </Button>
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
                                <Label>Iniciales</Label>
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
                                placeholder="juan@empresa.com" 
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
                                        <SelectItem key={role.id} value={role.id}>
                                            <div className="flex items-center gap-2">
                                                <Shield className={`w-3.5 h-3.5 ${role.color}`} />
                                                {role.name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Estado</Label>
                            <Select 
                                value={currentUserForm.status || 'active'} 
                                onValueChange={(v: any) => setCurrentUserForm({...currentUserForm, status: v})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Activo</SelectItem>
                                    <SelectItem value="inactive">Inactivo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {/* Sede Access Section */}
                        <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
                            <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-1.5 text-sm font-medium">
                                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                                    Acceso a Sedes
                                </Label>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                        {currentUserForm.allSedes ? 'Todas' : 'Específicas'}
                                    </span>
                                    <Switch
                                        checked={!!currentUserForm.allSedes}
                                        onCheckedChange={(v) => setCurrentUserForm({...currentUserForm, allSedes: v, sedes: v ? [] : currentUserForm.sedes})}
                                    />
                                </div>
                            </div>
                            {!currentUserForm.allSedes && (
                                <div className="space-y-3">
                                    <p className="text-xs text-muted-foreground">Sedes habilitadas:</p>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {sedesCatalog.map(sede => {
                                            const isSelected = currentUserForm.sedes?.includes(sede);
                                            return (
                                                <button
                                                    key={sede}
                                                    type="button"
                                                    onClick={() => {
                                                        const curr = currentUserForm.sedes || [];
                                                        const updated = isSelected
                                                            ? curr.filter(s => s !== sede)
                                                            : [...curr, sede];
                                                        setCurrentUserForm({...currentUserForm, sedes: updated});
                                                    }}
                                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all ${
                                                        isSelected
                                                            ? 'bg-blue-600 text-white border-blue-600'
                                                            : 'border-border text-muted-foreground hover:border-blue-400 hover:text-foreground'
                                                    }`}
                                                >
                                                    <Building2 className="w-3 h-3" />
                                                    {sede}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {sedesCatalogEntries.some(
                                        e => !e.enabled && (currentUserForm.sedes?.includes(e.name) ?? false)
                                    ) && (
                                        <div className="space-y-1.5">
                                            <p className="text-xs text-amber-600 dark:text-amber-400">
                                                Sedes deshabilitadas en catálogo (asignación conservada; pulse para quitar):
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {sedesCatalogEntries
                                                    .filter(e => !e.enabled && (currentUserForm.sedes?.includes(e.name) ?? false))
                                                    .map(e => (
                                                        <button
                                                            key={e.name}
                                                            type="button"
                                                            onClick={() => {
                                                                const curr = currentUserForm.sedes || [];
                                                                setCurrentUserForm({
                                                                    ...currentUserForm,
                                                                    sedes: curr.filter(s => s !== e.name),
                                                                });
                                                            }}
                                                            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border border-amber-500/50 bg-amber-500/15 text-amber-800 dark:text-amber-200 hover:bg-amber-500/25"
                                                        >
                                                            {e.name}
                                                            <Trash2 className="w-3 h-3 opacity-70" />
                                                        </button>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {currentUserForm.lastLogin && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5 bg-muted/30 rounded px-3 py-2">
                                <Clock className="w-3.5 h-3.5" />
                                Último acceso: {formatLastLogin(currentUserForm.lastLogin)}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditUserOpen(false)}>Cancelar</Button>
                        <Button onClick={handleUpdateUser}>Guardar Cambios</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* DIALOG: Restablecer Contraseña */}
            <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <KeyRound className="w-5 h-5 text-amber-500" />
                            Restablecer Contraseña
                        </DialogTitle>
                        <DialogDescription>
                            Asigne una nueva contraseña para el usuario: <strong>{uniqueUsers.find(u => u.id === resetPasswordForm.userId)?.name}</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Nueva Contraseña</Label>
                            <Input
                                type="password"
                                placeholder="Mínimo 8 caracteres, letra y número"
                                value={resetPasswordForm.newPassword}
                                onChange={(e) => setResetPasswordForm({...resetPasswordForm, newPassword: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Confirmar Nueva Contraseña</Label>
                            <Input
                                type="password"
                                placeholder="Repita la contraseña"
                                value={resetPasswordForm.confirmPassword}
                                onChange={(e) => setResetPasswordForm({...resetPasswordForm, confirmPassword: e.target.value})}
                                className={resetPasswordForm.confirmPassword && resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword ? 'border-red-400' : ''}
                            />
                            {resetPasswordForm.confirmPassword && resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword && (
                                <p className="text-xs text-red-500">Las contraseñas no coinciden</p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsResetPasswordOpen(false)}>Cancelar</Button>
                        <Button onClick={handleResetPassword} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
                            <KeyRound className="w-4 h-4" />
                            Restablecer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Role Configuration Dialog */}
            <RoleConfigDialog 
                open={isRolesConfigOpen} 
                onOpenChange={setIsRolesConfigOpen}
                roles={roles}
                onSaveRoles={onUpdateRoles}
                userCounts={roleCounts}
            />

            <SedeConfigDialog
                open={isSedesConfigOpen}
                onOpenChange={setIsSedesConfigOpen}
                entries={sedesCatalogEntries}
                onSave={onSaveSedesCatalog}
            />
        </div>
    );
}
