import React, { useState } from 'react';
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
import { Input } from "../ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useApp } from '../../context/AppContext';
import { LogOut, Moon, Sun, Shield, Mail, Camera, KeyRound, User as UserIcon, Lock } from 'lucide-react';
import { Badge } from "../ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { toast } from "sonner";

interface UserProfileDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onLogout: () => void;
}

export function UserProfileDialog({ 
    open, 
    onOpenChange, 
    onLogout
}: UserProfileDialogProps) {
    const { currentUser: user, theme: currentTheme, toggleTheme: onToggleTheme } = useApp();
    const [activeTab, setActiveTab] = useState("general");
    const [loading, setLoading] = useState(false);

    // Password change states
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const handleUploadPhoto = () => {
        // Mock upload
        toast.promise(new Promise((resolve) => setTimeout(resolve, 1500)), {
            loading: 'Subiendo foto de perfil...',
            success: 'Foto actualizada correctamente',
            error: 'Error al subir la foto'
        });
    };

    const handleChangePassword = () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            toast.error("Por favor completa todos los campos");
            return;
        }
        
        if (newPassword !== confirmPassword) {
            toast.error("Las contraseñas no coinciden");
            return;
        }

        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            toast.success("Contraseña actualizada correctamente");
            onOpenChange(false);
        }, 1500);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* Added z-[100] to ensure it sits above the sidebar and other elements */}
            <DialogContent className="sm:max-w-[500px] z-[100] glass-panel border-white/10">
                <DialogHeader className="flex flex-col items-center text-center pb-4 border-b border-white/10">
                    <div className="relative group cursor-pointer mb-4" onClick={handleUploadPhoto}>
                        <Avatar className="h-24 w-24 ring-4 ring-background border-2 border-border shadow-xl transition-all group-hover:opacity-80">
                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} />
                            <AvatarFallback className="text-2xl bg-primary/10 text-primary font-bold">
                                {user.initials}
                            </AvatarFallback>
                        </Avatar>
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="w-8 h-8 text-white drop-shadow-md" />
                        </div>
                        <div className="absolute bottom-0 right-0 bg-primary text-white p-1.5 rounded-full shadow-lg border-2 border-background">
                            <Camera className="w-3 h-3" />
                        </div>
                    </div>

                    <DialogTitle className="text-2xl font-bold">{user.name}</DialogTitle>
                    <DialogDescription className="flex items-center gap-2 mt-1 justify-center">
                        <Badge variant="outline" className="capitalize border-primary/20 bg-primary/5 text-primary">
                            {user.role.replace('_', ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground">ID: {user.id}</span>
                    </DialogDescription>
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
                        {/* Theme Section */}
                        <div className="space-y-3">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Apariencia del Sistema</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <div 
                                    onClick={currentTheme === 'light' ? undefined : onToggleTheme}
                                    className={`cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-all duration-200 ${
                                        currentTheme === 'light' 
                                            ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm scale-[1.02]' 
                                            : 'border-border hover:border-primary/50 hover:bg-muted opacity-70 hover:opacity-100'
                                    }`}
                                >
                                    <Sun className={`w-6 h-6 ${currentTheme === 'light' ? 'text-primary' : 'text-muted-foreground'}`} />
                                    <span className="text-sm font-medium">Claro</span>
                                </div>
                                
                                <div 
                                    onClick={currentTheme === 'dark' ? undefined : onToggleTheme}
                                    className={`cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-all duration-200 ${
                                        currentTheme === 'dark' 
                                            ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm scale-[1.02]' 
                                            : 'border-border hover:border-primary/50 hover:bg-muted opacity-70 hover:opacity-100'
                                    }`}
                                >
                                    <Moon className={`w-6 h-6 ${currentTheme === 'dark' ? 'text-primary' : 'text-muted-foreground'}`} />
                                    <span className="text-sm font-medium">Cyberpunk</span>
                                </div>
                            </div>
                        </div>

                        {/* Basic Info Section */}
                        <div className="space-y-4">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Información Personal</Label>
                            
                            <div className="grid gap-3">
                                <div className="relative group">
                                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                    <Input 
                                        readOnly 
                                        value={user.email || 'No registrado'} 
                                        className="pl-9 bg-muted/30 focus:bg-background transition-colors border-white/10" 
                                    />
                                </div>
                                
                                <div className="relative group">
                                    <Shield className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                    <Input 
                                        readOnly 
                                        value={`Rol: ${user.role.toUpperCase()}`} 
                                        className="pl-9 bg-muted/30 focus:bg-background transition-colors border-white/10" 
                                    />
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="security" className="space-y-6 py-2 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="space-y-4">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cambio de Contraseña</Label>
                            <div className="space-y-4 p-4 rounded-xl border border-white/10 bg-muted/20">
                                <div className="space-y-2">
                                    <Label htmlFor="current-pass">Contraseña Actual</Label>
                                    <div className="relative">
                                        <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            id="current-pass" 
                                            type="password" 
                                            className="pl-9 bg-background/50" 
                                            placeholder="••••••••"
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="new-pass">Nueva Contraseña</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            id="new-pass" 
                                            type="password" 
                                            className="pl-9 bg-background/50" 
                                            placeholder="••••••••"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirm-pass">Confirmar Contraseña</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            id="confirm-pass" 
                                            type="password" 
                                            className="pl-9 bg-background/50" 
                                            placeholder="••••••••"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                        />
                                    </div>
                                </div>
                                
                                <Button 
                                    className="w-full mt-2" 
                                    onClick={handleChangePassword}
                                    disabled={loading}
                                >
                                    {loading ? "Actualizando..." : "Actualizar Contraseña"}
                                </Button>
                            </div>
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
