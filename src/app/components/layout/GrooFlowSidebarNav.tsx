import { useState, useEffect, useMemo } from 'react';
import { Search, Pin, X } from 'lucide-react';
import { AppNavButton } from './AppNavigationContext';
import { useApp } from '../../context/AppContext';
import {
  menuItemFaIcon,
  menuRouteToView,
  resolveMenuIconColorClass,
  type GrooflowNavMenuSection,
  type GrooflowNavMenuItem,
} from '../../utils/grooflowMenuNav';

type Props = {
  sections: GrooflowNavMenuSection[];
  showSectionLabels?: boolean;
};

export function GrooFlowSidebarNav({ sections, showSectionLabels = true }: Props) {
  const { currentUser } = useApp();
  const [searchQuery, setSearchQuery] = useState('');

  const storageKey = `grooflow_menu_favorites_${currentUser?.id || 'default'}`;

  const [favoriteKeys, setFavoriteKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(favoriteKeys));
    } catch {
      // ignore
    }
  }, [favoriteKeys, storageKey]);

  const toggleFavorite = (key: string) => {
    setFavoriteKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Collect all unique menu items across sections
  const allItems = useMemo(() => {
    const map = new Map<string, GrooflowNavMenuItem>();
    sections.forEach((sec) => {
      sec.items.forEach((item) => {
        const key = item.modulo_key || item.route;
        if (key && !map.has(key)) {
          map.set(key, item);
        }
      });
    });
    return Array.from(map.values());
  }, [sections]);

  // Favorite items matching search query
  const query = searchQuery.trim().toLowerCase();

  const favoriteItems = useMemo(() => {
    return allItems.filter((item) => {
      const key = item.modulo_key || item.route;
      const isFav = favoriteKeys.includes(key);
      if (!isFav) return false;
      if (!query) return true;
      return item.label.toLowerCase().includes(query);
    });
  }, [allItems, favoriteKeys, query]);

  // Filter sections by search query
  const filteredSections = useMemo(() => {
    if (!query) return sections;
    return sections
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((item) => item.label.toLowerCase().includes(query)),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [sections, query]);

  const hasAnyMatch = favoriteItems.length > 0 || filteredSections.length > 0;

  return (
    <div className="flex flex-col space-y-1">
      {/* Search Input Bar (Shown when expanded) */}
      {showSectionLabels && (
        <div className="px-2.5 pb-2 pt-1">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en el menú..."
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* FAVORITOS Section Header & List */}
      {favoriteItems.length > 0 && (
        <div>
          {showSectionLabels && (
            <div className="px-3 pb-1 pt-2 flex items-center gap-1.5">
              <Pin className="w-3 h-3 text-cyan-400 fill-cyan-400 shrink-0" />
              <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-cyan-500 dark:text-cyan-400">
                FAVORITOS
              </span>
            </div>
          )}
          {favoriteItems.map((item) => {
            const view = menuRouteToView(item.route);
            if (!view) return null;
            const itemKey = item.modulo_key || item.route;
            return (
              <AppNavButton
                key={`fav-${itemKey}`}
                targetView={view}
                iconFa={menuItemFaIcon(item.icono)}
                label={item.label}
                iconColorClass={resolveMenuIconColorClass(item.icon_color)}
                requiredModule={item.modulo_key}
                isFavorite={true}
                onToggleFavorite={() => toggleFavorite(itemKey)}
              />
            );
          })}
        </div>
      )}

      {/* Main Menu Sections */}
      {filteredSections.map((block) => (
        <div key={block.section}>
          {showSectionLabels && (
            <div className="px-3 pb-1 pt-2.5">
              <span
                className="text-[9px] font-bold uppercase tracking-[0.22em]"
                style={{ color: 'var(--gf-sidebar-section)' }}
              >
                {block.section}
              </span>
            </div>
          )}
          {block.items.map((item) => {
            const view = menuRouteToView(item.route);
            if (!view) return null;
            const itemKey = item.modulo_key || item.route;
            const isFav = favoriteKeys.includes(itemKey);
            return (
              <AppNavButton
                key={`${block.section}-${item.id ?? item.route}-${item.modulo_key}`}
                targetView={view}
                iconFa={menuItemFaIcon(item.icono)}
                label={item.label}
                iconColorClass={resolveMenuIconColorClass(item.icon_color)}
                requiredModule={item.modulo_key}
                isFavorite={isFav}
                onToggleFavorite={() => toggleFavorite(itemKey)}
              />
            );
          })}
        </div>
      ))}

      {/* Empty Search State */}
      {query && !hasAnyMatch && (
        <div className="px-4 py-6 text-center text-xs text-slate-400">
          <Search className="w-5 h-5 mx-auto mb-2 opacity-40" />
          No se encontraron opciones para "{searchQuery}"
        </div>
      )}
    </div>
  );
}
