import React from 'react';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuGroup, 
    DropdownMenuItem, 
    DropdownMenuLabel, 
    DropdownMenuSeparator, 
    DropdownMenuTrigger 
} from "../ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { useApp } from "../../context/AppContext";
import { LogOut, User as UserIcon, Settings, Shield, Moon, Sun, ChevronsUpDown } from "lucide-react";

interface UserMenuProps {
    onLogout: () => void;
    onProfileClick?: () => void;
    showDetails?: boolean;
    side?: "top" | "right" | "bottom" | "left";
    align?: "start" | "center" | "end";
}

export function UserMenu({ 
    onLogout, 
    onProfileClick, 
    showDetails = false,
    side = "bottom",
    align = "end"
}: UserMenuProps) {
    const { currentUser: user, theme: currentTheme, toggleTheme: onToggleTheme } = useApp();
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {showDetails ? (
                    <Button variant="ghost" className="relative w-full h-12 justify-start px-2 rounded-xl border border-transparent hover:border-white/8 transition-all group overflow-hidden" style={{ background: 'transparent' }}>
                        <Avatar className="h-8 w-8 mr-2.5 shrink-0" style={{ ring: '1px solid rgba(34,211,238,0.3)' }}>
                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} alt={user.name} />
                            <AvatarFallback className="text-xs font-bold" style={{ background: 'rgba(34,211,238,0.15)', color: '#22d3ee' }}>{user.initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col items-start text-left flex-1 min-w-0">
                            <span className="text-sm font-semibold truncate w-full" style={{ color: '#E4E0FF' }}>{user.name}</span>
                            <span className="text-xs truncate w-full capitalize" style={{ color: '#6b5fa5' }}>{user.role.replace('_', ' ')}</span>
                        </div>
                        <ChevronsUpDown className="ml-auto h-3.5 w-3.5" style={{ color: 'rgba(255,255,255,0.2)' }} />
                    </Button>
                ) : (
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full transition-all hover:scale-105 active:scale-95" style={{ border: '1px solid rgba(139,92,246,0.2)' }}>
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} alt={user.name} />
                            <AvatarFallback className="text-xs font-bold" style={{ background: 'rgba(34,211,238,0.15)', color: '#22d3ee' }}>{user.initials}</AvatarFallback>
                        </Avatar>
                    </Button>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 shadow-[0_8px_32px_rgba(0,0,0,0.6)]" style={{ background: '#22203A', border: '1px solid #3D3B5C', borderRadius: '12px' }} side={side} align={align} forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-semibold leading-none truncate" style={{ color: '#F0EEFF' }}>{user.name}</p>
                        <p className="text-xs leading-none truncate" style={{ color: '#6b5fa5' }}>{user.email}</p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator style={{ background: 'rgba(139,92,246,0.2)' }} />
                <DropdownMenuGroup>
                    <DropdownMenuItem 
                        onClick={() => { if (onProfileClick) onProfileClick(); }} 
                        className="cursor-pointer rounded-lg transition-colors"
                        style={{ color: '#C4BCEC' }}
                    >
                        <UserIcon className="mr-2 h-4 w-4" />
                        <span>Ver Mi Perfil</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                        onClick={(e) => {
                            e.preventDefault(); 
                            onToggleTheme();
                        }} 
                        className="cursor-pointer focus:bg-white/10 focus:text-primary transition-colors"
                    >
                        {currentTheme === 'dark' ? (
                            <>
                                <Sun className="mr-2 h-4 w-4" />
                                <span>Cambiar a Modo Claro</span>
                            </>
                        ) : (
                            <>
                                <Moon className="mr-2 h-4 w-4" />
                                <span>Cambiar a Modo Cyberpunk</span>
                            </>
                        )}
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={onLogout} className="text-red-500 focus:text-red-600 focus:bg-red-500/10 cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Cerrar Sesión</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}