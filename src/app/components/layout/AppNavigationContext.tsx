import { createContext, useContext, type LucideIcon } from 'react';
import type { ViewType } from '../../routes';

export type AppNavigationContextValue = {
  activeView: ViewType;
  isSidebarCollapsed: boolean;
  hasPermission: (moduleName: string) => boolean;
  onSelectView: (view: ViewType) => void;
};

export const AppNavigationContext = createContext<AppNavigationContextValue | null>(null);

export function useAppNavigation(): AppNavigationContextValue {
  const ctx = useContext(AppNavigationContext);
  if (!ctx) {
    throw new Error('useAppNavigation debe usarse dentro de AppNavigationContext.Provider');
  }
  return ctx;
}

export type AppNavButtonProps = {
  targetView: ViewType;
  icon: LucideIcon;
  label: string;
  iconColorClass?: string;
  requiredModule?: string;
};

export function AppNavButton({
  targetView,
  icon: Icon,
  label,
  iconColorClass,
  requiredModule,
}: AppNavButtonProps) {
  const { activeView, isSidebarCollapsed, hasPermission, onSelectView } = useAppNavigation();

  if (requiredModule && !hasPermission(requiredModule)) return null;

  const isActive = activeView === targetView;

  return (
    <div className="relative group/tooltip px-2">
      <button
        onClick={() => onSelectView(targetView)}
        className={`relative flex items-center w-full py-2.5 transition-all duration-300 rounded-xl group/btn overflow-hidden
        ${isSidebarCollapsed ? 'justify-center px-0' : 'px-3'}
        ${
          isActive
            ? 'text-white border border-cyan-500/30'
            : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
        }`}
        style={
          isActive
            ? {
                background:
                  'linear-gradient(90deg, rgba(34,211,238,0.12) 0%, rgba(139,92,246,0.06) 100%)',
                boxShadow: '0 0 20px rgba(34,211,238,0.08)',
              }
            : {}
        }
      >
        {isActive && !isSidebarCollapsed && (
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full"
            style={{
              background: 'linear-gradient(180deg, #22d3ee, #a855f7)',
              boxShadow: '0 0 8px rgba(34,211,238,0.8)',
            }}
          />
        )}

        <Icon
          className={`w-[19px] h-[19px] transition-all duration-300 shrink-0
            ${isActive ? 'text-cyan-300' : iconColorClass || 'text-slate-500 group-hover/btn:text-slate-200'}
            ${!isSidebarCollapsed ? 'mr-3' : ''}`}
          style={isActive ? { filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.7))' } : {}}
        />

        {!isSidebarCollapsed && (
          <>
            <span
              className={`text-[13px] flex-1 text-left tracking-wide truncate font-medium ${isActive ? 'text-cyan-50' : ''}`}
            >
              {label}
            </span>
            {isActive && (
              <div
                className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-1 shrink-0"
                style={{ boxShadow: '0 0 8px rgba(34,211,238,0.9)' }}
              />
            )}
          </>
        )}
      </button>

      {isSidebarCollapsed && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 px-3 py-1.5 bg-[#22203A] text-white text-xs font-semibold rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 whitespace-nowrap z-[60] shadow-xl border border-[#3D3B5C] translate-x-2 group-hover/tooltip:translate-x-0 pointer-events-none">
          {label}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1.5 border-4 border-transparent border-r-[#22203A]" />
        </div>
      )}
    </div>
  );
}
