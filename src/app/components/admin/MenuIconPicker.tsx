import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { MENU_ICON_GROUPS } from '../../constants/menuIconPicker';

type MenuIconPickerProps = {
  open: boolean;
  selected: string;
  onIconSelected: (icon: string) => void;
  onClosed: () => void;
};

export function MenuIconPicker({ open, selected, onIconSelected, onClosed }: MenuIconPickerProps) {
  const [query, setQuery] = useState('');
  const [previewIcon, setPreviewIcon] = useState(selected || 'fa-circle');

  useEffect(() => {
    if (open) setPreviewIcon(selected || 'fa-circle');
  }, [open, selected]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MENU_ICON_GROUPS;
    return MENU_ICON_GROUPS.map((group) => ({
      ...group,
      icons: group.icons.filter((icon) => icon.toLowerCase().includes(q)),
    })).filter((group) => group.icons.length > 0);
  }, [query]);

  function pick(icon: string) {
    setPreviewIcon(icon);
    onIconSelected(icon);
    setQuery('');
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setQuery('');
      onClosed();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Elegir icono</DialogTitle>
        </DialogHeader>
        <div className="menu-icon-picker">
          <div className="menu-icon-picker__search-wrap">
            <i className="fa-solid fa-search menu-icon-picker__search-icon" aria-hidden />
            <input
              type="search"
              className="g-input g-input--soft menu-icon-picker__search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar icono… (ej. chart, user, paw)"
            />
          </div>

          {previewIcon ? (
            <div className="menu-icon-picker__preview">
              <span className="menu-icon-picker__preview-icon">
                <i className={`fa-solid ${previewIcon}`} aria-hidden />
              </span>
              <code>{previewIcon}</code>
            </div>
          ) : null}

          <div className="menu-icon-picker__groups">
            {filteredGroups.map((group) => (
              <section key={group.label} className="menu-icon-picker__group">
                <h4 className="menu-icon-picker__group-title">{group.label}</h4>
                <div className="menu-icon-picker__grid">
                  {group.icons.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      className={`menu-icon-picker__btn${icon === selected ? ' is-active' : ''}`}
                      title={icon}
                      onClick={() => pick(icon)}
                    >
                      <i className={`fa-solid ${icon}`} aria-hidden />
                    </button>
                  ))}
                </div>
              </section>
            ))}
            {!filteredGroups.length ? (
              <p className="menu-icon-picker__empty">No hay iconos que coincidan con «{query}».</p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
