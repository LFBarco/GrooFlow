import React, { useEffect, useState } from 'react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter 
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { useApp } from '../../context/AppContext';
import type { User } from '../../types';
import { ProfilePhotoPicker } from './ProfilePhotoPicker';
import { LogOut, Moon, Sun, Mail, KeyRound, User as UserIcon, Lock } from 'lucide-react';
import { Badge } from "../ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { toast } from "sonner";
import { getUserRoleLabel } from '../../utils/userDisplay';
import { fetchAuthProfile } from '../../services/menuApi';

interface UserProfileDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onLogout: () => void;
    onProfileRefresh?: (user: User) => void;
}

export function UserProfileDialog({ 
    open, 
    onOpenChange, 
    onLogout,
    onProfileRefresh,
}: UserProfileDialogProps) {
    const { currentUser: user, roles = [], theme: currentTheme, toggleTheme: onToggleTheme } = useApp();
    const roleLabel = getUserRoleLabel(user, roles);
    const [activeTab, setActiveTab] = useState("general");
    const [refreshingProfile, setRefreshingProfile] = useState(false);

    useEffect(() => {
        if (!open || !onProfileRefresh) return;
        let cancelled = false;
        setRefreshingProfile(true);
        void fetchAuthProfile()
            .then((profile) => {
                if (!cancelled && profile) onProfileRefresh(profile);
            })
            .catch(() => {
                /* mantener datos en caché */
            })
            .finally(() => {
                if (!cancelled) setRefreshingProfile(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open, onProfileRefresh]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] z-[100] glass-panel border-white/10">
                <DialogHeader className="flex flex-col items-center text-center pb-4 border-b border-white/10">
                    <ProfilePhotoPicker
                        user={user}
                        size="lg"
                        disabled
                    />

                    <DialogTitle className="text-2xl font-bold mt-2">{user.name}</DialogTitle>
                    <DialogDescription className="flex items-center gap-2 mt-1 justify-center">
                        <Badge variant="outline" className="capitalize border-primary/20 bg-primary/5 text-primary">
                            {roleLabel}
                        </Badge>
                        <span className="text-xs text-muted-foreground">ID: {user.id}</span>
                    </DialogDescription>
                    <p className="mt-3 text-xs text-muted-foreground leading-relaxed max-w-sm">
                        {refreshingProfile
                            ? 'Sincronizando con Gestión…'
                            : 'Nombre, foto y nivel se administran en el panel Gestión → Mi perfil o Usuarios.'}
                    </p>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/50">
                        <TabsTrigger value="general" className="flex items-center gap-2">
                            <UserIcon className="w-4 h-4" /> General
                        </TabsTrigger>
                        <TabsTrigger value="security" className="flex items-center gap-2">
                            <Lock className="w-4 h-4" /> Seguridad
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="general" className="space-y-6 py-2 animate-in fade-in slide-in-from-left-4 duration-300">
                        <div className="space-y-3">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Apariencia del Sistema</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <div 
                                    onClick={currentTheme === 'light' ? undefined : onToggleTheme}
                                    className={`cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-all duration-200 ${
                                        currentTheme === 'light' 
                                            ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm scale-[1.02]' 
                                            : 'border-border hover:border-primary/50 opacity-70 hover:opacity-100'
                                    }`}
                                >
                                    <Sun className="w-6 h-6 text-amber-500" />
                                    <span className="text-sm font-medium">Claro</span>
                                </div>
                                <div 
                                    onClick={currentTheme === 'dark' ? undefined : onToggleTheme}
                                    className={`cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-all duration-200 ${
                                        currentTheme === 'dark' 
                                            ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm scale-[1.02]' 
                                            : 'border-border hover:border-primary/50 opacity-70 hover:opacity-100'
                                    }`}
                                >
                                    <Moon className="w-6 h-6 text-indigo-400" />
                                    <span className="text-sm font-medium">Oscuro</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Correo</Label>
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
                                <Mail className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">{user.email || 'Sin correo registrado'}</span>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="security" className="space-y-4 py-2 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
                            <div className="flex items-start gap-3">
                                <KeyRound className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-sm font-medium">Cambio de contraseña</p>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Para restablecer tu contraseña, contacta al administrador del sistema.
                                        Un super-admin puede actualizarla desde Gestión de usuarios.
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => {
                                    toast.info('Contacta al administrador para restablecer tu contraseña.');
                                }}
                            >
                                Solicitar restablecimiento
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter className="sm:justify-between border-t border-white/10 pt-4 gap-2 sm:gap-0">
                     <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancelar
                     </Button>
                     <Button
                        variant="destructive"
                        onClick={() => {
                            setTimeout(() => {
                                void onLogout();
                            }, 0);
                        }}
                        className="gap-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20"
                     >
                        <LogOut className="w-4 h-4" />
                        Cerrar Sesión
                     </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
