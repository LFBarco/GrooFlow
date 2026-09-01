import { useCallback, useRef, type ReactNode } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import type { XYCoord } from 'react-dnd';

import type {
  AsistenciaLiveAreaBlock,
  AsistenciaLiveSedeSummary,
  AsistenciaLiveSubAreaBlock,
  AsistenciaSettings,
  AsistenciaStaffLiveState,
} from '../../types/asistencia';
import type { TurnosPlanVsReal } from '../../types/turnos';
import { shiftLabelForStaff } from '../../utils/asistenciaShift';
import { applyAreaLayoutReorder, applyStaffLayoutMove } from '../../utils/asistenciaLayoutUtils';
import { ManagerPlaceholder, StaffLiveCard, themeForColumnId } from './asistenciaLiveUi';

export const DND_STAFF = 'asistencia-live-staff';
export const DND_AREA = 'asistencia-live-area';

export type StaffDragItem = {
  staffId: string;
  sedeName: string;
  area: string;
  index: number;
};

export type AreaDragItem = {
  sedeName: string;
  area: string;
};
type LayoutPersist = (
  updater: (prev: AsistenciaSettings) => AsistenciaSettings,
  message?: string
) => Promise<boolean>;

function DraggableStaffCard({
  live,
  sedeName,
  area,
  index,
  editLayout,
  viewDate,
  onStaffClick,
  getPlanVsReal,
}: {
  live: AsistenciaStaffLiveState;
  sedeName: string;
  area: string;
  index: number;
  editLayout: boolean;
  viewDate?: Date;
  onStaffClick?: (live: AsistenciaStaffLiveState) => void;
  getPlanVsReal?: (live: AsistenciaStaffLiveState) => TurnosPlanVsReal | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: DND_STAFF,
      item: { staffId: live.staff.id, sedeName, area, index } satisfies StaffDragItem,
      canDrag: editLayout && !live.staff.isManager,
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [editLayout, live.staff.id, sedeName, area, index, live.staff.isManager]
  );

  const [, drop] = useDrop(
    () => ({
      accept: DND_STAFF,
      hover(item: StaffDragItem, monitor) {
        if (!editLayout || !ref.current) return;
        if (item.staffId === live.staff.id) return;
        if (item.sedeName !== sedeName) return;

        const dragIndex = item.index;
        const hoverIndex = index;
        if (dragIndex === hoverIndex && item.area === area) return;

        const hoverRect = ref.current.getBoundingClientRect();
        const hoverMiddleY = (hoverRect.bottom - hoverRect.top) / 2;
        const clientOffset = monitor.getClientOffset();
        if (!clientOffset) return;
        const hoverClientY = (clientOffset as XYCoord).y - hoverRect.top;
        if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
        if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

        item.index = hoverIndex;
        item.area = area;
      },
    }),
    [editLayout, index, area, sedeName, live.staff.id]
  );

  drag(drop(ref));

  return (
    <StaffLiveCard
      name={live.staff.fullName}
      cargo={live.staff.cargoLabel}
      status={live.status}
      time={live.entradaFormat ?? live.staff.expectedTime}
      avatarUrl={live.staff.avatarUrl}
      critical={live.staff.isCritical}
      matchHint={live.matchHint}
      statusNote={live.statusNote}
      shiftLabel={shiftLabelForStaff(live.staff, viewDate)}
      editLayout={editLayout}
      dragHandleRef={ref}
      isDragging={isDragging}
      onClick={!editLayout && onStaffClick ? () => onStaffClick(live) : undefined}
      planVsReal={getPlanVsReal?.(live)}
    />
  );
}

function AreaStaffDropZone({
  sedeName,
  area,
  index,
  editLayout,
  onDropStaff,
  children,
}: {
  sedeName: string;
  area: string;
  index: number;
  editLayout: boolean;
  onDropStaff: (item: StaffDragItem, toIndex: number, toArea: string) => void;
  children?: ReactNode;
}) {
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: DND_STAFF,
      drop: (item: StaffDragItem) => {
        if (item.sedeName !== sedeName) return;
        onDropStaff(item, index, area);
      },
      canDrop: (item) => editLayout && item.sedeName === sedeName,
      collect: (monitor) => ({ isOver: monitor.isOver() && monitor.canDrop() }),
    }),
    [editLayout, sedeName, area, index, onDropStaff]
  );

  return (
    <div
      ref={drop}
      className={`min-h-[8px] w-full rounded transition-colors ${
        isOver ? 'bg-indigo-500/20 ring-1 ring-indigo-400/50' : ''
      }`}
    >
      {children}
    </div>
  );
}

function StaffAreaList({
  sedeName,
  areaId,
  staffList,
  editLayout,
  onStaffDrop,
  viewDate,
  onStaffClick,
  getPlanVsReal,
}: {
  sedeName: string;
  areaId: string;
  staffList: AsistenciaStaffLiveState[];
  editLayout: boolean;
  onStaffDrop: (item: StaffDragItem, toIndex: number, toArea: string) => void;
  viewDate?: Date;
  onStaffClick?: (live: AsistenciaStaffLiveState) => void;
  getPlanVsReal?: (live: AsistenciaStaffLiveState) => TurnosPlanVsReal | undefined;
}) {
  const visibleStaff = staffList.filter((s) => !s.staff.isManager);

  return (
    <div className="flex flex-col gap-1 w-full items-center pt-1">
      {visibleStaff.length === 0 ? (
        <AreaStaffDropZone
          sedeName={sedeName}
          area={areaId}
          index={0}
          editLayout={editLayout}
          onDropStaff={onStaffDrop}
        >
          <div className="w-full rounded-xl border border-dashed border-border py-4 text-center text-xs text-muted-foreground dark:border-slate-700">
            {editLayout ? 'Soltar aquí' : 'Sin personal'}
          </div>
        </AreaStaffDropZone>
      ) : (
        visibleStaff.map((s, idx) => (
          <div key={s.staff.id} className="w-full flex flex-col items-center gap-1">
            <AreaStaffDropZone
              sedeName={sedeName}
              area={areaId}
              index={idx}
              editLayout={editLayout}
              onDropStaff={onStaffDrop}
            />
            <DraggableStaffCard
              live={s}
              sedeName={sedeName}
              area={areaId}
              index={idx}
              editLayout={editLayout}
              viewDate={viewDate}
              onStaffClick={onStaffClick}
              getPlanVsReal={getPlanVsReal}
            />
          </div>
        ))
      )}
      {visibleStaff.length > 0 ? (
        <AreaStaffDropZone
          sedeName={sedeName}
          area={areaId}
          index={visibleStaff.length}
          editLayout={editLayout}
          onDropStaff={onStaffDrop}
        />
      ) : null}
    </div>
  );
}

function SubAreaColumn({
  sub,
  sedeName,
  editLayout,
  onStaffDrop,
  viewDate,
  onStaffClick,
  getPlanVsReal,
}: {
  sub: AsistenciaLiveSubAreaBlock;
  sedeName: string;
  editLayout: boolean;
  onStaffDrop: (item: StaffDragItem, toIndex: number, toArea: string) => void;
  viewDate?: Date;
  onStaffClick?: (live: AsistenciaStaffLiveState) => void;
  getPlanVsReal?: (live: AsistenciaStaffLiveState) => TurnosPlanVsReal | undefined;
}) {
  return (
    <div className="w-full rounded-lg border border-border/80 bg-muted/30 p-2 dark:border-slate-700 dark:bg-slate-900/40">
      <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {sub.label}
      </p>
      <StaffAreaList
        sedeName={sedeName}
        areaId={sub.area}
        staffList={sub.staff}
        editLayout={editLayout}
        onStaffDrop={onStaffDrop}
        viewDate={viewDate}
        onStaffClick={onStaffClick}
        getPlanVsReal={getPlanVsReal}
      />
    </div>
  );
}

function DraggableAreaColumn({
  block,
  sedeName,
  editLayout,
  onAreaReorder,
  onStaffDrop,
  viewDate,
  onStaffClick,
  getPlanVsReal,
}: {
  block: AsistenciaLiveAreaBlock;
  sedeName: string;
  editLayout: boolean;
  onAreaReorder: (dragArea: string, hoverArea: string) => void;
  onStaffDrop: (item: StaffDragItem, toIndex: number, toArea: string) => void;
  viewDate?: Date;
  onStaffClick?: (live: AsistenciaStaffLiveState) => void;
  getPlanVsReal?: (live: AsistenciaStaffLiveState) => TurnosPlanVsReal | undefined;
}) {
  const headerRef = useRef<HTMLDivElement>(null);
  const theme = themeForColumnId(block.area);
  const Icon = theme.icon;
  const pct = block.totalCount > 0 ? Math.round((block.activeCount / block.totalCount) * 100) : 0;
  const hasSubAreas = (block.subAreas?.length ?? 0) > 0;

  const [{ isDraggingArea }, dragArea] = useDrag(
    () => ({
      type: DND_AREA,
      item: { sedeName, area: block.area } satisfies AreaDragItem,
      canDrag: editLayout,
      collect: (monitor) => ({ isDraggingArea: monitor.isDragging() }),
    }),
    [editLayout, sedeName, block.area]
  );

  const [, dropArea] = useDrop(
    () => ({
      accept: DND_AREA,
      drop(item: AreaDragItem) {
        if (!editLayout || item.sedeName !== sedeName || item.area === block.area) return;
        onAreaReorder(item.area, block.area);
      },
      canDrop: (item) => editLayout && item.sedeName === sedeName && item.area !== block.area,
    }),
    [editLayout, sedeName, block.area, onAreaReorder]
  );

  dragArea(dropArea(headerRef));

  return (
    <div className={`flex flex-col items-center ${isDraggingArea ? 'opacity-50' : ''}`}>
      <div
        ref={headerRef}
        className={`w-full rounded-xl border p-4 ${theme.card} ${theme.glow} ${
          editLayout ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-foreground/80" />
          <span className="font-semibold text-foreground">{block.label}</span>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Personal Activo {block.activeCount}/{block.totalCount}
        </p>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden dark:bg-slate-800">
          <div className={`h-full rounded-full transition-all ${theme.bar}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="h-4 w-px bg-border dark:bg-slate-700" />

      {hasSubAreas ? (
        <div className="flex w-full flex-col gap-2 px-1">
          {(block.subAreas ?? []).map((sub) => (
            <SubAreaColumn
              key={sub.area}
              sub={sub}
              sedeName={sedeName}
              editLayout={editLayout}
              onStaffDrop={onStaffDrop}
              viewDate={viewDate}
              onStaffClick={onStaffClick}
              getPlanVsReal={getPlanVsReal}
            />
          ))}
          {block.staff.length > 0 ? (
            <div className="w-full">
              <p className="mb-1 text-center text-[10px] text-muted-foreground">General</p>
              <StaffAreaList
                sedeName={sedeName}
                areaId={block.area}
                staffList={block.staff}
                editLayout={editLayout}
                onStaffDrop={onStaffDrop}
                viewDate={viewDate}
                onStaffClick={onStaffClick}
                getPlanVsReal={getPlanVsReal}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <StaffAreaList
          sedeName={sedeName}
          areaId={block.area}
          staffList={block.staff}
          editLayout={editLayout}
          onStaffDrop={onStaffDrop}
          viewDate={viewDate}
          onStaffClick={onStaffClick}
          getPlanVsReal={getPlanVsReal}
        />
      )}
    </div>
  );
}

type SedeBlockProps = {
  summary: AsistenciaLiveSedeSummary;
  editLayout: boolean;
  onPersistLayout: LayoutPersist;
  compact?: boolean;
  viewDate?: Date;
  onStaffClick?: (live: AsistenciaStaffLiveState) => void;
  getPlanVsReal?: (live: AsistenciaStaffLiveState) => TurnosPlanVsReal | undefined;
};

export function AsistenciaLiveSedeBlock({
  summary,
  editLayout,
  onPersistLayout,
  compact,
  viewDate,
  onStaffClick,
  getPlanVsReal,
}: SedeBlockProps) {
  const handleStaffDrop = useCallback(
    (item: StaffDragItem, toIndex: number, toArea: string) => {
      if (item.sedeName !== summary.sedeName) return;
      void onPersistLayout(
        (prev) =>
          applyStaffLayoutMove(prev, {
            sedeName: summary.sedeName,
            staffId: item.staffId,
            toArea,
            toIndex,
          }),
        'Layout actualizado.'
      );
    },
    [summary.sedeName, onPersistLayout]
  );

  const handleAreaReorder = useCallback(
    (dragArea: string, hoverArea: string) => {
      void onPersistLayout(
        (prev) => applyAreaLayoutReorder(prev, summary.sedeName, dragArea, hoverArea),
        'Columnas reordenadas.'
      );
    },
    [summary.sedeName, onPersistLayout]
  );

  return (
    <div className={compact ? 'pt-6 border-t border-border first:border-t-0 dark:border-slate-800 first:pt-0' : ''}>
      {compact ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">{summary.sedeName}</h3>
          <span className="text-xs text-emerald-400">{summary.workingCount} trabajando</span>
          <span className="text-xs text-red-400">{summary.absentCount} ausentes</span>
          {!summary.isOperational ? (
            <span className="text-xs text-amber-400">No operativa</span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col items-center">
        <div className="mb-2">
          {summary.manager ? (
            <StaffLiveCard
              name={summary.manager.staff.fullName}
              cargo={summary.manager.staff.cargoLabel}
              status={summary.manager.status}
              time={summary.manager.entradaFormat ?? summary.manager.staff.expectedTime}
              avatarUrl={summary.manager.staff.avatarUrl}
              critical={summary.manager.staff.isCritical}
              matchHint={summary.manager.matchHint}
              statusNote={summary.manager.statusNote}
              shiftLabel={shiftLabelForStaff(summary.manager.staff, viewDate)}
              onClick={!editLayout && onStaffClick ? () => onStaffClick(summary.manager!) : undefined}
              planVsReal={summary.manager && getPlanVsReal ? getPlanVsReal(summary.manager) : undefined}
            />
          ) : (
            <ManagerPlaceholder />
          )}
        </div>

        <div className="h-6 w-px bg-border dark:bg-slate-700" />
        <div className="h-px w-full max-w-3xl bg-border dark:bg-slate-700" />

        <div
          className="grid w-full max-w-5xl gap-6 mt-4"
          style={{
            gridTemplateColumns: `repeat(${Math.max(1, summary.areas.length)}, minmax(0, 1fr))`,
          }}
        >
          {summary.areas.map((block) => (
            <DraggableAreaColumn
              key={`${summary.sedeName}-${block.area}`}
              block={block}
              sedeName={summary.sedeName}
              editLayout={editLayout}
              onAreaReorder={handleAreaReorder}
              onStaffDrop={handleStaffDrop}
              viewDate={viewDate}
              onStaffClick={onStaffClick}
              getPlanVsReal={getPlanVsReal}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
