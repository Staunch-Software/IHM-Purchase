import { useCallback, useMemo, useState } from "react";
import { ClipboardList, Search, Ship, Tag, X, FileText, Anchor, Download } from "lucide-react";

import { DataTable } from "../components/data-table/DataTable.jsx";
import { ColumnVisibilityMenu } from "../components/data-table/ColumnVisibilityMenu.jsx";
import { Select } from "../components/ui/Select.jsx";
import { DEFAULT_VISIBLE_COLUMNS, poColumns } from "../components/data-table/columns/poColumns.js";
import { PODetailSheet } from "../components/po-detail/PODetailSheet.jsx";
import { usePurchaseOrders } from "../hooks/usePurchaseOrders.js";
import { useAuth } from "../lib/auth.jsx";
import { api } from "../lib/api.js";
import { formatDate, formatMoney } from "../lib/format.js";
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
    
    document.body.style.cursor = "wait";

    try {
      const ExcelJSModule = await import("exceljs/dist/exceljs.min.js");
      const ExcelJS = ExcelJSModule.default || window.ExcelJS;
      const { SMARTPAL_COLUMNS } = await import("../components/po-detail/POLineItemsTable.jsx");
      
      const exportRows = tableInstance.getPrePaginationRowModel().rows;
      const visibleColumns = tableInstance.getVisibleLeafColumns();
      const poNumbers = exportRows.map(r => r.getValue("po_number"));
      
      // Fetch details in chunks of 50 to avoid massive payloads
      const allDetails = [];
      for (let i = 0; i < poNumbers.length; i += 50) {
        const chunk = poNumbers.slice(i, i + 50);
        try {
          const res = await api.post("/po/bulk-details", { po_numbers: chunk });
          allDetails.push(...res);
        } catch (err) {
          console.error("Failed to fetch bulk details", err);
        }
      }

      const poMap = new Map(allDetails.map(d => [d.po_number, d]));

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "IHM-Purchase";
      const sheet = workbook.addWorksheet("Purchase Orders", {
        views: [{ state: "frozen", ySplit: 1, xSplit: 1 }],
      });

      // Default visible line item columns (27 columns)
      const itemCols = SMARTPAL_COLUMNS.slice(0, 27);

      // ── 1. Main Column Headers Row ──────────────────────────────────────────
      const combinedHeaders = ["PO Number", ...itemCols.map(c => c.label.replace(/^\*/, ""))];
      const headerRow = sheet.addRow(combinedHeaders);
      headerRow.height = 28;

      headerRow.eachCell((cell, colNumber) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: colNumber === 1 ? "FF0F172A" : "FF1E293B" },
        };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10, name: "Calibri" };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = {
          top:    { style: "medium", color: { argb: "FF0F172A" } },
          bottom: { style: "medium", color: { argb: colNumber === 1 ? "FF0284C7" : "FF38BDF8" } },
          left:   { style: "thin",   color: { argb: "FF334155" } },
          right:  colNumber === 1 
                    ? { style: "medium", color: { argb: "FF38BDF8" } } 
                    : { style: "thin",   color: { argb: "FF334155" } },
        };
      });

      // ── 2. Add PO Groups ────────────────────────────────────────────────────
      const PO_BG_EVEN   = "FFF0F9FF"; // Sky 50
      const PO_BG_ODD    = "FFF8FAFC"; // Slate 50
      const ITEM_BG_EVEN = "FFFFFFFF"; // White
      const ITEM_BG_ODD  = "FFF8FAFC"; // Soft grey

      const GRP_BORDER_DARK = { style: "medium", color: { argb: "FF475569" } };
      const INNER_BORDER    = { style: "thin",   color: { argb: "FFE2E8F0" } };

      exportRows.forEach((row, groupIdx) => {
        const poData = visibleColumns.map(c => row.getValue(c.id));
        const poNumber  = row.getValue("po_number");
        const poDetails = poMap.get(poNumber);
        const items     = (poDetails && poDetails.line_items && poDetails.line_items.length > 0)
          ? poDetails.line_items : [];

        const poBg = groupIdx % 2 === 0 ? PO_BG_EVEN : PO_BG_ODD;
        const startRowIndex = sheet.rowCount + 1;

        // ── Block Row 1: PO Details Summary ───────────────────────────────────
        const poFieldMap = {};
        visibleColumns.forEach((c, i) => {
          poFieldMap[c.id] = poData[i] === null || poData[i] === undefined ? "" : poData[i];
        });
        const fmt  = (v) => (v === "" ? "—" : String(v));
        
        const summaryParts = [];
        visibleColumns.forEach(c => {
          if (c.id !== "po_number") {
             summaryParts.push(`${c.columnDef.header || c.id}: ${fmt(poFieldMap[c.id])}`);
          }
        });
        const poSummary = summaryParts.join("   |   ");

        const poDetailRowData = new Array(combinedHeaders.length).fill("");
        poDetailRowData[0] = poNumber;
        poDetailRowData[1] = poSummary;
        
        const summaryRow = sheet.addRow(poDetailRowData);
        summaryRow.height = 26;

        // Merge from Col 2 to Last Col for the summary
        sheet.mergeCells(startRowIndex, 2, startRowIndex, combinedHeaders.length);
        const summaryCell = sheet.getCell(startRowIndex, 2);
        summaryCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F2FE" } }; // Sky 100
        summaryCell.font = { bold: true, color: { argb: "FF0F172A" }, size: 9.5, name: "Calibri" };
        summaryCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        summaryCell.border = {
          top: GRP_BORDER_DARK,
          bottom: INNER_BORDER,
          left: GRP_BORDER_DARK,
          right: GRP_BORDER_DARK,
        };

        // ── Block Row 2..N: Line Items ────────────────────────────────────────
        const itemCount = items.length > 0 ? items.length : 1;
        
        for (let itemIdx = 0; itemIdx < itemCount; itemIdx++) {
          const item = items.length > 0 ? items[itemIdx] : null;
          const isLastInGroup  = itemIdx === itemCount - 1;
          
          const itemColValues = itemCols.map(c => {
            if (!item) return "";
            const val = c.isRaw ? item.extra_fields?.[c.label] : item[c.field];
            return val === null || val === undefined ? "" : val;
          });

          // Col 1 is empty because it will be merged with the top row's Col 1
          const itemRowData = ["", ...itemColValues];
          const r = sheet.addRow(itemRowData);
          r.height = 20;

          r.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            if (colNumber === 1) return; // Handled by vertical merge styling

            const itemBg  = itemIdx % 2 === 0 ? ITEM_BG_EVEN : ITEM_BG_ODD;
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: itemBg } };
            cell.font = { size: 9.5, name: "Calibri", color: { argb: "FF1E293B" } };

            let isNumericCol = false;
            let numFormat = undefined;
            const itemColDef = itemCols[colNumber - 2]; 
            
            if (itemColDef?.isNumeric) {
              isNumericCol = true;
              numFormat = ["rob", "qty", "lead_days"].includes(itemColDef.field) ? "#,##0" : "#,##0.00";
            }

            if (isNumericCol && cell.value !== "" && cell.value !== null && !isNaN(Number(cell.value))) {
              cell.value = Number(cell.value);
              if (numFormat) cell.numFmt = numFormat;
            }

            if (isNumericCol) {
              cell.alignment = { vertical: "middle", horizontal: "right" };
            } else {
              const isCenter = ["s_no", "part_number", "item_code", "uom", "account_code"].includes(itemColDef?.field || itemColDef?.label);
              cell.alignment = { vertical: "middle", horizontal: isCenter ? "center" : "left", wrapText: true };
            }

            cell.border = {
              top:    INNER_BORDER,
              bottom: isLastInGroup ? GRP_BORDER_DARK : INNER_BORDER,
              left:   colNumber === 2 ? GRP_BORDER_DARK : INNER_BORDER,
              right:  colNumber === combinedHeaders.length ? GRP_BORDER_DARK : INNER_BORDER,
            };
          });
          
          if (items.length === 0) {
             sheet.mergeCells(r.number, 2, r.number, combinedHeaders.length);
             const emptyCell = sheet.getCell(r.number, 2);
             emptyCell.value = "No line items recorded.";
             emptyCell.alignment = { horizontal: "center", vertical: "middle" };
             emptyCell.font = { italic: true, color: { argb: "FF64748B" } };
             emptyCell.border = {
               top: INNER_BORDER,
               bottom: GRP_BORDER_DARK,
               left: GRP_BORDER_DARK,
               right: GRP_BORDER_DARK,
             };
          }
        }

        const endRowIndex = sheet.rowCount;

        // ── Vertically Merge Col 1 (PO Number) ────────────────────────────────
        sheet.mergeCells(startRowIndex, 1, endRowIndex, 1);
        const masterPoCell = sheet.getCell(startRowIndex, 1);
        masterPoCell.value = poNumber;
        masterPoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: poBg } };
        masterPoCell.font = { bold: true, size: 10, name: "Calibri", color: { argb: "FF0F172A" } };
        masterPoCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        masterPoCell.border = {
          top: GRP_BORDER_DARK,
          bottom: GRP_BORDER_DARK,
          left: GRP_BORDER_DARK,
          right: GRP_BORDER_DARK,
        };
      });

      // ── 3. Auto-fit column widths with intelligent padding ─────────────────
      sheet.columns.forEach((column, colIdx) => {
        let maxLen = 10;
        
        // Measure header
        const headerCell = sheet.getCell(1, colIdx + 1);
        if (headerCell.value) {
          maxLen = Math.max(maxLen, String(headerCell.value).length);
        }

        // Measure content cells
        column.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
          if (rowNumber === 1) return;
          // Skip the merged PO details summary row, which spans col 2 to end
          if (cell.isMerged && colIdx > 0) return; 
          
          if (cell.value !== null && cell.value !== undefined) {
            const strVal = String(cell.value);
            const lines = strVal.split("\n");
            lines.forEach(l => {
              maxLen = Math.max(maxLen, Math.min(l.length, 50));
            });
          }
        });

        column.width = Math.min(Math.max(maxLen + 3, 12), 50);
      });

      // ── 4. Download .xlsx file ─────────────────────────────────────────────
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const today = new Date().toISOString().split("T")[0];
      link.href = url;
      link.download = `purchase_orders_with_items_${today}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      document.body.style.cursor = "default";
    }
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

  const stats = useMemo(() => {
    if (!rows?.length) return null;
    const vessels    = new Set(rows.map((r) => r.vessel).filter(Boolean));
    return { count: rows.length, vessels: vessels.size };
  }, [rows]);  const isFiltered = 
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

      {isFiltered && (
        <div className={styles.filterSummary}>
          Showing <strong>{filteredRows.length.toLocaleString()}</strong> result{filteredRows.length !== 1 ? "s" : ""} out of {rows.length.toLocaleString()} total orders
        </div>
      )}

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
