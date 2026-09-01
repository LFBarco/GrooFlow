import { useState } from 'react';
import {
  MENU_ICON_COLOR_OPTIONS,
  menuIconColorSwatchClass,
  resolveMenuIconColorClass,
} from '../../utils/menuIconColors';

type Props = {
  value?: string | null;
  disabled?: boolean;
  onChange: (colorClass: string) => void;
};

export function MenuIconColorPicker({ value, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const active = resolveMenuIconColorClass(value);
  const swatch = menuIconColorSwatchClass(value);

  return (
    <div className="menu-icon-color-picker">
      <button
        type="button"
        className="menu-icon-color-picker__trigger"
        disabled={disabled}
        title="Color del icono en el menú lateral"
        aria-label="Elegir color del icono"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={`menu-icon-color-picker__dot ${swatch}`} aria-hidden />
        <i className="fa-solid fa-chevron-down text-[9px] opacity-60" aria-hidden />
      </button>
      {open ? (
        <div className="menu-icon-color-picker__panel" role="listbox" aria-label="Colores de icono">
          {MENU_ICON_COLOR_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="option"
              aria-selected={opt.classes === active}
              className={`menu-icon-color-picker__swatch ${opt.swatch}${opt.classes === active ? ' is-active' : ''}`}
              title={opt.label}
              onClick={() => {
                onChange(opt.classes);
                setOpen(false);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
