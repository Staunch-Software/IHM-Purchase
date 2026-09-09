import { useMemo, useRef, useState } from "react";

import { useDismiss } from "../../hooks/useDismiss.js";
import styles from "./DataTable.module.css";

/**
 * A small floating card that appears beneath the filter icon in a column header.
 *
 * filterType  → UI rendered
 * ──────────────────────────────────────────────────────────────────────────────
 * "text"      → plain text search input
 * "number"    → min / max number range
 * "date"      → From date / To date pickers  (range filter)
 * "select"    → searchable multi-checkbox dropdown from faceted unique values
 */
export function ColumnFilterPopover({ column, anchorRef, onClose }) {
  const popoverRef = useRef(null);
  const filterType = column.columnDef.meta?.filterType ?? "text";
  const currentValue = column.getFilterValue();

  // ── Local state per filter type ──────────────────────────────────────────
  const [localValue, setLocalValue] = useState(() => {
    if (filterType === "number") {
      const v = currentValue ?? {};
      return { min: v.min ?? "", max: v.max ?? "" };
    }
    if (filterType === "date") {
      const v = currentValue ?? {};
      return { from: v.from ?? "", to: v.to ?? "" };
    }
    // "select" → Set of selected string values
    if (filterType === "select") {
      return new Set(Array.isArray(currentValue) ? currentValue : []);
    }
    return currentValue ?? "";
  });

  // Search within the dropdown list for "select"
  const [optionSearch, setOptionSearch] = useState("");

  useDismiss(true, onClose, [popoverRef, anchorRef]);

  // ── Apply / Clear ────────────────────────────────────────────────────────
  function handleApply() {
    if (filterType === "number") {
      const min = localValue.min !== "" ? Number(localValue.min) : undefined;
      const max = localValue.max !== "" ? Number(localValue.max) : undefined;
      column.setFilterValue(min !== undefined || max !== undefined ? { min, max } : undefined);
    } else if (filterType === "date") {
      const { from, to } = localValue;
      column.setFilterValue(from || to ? { from: from || undefined, to: to || undefined } : undefined);
    } else if (filterType === "select") {
      const arr = [...localValue];
      column.setFilterValue(arr.length > 0 ? arr : undefined);
    } else {
      column.setFilterValue(localValue || undefined);
    }
    onClose();
  }

  function handleClear() {
    if (filterType === "number") setLocalValue({ min: "", max: "" });
    else if (filterType === "date") setLocalValue({ from: "", to: "" });
    else if (filterType === "select") setLocalValue(new Set());
    else setLocalValue("");
    column.setFilterValue(undefined);
    onClose();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleApply();
    if (e.key === "Escape") onClose();
  }

  // ── Faceted options for "select" ─────────────────────────────────────────
  // Sorted by count desc, then alpha. Memoized because it walks the row set.
  const allOptions = useMemo(() => {
    if (filterType !== "select") return [];
    return [...column.getFacetedUniqueValues().entries()]
      .filter(([v]) => v !== null && v !== undefined && v !== "")
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
  }, [column, filterType]);

  const filteredOptions = useMemo(() => {
    if (!optionSearch.trim()) return allOptions;
    const q = optionSearch.toLowerCase();
    return allOptions.filter(([v]) => String(v).toLowerCase().includes(q));
  }, [allOptions, optionSearch]);

  function toggleOption(val) {
    setLocalValue((prev) => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val);
      else next.add(val);
      return next;
    });
  }

  function selectAll() { setLocalValue(new Set(filteredOptions.map(([v]) => String(v)))); }
  function clearAll()  { setLocalValue(new Set()); }

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div
      ref={popoverRef}
      className={`${styles.filterPopover} ${filterType === "select" ? styles.filterPopoverSelect : ""}`}
      role="dialog"
      aria-label={`Filter ${column.columnDef.header}`}
    >
      <div className={styles.filterPopoverInner}>
        <span className={styles.filterPopoverTitle}>{String(column.columnDef.header)}</span>

        {/* ── TEXT ────────────────────────────────────────────────────────── */}
        {filterType === "text" && (
          <input
            autoFocus
            className={styles.filterPopoverInput}
            placeholder={`Search ${column.columnDef.header}…`}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        )}

        {/* ── NUMBER RANGE ────────────────────────────────────────────────── */}
        {filterType === "number" && (
          <div className={styles.filterPopoverRange}>
            <input
              autoFocus
              type="number"
              className={styles.filterPopoverInput}
              placeholder="Min"
              value={localValue.min}
              onChange={(e) => setLocalValue((v) => ({ ...v, min: e.target.value }))}
              onKeyDown={handleKeyDown}
            />
            <span className={styles.filterPopoverRangeSep}>–</span>
            <input
              type="number"
              className={styles.filterPopoverInput}
              placeholder="Max"
              value={localValue.max}
              onChange={(e) => setLocalValue((v) => ({ ...v, max: e.target.value }))}
              onKeyDown={handleKeyDown}
            />
          </div>
        )}

        {/* ── DATE RANGE ──────────────────────────────────────────────────── */}
        {filterType === "date" && (
          <div className={styles.filterDateRange}>
            <label className={styles.filterDateLabel}>
              <span className={styles.filterDateLabelText}>From</span>
              <input
                autoFocus
                type="date"
                className={styles.filterPopoverInput}
                value={localValue.from}
                onChange={(e) => setLocalValue((v) => ({ ...v, from: e.target.value }))}
                onKeyDown={handleKeyDown}
              />
            </label>
            <label className={styles.filterDateLabel}>
              <span className={styles.filterDateLabelText}>To</span>
              <input
                type="date"
                className={styles.filterPopoverInput}
                value={localValue.to}
                min={localValue.from || undefined}
                onChange={(e) => setLocalValue((v) => ({ ...v, to: e.target.value }))}
                onKeyDown={handleKeyDown}
              />
            </label>
          </div>
        )}

        {/* ── MULTI-CHECKBOX SELECT ────────────────────────────────────────── */}
        {filterType === "select" && (
          <div className={styles.filterSelectWrap}>
            {/* Search within options */}
            <input
              autoFocus
              className={`${styles.filterPopoverInput} ${styles.filterSelectSearch}`}
              placeholder="Search options…"
              value={optionSearch}
              onChange={(e) => setOptionSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
            />

            {/* Select-all / Clear-all micro-bar */}
            <div className={styles.filterSelectBar}>
              <button type="button" className={styles.filterSelectBarBtn} onClick={selectAll}>
                All
              </button>
              <span className={styles.filterSelectBarSep} />
              <button type="button" className={styles.filterSelectBarBtn} onClick={clearAll}>
                None
              </button>
              {localValue.size > 0 && (
                <span className={styles.filterSelectCount}>{localValue.size} selected</span>
              )}
            </div>

            {/* Option list */}
            <div className={styles.filterSelectList} role="listbox" aria-multiselectable="true">
              {filteredOptions.length === 0 ? (
                <span className={styles.filterSelectEmpty}>No options</span>
              ) : (
                filteredOptions.map(([value, count]) => {
                  const str = String(value);
                  const checked = localValue.has(str);
                  return (
                    <label key={str} className={`${styles.filterSelectItem} ${checked ? styles.filterSelectItemChecked : ""}`}>
                      <input
                        type="checkbox"
                        className={styles.filterSelectCheckbox}
                        checked={checked}
                        onChange={() => toggleOption(str)}
                      />
                      <span className={styles.filterSelectItemLabel}>{str}</span>
                      <span className={styles.filterSelectItemCount}>{count.toLocaleString()}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        <div className={styles.filterPopoverActions}>
          <button type="button" className={styles.filterPopoverClear} onClick={handleClear}>
            Clear
          </button>
          <button type="button" className={styles.filterPopoverApply} onClick={handleApply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
