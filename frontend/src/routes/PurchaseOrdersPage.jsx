import { useCallback, useMemo, useState } from "react";
import { ClipboardList, Search, Ship, Tag, X, FileText, Anchor, Download } from "lucide-react";

import { DataTable } from "../components/data-table/DataTable.jsx";
import { ColumnVisibilityMenu } from "../components/data-table/ColumnVisibilityMenu.jsx";
import { Select } from "../components/ui/Select.jsx";
import { DEFAULT_VISIBLE_COLUMNS, poColumns } from "../components/data-table/columns/poColumns.js";
import { PODetailSheet } from "../components/po-detail/PODetailSheet.jsx";
import { usePurchaseOrders } from "../hooks/usePurchaseOrders.js";
import { useAuth } from "../lib/auth.jsx";
import styles from "./PurchaseOrdersPage.module.css";

export function PurchaseOrdersPage() {
  const { data, isLoading } = usePurchaseOrders();
  const { user } = useAuth();
  const [selectedPoNumber, setSelectedPoNumber] = useState(null);
  const [poFilter, setPoFilter]             = useState("");
  const [vesselFilter, setVesselFilter]     = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  
  const defaultCreatedDateFrom = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  }, []);

  const [createdDateFrom, setCreatedDateFrom] = useState(defaultCreatedDateFrom);
  const [createdDateTo, setCreatedDateTo] = useState("");
  const [tableInstance, setTableInstance]   = useState(null);
  const [, setTableUpdateTick] = useState(0);

  const rows = data?.items;

  const handleRowClick     = useCallback((row) => setSelectedPoNumber(row.po_number), []);
  const handleCloseSheet   = useCallback(() => setSelectedPoNumber(null), []);
  const handleClearFilters = useCallback(() => {
    setPoFilter(""); setVesselFilter(""); setCategoryFilter("");
    setCreatedDateFrom(defaultCreatedDateFrom); setCreatedDateTo("");
  }, [defaultCreatedDateFrom]);
  const handleTableReady = useCallback((t) => setTableInstance(t), []);

  const handleExport = useCallback(async () => {
    if (!tableInstance) return;
    const ExcelJSModule = await import("exceljs/dist/exceljs.min.js");
    const ExcelJS = ExcelJSModule.default || window.ExcelJS;
    const visibleColumns = tableInstance.getVisibleLeafColumns();
    const exportRows = tableInstance.getPrePaginationRowModel().rows;

    const headers = visibleColumns.map(c => String(c.columnDef.header || c.id));
    const dataRows = exportRows.map(row =>
      visibleColumns.map(c => {
        const val = row.getValue(c.id);
        return val === null || val === undefined ? "" : val;
      })
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "IHM-Purchase";
    const sheet = workbook.addWorksheet("Purchase Orders", {
      views: [{ state: "frozen", ySplit: 1 }],  // freeze header row
    });

    // ── Column definitions with auto-fit widths ──────────────────────────────
    sheet.columns = headers.map((h, colIdx) => {
      const maxLen = Math.max(
        h.length,
        ...dataRows.map(row => String(row[colIdx] ?? "").length)
      );
      return { header: h, key: String(colIdx), width: Math.min(maxLen + 3, 42) };
    });

    // ── Style the header row (row 1) ─────────────────────────────────────────
    const headerRow = sheet.getRow(1);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0B2A45" },   // deep navy — matches app brand
      };
      cell.font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
        size: 11,
        name: "Calibri",
      };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: false };
      cell.border = {
        top:    { style: "thin",   color: { argb: "FF1A9BB5" } },
        bottom: { style: "medium", color: { argb: "FF12A7BC" } },  // teal accent
        left:   { style: "thin",   color: { argb: "FF1A4A6A" } },
        right:  { style: "thin",   color: { argb: "FF1A4A6A" } },
      };
    });

    // ── Add data rows with alternating tint ──────────────────────────────────
    dataRows.forEach((rowData, rowIdx) => {
      const row = sheet.addRow(rowData);
      row.height = 18;
      const bgArgb = rowIdx % 2 === 0 ? "FFFFFFFF" : "FFF0F7FA";
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
        cell.font = { size: 10, name: "Calibri" };
        cell.alignment = { vertical: "middle" };
        cell.border = {
          top:    { style: "hair", color: { argb: "FFD0DDE8" } },
          bottom: { style: "hair", color: { argb: "FFD0DDE8" } },
          left:   { style: "hair", color: { argb: "FFD0DDE8" } },
          right:  { style: "hair", color: { argb: "FFD0DDE8" } },
        };
      });
    });

    // ── Download as .xlsx ─────────────────────────────────────────────────────
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toISOString().split("T")[0];
    link.href = url;
    link.download = `purchase_orders_${today}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [tableInstance]);

  const vesselOptions = useMemo(() => {
    if (!rows?.length) return [{ value: "", label: "All Vessels" }];
    const unique = [...new Set(rows.map((r) => r.vessel).filter(Boolean))].sort();
    return [{ value: "", label: "All Vessels" }, ...unique.map(v => ({ value: v, label: v }))];
  }, [rows]);

  const categoryOptions = useMemo(() => {
    if (!rows?.length) return [{ value: "", label: "All Categories" }];
    const unique = [...new Set(rows.map((r) => r.category).filter(Boolean))].sort();
    return [{ value: "", label: "All Categories" }, ...unique.map(c => ({ value: c, label: c }))];
  }, [rows]);

  const stats = useMemo(() => {
    if (!rows?.length) return null;
    const vessels    = new Set(rows.map((r) => r.vessel).filter(Boolean));
    return { count: rows.length, vessels: vessels.size };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!rows) return rows;
    return rows.filter((r) => {
      if (poFilter       && !String(r.po_number ?? "").toLowerCase().includes(poFilter.toLowerCase())) return false;
      if (vesselFilter   && r.vessel   !== vesselFilter)   return false;
      if (categoryFilter && r.category !== categoryFilter) return false;
      
      if (createdDateFrom || createdDateTo) {
        if (!r.created_on) return false;
        const rowDate = new Date(r.created_on);
        
        if (createdDateFrom) {
          const fromDate = new Date(createdDateFrom);
          if (rowDate < fromDate) return false;
        }
        if (createdDateTo) {
          const toDate = new Date(createdDateTo);
          toDate.setHours(23, 59, 59, 999);
          if (rowDate > toDate) return false;
        }
      }
      return true;
    });
  }, [rows, poFilter, vesselFilter, categoryFilter, createdDateFrom, createdDateTo]);

  const isFiltered = 
    poFilter !== "" || 
    vesselFilter !== "" || 
    categoryFilter !== "" || 
    (createdDateFrom !== "" && createdDateFrom !== defaultCreatedDateFrom) || 
    createdDateTo !== "";

  const activeCount = [
    poFilter !== "",
    vesselFilter !== "",
    categoryFilter !== "",
    createdDateFrom !== "" && createdDateFrom !== defaultCreatedDateFrom,
    createdDateTo !== ""
  ].filter(Boolean).length;

  const hiddenCount = tableInstance
    ? poColumns.length - tableInstance.getVisibleLeafColumns().length
    : 0;

  return (
    <div className={styles.page}>

      {/* ══ PAGE HEADER ════════════════════════════════════════════════════ */}
      <header className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.iconBadge}>
            <ClipboardList size={22} strokeWidth={1.75} />
          </div>
          <div className={styles.titleBlock}>
            <h1 className={styles.pageTitle}>Purchase Orders</h1>
            <p className={styles.pageSubtitle}>Fleet-wide procurement — view, filter and review all orders</p>
          </div>
        </div>

        {stats && (
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <FileText size={16} strokeWidth={1.75} />
              </div>
              <div className={styles.statText}>
                <span className={styles.statNum}>{stats.count.toLocaleString()}</span>
                <span className={styles.statLbl}>Total Orders</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <Anchor size={16} strokeWidth={1.75} />
              </div>
              <div className={styles.statText}>
                <span className={styles.statNum}>{stats.vessels.toLocaleString()}</span>
                <span className={styles.statLbl}>Vessels</span>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ══ CONTROL BAR ════════════════════════════════════════════════════ */}
      <div className={styles.controlBar}>

        {/* Search */}
        <div className={styles.searchWrap}>
          <Search size={14} strokeWidth={1.75} className={styles.searchIcon} aria-hidden="true" />
          <input
            className={`${styles.searchInput} ${poFilter ? styles.searchActive : ""}`}
            type="text"
            placeholder="Search by PO number…"
            value={poFilter}
            onChange={(e) => setPoFilter(e.target.value)}
            aria-label="Search PO number"
          />
          {poFilter && (
            <button type="button" className={styles.searchClear} onClick={() => setPoFilter("")} aria-label="Clear search">
              <X size={11} strokeWidth={2.5} />
            </button>
          )}
        </div>

        <span className={styles.sep} />

        {/* Vessel filter */}
        <Select
          value={vesselFilter}
          onChange={setVesselFilter}
          options={vesselOptions}
          icon={<Ship size={13} strokeWidth={1.75} />}
          isActive={!!vesselFilter}
        />

        {/* Category filter */}
        <Select
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={categoryOptions}
          icon={<Tag size={13} strokeWidth={1.75} />}
          isActive={!!categoryFilter}
        />

        {/* Created Date From */}
        <div className={styles.dateFilterGroup}>
          <label className={styles.dateFilterLabel}>Created Date From</label>
          <input
            type="date"
            className={`${styles.searchInput} ${createdDateFrom ? styles.searchActive : ""}`}
            value={createdDateFrom}
            onChange={(e) => setCreatedDateFrom(e.target.value)}
            aria-label="Created Date From"
            style={{ paddingLeft: "12px", paddingRight: "12px", minWidth: "150px" }}
          />
        </div>

        {/* Created Date To */}
        <div className={styles.dateFilterGroup}>
          <label className={styles.dateFilterLabel}>Created Date To</label>
          <input
            type="date"
            className={`${styles.searchInput} ${createdDateTo ? styles.searchActive : ""}`}
            value={createdDateTo}
            onChange={(e) => setCreatedDateTo(e.target.value)}
            aria-label="Created Date To"
            style={{ paddingLeft: "12px", paddingRight: "12px", minWidth: "150px" }}
          />
        </div>

        {/* Clear */}
        {isFiltered && (
          <>
            <span className={styles.sep} />
            <button type="button" className={styles.clearBtn} onClick={handleClearFilters}>
              <X size={12} strokeWidth={2.5} />
              Clear {activeCount} filter{activeCount > 1 ? "s" : ""}
            </button>
          </>
        )}

        <div className={styles.controlSpacer} />

        <button type="button" className={styles.exportBtn} onClick={handleExport} aria-label="Export to Excel">
          <Download size={14} strokeWidth={2} className={styles.exportIcon} />
          Export Excel
        </button>

        {/* Columns visibility — far right */}
        {tableInstance && (
          <ColumnVisibilityMenu
            table={tableInstance}
            hiddenCount={hiddenCount}
            lockedIds={["po_number"]}
            totalCount={poColumns.length}
            defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
          />
        )}
      </div>

      {/* ══ TABLE ══════════════════════════════════════════════════════════ */}
      <div className={styles.tableArea}>
        <DataTable
          columns={poColumns}
          data={filteredRows}
          isLoading={isLoading}
          storageKey={`purchase-orders-${user?.email || "default"}`}
          defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
          pinnedLeft={["po_number"]}
          rowLabelKey="po_number"
          onRowClick={handleRowClick}
          onTableReady={handleTableReady}
          onStateChange={() => setTableUpdateTick(t => t + 1)}
          hideToolbar
        />
      </div>

      <PODetailSheet poNumber={selectedPoNumber} onClose={handleCloseSheet} />
    </div>
  );
}
