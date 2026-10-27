import { HandCoins, Truck, Wallet } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { viewToPath, type ViewType } from '../../routes';
import { cn } from '../ui/utils';

type DockItem = {
  view: ViewType;
  label: string;
  short: string;
  icon: typeof Wallet;
  match: (pathname: string) => boolean;
};

const ITEMS: DockItem[] = [
  {
    view: 'pettycash',
    label: 'Caja chica',
    short: 'Caja',
    icon: Wallet,
    match: (p) => p.includes('caja-chica'),
  },
  {
    view: 'cashback',
    label: 'Cashback',
    short: 'Cash',
    icon: HandCoins,
    match: (p) => p.includes('cashback'),
  },
  {
    view: 'fleet',
    label: 'Flota clínica',
    short: 'Flota',
    icon: Truck,
    match: (p) => p.includes('flota'),
  },
];

type Props = {
  canPettyCash: boolean;
  canCashback: boolean;
  canFleet: boolean;
};

/** Barra inferior en móvil para los módulos de campo más usados. */
export function MobileFieldDock({ canPettyCash, canCashback, canFleet }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const allowed = ITEMS.filter((item) => {
    if (item.view === 'pettycash') return canPettyCash;
    if (item.view === 'cashback') return canCashback;
    if (item.view === 'fleet') return canFleet;
    return false;
  });

  if (allowed.length < 1) return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur-md"
      style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom))' }}
      aria-label="Accesos rápidos de campo"
    >
      <ul
        className={cn(
          'grid gap-0 max-w-lg mx-auto',
          allowed.length === 1 && 'grid-cols-1',
          allowed.length === 2 && 'grid-cols-2',
          allowed.length >= 3 && 'grid-cols-3'
        )}
      >
        {allowed.map((item) => {
          const active = item.match(location.pathname);
          const Icon = item.icon;
          return (
            <li key={item.view}>
              <button
                type="button"
                onClick={() => navigate(viewToPath(item.view))}
                className={cn(
                  'flex w-full flex-col items-center justify-center gap-0.5 py-2.5 min-h-14 text-[11px] font-medium transition-colors',
                  active ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className={cn('h-5 w-5', active && 'stroke-[2.25]')} />
                <span>{item.short}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
