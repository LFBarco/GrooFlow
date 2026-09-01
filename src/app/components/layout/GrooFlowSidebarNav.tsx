import { AppNavButton } from './AppNavigationContext';
import {
  menuItemFaIcon,
  menuRouteToView,
  resolveMenuIconColorClass,
  type GrooflowNavMenuSection,
} from '../../utils/grooflowMenuNav';

type Props = {
  sections: GrooflowNavMenuSection[];
  showSectionLabels?: boolean;
};

export function GrooFlowSidebarNav({ sections, showSectionLabels = true }: Props) {
  return (
    <>
      {sections.map((block) => (
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
            return (
              <AppNavButton
                key={`${block.section}-${item.id ?? item.route}-${item.modulo_key}`}
                targetView={view}
                iconFa={menuItemFaIcon(item.icono)}
                label={item.label}
                iconColorClass={resolveMenuIconColorClass(item.icon_color)}
                requiredModule={item.modulo_key}
              />
            );
          })}
        </div>
      ))}
    </>
  );
}
