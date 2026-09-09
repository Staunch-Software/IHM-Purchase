import { Columns3, Search } from "lucide-react";
import { useRef, useState } from "react";

import { useDismiss } from "../../hooks/useDismiss.js";
import styles from "./ColumnVisibilityMenu.module.css";

/**
 * @param {string[]} lockedIds Columns that can't be hidden — kept in sync with
 *   the table's pinned set rather than hardcoded, so the two can't drift.
 */
export function ColumnVisibilityMenu({ table, hiddenCount, lockedIds = [], totalCount, defaultVisibleColumns }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);

  useDismiss(open, () => setOpen(false), [containerRef]);

  const allColumns = table.getAllLeafColumns().filter((c) => !lockedIds.includes(c.id));
  const visibleCount = table.getVisibleLeafColumns().length;
  const filtered = search
    ? allColumns.filter((c) => (c.columnDef.header || c.id).toLowerCase().includes(search.toLowerCase()))
    : allColumns;

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={open ? styles.triggerOpen : styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Columns3 size={14} strokeWidth={1.75} className={styles.triggerIcon} aria-hidden="true" />
        Columns
        <span className={styles.badge}>
          {visibleCount}/{totalCount ?? allColumns.length + lockedIds.length}
        </span>
      </button>

      {open && (
        <div className={styles.panel} role="menu">
          <div className={styles.panelHeader}>
            <div className={styles.searchWrap}>
              <Search size={13} strokeWidth={1.75} className={styles.searchIcon} aria-hidden="true" />
              <input
                className={styles.search}
                placeholder="Search columns…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className={styles.panelActions}>
              <button
                type="button"
                className={styles.textButton}
                onClick={() => table.toggleAllColumnsVisible(true)}
              >
                Select all
              </button>
              <span className={styles.actionDivider} aria-hidden="true" />
              <button
                type="button"
                className={styles.textButton}
                onClick={() => {
                  // Locked columns must survive "Clear all", so set visibility
                  // explicitly rather than calling toggleAllColumnsVisible(false).
                  table.setColumnVisibility(
                    Object.fromEntries(
                      table.getAllLeafColumns().map((c) => [c.id, lockedIds.includes(c.id)])
                    )
                  );
                }}
              >
                Clear all
              </button>
              {defaultVisibleColumns && (
                <>
                  <span className={styles.actionDivider} aria-hidden="true" />
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={() => {
                      table.setColumnVisibility(
                        Object.fromEntries(
                          table.getAllLeafColumns().map((c) => [
                            c.id,
                            defaultVisibleColumns.includes(c.id) || lockedIds.includes(c.id)
                          ])
                        )
                      );
                    }}
                  >
                    Default
                  </button>
                </>
              )}
            </div>
          </div>

          <div className={styles.list}>
            {filtered.map((column) => (
              <label key={column.id} className={styles.item}>
                <input
                  type="checkbox"
                  checked={column.getIsVisible()}
                  onChange={column.getToggleVisibilityHandler()}
                />
                <span>{column.columnDef.header || column.id}</span>
              </label>
            ))}
            {filtered.length === 0 && <p className={styles.empty}>No columns match “{search}”.</p>}
          </div>

          {hiddenCount > 0 && (
            <div className={styles.panelFooter}>
              {hiddenCount} column{hiddenCount === 1 ? "" : "s"} hidden
            </div>
          )}
        </div>
      )}
    </div>
  );
}
