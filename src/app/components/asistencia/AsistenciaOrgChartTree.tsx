import type { AsistenciaOrgChartTreeNode, AsistenciaStaffLiveState } from '../../types/asistencia';
import type { TurnosPlanVsReal } from '../../types/turnos';
import { ORG_CHART_COLOR_STYLES } from '../../utils/asistenciaOrgChart';

type Props = {
  sedeName: string;
  tree: AsistenciaOrgChartTreeNode[];
  viewDate?: Date;
  editLayout?: boolean;
  onStaffClick?: (live: AsistenciaStaffLiveState) => void;
  getPlanVsReal?: (live: AsistenciaStaffLiveState) => TurnosPlanVsReal | undefined;
};

function OrgChartNodeBox({
  treeNode,
  viewDate,
  editLayout,
  onStaffClick,
  getPlanVsReal,
}: {
  treeNode: AsistenciaOrgChartTreeNode;
  viewDate?: Date;
  editLayout?: boolean;
  onStaffClick?: (live: AsistenciaStaffLiveState) => void;
  getPlanVsReal?: (live: AsistenciaStaffLiveState) => TurnosPlanVsReal | undefined;
}) {
  const { node, staff, totalCount } = treeNode;
  const color = ORG_CHART_COLOR_STYLES[node.color ?? 'default'];
  const countLabel = staff.length > 0 ? staff.length : totalCount > 0 ? totalCount : null;

  return (
    <div
      className={`min-w-[120px] max-w-[180px] rounded-lg border-2 px-3 py-2 text-center shadow-sm ${color.border} ${color.bg}`}
    >
      <p className="text-[11px] font-bold uppercase leading-tight text-foreground">{node.label}</p>
      {countLabel != null ? (
        <p className="text-[10px] text-muted-foreground tabular-nums">({countLabel})</p>
      ) : null}
      {staff.length > 0 ? (
        <div className="mt-2 space-y-1">
          {staff.map((live) => (
            <button
              key={live.staff.id}
              type="button"
              disabled={editLayout}
              onClick={!editLayout && onStaffClick ? () => onStaffClick(live) : undefined}
              className={`w-full rounded px-1 py-0.5 text-left ${
                live.status === 'ausente'
                  ? 'bg-red-100/80 dark:bg-red-950/40'
                  : 'bg-white/60 dark:bg-slate-800/60'
              } ${!editLayout && onStaffClick ? 'cursor-pointer hover:ring-1 hover:ring-teal-400/50' : ''}`}
            >
              <p className="text-[10px] font-semibold text-foreground truncate">{live.staff.fullName}</p>
              <p className="text-[9px] text-muted-foreground truncate">{live.staff.cargoLabel}</p>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function OrgChartBranch({
  treeNode,
  viewDate,
  editLayout,
  onStaffClick,
  getPlanVsReal,
}: {
  treeNode: AsistenciaOrgChartTreeNode;
  viewDate?: Date;
  editLayout?: boolean;
  onStaffClick?: (live: AsistenciaStaffLiveState) => void;
  getPlanVsReal?: (live: AsistenciaStaffLiveState) => TurnosPlanVsReal | undefined;
}) {
  const { node, children } = treeNode;
  const color = ORG_CHART_COLOR_STYLES[node.color ?? 'default'];
  const hasChildren = children.length > 0;
  const isVertical = node.childrenLayout === 'vertical';

  return (
    <div className="flex flex-col items-center">
      <OrgChartNodeBox
        treeNode={treeNode}
        viewDate={viewDate}
        editLayout={editLayout}
        onStaffClick={onStaffClick}
        getPlanVsReal={getPlanVsReal}
      />

      {hasChildren ? (
        <>
          <div className={`w-px h-4 ${color.line}`} />
          {isVertical ? (
            <div className="flex flex-col items-center gap-3">
              {children.map((child) => (
                <OrgChartBranch
                  key={child.node.id}
                  treeNode={child}
                  viewDate={viewDate}
                  editLayout={editLayout}
                  onStaffClick={onStaffClick}
                  getPlanVsReal={getPlanVsReal}
                />
              ))}
            </div>
          ) : (
            <div className="relative flex flex-col items-center w-full">
              <div className={`h-px w-full min-w-[60px] ${color.line}`} />
              <div className="flex flex-wrap justify-center gap-6 pt-0">
                {children.map((child) => (
                  <div key={child.node.id} className="flex flex-col items-center pt-0">
                    <div className={`w-px h-4 ${color.line}`} />
                    <OrgChartBranch
                      treeNode={child}
                      viewDate={viewDate}
                      editLayout={editLayout}
                      onStaffClick={onStaffClick}
                      getPlanVsReal={getPlanVsReal}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

export function AsistenciaOrgChartTree({
  sedeName,
  tree,
  viewDate,
  editLayout,
  onStaffClick,
  getPlanVsReal,
}: Props) {
  if (tree.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Sin nodos configurados. Define la estructura en Configuración de sede.
      </p>
    );
  }

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="flex flex-col items-center min-w-max px-4">
        <div className="rounded-xl border-2 border-slate-500 bg-slate-50 dark:bg-slate-900 px-6 py-3 text-center shadow-md">
          <p className="text-sm font-bold uppercase tracking-wide text-foreground">{sedeName}</p>
        </div>
        <div className="w-px h-5 bg-slate-400" />
        <div className="h-px w-full min-w-[200px] max-w-4xl bg-slate-400" />
        <div className="flex flex-wrap justify-center gap-8 pt-0">
          {tree.map((branch) => (
            <div key={branch.node.id} className="flex flex-col items-center">
              <div className="w-px h-4 bg-slate-400" />
              <OrgChartBranch
                treeNode={branch}
                viewDate={viewDate}
                editLayout={editLayout}
                onStaffClick={onStaffClick}
                getPlanVsReal={getPlanVsReal}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
