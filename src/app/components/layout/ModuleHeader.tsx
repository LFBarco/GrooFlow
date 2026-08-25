import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '../ui/utils';

type ModuleHeaderProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  accent: string;
  accentGlow: string;
  isDark: boolean;
  className?: string;
  children?: ReactNode;
  trailing?: ReactNode;
};

/**
 * Cabecera unificada GrooFlow — icono grande, título, subtítulo y línea degradada.
 */
export function ModuleHeader({
  icon: Icon,
  title,
  subtitle,
  accent,
  accentGlow,
  isDark,
  className,
  children,
  trailing,
}: ModuleHeaderProps) {
  return (
    <div
      className={cn(
        'mb-5 sm:mb-8 flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-5',
        !isDark && 'gf-module-header',
        className,
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'gf-module-header-icon p-2.5 sm:p-3 rounded-2xl shrink-0',
              !isDark && 'gf-glass-icon-wrap',
            )}
            style={
              isDark
                ? { background: `${accent}18`, border: `1px solid ${accent}35` }
                : undefined
            }
          >
            <Icon
              className="w-6 h-6 sm:w-8 sm:h-8"
              style={{
                color: accent,
                filter: isDark ? `drop-shadow(0 0 10px ${accentGlow})` : undefined,
              }}
            />
          </div>
          <div className="space-y-1 min-w-0">
            <h1
              className={cn(
                'gf-module-title font-extrabold tracking-tight text-[1.35rem] sm:text-[1.75rem] lg:text-[1.85rem]',
              )}
              style={{ color: isDark ? '#F0EEFF' : '#0f172a', letterSpacing: '-0.02em' }}
            >
              {title}
            </h1>
            <p
              className="text-sm gf-module-subtitle"
              style={{ color: isDark ? '#6b5fa5' : '#475569' }}
            >
              {subtitle}
            </p>
            {!isDark && (
              <div
                className="gf-module-accent-line mt-3 h-0.5 w-full max-w-md rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${accent}, transparent)`,
                  boxShadow: `0 0 12px ${accentGlow}`,
                }}
              />
            )}
          </div>
        </div>
        {children}
      </div>
      {trailing && <div className="flex items-center gap-4 self-end sm:self-auto">{trailing}</div>}
    </div>
  );
}
