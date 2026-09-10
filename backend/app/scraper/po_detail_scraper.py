"""Scrapes a single PO's detail page (header fields + line items).

VERIFIED LIVE against the real site on 2026-09-04 (see
`backend/scratch_diagnostics/` for raw dumps from that session).

Two things discovered that shape this module's design:

1. The PO Number link in the list grid has `href="javascript:void(0)"` —
   it is NOT a real URL. Opening a PO's detail page requires actually
   clicking the link, and it navigates in the SAME tab (confirmed: no new
   page/tab is created). This means detail scraping cannot be done as an
   independent "visit this URL" step per PO — it must happen inline while
   iterating the list grid (see `po_overview_scraper.extract_list_rows`),
   clicking each row's link, extracting, then `page.go_back()` (confirmed
   to correctly restore the exact same filtered + paginated list state)
   before moving to the next row.

2. On the FIRST attempt, clicking ".first" anchor in a row actually
   clicked a row-edit ICON (class `poclickedit ... grid-btn-icon-edit`),
   not the PO Number link — each row has several `<a>` elements (edit
   icon, attachment icon, comment icons, info tooltip, and only THEN the
   real PO Number link at the same cell index as list extraction's
   `po_idx`, class `link poclick OpenNewTab`). Clicking the wrong one
   triggered a real SmartPAL permission error ("not allocated for the
   selected vessel/category") that had nothing to do with account access —
   always click the PO Number cell's own anchor specifically, never
   "first anchor in the row".

Header field extraction: the page has MANY `.form-group`-like wrappers
(some are filter-bar controls containing 4+ inputs — must be excluded).
Restricting to wrappers with exactly one `<label>` and 1-3 form controls,
then reading that input/select's value, reliably matches each field to
its correct value (verified against a real PO: Title, Priority, Delivery
Port, Payment, Budget Date, Entity, Currency, Delivery To, Payment Due
After Days, Vendor Name all matched exactly what the list/detail page
visually showed).

Line items: the item grid, like the list grid, may expose far more
columns (69 confirmed) than are visible by default — extracted by
header-label matching, same approach as `po_overview_scraper`.
"""
import re

from playwright.async_api import Page

from app.core.logging import logger

# Matches SmartPAL's various unset-dropdown placeholder texts:
# "--Select--", "-- Select --", "-- Select Any--", "--Not Specified--", etc.
_UNSET_PLACEHOLDER_RE = re.compile(r"^--?\s*(select|not specified)", re.IGNORECASE)

# Header field labels we care about, and the dict key we store them under.
# Labels are matched with a leading "*" stripped (some required fields are
# rendered as "*Vendor Name" etc).
HEADER_FIELD_LABELS = {
    "Vendor Name": "vendor_name",
    "Title": "title",
    "Priority": "priority",
    "Delivery Port": "delivery_port",
    "Payment": "payment",
    "Budget Date": "budget_date",
    "Entity": "entity",
    "Currency": "currency",
    "Exch. Rate": "exch_rate",
    "Delivery To": "delivery_to",
    "ETA": "eta",
    "Readiness Date": "readiness_date",
    "Project": "project",
    "Vendor Reference": "vendor_reference",
    "Payment Due After (Days)": "payment_due_after_days",
    "Department": "department",
    "Delivery Terms": "delivery_terms",
}

# PO item grid header labels -> our field names (full 69-column dump saved
# at backend/scratch_diagnostics/line_items_result.json). "Total Amount
# [USD]" appears twice in the live grid; the first occurrence is the real
# one (confirmed: matches unit_price * qty), matching the default
# first-match behavior below.
LINE_ITEM_LABEL_MAP = {
    "S. No.": "s_no",
    "Part Number": "part_number",
    "Item Description": "item_description",
    "ROB": "rob",
    "*Unit Price": "unit_price",
    "*Qty.": "qty",
    "Discount %": "discount_pct",
    "Total Amount [USD]": "amount",
    "Account Code": "account_code",
    "Plate/Drawing Number": "plate_drawing_number",
    "UOM": "uom",
    "Brand": "brand",
    "Weight": "weight",
    "Item Category": "item_category",
    "Item Code": "item_code",
    "Equipment Name": "equipment_name",
    "Drawing Number": "drawing_number",
    "Section": "section",
    "Warranty Applicable": "warranty_applicable",
    "Warranty Period (in days)": "warranty_period_days",
    "Hazardous Material": "hazardous_material",
    "OEM Item": "oem_item",
    "Export Control": "export_control",
    "Lead Days": "lead_days",
    "Remarks to Vendor": "remarks_to_vendor",
    "Remarks from Office": "remarks_from_office",
    "Remarks From Vessel": "remarks_from_vessel",
    "Readiness Date": "readiness_date",
    "Vendor Remarks": "vendor_remarks",
    "Item Subsection": "item_subsection",
    "Manual": "manual",
    "Position Number": "position_number",
    "Service Description": "service_description",
    "PKG UOM": "pkg_uom",
    "MED Approval Required": "med_approval_required",
    "*Cost Centre/WBS": "cost_centre_wbs_item",
    "Contract Price": "contract_price",
    "Transit Qty.": "transit_qty",
    "VAT": "vat",
    "VAT %": "vat_pct",
    "Net Discount": "net_discount",
    "Adj. Unit Price": "adj_unit_price",
    "Authenticity of Product": "authenticity_of_product",
    "Unbudgeted Cost ?": "unbudgeted_cost",
    "*Cost Remarks": "cost_remarks",
    "Sub Account Code": "sub_account_code",
    "Analysis Code": "analysis_code",
    "Project Code": "project_code",
    "Client Code": "client_code",
    "Alt. Account Code": "alt_account_code",
    "Alt. Sub Account Code": "alt_sub_account_code",
    "Alt. Analysis Code": "alt_analysis_code",
    "MD Required": "md_required",
    "SDoc Required": "sdoc_required",
    "URL": "url",
    "ECCN/ECN No.": "eccn_ecn_no",
    "itemid": "item_id_raw",
    "*Expected Date of supply": "expected_date_of_supply",
    "Min. Qty.": "min_qty",
    "Max. Qty.": "max_qty",
}

_PROCESSING_OVERLAY_SELECTOR = "text=Processing your request"


async def wait_for_detail_page_ready(page: Page) -> None:
    try:
        await page.wait_for_selector(".k-loading-mask", state="hidden", timeout=10000)
    except Exception:
        pass

    try:
        # The DOM contains multiple .k-grid elements (e.g. the main list grid).
        # A generic wait for ".k-grid tbody tr td" often matches the wrong grid
        # or times out, causing a 30-second delay per PO. 
        # Waiting for a header we know exists in the item grid ensures we target the right one.
        await page.wait_for_function(
            """() => {
                const grids = Array.from(document.querySelectorAll(".k-grid"));
                const candidates = grids.filter(g => g.offsetWidth > 0 && g.querySelector("tbody tr"));
                if (candidates.length === 0) return false;
                candidates.sort((a, b) => b.querySelectorAll("thead th").length - a.querySelectorAll("thead th").length);
                const g = candidates[0];
                return g && g.querySelectorAll("tbody tr td").length > 0;
            }""",
            timeout=30000
        )
    except Exception:
        logger.warning("Detail page's item grid did not appear within timeout.")
        
    try:
        await page.wait_for_selector(_PROCESSING_OVERLAY_SELECTOR, state="hidden", timeout=10000)
    except Exception:
        pass
    await page.wait_for_timeout(500)


async def extract_header_fields(page: Page) -> dict:
    """Reads every "narrow" label+input wrapper on the page (excludes
    filter-bar wrappers that hold several inputs) and returns whichever
    ones match our known field labels."""
    raw = await page.evaluate(
        """() => {
            const candidates = Array.from(document.querySelectorAll(".form-group, [class*='col-']"));
            const results = [];
            const seen = new Set();
            for (const el of candidates) {
                const label = el.querySelector("label");
                const input = el.querySelector("input, select, textarea");
                if (!label || !input) continue;
                const labelText = label.innerText.trim().replace(/^\\*/, "");
                if (!labelText || seen.has(labelText)) continue;
                const inputCount = el.querySelectorAll("input, select, textarea").length;
                if (inputCount > 3) continue;
                seen.add(labelText);
                let value = input.value;
                if (input.tagName === "SELECT") {
                    value = input.options[input.selectedIndex] ? input.options[input.selectedIndex].text : "";
                }
                results.push({label: labelText, value: (value || "").trim()});
            }
            return results;
        }"""
    )
    by_label = {r["label"]: r["value"] for r in raw}

    fields: dict[str, str | None] = {}
    for label, field_name in HEADER_FIELD_LABELS.items():
        value = by_label.get(label)
        if value and not _UNSET_PLACEHOLDER_RE.match(value):
            fields[field_name] = value
        else:
            fields[field_name] = None

    # Full verbatim capture of every label+input pair found on the detail
    # page (not just the curated HEADER_FIELD_LABELS subset) — this is
    # what makes it into extra_fields so nothing scraped is lost, even
    # fields SmartPAL adds later without code changes here.
    fields["_raw_detail_fields"] = by_label
    return fields


async def extract_line_items(page: Page) -> list[dict]:
    """Extracts the item grid via header-label matching (mirrors
    `po_overview_scraper._build_column_index_map` — same "pick the .k-grid
    with the most thead columns" logic, verified live to work correctly
    for this page's item grid without needing a locked-columns merge)."""
    result = await page.evaluate(
        """() => {
            const grids = Array.from(document.querySelectorAll(".k-grid"));
            const candidates = grids.filter(g => g.offsetWidth > 0 && g.querySelector("tbody tr"));
            if (candidates.length === 0) return {headers: [], rows: []};
            candidates.sort((a, b) => b.querySelectorAll("thead th").length - a.querySelectorAll("thead th").length);
            const g = candidates[0];
            const headers = Array.from(g.querySelectorAll("thead th")).map(th => th.innerText.trim());
            const rows = Array.from(g.querySelectorAll("tbody tr")).map(tr =>
                Array.from(tr.querySelectorAll("td")).map(td => td.innerText.trim())
            );
            return {headers, rows};
        }"""
    )
    headers = result["headers"]
    rows = result["rows"]

    index_map: dict[str, int] = {}
    for label, field in LINE_ITEM_LABEL_MAP.items():
        for i, header_text in enumerate(headers):
            if header_text == label:
                index_map[field] = i
                break

    # Every non-empty labeled column, deduped ("Total Amount [USD] (2)"
    # for the second occurrence) — full verbatim capture for extra_fields.
    raw_label_map: dict[str, int] = {}
    seen_counts: dict[str, int] = {}
    for i, label in enumerate(headers):
        if not label:
            continue
        seen_counts[label] = seen_counts.get(label, 0) + 1
        key = label if seen_counts[label] == 1 else f"{label} ({seen_counts[label]})"
        raw_label_map[key] = i

    if "s_no" not in index_map:
        logger.warning(f"Could not find 'S. No.' column in item grid headers: {headers[:20]}...")
        return []

    items = []
    for cells in rows:
        s_no_idx = index_map["s_no"]
        if s_no_idx >= len(cells) or not cells[s_no_idx] or not cells[s_no_idx].isdigit():
            continue  # skips the "Total" summary row and any malformed rows
        item = {field: (cells[i] if i < len(cells) else None) for field, i in index_map.items()}
        item["raw_fields"] = {label: (cells[i] if i < len(cells) else None) for label, i in raw_label_map.items()}
        items.append(item)
    return items


async def scrape_current_po_detail(page: Page, po_number: str) -> dict:
    """Assumes `page` has ALREADY navigated to a PO's detail page (i.e. the
    caller just clicked the PO Number link). Extracts and returns its data
    — does NOT navigate away; the caller is responsible for `go_back()`."""
    await wait_for_detail_page_ready(page)
    header_fields = await extract_header_fields(page)
    line_items = await extract_line_items(page)
    logger.info(f"Scraped detail for {po_number}: {len(line_items)} line item(s).")
    return {"po_number": po_number, "header_fields": header_fields, "line_items": line_items}
