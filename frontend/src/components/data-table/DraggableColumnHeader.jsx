import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { flexRender } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, Filter, GripVertical } from "lucide-react";
import { useRef, useState } from "react";

import { ColumnFilterPopover } from "./ColumnFilterPopover.jsx";
import styles from "./DataTable.module.css";

function SortIcon({ direction }) {
  if (direction === "asc") {
    return <ArrowUp size={12} strokeWidth={2} className={styles.sortIconActive} aria-hidden="true" />;
  }
  if (direction === "desc") {
    return <ArrowDown size={12} strokeWidth={2} className={styles.sortIconActive} aria-hidden="true" />;
  }
  // Neutral affordance — only revealed on hover, so 60+ headers stay calm.
  return <ChevronsUpDown size={12} strokeWidth={1.75} className={styles.sortIcon} aria-hidden="true" />;
}

/**
 * The interior of a header cell, shared by the pinned and draggable variants.
 * `draggable` is false for the pinned column: it can't be reordered, so it
 * gets no grip and no drag listeners.
 */
function HeaderContent({ header, dragAttributes, dragListeners, filterOpen, setFilterOpen }) {
  const filterBtnRef = useRef(null);

  // Only meaningful while multi-sorting — a lone "1" next to the arrow on a
  // single sort is noise.
  const sortCount = header.getContext().table.getState().sorting.length;
  const sortIndex = sortCount > 1 ? header.column.getSortIndex() + 1 : 0;

  const canSort = header.column.getCanSort();
  const canFilter = !!header.column.columnDef.meta?.filterType;
  const sortDirection = header.column.getIsSorted(); // false | "asc" | "desc"
  const isFiltered = header.column.getIsFiltered();
  const toggleSort = header.column.getToggleSortingHandler();

  function handleHeaderClick(e) {
    // Clicks that originate in the grip or the filter button are not sorts.
    // Matched on a data attribute rather than hashed CSS-module class names.
    if (e.target.closest?.("[data-no-sort]")) return;
    // getToggleSortingHandler owns the whole none → asc → desc → none cycle
    // *and* forwards shift-click as a multi-sort event.
    toggleSort?.(e);
  }

  return (
    <>
      <div
        className={`${styles.thInner} ${canSort ? styles.thSortable : ""}`}
        onClick={handleHeaderClick}
        title={canSort ? "Click to sort · Shift-click to add to sort" : undefined}
      >
        {dragListeners && (
          <span
            className={styles.dragHandle}
            data-no-sort=""
            {...dragAttributes}
            {...dragListeners}
            title="Drag to reorder"
          >
            <GripVertical size={12} strokeWidth={1.75} />
          </span>
        )}

        {/* title attr is a fallback tooltip for when a column is resized
            below its label's width */}
        <span className={styles.thLabel} title={String(header.column.columnDef.header)}>
          {flexRender(header.column.columnDef.header, header.getContext())}
        </span>

        {canSort && (
          <span className={styles.sortSlot}>
            <SortIcon direction={sortDirection} />
            {sortIndex > 0 && <span className={styles.sortIndex}>{sortIndex}</span>}
          </span>
        )}

        {canFilter && (
          <button
            ref={filterBtnRef}
            type="button"
            data-no-sort=""
            className={`${styles.filterBtn} ${isFiltered || filterOpen ? styles.filterBtnActive : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setFilterOpen((v) => !v);
            }}
            title="Filter this column"
            aria-haspopup="dialog"
            aria-expanded={filterOpen}
          >
            <Filter
              size={12}
              strokeWidth={1.75}
              fill={isFiltered ? "currentColor" : "none"}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      {filterOpen && (
        <ColumnFilterPopover
          column={header.column}
          anchorRef={filterBtnRef}
          onClose={() => setFilterOpen(false)}
        />
      )}

      <div
        onMouseDown={header.getResizeHandler()}
        onTouchStart={header.getResizeHandler()}
        className={styles.resizer}
      />
    </>
  );
}

/**
 * The left-pinned header. Deliberately does NOT call useSortable: that hook
 * writes `transform: translate3d(...)` into the same inline style that has to
 * carry `position: sticky`, and the two fight each other.
 */
export function PinnedColumnHeader({ header }) {
  // Held here rather than inside HeaderContent so the <th> can lift itself
  // above its siblings while its popover is open.
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <th
      style={{
        width: header.getSize(),
        position: "sticky",
        left: header.column.getStart("left"),
      }}
      className={`${styles.th} ${styles.thPinned} ${filterOpen ? styles.thPopoverOpen : ""}`}
    >
      <HeaderContent header={header} filterOpen={filterOpen} setFilterOpen={setFilterOpen} />
    </th>
  );
}

export function DraggableColumnHeader({ header }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: header.column.id,
  });

  const [filterOpen, setFilterOpen] = useState(false);

  const style = {
    width: header.getSize(),
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    position: "relative",
  };

  const elevation = isDragging ? styles.thDragging : filterOpen ? styles.thPopoverOpen : "";

  return (
    <th ref={setNodeRef} style={style} className={`${styles.th} ${elevation}`}>
      <HeaderContent
        header={header}
        dragAttributes={attributes}
        dragListeners={listeners}
        filterOpen={filterOpen}
        setFilterOpen={setFilterOpen}
      />
    </th>
  );
}
