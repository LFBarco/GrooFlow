import type { CSSProperties, ReactNode } from 'react';

import { cn } from '../ui/utils';

type GlassCardProps = {
  children: ReactNode;
  className?: string;
  isDark?: boolean;
  style?: CSSProperties;
  hover?: boolean;
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
};

/**
 * Tarjeta glass premium — GrooFlow Light.
 * En dark devuelve wrapper neutro (estilos vienen de moduleSurfaces inline).
 */
export function GlassCard({
  children,
  className,
  isDark = false,
  style,
  hover = true,
  onMouseEnter,
  onMouseLeave,
}: GlassCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl',
        !isDark && 'gf-glass-card',
        hover && !isDark && 'gf-glass-card-hover',
        className,
      )}
      style={isDark ? style : { ...style }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
}
