import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { formatMoney } from "../../lib/format.js";
import { Badge } from "../ui/Badge.jsx";
import { ColumnVisibilityMenu } from "../data-table/ColumnVisibilityMenu.jsx";
import styles from "./PODetailSheet.module.css";

// SmartPAL line item columns — visible ones first (matching SmartPAL's
// 27 default-visible columns in exact order), then the 33 hidden ones.
// isRaw=true  → read from extra_fields using the SmartPAL label as key
// isRaw=false → read from the promoted DB field directly
export const SMARTPAL_COLUMNS = [
  // ── SmartPAL DEFAULT-VISIBLE (27 unique) ─────────────────────────────────
  { label: "S. No.",                   field: "s_no",                isNumeric: false, isRaw: false },
  { label: "Part Number",              field: "part_number",         isNumeric: false, isRaw: false },
  { label: "Item Description",         field: "item_description",    isNumeric: false, isRaw: false },
  { label: "ROB",                      field: "rob",                 isNumeric: true,  isRaw: false },
  { label: "*Unit Price",              field: "unit_price",          isNumeric: true,  isRaw: false },
  { label: "*Qty.",                    field: "qty",                 isNumeric: true,  isRaw: false },
  { label: "Discount %",               field: "discount_pct",        isNumeric: true,  isRaw: false },
  { label: "Total Amount [USD]",       field: "amount",              isNumeric: true,  isRaw: false },
  { label: "Account Code",             field: "account_code",        isNumeric: false, isRaw: false },
  { label: "Plate/Drawing Number",     field: "plate_drawing_number",isNumeric: false, isRaw: false },
  { label: "MED Approval Required",    field: null,                  isNumeric: false, isRaw: true  },
  { label: "UOM",                      field: "uom",                 isNumeric: false, isRaw: false },
  { label: "Contract Price",           field: null,                  isNumeric: true,  isRaw: true  },
  { label: "Transit Qty.",             field: null,                  isNumeric: true,  isRaw: true  },
  { label: "VAT",                      field: null,                  isNumeric: false, isRaw: true  },
  { label: "VAT %",                    field: null,                  isNumeric: true,  isRaw: true  },
  { label: "Sub Account Code",         field: null,                  isNumeric: false, isRaw: true  },
  { label: "Analysis Code",            field: null,                  isNumeric: false, isRaw: true  },
  { label: "Client Code",              field: null,                  isNumeric: false, isRaw: true  },
  { label: "Lead Days",                field: "lead_days",           isNumeric: false, isRaw: false },
  { label: "Readiness Date",           field: "readiness_date",      isNumeric: false, isRaw: false },
  { label: "Remarks to Vendor",        field: "remarks_to_vendor",   isNumeric: false, isRaw: false },
  { label: "Vendor Remarks",           field: "vendor_remarks",      isNumeric: false, isRaw: false },
  { label: "Item Category",            field: "item_category",       isNumeric: false, isRaw: false },
  { label: "Section",                  field: "section",             isNumeric: false, isRaw: false },
  { label: "Item Subsection",          field: "item_subsection",     isNumeric: false, isRaw: false },
  { label: "Item Code",                field: "item_code",           isNumeric: false, isRaw: false },

  // ── SmartPAL HIDDEN BY DEFAULT (33) ──────────────────────────────────────
  { label: "Manual",                   field: null,                  isNumeric: false, isRaw: true  },
  { label: "Position Number",          field: null,                  isNumeric: false, isRaw: true  },
  { label: "Service Description",      field: null,                  isNumeric: false, isRaw: true  },
  { label: "Warranty Applicable",      field: "warranty_applicable", isNumeric: false, isRaw: false },
  { label: "Warranty Period (in days)",field: "warranty_period_days",isNumeric: false, isRaw: false },
  { label: "Brand",                    field: "brand",               isNumeric: false, isRaw: false },
  { label: "Weight",                   field: "weight",              isNumeric: false, isRaw: false },
  { label: "PKG UOM",                  field: null,                  isNumeric: false, isRaw: true  },
  { label: "*Cost Centre/WBS",         field: null,                  isNumeric: false, isRaw: true  },
  { label: "Net Discount",             field: null,                  isNumeric: true,  isRaw: true  },
  { label: "Adj. Unit Price",          field: null,                  isNumeric: true,  isRaw: true  },
  { label: "Authenticity of Product",  field: null,                  isNumeric: false, isRaw: true  },
  { label: "Unbudgeted Cost ?",        field: null,                  isNumeric: false, isRaw: true  },
  { label: "*Cost Remarks",            field: null,                  isNumeric: false, isRaw: true  },
  { label: "Project Code",             field: null,                  isNumeric: false, isRaw: true  },
  { label: "Alt. Account Code",        field: null,                  isNumeric: false, isRaw: true  },
  { label: "Alt. Sub Account Code",    field: null,                  isNumeric: false, isRaw: true  },
  { label: "Alt. Analysis Code",       field: null,                  isNumeric: false, isRaw: true  },
  { label: "MD Required",              field: null,                  isNumeric: false, isRaw: true  },
  { label: "SDoc Required",            field: null,                  isNumeric: false, isRaw: true  },
  { label: "URL",                      field: null,                  isNumeric: false, isRaw: true  },
  { label: "Equipment Name",           field: "equipment_name",      isNumeric: false, isRaw: false },
  { label: "Drawing Number",           field: "drawing_number",      isNumeric: false, isRaw: false },
  { label: "Hazardous Material",       field: "hazardous_material",  isNumeric: false, isRaw: false },
  { label: "OEM Item",                 field: "oem_item",            isNumeric: false, isRaw: false },
  { label: "Export Control",           field: "export_control",      isNumeric: false, isRaw: false },
  { label: "ECCN/ECN No.",             field: null,                  isNumeric: false, isRaw: true  },
  { label: "itemid",                   field: null,                  isNumeric: false, isRaw: true  },
  { label: "*Expected Date of supply", field: null,                  isNumeric: false, isRaw: true  },
  { label: "Min. Qty.",                field: null,                  isNumeric: true,  isRaw: true  },
  { label: "Max. Qty.",                field: null,                  isNumeric: true,  isRaw: true  },
  { label: "Remarks from Office",      field: "remarks_from_office", isNumeric: false, isRaw: false },
  { label: "Remarks From Vessel",      field: "remarks_from_vessel", isNumeric: false, isRaw: false },
];

// First 27 entries above are SmartPAL's default-visible columns; the rest
// are hidden by default there too — mirror that here instead of dumping
// all 60 columns on screen at once.
const DEFAULT_VISIBLE_COUNT = 27;

/**
 * These two carry the row's identity, so they stay pinned and unhideable.
 * They need explicit widths: the table is auto-laid-out, but getStart("left")
 * computes sticky offsets from the declared column sizes. If the two disagree,
 * the second pinned column lands at the wrong offset and overlaps the first.
 * Pinning min/max/width to the same value makes the rendered width match.
 */
const LOCKED_WIDTHS = { "S. No.": 56, "Part Number": 150 };
const LOCKED_COLUMNS = Object.keys(LOCKED_WIDTHS);

/** Inline style for a pinned header/body cell. */
function pinnedStyle(column) {
  const width = LOCKED_WIDTHS[column.id];
  return { left: column.getStart("left"), width, minWidth: width, maxWidth: width };
}

if (import.meta.env.DEV) {
  const dupes = SMARTPAL_COLUMNS.map((c) => c.label).filter((l, i, a) => a.indexOf(l) !== i);
  // Labels double as column ids, so a duplicate would silently drop a column.
  if (dupes.length) console.error("Duplicate SMARTPAL_COLUMNS labels:", dupes);
}

function getCellValue(item, col) {
  // For promoted DB fields, read directly from the item object
  if (!col.isRaw && col.field) {
    const val = item[col.field];
    return val !== null && val !== undefined ? String(val) : null;
  }
  // For raw/extra columns, read from extra_fields using the SmartPAL label
  return item.extra_fields?.[col.label] ?? null;
}

export function POLineItemsTable({ items }) {
  // Labels are used verbatim as ids. `accessorFn` is mandatory here rather
  // than `accessorKey`, because v8 parses accessorKey as a dotted deep path —
  // "Min. Qty." would resolve as item["Min"]["Qty"][""]. Ids, by contrast, are
  // never parsed, so the human-readable label is safe (and avoids slug
  // collisions like "VAT" vs "VAT %").
  const columns = useMemo(
    () =>
      SMARTPAL_COLUMNS.map((col) => ({
        id: col.label,
        header: col.label.replace(/^\*/, ""),
        accessorFn: (item) => getCellValue(item, col),
        cell: (info) =>
          col.isNumeric ? formatMoney(info.getValue()) : info.getValue() || "—",
        enableSorting: false,
        enableHiding: !LOCKED_COLUMNS.includes(col.label),
        ...(LOCKED_WIDTHS[col.label] ? { size: LOCKED_WIDTHS[col.label] } : {}),
        meta: { isNumeric: col.isNumeric },
      })),
    []
  );

  // Preserves the previous 27-visible default exactly.
  const [columnVisibility, setColumnVisibility] = useState(() =>
    Object.fromEntries(SMARTPAL_COLUMNS.map((c, i) => [c.label, i < DEFAULT_VISIBLE_COUNT]))
  );

  const table = useReactTable({
    data: items ?? [],
    columns,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    initialState: { columnPinning: { left: LOCKED_COLUMNS, right: [] } },
    getCoreRowModel: getCoreRowModel(),
  });

  if (!items?.length) {
    return <p className={styles.emptyLineItems}>No line items recorded for this PO.</p>;
  }

  const visibleCount = table.getVisibleLeafColumns().length;

  return (
    <div className={styles.lineItemsSection}>
      <div className={styles.lineItemsHeading} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={styles.lineItemsTitle}>Line Items</span>
          <Badge tone="neutral" size="sm">
            {items.length}
          </Badge>
        </div>
        <ColumnVisibilityMenu
          table={table}
          hiddenCount={SMARTPAL_COLUMNS.length - visibleCount}
          lockedIds={LOCKED_COLUMNS}
          totalCount={SMARTPAL_COLUMNS.length}
        />
      </div>

      <div className={styles.lineItemsScroll}>
        <table className={styles.lineItemsTable}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const pinned = header.column.getIsPinned() === "left";
                  return (
                    <th
                      key={header.id}
                      className={[
                        header.column.columnDef.meta?.isNumeric ? styles.numeric : "",
                        pinned ? styles.liPinned : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={pinned ? pinnedStyle(header.column) : undefined}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  const pinned = cell.column.getIsPinned() === "left";
                  return (
                    <td
                      key={cell.id}
                      className={[
                        cell.column.columnDef.meta?.isNumeric ? styles.numeric : "",
                        pinned ? styles.liPinned : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={pinned ? pinnedStyle(cell.column) : undefined}
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
    </div>
  );
}
