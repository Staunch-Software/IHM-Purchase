import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import styles from "./TablePagination.module.css";

/**
 * Build a compact page window that always shows first, last and current ± span,
 * collapsing the rest into ellipses: [0, "…", 4, 5, 6, "…", 24]
 */
function pageWindow(pageIndex, pageCount, span = 1) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i);

  const pages = new Set([0, pageCount - 1]);
  for (let i = pageIndex - span; i <= pageIndex + span; i += 1) {
    if (i > 0 && i < pageCount - 1) pages.add(i);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ["…", p] : [p]));
}

/**
 * Purely presentational — takes numbers, not a table instance, so any table in
 * the app can reuse it.
 */
export function TablePagination({
  pageIndex,
  pageSize,
  pageCount,
  rowCount,
  totalRowCount,
  pageSizeOptions = [10, 50, 100],
  onPageChange,
  onPageSizeChange,
}) {
  const first = rowCount === 0 ? 0 : pageIndex * pageSize + 1;
  const last = Math.min((pageIndex + 1) * pageSize, rowCount);
  const isFiltered = typeof totalRowCount === "number" && totalRowCount > rowCount;

  const atStart = pageIndex <= 0;
  const atEnd = pageIndex >= pageCount - 1;

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <label className={styles.sizeLabel}>
          <span className={styles.sizeText}>Rows</span>
          <select
            className={styles.sizeSelect}
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Rows per page"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <span className={styles.divider} aria-hidden="true" />

        <span className={styles.summary}>
          Showing <b>{first.toLocaleString()}</b>–<b>{last.toLocaleString()}</b> of{" "}
          <b>{rowCount.toLocaleString()}</b>
          {isFiltered && (
            <span className={styles.filteredNote}> (filtered from {totalRowCount.toLocaleString()})</span>
          )}
        </span>
      </div>

      {pageCount > 1 && (
        <nav className={styles.pager} aria-label="Pagination">
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => onPageChange(0)}
            disabled={atStart}
            aria-label="First page"
          >
            <ChevronsLeft size={15} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => onPageChange(pageIndex - 1)}
            disabled={atStart}
            aria-label="Previous page"
          >
            <ChevronLeft size={15} strokeWidth={1.75} />
          </button>

          <div className={styles.pageList}>
            {pageWindow(pageIndex, pageCount).map((page, i) =>
              page === "…" ? (
                // eslint-disable-next-line react/no-array-index-key
                <span key={`gap-${i}`} className={styles.ellipsis} aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  key={page}
                  type="button"
                  className={page === pageIndex ? styles.pageBtnActive : styles.pageBtn}
                  onClick={() => onPageChange(page)}
                  aria-current={page === pageIndex ? "page" : undefined}
                  aria-label={`Page ${page + 1}`}
                >
                  {page + 1}
                </button>
              )
            )}
          </div>

          <button
            type="button"
            className={styles.navBtn}
            onClick={() => onPageChange(pageIndex + 1)}
            disabled={atEnd}
            aria-label="Next page"
          >
            <ChevronRight size={15} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => onPageChange(pageCount - 1)}
            disabled={atEnd}
            aria-label="Last page"
          >
            <ChevronsRight size={15} strokeWidth={1.75} />
          </button>
        </nav>
      )}
    </div>
  );
}
