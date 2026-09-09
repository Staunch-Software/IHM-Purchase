const DATE_FORMAT = { day: "2-digit", month: "short", year: "numeric" };

function formatDate(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, DATE_FORMAT);
}

function formatAmount(value) {
  if (value === null || value === undefined || value === "") return "";
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatInt(value) {
  if (value === null || value === undefined || value === "") return "";
  return Number(value).toLocaleString();
}

// Every factory uses `id` + `accessorFn` rather than `accessorKey`, and maps
// null → undefined. Two reasons:
//   1. accessorKey is parsed as a dotted deep path, so any key containing "."
//      would silently resolve to undefined.
//   2. sortUndefined only recognises `undefined`; the API sends `null` for
//      every empty field, and sortingFns.text stringifies it to "null" — which
//      sorts blanks between "no…" and "nu…", in the middle of the alphabet.
// The id keeps the old accessorKey value, so saved column orders stay valid.
//
// Column sizes: header text at 11px bold uppercase ~8px/char + 56px for icons/padding.
// Formula: ceil(char_count * 8) + 56, rounded up to nearest 10.
function textCol(key, header, opts = {}) {
  const size = opts.size ?? 150;
  return {
    id: key,
    accessorFn: (row) => row[key] ?? undefined,
    header,
    size,
    minSize: size,
    sortUndefined: "last",
    meta: { filterType: "text" },
  };
}

// dateCol: date strings like "13 Aug 2026" are ~90px data width.
// Header widths are calculated based on header text length.
function dateCol(key, header, size = 160) {
  return {
    id: key,
    accessorFn: (row) => row[key] ?? undefined,
    header,
    size,
    minSize: size,
    cell: (info) => formatDate(info.getValue()),
    sortUndefined: "last",
    meta: { filterType: "date" },
  };
}

function numCol(key, header, cell, size = 100) {
  return {
    id: key,
    accessorFn: (row) => row[key] ?? undefined,
    header,
    size,
    minSize: size,
    cell,
    // "basic" avoids getAutoSortingFn, which samples flatRows.slice(10) —
    // an upstream typo for slice(0, 10) — and so rescans on every sort.
    sortingFn: "basic",
    sortUndefined: "last",
    meta: { filterType: "number" },
  };
}

// Columns in SmartPAL's exact order (duplicates deduplicated).
// Widths are calculated to always show the full uppercase header text.
export const poColumns = [
  // ── Identity / Core ────────────────────────────────────────────────────────
  { id: "operating_unit", accessorFn: (r) => r.operating_unit ?? undefined, header: "Operating Unit", size: 170, minSize: 170, sortUndefined: "last", meta: { filterType: "select" } },
  textCol("local_purchase",  "Local Purchase",  { size: 170 }),
  // Pinned left and never hideable — it is the row's identity.
  {
    id: "po_number",
    accessorFn: (row) => row.po_number ?? undefined,
    header: "PO Number",
    size: 160,
    minSize: 160,
    enableHiding: false,
    sortUndefined: "last",
    meta: { filterType: "text" },
  },
  textCol("coupa_po_number",  "Coupa PO Number", { size: 190 }),
  textCol("tag_name",         "Tag Name",         { size: 150 }),
  { id: "vessel",    accessorFn: (r) => r.vessel    ?? undefined, header: "Vessel",      size: 150, minSize: 150, sortUndefined: "last", meta: { filterType: "select" } },
  { id: "category",  accessorFn: (r) => r.category  ?? undefined, header: "PO Category", size: 155, minSize: 155, sortUndefined: "last", meta: { filterType: "select" } },

  // ── Dates ──────────────────────────────────────────────────────────────────
  dateCol("created_on",         "Created Date",          160),
  dateCol("approved_date",      "Approved Date",         165),
  dateCol("afe_approved_date",  "AFE Approved Date",     190),
  dateCol("deadline_date",      "Deadline Date",         165),
  dateCol("actioned_on",        "Actioned On",           155),
  dateCol("closed_date",        "Closed Date",           155),
  dateCol("budget_date",        "Budget Date",           155),
  dateCol("forwarded_date",     "Forwarded Date",        170),

  // ── Items / Content ────────────────────────────────────────────────────────
  numCol("items_count",          "Items",                    (info) => formatInt(info.getValue()),    80),
  textCol("title",               "Title",                   { size: 280 }),
  textCol("grn_no",              "GRN No.",                 { size: 160 }),
  numCol("value_of_interfaced_qty", "Value of Interfaced Qty.", (info) => formatAmount(info.getValue()), 220),
  { id: "port_schedule_status", accessorFn: (r) => r.port_schedule_status ?? undefined, header: "Port Schedule Status", size: 210, minSize: 210, sortUndefined: "last", meta: { filterType: "select" } },

  // ── Vendor ─────────────────────────────────────────────────────────────────
  textCol("vendor_name",         "Vendor",                  { size: 260 }),
  textCol("revision_no",         "Revision No.",            { size: 155 }),
  textCol("insurance_claim_no",  "Insurance Claim No.",     { size: 210 }),
  { id: "transfer_method", accessorFn: (r) => r.transfer_method ?? undefined, header: "Transfer Method", size: 175, minSize: 175, sortUndefined: "last", meta: { filterType: "select" } },

  // ── Financials ─────────────────────────────────────────────────────────────
  { id: "currency", accessorFn: (r) => r.currency ?? undefined, header: "Base Currency", size: 155, minSize: 155, sortUndefined: "last", meta: { filterType: "select" } },
  numCol("base_currency_amount",  "Base Amount",            (info) => formatAmount(info.getValue()), 145),
  textCol("organisation_assignment", "Organisation Assignment", { size: 230 }),
  textCol("po_update",            "PO Update",              { size: 140 }),
  textCol("account_re_allocation","Account Re-Allocation",  { size: 210 }),
  textCol("account_code",         "Account Code",           { size: 155 }),
  textCol("analysis_code",        "Analysis Code",          { size: 160 }),
  textCol("cost_centre_wbs",      "Cost Centre/WBS",        { size: 180 }),
  textCol("afe_po",               "AFE PO",                 { size: 110 }),
  textCol("afe_status",           "AFE Status",             { size: 130 }),

  // ── People ─────────────────────────────────────────────────────────────────
  textCol("created_by",           "Created By",             { size: 155 }),
  textCol("approved_by",          "Approved By",            { size: 155 }),

  // ── Status ─────────────────────────────────────────────────────────────────
  {
    id: "status",
    accessorFn: (row) => row.status ?? undefined,
    header: "Status",
    size: 120,
    minSize: 120,
    sortUndefined: "last",
    meta: { filterType: "select" },
  },
  { id: "invoice_status",    accessorFn: (r) => r.invoice_status    ?? undefined, header: "Invoice Status",    size: 165, minSize: 165, sortUndefined: "last", meta: { filterType: "select" } },
  { id: "po_send_status",    accessorFn: (r) => r.po_send_status    ?? undefined, header: "PO Send Status",    size: 170, minSize: 170, sortUndefined: "last", meta: { filterType: "select" } },
  { id: "logistic_priority", accessorFn: (r) => r.logistic_priority ?? undefined, header: "Logistic Priority", size: 180, minSize: 180, sortUndefined: "last", meta: { filterType: "select" } },

  // ── More Dates ─────────────────────────────────────────────────────────────
  dateCol("issue_date",              "Issue Date",              150),
  dateCol("expected_delivery_date",  "Expected Delivery Date",  220),
  dateCol("delivery_date",           "Delivery Date",           170),

  // ── Logistics ──────────────────────────────────────────────────────────────
  textCol("schd_delivery_port", "Schd. Delivery Port", { size: 200 }),
  dateCol("vessel_eta",          "Vessel ETA",          150),
  textCol("delivery_to",         "Delivery To",         { size: 160 }),
  { id: "post_invoice",   accessorFn: (r) => r.post_invoice   ?? undefined, header: "Post Invoice",   size: 155, minSize: 155, sortUndefined: "last", meta: { filterType: "select" } },
  { id: "owner_approved", accessorFn: (r) => r.owner_approved ?? undefined, header: "Owner Approved", size: 175, minSize: 175, sortUndefined: "last", meta: { filterType: "select" } },
  { id: "po_location",    accessorFn: (r) => r.po_location    ?? undefined, header: "PO Location",    size: 155, minSize: 155, sortUndefined: "last", meta: { filterType: "select" } },
  { id: "process",        accessorFn: (r) => r.process        ?? undefined, header: "Process",        size: 130, minSize: 130, sortUndefined: "last", meta: { filterType: "select" } },
  { id: "po_type",        accessorFn: (r) => r.po_type        ?? undefined, header: "PO Type",        size: 130, minSize: 130, sortUndefined: "last", meta: { filterType: "select" } },
  { id: "quote",          accessorFn: (r) => r.quote          ?? undefined, header: "Quote",          size: 110, minSize: 110, sortUndefined: "last", meta: { filterType: "select" } },
  textCol("requisition_no",      "Requisition No.",     { size: 175 }),
  textCol("enquiry_no",          "Enquiry No.",         { size: 155 }),
  textCol("do_no",               "DO No.",              { size: 110 }),
  textCol("equipment",           "Equipment",           { size: 160 }),
  textCol("remarks",             "Remarks",             { size: 160 }),
  dateCol("eff_date",            "Eff. Date",           130),
  { id: "department", accessorFn: (r) => r.department ?? undefined, header: "Department", size: 155, minSize: 155, sortUndefined: "last", meta: { filterType: "select" } },
  textCol("post_invoice_remarks","Post Invoice Remarks",{ size: 220 }),
  { id: "priority",   accessorFn: (r) => r.priority   ?? undefined, header: "Priority",   size: 120, minSize: 120, sortUndefined: "last", meta: { filterType: "select" } },
  dateCol("est_vessel_delivery", "Est. Vessel Delivery",200),
  dateCol("org_commit_date",     "Org. Commit Date",    185),
  dateCol("asn_date",            "ASN Date",            140),
  { id: "send_reminder",          accessorFn: (r) => r.send_reminder          ?? undefined, header: "Send Reminder",          size: 165, minSize: 165, sortUndefined: "last", meta: { filterType: "select" } },
  { id: "recharge_applicable_to", accessorFn: (r) => r.recharge_applicable_to ?? undefined, header: "Recharge Applicable To",   size: 240, minSize: 240, sortUndefined: "last", meta: { filterType: "select" } },
  { id: "recharge",               accessorFn: (r) => r.recharge               ?? undefined, header: "Recharge",               size: 130, minSize: 130, sortUndefined: "last", meta: { filterType: "select" } },
  textCol("ar_invoice_no",       "AR Invoice No.",      { size: 165 }),

  // ── Detail-page fields (from PO header, not list grid) ─────────────────────
  numCol("grand_total",          "Grand Total",         (info) => formatAmount(info.getValue()), 145),
  textCol("vendor_reference",    "Vendor Reference",    { size: 185 }),
  numCol("exch_rate",            "Exch. Rate",          (info) => {
    const v = info.getValue();
    if (v === null || v === undefined || v === "") return "";
    return Number(v).toFixed(4);
  }, 120),
  { id: "payment",       accessorFn: (r) => r.payment       ?? undefined, header: "Payment",       size: 130, minSize: 130, sortUndefined: "last", meta: { filterType: "select" } },
  numCol("payment_due_after_days","Payment Due (Days)", (info) => formatInt(info.getValue()), 190),
  { id: "entity",        accessorFn: (r) => r.entity        ?? undefined, header: "Entity",        size: 120, minSize: 120, sortUndefined: "last", meta: { filterType: "select" } },
  { id: "delivery_port", accessorFn: (r) => r.delivery_port ?? undefined, header: "Delivery Port", size: 165, minSize: 165, sortUndefined: "last", meta: { filterType: "select" } },
  { id: "delivery_terms",accessorFn: (r) => r.delivery_terms?? undefined, header: "Delivery Terms",size: 175, minSize: 175, sortUndefined: "last", meta: { filterType: "select" } },
  { id: "project",       accessorFn: (r) => r.project       ?? undefined, header: "Project",       size: 130, minSize: 130, sortUndefined: "last", meta: { filterType: "select" } },
  dateCol("readiness_date",      "Readiness Date",      170),
  dateCol("eta",                 "ETA",                 110),
];

/**
 * Default visible columns — matches SmartPAL's 30 default-visible columns exactly.
 * Same order as SmartPAL's live grid (left to right).
 * All other columns are available via the "Columns" toggle button.
 */
export const DEFAULT_VISIBLE_COLUMNS = [
  "po_number",             // PO Number      (SmartPAL col 1 — sticky/locked)
  "vessel",                // Vessel
  "category",              // PO Category
  "created_on",            // Created Date
  "approved_date",         // Approved Date
  "items_count",           // Items
  "title",                 // Title
  "vendor_name",           // Vendor
  "currency",              // Base Currency
  "base_currency_amount",  // Base Amount
  "account_code",          // Account Code
  "account_re_allocation", // Account Re-Allocation
  "created_by",            // Created By
  "approved_by",           // Approved By
  "status",                // Status
  "invoice_status",        // Invoice Status
  "po_send_status",        // PO Send Status
  "issue_date",            // Issue Date
  "expected_delivery_date",// Expected Delivery Date
  "schd_delivery_port",    // Schd. Delivery Port
  "vessel_eta",            // Vessel ETA
  "post_invoice",          // Post Invoice
  "owner_approved",        // Owner Approved
  "quote",                 // Quote
  "requisition_no",        // Requisition No.
  "enquiry_no",            // Enquiry No.
  "grn_no",                // GRN No.
  "equipment",             // Equipment
  "department",            // Department
  "priority",              // Priority
];
