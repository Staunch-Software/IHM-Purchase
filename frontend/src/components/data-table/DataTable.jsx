import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ColumnVisibilityMenu } from "./ColumnVisibilityMenu.jsx";
import styles from "./DataTable.module.css";
import { DraggableColumnHeader, PinnedColumnHeader } from "./DraggableColumnHeader.jsx";
import { TablePagination } from "./TablePagination.jsx";

const STORAGE_KEY_PREFIX = "ihm_purchase_column_order:";
const VISIBILITY_STORAGE_KEY_PREFIX = "ihm_purchase_column_visibility:";
const PAGE_SIZE_OPTIONS = [10, 50, 100];
const DEFAULT_PAGE_SIZE = 50;

function loadColumnOrder(storageKey, columns) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_PREFIX + storageKey) || "null");
    const ids = columns.map((c) => c.id);
    if (saved && Array.isArray(saved) && saved.every((id) => ids.includes(id))) {
      return saved;
    }
  } catch {
    /* ignore malformed storage */
  }
  return columns.map((c) => c.id);
}

function loadColumnVisibility(storageKey, columns, defaultVisibleColumns) {
  try {
    const saved = JSON.parse(localStorage.getItem(VISIBILITY_STORAGE_KEY_PREFIX + storageKey) || "null");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      return saved;
    }
  } catch {
    /* ignore malformed storage */
  }
  if (!defaultVisibleColumns) return {};
  return Object.fromEntries(columns.map((c) => [c.id, defaultVisibleColumns.includes(c.id)]));
}

/**
 * Custom filter function for number ranges: { min, max }
 */
function numberRangeFilter(row, columnId, filterValue) {
  const val = row.getValue(columnId);
  const num = Number(val);
  if (Number.isNaN(num)) return false;
  const { min, max } = filterValue ?? {};
  if (min !== undefined && num < min) return false;
  if (max !== undefined && num > max) return false;
  return true;
}
numberRangeFilter.autoRemove = (val) => !val || (val.min === undefined && val.max === undefined);

/**
 * Custom filter function for date ranges: { from, to } — both ISO strings.
 * The raw cell value is also an ISO date string (or parseable date).
 */
function dateRangeFilter(row, columnId, filterValue) {
  const raw = row.getValue(columnId);
  if (!raw) return false;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return false;
  const { from, to } = filterValue ?? {};
  if (from) {
    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    if (date < fromDate) return false;
  }
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    if (date > toDate) return false;
  }
  return true;
}
dateRangeFilter.autoRemove = (val) => !val || (!val.from && !val.to);

/**
 * Custom filter function for multi-value select: string[]
 * An empty array means "show all".
 */
function multiSelectFilter(row, columnId, filterValue) {
  if (!filterValue || filterValue.length === 0) return true;
  const val = row.getValue(columnId);
  return filterValue.includes(String(val ?? ""));
}
multiSelectFilter.autoRemove = (val) => !val || val.length === 0;

export function DataTable({
  columns,
  data,
  onRowClick,
  storageKey = "default",
  isLoading,
  defaultVisibleColumns,
  pinnedLeft = [],
  rowLabelKey,
  hideToolbar = false,
  onTableReady,
  onStateChange,
}) {
  const [columnOrder, setColumnOrder] = useState(() => loadColumnOrder(storageKey, columns));
  const [columnFilters, setColumnFilters] = useState([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE });
  const [scrolledX, setScrolledX] = useState(false);

  // Column visibility: start with saved preferences or default set
  const [columnVisibility, setColumnVisibility] = useState(() => 
    loadColumnVisibility(storageKey, columns, defaultVisibleColumns)
  );

  useEffect(() => {
    setColumnOrder(loadColumnOrder(storageKey, columns));
    setColumnVisibility(loadColumnVisibility(storageKey, columns, defaultVisibleColumns));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Build column defs: attach the right filterFn per filter type.
  // `select` gets exact matching — the default `auto` resolves to
  // `includesString`, which would make "Approved" also match "Partially
  // Approved". A column may still override by declaring its own filterFn.
  const columnDefs = useMemo(
    () =>
      columns.map((col) => {
        if (col.meta?.filterType === "number") return { ...col, filterFn: numberRangeFilter };
        if (col.meta?.filterType === "date")   return { ...col, filterFn: dateRangeFilter };
        if (col.meta?.filterType === "select") return { ...col, filterFn: multiSelectFilter };
        return col;
      }),
    [columns]
  );

  const table = useReactTable({
    data: data ?? [],
    columns: columnDefs,
    // Pinning never changes, so it is uncontrolled — useReactTable merges
    // { ...internalState, ...options.state }, making partial control the
    // documented path. Header groups and row.getVisibleCells() both re-split
    // the ordered leaf list into [...left, ...center], which is what keeps the
    // pinned column at index 0 no matter how the rest is dragged around.
    initialState: { columnPinning: { left: pinnedLeft, right: [] } },
    state: { columnOrder, columnFilters, globalFilter, sorting, columnVisibility, pagination },
    onColumnOrderChange: (updater) => {
      setColumnOrder((old) => {
        const next = typeof updater === "function" ? updater(old) : updater;
        localStorage.setItem(STORAGE_KEY_PREFIX + storageKey, JSON.stringify(next));
        onStateChange?.();
        return next;
      });
    },
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnVisibilityChange: (updater) => {
      setColumnVisibility((old) => {
        const next = typeof updater === "function" ? updater(old) : updater;
        localStorage.setItem(VISIBILITY_STORAGE_KEY_PREFIX + storageKey, JSON.stringify(next));
        onStateChange?.();
        return next;
      });
    },
    onPaginationChange: setPagination,
    columnResizeMode: "onChange",
    // Without this, getFirstSortDir() falls through to getAutoSortDir(), which
    // returns "asc" only when the first filtered row's value is a string — so
    // numeric columns would start descending and the direction would flip as
    // filters changed which row came first.
    sortDescFirst: false,
    enableSortingRemoval: true,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    // Faceting costs nothing until a popover actually calls it: createColumn
    // only assigns memoized closures, so no row is touched at build time.
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  // Expose the table instance to parent when requested (e.g. to render
  // ColumnVisibilityMenu in the page-level control bar)
  useEffect(() => { onTableReady?.(table); }, [table, onTableReady]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setColumnOrder((old) => {
      const oldIndex = old.indexOf(active.id);
      const newIndex = old.indexOf(over.id);
      const next = arrayMove(old, oldIndex, newIndex);
      localStorage.setItem(STORAGE_KEY_PREFIX + storageKey, JSON.stringify(next));
      return next;
    });
  }

  const rows = table.getRowModel().rows;
  const scrollRef = useRef(null);

  // Only the draggable (centre) columns belong in SortableContext. Passing the
  // full column order would hand the strategy ids with no rendered <th>, and it
  // measures a rect per index — missing rects produce wrong drag offsets.
  const sortableIds = useMemo(
    () => table.getCenterVisibleLeafColumns().map((c) => c.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, columnOrder, columnVisibility]
  );

  // New page starts at the top; horizontal position is deliberately kept so
  // paging while scrolled right doesn't yank the view back to column 1.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pagination.pageIndex]);

  const headerGroup = table.getHeaderGroups()[0];
  const visibleColumnCount = headerGroup.headers.length;
  const activeFilterCount = columnFilters.length;
  const hiddenCount = columns.length - table.getVisibleLeafColumns().length;

  // Expose column menu via portal when toolbar is hidden
  const columnsMenu = (
    <ColumnVisibilityMenu
      table={table}
      hiddenCount={hiddenCount}
      lockedIds={pinnedLeft}
      totalCount={columns.length}
      defaultVisibleColumns={defaultVisibleColumns}
    />
  );

  return (
    <div className={styles.wrapper}>
      {!hideToolbar ? (
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.searchWrap}>
            <Search size={14} strokeWidth={1.75} className={styles.searchIcon} aria-hidden="true" />
            <input
              className={styles.globalSearch}
              placeholder="Search purchase orders…"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              aria-label="Search purchase orders"
            />
            {globalFilter && (
              <button
                type="button"
                className={styles.searchClear}
                onClick={() => setGlobalFilter("")}
                aria-label="Clear search"
              >
                <X size={13} strokeWidth={2} />
              </button>
            )}
          </div>

          {activeFilterCount > 0 && (
            <button type="button" className={styles.clearFiltersBtn} onClick={() => setColumnFilters([])}>
              <X size={12} strokeWidth={2} />
              Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
            </button>
          )}
        </div>

        <div className={styles.toolbarRight}>
          {columnsMenu}
        </div>
      </div>
      ) : (
      /* Slim columns-only bar when the page handles filters itself */
      <div className={styles.toolbarSlim}>
        <div className={styles.toolbarRight}>
          {columnsMenu}
        </div>
      </div>
      )}

      {/* DndContext must wrap the <table>, not sit inside it: dnd-kit renders
          a hidden accessibility <div>, which is invalid DOM as a child of
          <table> and triggers a React validateDOMNesting warning. */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div
          ref={scrollRef}
          className={styles.scrollContainer}
          onScroll={(e) => {
            const next = e.currentTarget.scrollLeft > 0;
            setScrolledX((prev) => (prev === next ? prev : next));
          }}
        >
          <table
            className={`${styles.table} ${scrolledX ? styles.scrolledX : ""}`}
            style={{ width: table.getTotalSize() }}
          >
            <thead className={styles.thead}>
              <tr>
                <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
                  {headerGroup.headers.map((header) =>
                    header.column.getIsPinned() === "left" ? (
                      <PinnedColumnHeader key={header.id} header={header} />
                    ) : (
                      <DraggableColumnHeader key={header.id} header={header} />
                    )
                  )}
                </SortableContext>
              </tr>
            </thead>

            <tbody>
              {isLoading &&
                Array.from({ length: 12 }).map((_, rowIdx) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <tr key={`skeleton-${rowIdx}`} className={styles.skeletonRow}>
                    {headerGroup.headers.map((header) => (
                      <td
                        key={header.id}
                        className={
                          header.column.getIsPinned() === "left"
                            ? `${styles.td} ${styles.tdPinned}`
                            : styles.td
                        }
                        style={{ width: header.getSize() }}
                      >
                        <span className={styles.skeletonBar} />
                      </td>
                    ))}
                  </tr>
                ))}

              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={visibleColumnCount} className={styles.emptyState}>
                    <Search size={22} strokeWidth={1.5} className={styles.emptyIcon} aria-hidden="true" />
                    <span className={styles.emptyTitle}>No purchase orders</span>
                    <span className={styles.emptyText}>
                      {activeFilterCount > 0 || globalFilter
                        ? "No purchase orders match your current filters."
                        : "There is nothing to show yet."}
                    </span>
                    {(activeFilterCount > 0 || globalFilter) && (
                      <button
                        type="button"
                        className={styles.emptyAction}
                        onClick={() => {
                          setColumnFilters([]);
                          setGlobalFilter("");
                        }}
                      >
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              )}

              {!isLoading &&
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={styles.tr}
                    tabIndex={0}
                    role="button"
                    aria-label={
                      rowLabelKey ? `Open ${row.getValue(rowLabelKey)}` : "Open row details"
                    }
                    onClick={() => onRowClick?.(row.original)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick?.(row.original);
                      }
                    }}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const value = cell.getValue();
                      const pinned = cell.column.getIsPinned() === "left";
                      const numeric = cell.column.columnDef.meta?.filterType === "number";
                      return (
                        <td
                          key={cell.id}
                          style={
                            pinned
                              ? { width: cell.column.getSize(), left: cell.column.getStart("left") }
                              : { width: cell.column.getSize() }
                          }
                          className={[
                            styles.td,
                            pinned ? styles.tdPinned : "",
                            numeric ? styles.tdNumeric : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          title={typeof value === "string" ? value : undefined}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </DndContext>

      <TablePagination
        pageIndex={pagination.pageIndex}
        pageSize={pagination.pageSize}
        pageCount={table.getPageCount()}
        rowCount={table.getRowCount()}
        totalRowCount={data?.length ?? 0}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageChange={table.setPageIndex}
        onPageSizeChange={table.setPageSize}
      />
    </div>
  );
}
