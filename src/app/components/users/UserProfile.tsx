import React, { useState } from 'react';
import { User } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';
import { User as UserIcon, Mail, Shield, Moon, Sun, LogOut, Camera } from 'lucide-react';

interface UserProfileProps {
    user: User;
    onUpdateUser: (updatedUser: User) => void;
    currentTheme: 'dark' | 'light';
    onToggleTheme: () => void;
    onLogout: () => void;
}

export function UserProfile({ user, onUpdateUser, currentTheme, onToggleTheme, onLogout }: UserProfileProps) {
    const [name, setName] = useState(user.name);
    const [email, setEmail] = useState(user.email);
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async () => {
        setIsLoading(true);
        // Simular petición a API
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        onUpdateUser({
            ...user,
            name,
            email
        });
        
        setIsLoading(false);
        toast.success("Perfil actualizado correctamente", {
            description: "Los cambios se han guardado en el sistema."
        });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Mi Perfil</h2>
                    <p className="text-muted-foreground">Administra tu información personal y preferencias del sistema.</p>
                </div>
            </div>

            <div className="grid gap-8 md:grid-cols-[300px_1fr]">
                {/* Sidebar / Info Card */}
                <div className="space-y-6">
                    <Card>
                        <CardContent className="pt-6 flex flex-col items-center text-center">
                            <div className="relative mb-4 group cursor-pointer">
                                <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} />
                                    <AvatarFallback className="text-4xl">{user.initials}</AvatarFallback>
                                </Avatar>
                                <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera className="w-8 h-8 text-white" />
                                </div>
                            </div>
                            <h3 className="text-xl font-bold">{user.name}</h3>
                            <p className="text-sm text-muted-foreground mb-4">{user.email}</p>
                            
                            <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium uppercase tracking-wider mb-6">
                                <Shield className="w-3 h-3 mr-1" />
                                {user.role}
                            </div>

                            <Button variant="destructive" className="w-full" onClick={onLogout}>
                                <LogOut className="w-4 h-4 mr-2" />
                                Cerrar Sesión
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Detalles de Cuenta</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">ID de Usuario:</span>
                                <span className="font-mono">{user.id}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Último acceso:</span>
                                <span>Hace 2 minutos</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Estado:</span>
                                <span className="text-green-500 font-medium">Activo</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content Tabs */}
                <div className="space-y-6">
                    <Tabs defaultValue="general" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="general">Información General</TabsTrigger>
                            <TabsTrigger value="appearance">Apariencia y Sistema</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="general" className="space-y-6 mt-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Datos Personales</CardTitle>
                                    <CardDescription>
                                        Actualiza tu información de contacto. Tu email es tu ID de acceso.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="name">Nombre Completo</Label>
                                        <div className="relative">
                                            <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input 
                                                id="name" 
                                                value={name} 
                                                onChange={(e) => setName(e.target.value)}
                                                className="pl-9"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="email">Correo Electrónico</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input 
                                                id="email" 
                                                value={email} 
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="pl-9"
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="flex justify-end">
                                    <Button onClick={handleSave} disabled={isLoading}>
                                        {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                                    </Button>
                                </CardFooter>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Seguridad</CardTitle>
                                    <CardDescription>
                                        Gestiona tu contraseña y métodos de autenticación.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="space-y-0.5">
                                            <div className="font-medium">Contraseña</div>
                                            <div className="text-sm text-muted-foreground">
                                                ••••••••••••
                                            </div>
                                        </div>
                                        <Button variant="outline" size="sm">Cambiar</Button>
                                    </div>
                                    <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="space-y-0.5">
                                            <div className="font-medium">Autenticación de dos factores</div>
                                            <div className="text-sm text-muted-foreground">
                                                Añade una capa extra de seguridad.
                                            </div>
                                        </div>
                                        <Switch />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="appearance" className="space-y-6 mt-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Apariencia</CardTitle>
                                    <CardDescription>
                                        Personaliza cómo se ve GrooFlow en tu dispositivo.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <div className="font-medium">Tema del Sistema</div>
                                            <div className="text-sm text-muted-foreground">
                                                {currentTheme === 'dark' ? 'Modo Cyberpunk (Oscuro) activo' : 'Modo Profesional (Claro) activo'}
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Sun className={`h-4 w-4 ${currentTheme === 'light' ? 'text-primary' : 'text-muted-foreground'}`} />
                                            <Switch 
                                                checked={currentTheme === 'dark'}
                                                onCheckedChange={onToggleTheme}
                                            />
                                            <Moon className={`h-4 w-4 ${currentTheme === 'dark' ? 'text-primary' : 'text-muted-foreground'}`} />
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                        <div 
                                            className={`cursor-pointer rounded-lg border-2 p-4 hover:border-primary transition-all ${currentTheme === 'light' ? 'border-primary bg-primary/5' : 'border-border'}`}
                                            onClick={() => currentTheme === 'dark' && onToggleTheme()}
                                        >
                                            <div className="space-y-2">
                                                <div className="h-2 w-[80%] rounded-lg bg-gray-200" />
                                                <div className="h-2 w-[60%] rounded-lg bg-gray-200" />
                                            </div>
                                            <div className="mt-4 flex items-center space-x-2">
                                                <div className="h-4 w-4 rounded-full bg-gray-200" />
                                                <div className="text-xs font-medium">Claro</div>
                                            </div>
                                        </div>
                                        <div 
                                            className={`cursor-pointer rounded-lg border-2 p-4 bg-black hover:border-primary transition-all ${currentTheme === 'dark' ? 'border-primary' : 'border-border'}`}
                                            onClick={() => currentTheme === 'light' && onToggleTheme()}
                                        >
                                            <div className="space-y-2">
                                                <div className="h-2 w-[80%] rounded-lg bg-gray-800" />
                                                <div className="h-2 w-[60%] rounded-lg bg-gray-800" />
                                            </div>
                                            <div className="mt-4 flex items-center space-x-2">
                                                <div className="h-4 w-4 rounded-full bg-gray-800" />
                                                <div className="text-xs font-medium text-white">Oscuro</div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
