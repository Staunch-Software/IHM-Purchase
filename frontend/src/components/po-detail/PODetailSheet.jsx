import {
  Building2,
  CalendarDays,
  CircleDollarSign,
  FileText,
  Maximize2,
  MapPin,
  Minimize2,
  Network,
  Ship,
  Download,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";

import { usePurchaseOrderDetail } from "../../hooks/usePurchaseOrders.js";
import { formatDate, formatMoney, formatText } from "../../lib/format.js";
import { Badge, toneForStatus } from "../ui/Badge.jsx";
import { IconButton } from "../ui/IconButton.jsx";
import { Sheet, SheetBody, SheetHeader } from "../ui/Sheet.jsx";
import styles from "./PODetailSheet.module.css";
import { POLineItemsTable } from "./POLineItemsTable.jsx";

const WIDTH_KEY = "ihm_purchase_sheet_width";

/** A labelled key-value field */
function Field({ label, value, mono }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={`${styles.fieldValue} ${mono ? styles.fieldMono : ""}`}>{value}</span>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionHeading}>
        <Icon size={14} strokeWidth={1.75} className={styles.sectionIcon} aria-hidden="true" />
        {title}
      </h3>
      <div className={styles.fieldGroup}>{children}</div>
    </section>
  );
}

export function PODetailSheet({ poNumber, onClose }) {
  // Latch the PO so its content stays rendered through the slide-out; the
  // parent nulls poNumber the moment close is clicked.
  const [renderedPo, setRenderedPo] = useState(poNumber ?? null);
  const [width, setWidth] = useState(() => localStorage.getItem(WIDTH_KEY) || "wide");

  useEffect(() => {
    if (poNumber) setRenderedPo(poNumber);
  }, [poNumber]);

  // Stays enabled through the exit animation, so there's no spinner flash
  // mid-slide; the query drops only once renderedPo clears.
  const { data: po, isLoading } = usePurchaseOrderDetail(renderedPo);

  function toggleWidth() {
    setWidth((w) => {
      const next = w === "wide" ? "full" : "wide";
      localStorage.setItem(WIDTH_KEY, next);
      return next;
    });
  }

  const handleExport = useCallback(async () => {
    if (!po) return;
    const ExcelJSModule = await import("exceljs/dist/exceljs.min.js");
    const ExcelJS = ExcelJSModule.default || window.ExcelJS;
    const { SMARTPAL_COLUMNS } = await import("./POLineItemsTable.jsx");

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "IHM-Purchase";
    const sheet = workbook.addWorksheet("PO Details");

    // ── 1. Top Section: PO Details ──────────────────────────────────────────
    sheet.mergeCells("A1:G1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = `Purchase Order: ${po.po_number}`;
    titleCell.font = { bold: true, size: 16, color: { argb: "FF0B2A45" }, name: "Calibri" };
    titleCell.alignment = { vertical: "middle" };
    sheet.getRow(1).height = 30;
    
    const details = [
      ["Vendor Name", po.vendor_name || "—", "Vessel", po.vessel || "—"],
      ["Status", po.status || "—", "Category", po.category || "—"],
      ["Approved Date", po.approved_date ? formatDate(po.approved_date) : "—", "Grand Total", po.grand_total ? formatMoney(po.grand_total) : "—"],
      ["Delivery Port", po.delivery_port || "—", "Currency", po.currency || "—"]
    ];
    
    details.forEach((row) => {
      const r = sheet.addRow(row);
      r.getCell(1).font = { bold: true, color: { argb: "FF475569" }, size: 10 };
      r.getCell(2).font = { size: 10 };
      r.getCell(3).font = { bold: true, color: { argb: "FF475569" }, size: 10 };
      r.getCell(4).font = { size: 10 };
    });
    
    sheet.addRow([]); // empty spacing row

    // ── 2. Line Items Section ────────────────────────────────────────────────
    const startRow = sheet.rowCount + 1;
    
    // We export the first 27 columns (SmartPAL default visible)
    const cols = SMARTPAL_COLUMNS.slice(0, 27); 
    const headerRow = sheet.addRow(cols.map(c => c.label));
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0B2A45" }, // deep navy
      };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Calibri" };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FF1A9BB5" } },
        bottom: { style: "medium", color: { argb: "FF12A7BC" } },
        left: { style: "thin", color: { argb: "FF1A4A6A" } },
        right: { style: "thin", color: { argb: "FF1A4A6A" } },
      };
    });

    const items = po.line_items || [];
    items.forEach((item, idx) => {
      const rowData = cols.map(c => {
        let val = c.isRaw ? (item.extra_fields?.[c.label]) : item[c.field];
        return val === null || val === undefined ? "" : val;
      });
      const r = sheet.addRow(rowData);
      r.height = 18;
      const bgArgb = idx % 2 === 0 ? "FFFFFFFF" : "FFF0F7FA"; // alternating white/light blue
      r.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
        cell.font = { size: 10, name: "Calibri" };
        cell.alignment = { vertical: "middle" };
        cell.border = {
          top: { style: "hair", color: { argb: "FFD0DDE8" } },
          bottom: { style: "hair", color: { argb: "FFD0DDE8" } },
          left: { style: "hair", color: { argb: "FFD0DDE8" } },
          right: { style: "hair", color: { argb: "FFD0DDE8" } },
        };
      });
    });

    // Auto widths for the table columns
    sheet.columns.forEach((column, i) => {
      let maxLen = 12;
      column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
        if (rowNumber >= startRow) {
          const len = cell.value ? String(cell.value).length : 0;
          if (len > maxLen) maxLen = len;
        }
      });
      column.width = Math.min(maxLen + 3, 40);
    });

    // First column is wide enough for the "Vendor Name" etc. details
    sheet.getColumn(1).width = Math.max(sheet.getColumn(1).width, 18);
    sheet.getColumn(2).width = Math.max(sheet.getColumn(2).width, 25);
    sheet.getColumn(3).width = Math.max(sheet.getColumn(3).width, 18);
    sheet.getColumn(4).width = Math.max(sheet.getColumn(4).width, 25);

    // Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `PO_${po.po_number}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [po]);

  const itemCount = po?.line_items?.length ?? 0;

  return (
    <Sheet
      open={!!poNumber}
      onClose={onClose}
      onExited={() => setRenderedPo(null)}
      width={width}
      labelledBy="po-sheet-title"
    >
      <SheetHeader 
        onClose={onClose}
        actions={
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              className={styles.exportBtn}
              onClick={handleExport}
              disabled={isLoading || !po}
              aria-label="Export to Excel"
            >
              <Download size={14} strokeWidth={2.5} />
              Export Excel
            </button>
            <IconButton
              icon={width === "wide" ? Maximize2 : Minimize2}
              label={width === "wide" ? "Expand panel" : "Collapse panel"}
              onClick={toggleWidth}
              variant="outline"
              style={{
                backgroundColor: "var(--surface-base)",
                boxShadow: "var(--shadow-sm)",
                border: "1px solid var(--border-default)",
              }}
            />
          </div>
        }
      >
        <div className={styles.topBar}>
          <div className={styles.identity}>
            <span className={styles.poLabel}>Purchase Order</span>
            <span className={styles.poNumber} id="po-sheet-title">
              {renderedPo}
            </span>
          </div>

          {!isLoading && po && (
            <div className={styles.headerMeta}>
              {po.vessel && (
                <span className={styles.vesselChip}>
                  <Ship size={14} strokeWidth={1.75} aria-hidden="true" />
                  {po.vessel}
                </span>
              )}
              {po.status && <Badge tone={toneForStatus(po.status)}>{po.status}</Badge>}
            </div>
          )}
        </div>
      </SheetHeader>

      <SheetBody>
        {isLoading && (
          <div className={styles.loading}>
            <span className={styles.spinner} aria-hidden="true" />
            Loading purchase order…
          </div>
        )}

        {!isLoading && po && (
          <>
            {po.title && <p className={styles.poTitle}>{po.title}</p>}

            <POLineItemsTable items={po.line_items} />

            <div className={styles.infoGrid}>
              <Section icon={Building2} title="Vendor">
                <Field label="Vendor Name" value={formatText(po.vendor_name)} />
                <Field label="Vendor Reference" value={formatText(po.vendor_reference)} />
                <Field label="Payment Terms" value={formatText(po.payment)} />
                <Field
                  label="Payment Due"
                  value={po.payment_due_after_days ? `${po.payment_due_after_days} days` : "—"}
                />
              </Section>

              <Section icon={CircleDollarSign} title="Financials">
                <Field label="Grand Total" value={formatMoney(po.grand_total)} mono />
                <Field label="Amount (USD)" value={formatMoney(po.base_currency_amount)} mono />
                <Field label="Currency" value={formatText(po.currency)} mono />
                <Field
                  label="Exchange Rate"
                  value={po.exch_rate ? Number(po.exch_rate).toFixed(4) : "—"}
                  mono
                />
              </Section>

              <Section icon={CalendarDays} title="Dates">
                <Field label="Approved Date" value={formatDate(po.approved_date)} />
                <Field label="Budget Date" value={formatDate(po.budget_date)} />
                <Field label="ETA" value={formatDate(po.eta)} />
                <Field label="Created On" value={formatDate(po.created_on)} />
              </Section>

              <Section icon={MapPin} title="Logistics">
                <Field label="Delivery Port" value={formatText(po.delivery_port)} />
                <Field label="Delivery To" value={formatText(po.delivery_to)} />
                <Field label="Delivery Terms" value={formatText(po.delivery_terms)} />
                <Field label="Priority" value={formatText(po.priority)} />
              </Section>

              <Section icon={Network} title="Organisation">
                <Field label="Category" value={formatText(po.category)} />
                <Field label="Entity" value={formatText(po.entity)} />
                <Field label="Project" value={formatText(po.project)} />
                <Field label="Department" value={formatText(po.department)} />
                <Field label="Created By" value={formatText(po.created_by)} />
              </Section>
            </div>

            {po.remarks && (
              <section className={`${styles.section} ${styles.sectionRemarks}`}>
                <h3 className={styles.sectionHeading}>
                  <FileText
                    size={14}
                    strokeWidth={1.75}
                    className={styles.sectionIcon}
                    aria-hidden="true"
                  />
                  Remarks
                </h3>
                <p className={styles.remarksText}>{po.remarks}</p>
              </section>
            )}
          </>
        )}
      </SheetBody>
    </Sheet>
  );
}
