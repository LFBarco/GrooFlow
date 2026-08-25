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
import { getUserAvatarSrc } from "../../utils/userAvatar";
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
    const { currentUser: user, roles = [], theme: currentTheme, toggleTheme: onToggleTheme } = useApp();
    const roleLabel = roles.find((r) => r.id === user.role)?.name || user.role.replace(/_/g, ' ');
    const isDark = currentTheme === 'dark';
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {showDetails ? (
                    <Button variant="ghost" className={`relative w-full h-12 justify-start px-2 rounded-xl border border-transparent transition-all group overflow-hidden ${isDark ? 'hover:border-white/8' : 'hover:border-slate-200'}`} style={{ background: 'transparent' }}>
                        <Avatar className="h-8 w-8 mr-2.5 shrink-0" style={{ ring: '1px solid rgba(34,211,238,0.3)' }}>
                            <AvatarImage src={getUserAvatarSrc(user)} alt={user.name} />
                            <AvatarFallback className="text-xs font-bold" style={{ background: isDark ? 'rgba(34,211,238,0.15)' : 'rgba(8,145,178,0.12)', color: isDark ? '#22d3ee' : '#0891b2' }}>{user.initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col items-start text-left flex-1 min-w-0">
                            <span className="text-sm font-semibold truncate w-full" style={{ color: isDark ? '#E4E0FF' : '#0f172a' }}>{user.name}</span>
                            <span className="text-xs truncate w-full" style={{ color: isDark ? '#6b5fa5' : '#64748b' }}>{roleLabel}</span>
                        </div>
                        <ChevronsUpDown className="ml-auto h-3.5 w-3.5" style={{ color: isDark ? 'rgba(255,255,255,0.2)' : '#94a3b8' }} />
                    </Button>
                ) : (
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full transition-all hover:scale-105 active:scale-95" style={{ border: '1px solid rgba(139,92,246,0.2)' }} data-testid="user-menu-trigger">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={getUserAvatarSrc(user)} alt={user.name} />
                            <AvatarFallback className="text-xs font-bold" style={{ background: 'rgba(34,211,238,0.15)', color: '#22d3ee' }}>{user.initials}</AvatarFallback>
                        </Avatar>
                    </Button>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className={`w-56 ${isDark ? 'shadow-[0_8px_32px_rgba(0,0,0,0.6)]' : 'shadow-[0_16px_40px_-16px_rgba(15,23,42,0.18)]'}`}
                style={
                    isDark
                        ? { background: '#22203A', border: '1px solid #3D3B5C', borderRadius: '12px' }
                        : { background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: '12px' }
                }
                side={side}
                align={align}
                forceMount
            >
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-semibold leading-none truncate" style={{ color: isDark ? '#F0EEFF' : '#0f172a' }}>{user.name}</p>
                        <p className="text-xs leading-none truncate" style={{ color: isDark ? '#6b5fa5' : '#64748b' }}>{user.email}</p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator style={{ background: isDark ? 'rgba(139,92,246,0.2)' : 'rgba(148,163,184,0.35)' }} />
                <DropdownMenuGroup>
                    <DropdownMenuItem 
                        onClick={() => { if (onProfileClick) onProfileClick(); }} 
                        className="cursor-pointer rounded-lg transition-colors"
                        style={{ color: isDark ? '#C4BCEC' : '#334155' }}
                    >
                        <UserIcon className="mr-2 h-4 w-4" />
                        <span>Ver Mi Perfil</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                        onClick={(e) => {
                            e.preventDefault(); 
                            onToggleTheme();
                        }} 
                        className={`cursor-pointer transition-colors ${isDark ? 'focus:bg-white/10 focus:text-primary' : 'focus:bg-indigo-50 focus:text-slate-900'}`}
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
                <DropdownMenuSeparator className={isDark ? 'bg-white/10' : 'bg-slate-200'} />
                <DropdownMenuItem
                    data-testid="user-menu-logout"
                    onSelect={() => {
                        /** Defer hasta después del cierre del menú (Radix) para que signOut no compita con el desmontaje. */
                        setTimeout(() => {
                            void onLogout();
                        }, 0);
                    }}
                    className="text-red-500 focus:text-red-600 focus:bg-red-500/10 cursor-pointer"
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Cerrar Sesión</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}