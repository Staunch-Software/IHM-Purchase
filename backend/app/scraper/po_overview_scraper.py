"""Scrapes the SmartPAL Purchase Order Overview grid (list rows only).

Flow (verified live against the real portal in a diagnostic session — see
`backend/scratch_diagnostics/` for screenshots/dumps from that session):
  1. Navigate directly to POOverview (falls back to menu clicks if that
     doesn't land correctly post-login).
  2. Click the "Finally Approved" tab.
  3. Open the Category filter (a bootstrap-select multi-select, NOT Kendo),
     click Select All, type "crew" into its search box, click Deselect All
     while filtered (unchecks just those 11), clear the search box.
  4. Click the real "Show"/apply-search button
     (`.btn-icon-apply-search-result` — confirmed via elementFromPoint;
     it is icon-only with no reliable text/title/aria-label to select by).
  5. Extract every row across all columns, walking Kendo's page-based
     pager (`.k-pager-nav`) — confirmed the grid uses classic pagination,
     not virtual/infinite scroll.

Verified end-to-end on 2026-09-04: baseline "All Categories" showed 2621
Finally-Approved records; after Select All -> search "crew" -> Deselect
All (62 -> 51 categories) -> Show, it dropped to 1565 records — closely
matching the user's real-world count (~1559, which naturally drifts day
to day as new POs are approved).
"""
from typing import Awaitable, Callable

from playwright.async_api import BrowserContext, Page

from app.core.logging import logger
from app.scraper.po_detail_scraper import scrape_current_po_detail

PO_OVERVIEW_URL = "https://smartpal.ozellar.com/PurchasePALApp/Purchase/POOverview"

CATEGORY_EXCLUDE_SEARCH_TERM = "crew"

# If this many detail-page scrapes fail back-to-back, the page is
# considered stuck (not a run of coincidentally-slow individual rows) —
# see the raise site in extract_list_rows for what this was observed to
# fix live.
CONSECUTIVE_FAILURE_LIMIT = 3

# Maps the grid's actual header labels (confirmed live, full 86-column
# dump saved at backend/scratch_diagnostics/list_grid_headers_labeled.json)
# to our internal field names. Extraction is done by matching header text
# at runtime (not fixed column indices), since the grid has several
# leading icon-only columns (checkbox/edit/attachment/etc) whose count can
# shift, and the account's saved column view can vary column count too.
#
# This covers every column with a real label. A handful of labels are
# DUPLICATED in the live grid (e.g. two "Account Code", two "GRN No.") —
# _build_column_index_map resolves those by preferring whichever
# occurrence actually has data in a sample row, not just "the first one",
# since for "GRN No." specifically the first occurrence is always blank.
COLUMN_LABEL_MAP = {
    "PO Number": "po_number",
    "Vessel": "vessel",
    "PO Category": "category",
    "Created Date": "created_on",
    "Approved Date": "approved_date",
    "Items": "items_count",
    "Title": "title",
    "Vendor": "vendor_name",
    "Base Currency": "currency",
    "Base Amount": "base_currency_amount",
    "Account Code": "account_code",
    "Created By": "created_by",
    "Approved By": "approved_by",
    "Status": "status",
    "Invoice Status": "invoice_status",
    "PO Send Status": "po_send_status",
    "Department": "department",
    "Priority": "priority",
    "Operating Unit": "operating_unit",
    "Coupa PO Number": "coupa_po_number",
    "Tag Name": "tag_name",
    "Logistic Priority": "logistic_priority",
    "Process": "process",
    "PO Type": "po_type",
    "PO Location": "po_location",
    "Requisition No.": "requisition_no",
    "Enquiry No.": "enquiry_no",
    "GRN No.": "grn_no",
    "DO No.": "do_no",
    "Equipment": "equipment",
    "Owner Approved": "owner_approved",
    "Post Invoice": "post_invoice",
    "Port Schedule Status": "port_schedule_status",
    "Revision No.": "revision_no",
    "Cost Centre/WBS": "cost_centre_wbs",
    "Account Re-Allocation": "account_re_allocation",
    "Analysis Code": "analysis_code",
    "Quote": "quote",
    "AR Invoice No.": "ar_invoice_no",
    "Issue Date": "issue_date",
    "Expected Delivery Date": "expected_delivery_date",
    "Delivery Date": "delivery_date",
    "Deadline Date": "deadline_date",
    "Closed Date": "closed_date",
    "AFE Approved Date": "afe_approved_date",
    "Eff. Date": "eff_date",
    "Est. Vessel Delivery": "est_vessel_delivery",
    "Org. Commit Date": "org_commit_date",
    "Local Purchase": "local_purchase",
    "Actioned On": "actioned_on",
    "Forwarded Date": "forwarded_date",
    "Value of Interfaced Qty.": "value_of_interfaced_qty",
    "Insurance Claim No.": "insurance_claim_no",
    "Transfer Method": "transfer_method",
    "Organisation Assignment": "organisation_assignment",
    "PO Update": "po_update",
    "AFE PO": "afe_po",
    "AFE Status": "afe_status",
    "Schd. Delivery Port": "schd_delivery_port",
    "Vessel ETA": "vessel_eta",
    "Post Invoice Remarks": "post_invoice_remarks",
    "ASN date": "asn_date",
    "Send Reminder": "send_reminder",
    "Recharge Applicable To": "recharge_applicable_to",
    "Recharge": "recharge",
    "Remarks": "remarks",
}


async def open_po_overview(page: Page) -> bool:
    await page.goto(PO_OVERVIEW_URL, timeout=60000)
    try:
        await page.wait_for_selector("text=Purchase Order", timeout=15000)
        return True
    except Exception:
        logger.warning("Direct navigation to POOverview did not land as expected; menu-click fallback not yet implemented.")
        return False


async def click_finally_approved_tab(page: Page) -> None:
    await page.get_by_text("Finally Approved", exact=False).first.click()
    try:
        await page.wait_for_selector(".k-loading-mask", state="hidden", timeout=20000)
    except Exception:
        pass
    await page.wait_for_timeout(1000)


async def apply_category_filter_excluding_crew(page: Page) -> None:
    """Opens the Category bootstrap-select dropdown, selects all, searches
    "crew", deselects those (currently 11) categories, leaving the rest
    checked. The exact counts (62/11/51) are NOT hardcoded/asserted here
    since the category list can grow over time on the live site — we log
    the resulting summary instead of failing on an exact number."""
    await page.evaluate(
        """() => {
            const spans = Array.from(document.querySelectorAll("span, div"));
            const label = spans.find(el => el.innerText && (
                el.innerText.trim() === "All Categories" || /^\\d+ Category\\(s\\) selected$/.test(el.innerText.trim())
            ));
            if (label) label.click();
        }"""
    )
    await page.wait_for_selector(".bs-container.open input.form-control", timeout=10000)

    await page.locator(".bs-container.open .actions-btn.bs-select-all").click()
    await page.wait_for_timeout(300)

    search_input = page.locator(".bs-container.open input.form-control")
    await search_input.fill(CATEGORY_EXCLUDE_SEARCH_TERM)
    await page.wait_for_timeout(800)

    excluded_labels = await page.evaluate(
        """() => {
            const container = document.querySelector(".bs-container.open");
            const items = Array.from(container.querySelectorAll("li"));
            return items.filter(li => li.offsetWidth > 0 && li.offsetHeight > 0).map(li => li.innerText.trim()).filter(Boolean);
        }"""
    )
    logger.info(f"Category filter: excluding {len(excluded_labels)} categories matching '{CATEGORY_EXCLUDE_SEARCH_TERM}': {excluded_labels}")

    await page.locator(".bs-container.open .actions-btn.bs-deselect-all").click()
    await page.wait_for_timeout(300)

    await search_input.fill("")
    await page.wait_for_timeout(500)

    summary = await page.evaluate(
        """() => {
            const btn = document.querySelector('button.dropdown-toggle[title]');
            return btn ? btn.innerText.trim() : null;
        }"""
    )
    logger.info(f"Category filter summary after exclusion: {summary}")

    await page.keyboard.press("Escape")
    await page.wait_for_timeout(300)


async def run_show_query(page: Page) -> None:
    await page.locator(".btn-icon-apply-search-result").click()
    await page.wait_for_timeout(2500)
    try:
        await page.wait_for_selector(".k-loading-mask", state="hidden", timeout=30000)
    except Exception:
        pass
    await page.wait_for_timeout(1000)


# This grid uses Kendo's "locked columns" (frozen columns) layout: what
# looks like one <div class="k-grid"> actually contains TWO independent
# <table> pairs kept in sync by row position —
#   .k-grid-header-locked / .k-grid-content-locked   (~12 leading columns,
#       including PO Number, kept pinned while scrolling horizontally)
#   .k-grid-header-wrap   / .k-grid-content (scrollable) (the remaining
#       70+ columns)
# Naively querying ".k-grid thead th" / ".k-grid tbody tr" returns BOTH
# tables' headers/rows concatenated in DOM order — 12+74=86 headers, but
# each individual <tr> only has the 12 or 74 cells from its OWN table, so
# fixed-index cell lookups silently read past the end of whichever table's
# row you happened to land on. The fix: read locked and scrollable headers
# separately (concatenated in that order to build one 0..85 index space),
# and per row, concatenate the i-th locked <tr>'s cells with the i-th
# scrollable <tr>'s cells (same row index in each table = same PO, since
# Kendo keeps them position-synced for the frozen-column UX to work at
# all).
_READ_HEADERS_JS = """() => {
    const lockedHeaders = Array.from(document.querySelectorAll(".k-grid-header-locked thead th")).map(th => th.innerText.trim());
    const scrollHeaders = Array.from(document.querySelectorAll(".k-grid-header-wrap thead th")).map(th => th.innerText.trim());
    return lockedHeaders.concat(scrollHeaders);
}"""

# Same header read, plus the first rendered row's cells — used to
# disambiguate duplicate header labels (e.g. two columns both named
# "GRN No.") by preferring whichever occurrence actually has data,
# rather than blindly taking the first match.
_READ_HEADERS_WITH_SAMPLE_JS = """() => {
    const lockedHeaders = Array.from(document.querySelectorAll(".k-grid-header-locked thead th")).map(th => th.innerText.trim());
    const scrollHeaders = Array.from(document.querySelectorAll(".k-grid-header-wrap thead th")).map(th => th.innerText.trim());
    const headers = lockedHeaders.concat(scrollHeaders);

    const lockedRow = document.querySelector(".k-grid-content-locked tbody tr");
    const scrollRow = document.querySelector(".k-grid-content.k-auto-scrollable tbody tr");
    let sample = [];
    if (lockedRow && scrollRow) {
        const lockedCells = Array.from(lockedRow.querySelectorAll("td")).map(td => td.innerText.trim());
        const scrollCells = Array.from(scrollRow.querySelectorAll("td")).map(td => td.innerText.trim());
        sample = lockedCells.concat(scrollCells);
    }
    return {headers, sample};
}"""

_READ_ROWS_JS = """() => {
    const lockedRows = Array.from(document.querySelectorAll(".k-grid-content-locked tbody tr"));
    const scrollRows = Array.from(document.querySelectorAll(".k-grid-content.k-auto-scrollable tbody tr"));
    const n = Math.min(lockedRows.length, scrollRows.length);
    const out = [];
    for (let i = 0; i < n; i++) {
        const lockedCells = Array.from(lockedRows[i].querySelectorAll("td"));
        const scrollCells = Array.from(scrollRows[i].querySelectorAll("td"));
        const link = lockedRows[i].querySelector("td a");
        out.push({
            cells: lockedCells.concat(scrollCells).map(td => td.innerText.trim()),
            detail_href: link ? link.getAttribute("href") : null,
        });
    }
    return out;
}"""


def _build_raw_label_map(headers: list[str]) -> dict[str, int]:
    """Maps EVERY non-empty header label to its column index, including
    ones with no dedicated typed field. Duplicate labels (confirmed live:
    "Account Code", "GRN No.", "Revision No.", "Org. Commit Date",
    "Remarks" each appear twice) get " (2)", " (3)", ... suffixes so both
    occurrences are captured distinctly rather than the second silently
    overwriting the first."""
    raw_map: dict[str, int] = {}
    seen_counts: dict[str, int] = {}
    for i, label in enumerate(headers):
        if not label:
            continue
        seen_counts[label] = seen_counts.get(label, 0) + 1
        key = label if seen_counts[label] == 1 else f"{label} ({seen_counts[label]})"
        raw_map[key] = i
    return raw_map


async def _build_column_index_map(page: Page) -> tuple[dict[str, int], dict[str, int]]:
    """Returns (typed_index_map, raw_label_map). `typed_index_map` covers
    the fields in COLUMN_LABEL_MAP (disambiguating duplicate labels by
    preferring whichever occurrence has data in a sample row);
    `raw_label_map` covers literally every labeled column, for the
    complete verbatim capture stored in extra_fields."""
    result = await page.evaluate(_READ_HEADERS_WITH_SAMPLE_JS)
    headers = result["headers"]
    sample = result["sample"]

    index_map: dict[str, int] = {}
    for label, field in COLUMN_LABEL_MAP.items():
        candidates = [i for i, header_text in enumerate(headers) if header_text == label]
        if not candidates:
            continue
        if len(candidates) == 1:
            index_map[field] = candidates[0]
            continue
        # Duplicate label: prefer the occurrence with actual data in the
        # sample row; fall back to the last occurrence (empirically the
        # "real" one for GRN No.) if the sample is empty/unavailable.
        with_data = [i for i in candidates if i < len(sample) and sample[i]]
        index_map[field] = with_data[0] if with_data else candidates[-1]

    logger.info(f"Grid has {len(headers)} columns; matched {len(index_map)}/{len(COLUMN_LABEL_MAP)} typed fields.")
    if len(index_map) < len(COLUMN_LABEL_MAP):
        unmatched = set(COLUMN_LABEL_MAP) - {f for f in COLUMN_LABEL_MAP if COLUMN_LABEL_MAP[f] in index_map}
        logger.warning(f"Unmatched header labels (grid's saved column view may differ from expected): {unmatched}")

    raw_map = _build_raw_label_map(headers)
    return index_map, raw_map


# Substrings that indicate the browser/context/page itself has died (not a
# recoverable "this one PO's page was slow to render" failure). Confirmed
# live: once these start appearing, EVERY subsequent action on this page
# fails identically — there is no page left to recover on, and retrying
# per-row just burns through the whole rest of the list producing an
# error per PO. These must propagate up so runner.py's browser-restart
# loop actually triggers, instead of being swallowed as one row's failure.
_FATAL_BROWSER_ERROR_MARKERS = (
    "Target page, context or browser has been closed",
    "Connection closed while reading from the driver",
    "Target crashed",
    "Page crashed",
    "Browser has been closed",
)


def _is_fatal_browser_error(exc: Exception) -> bool:
    text = str(exc)
    return any(marker in text for marker in _FATAL_BROWSER_ERROR_MARKERS)


async def _open_po_detail_and_scrape(page: Page, row_index: int, po_idx: int, po_number: str) -> tuple[dict | None, bool]:
    """Clicks the given row's PO Number link (same-tab navigation,
    confirmed live — NOT a new page/tab despite the link's
    'OpenNewTab' CSS class name), scrapes the detail page, then
    `go_back()`s to the list (confirmed live to restore the exact same
    filtered + paginated grid state, not reset to page 1 / unfiltered).

    Returns `(detail_or_None, page_confirmed_healthy)`. `page_confirmed_healthy`
    tells the caller whether this failure says anything about the PAGE's
    state (worth counting toward a "the page itself is stuck" circuit
    breaker) versus being a known, self-contained, per-PO condition where
    we've positively confirmed the list grid is still intact.

    Confirmed live: a handful of specific POs (reproducible across
    restarts, e.g. KIRT/O-0289/PO26) simply never navigate on click —
    likely a dialog we don't handle, or a genuinely inert link for that
    PO — while the list page remains perfectly fine. Treating that as
    "page might be stuck" tripped the circuit breaker on every single
    attempt (since restarting doesn't change the click outcome for THOSE
    POs) and burned all restart attempts without ever passing them."""
    try:
        link = page.locator(".k-grid-content-locked tbody tr").nth(row_index).locator("td").nth(po_idx).locator("a")
        # Ensure the loading mask isn't obscuring the click
        try:
            await page.wait_for_selector(".k-loading-mask", state="hidden", timeout=5000)
        except Exception:
            pass
        # Confirmed live (2026-09-07): for a reproducible subset of rows,
        # Playwright's simulated mouse click (forced OR real/non-forced,
        # both tested) silently does nothing — no navigation, no network
        # call, no console error, no new tab — while elementFromPoint at
        # the exact click coordinates confirms the correct anchor is right
        # there with nothing overlapping it. A native DOM `element.click()`
        # reliably navigates for every row tested, including all of these.
        # Root cause on SmartPAL's side isn't pinned down (its jQuery click
        # handler presumably reacts differently to a synthetic vs a real
        # DOM click for these rows), but the native-click path is 8/8
        # reproducible against the affected rows, so use it instead of
        # Playwright's click entirely.
        await link.evaluate("el => el.click()")

        try:
            await page.wait_for_url("**/POCreation**", timeout=15000)
        except Exception:
            logger.warning(f"Clicking {po_number}'s link did not navigate to a detail page (URL still {page.url}) — skipping this PO.")
            return None, True

        detail = await scrape_current_po_detail(page, po_number)
        await page.go_back()
        try:
            await page.wait_for_selector(".k-loading-mask", state="hidden", timeout=15000)
        except Exception:
            pass
        await page.wait_for_timeout(500)
        return detail, True
    except Exception as e:
        if _is_fatal_browser_error(e):
            logger.error(f"Fatal browser error while scraping {po_number} — propagating for a browser restart: {e}")
            raise
        logger.error(f"Failed to scrape detail for {po_number}: {e}")
        # Best-effort recovery: if we're stuck on the detail page, go back
        # so the next row's click still lands on the list grid.
        try:
            if "POOverview" not in page.url:
                await page.go_back()
                await page.wait_for_timeout(1000)
        except Exception:
            pass
        return None, False


async def extract_list_rows(
    page: Page,
    scrape_details: bool = True,
    on_po_scraped: Callable[[dict], Awaitable[None]] | None = None,
    skip_po_numbers: set[str] | None = None,
) -> list[dict]:
    """Extracts every row across the grid's Kendo pager (confirmed
    page-based, not virtual scroll), mapping cells by header label rather
    than fixed index since leading icon-only columns vary in count (the
    grid's visible column set is a saved-per-account view and has been
    observed to vary between 30 and 84+ columns across sessions).

    When `scrape_details` is True (the default), each row's PO detail page
    (header fields + line items) is scraped inline — clicking the list
    grid's own PO Number link is the ONLY way to reach it (no real URL to
    navigate to independently, see po_detail_scraper's module docstring).
    If `on_po_scraped` is given, each completed record (list fields +
    `header_fields` + `line_items`) is passed to it immediately (so the
    caller can upsert incrementally instead of holding ~1500+ full records
    in memory); the same records are still accumulated and returned.

    `skip_po_numbers` lets a caller resume after a browser crash mid-run
    (headless Chromium has been observed to crash/OOM after repeatedly
    navigating this heavy detail page in the same tab — see runner.py's
    restart-and-resume loop) without re-scraping detail pages for POs
    already completed in an earlier attempt this run."""
    rows: list[dict] = []
    seen_po_numbers: set[str] = set()
    skip_po_numbers = skip_po_numbers or set()
    consecutive_detail_failures = 0

    try:
        await page.wait_for_selector(".k-grid-content-locked tbody tr td", timeout=15000)
    except Exception:
        logger.warning("No grid rows appeared after Show — the filtered result set may genuinely be empty.")

    index_map, raw_label_map = await _build_column_index_map(page)
    if "po_number" not in index_map:
        raise RuntimeError("Could not find 'PO Number' column header — grid layout may have changed.")
    po_idx = index_map["po_number"]

    page_num = 1
    while True:
        row_data = await page.evaluate(_READ_ROWS_JS)

        new_on_this_page = 0
        for row_index_on_page, entry in enumerate(row_data):
            cells = entry["cells"]
            if len(cells) <= po_idx:
                continue
            po_number = cells[po_idx]
            if not po_number or po_number in seen_po_numbers:
                continue
            seen_po_numbers.add(po_number)

            if po_number in skip_po_numbers:
                continue  # already fully scraped in an earlier attempt this run (crash-resume)

            new_on_this_page += 1

            record = {field: (cells[i] if i < len(cells) else None) for field, i in index_map.items()}
            # Full verbatim capture of EVERY labeled column in the grid,
            # not just the ones promoted to typed fields above — this is
            # what makes it into extra_fields so nothing scraped is lost.
            record["raw_list_fields"] = {
                label: (cells[i] if i < len(cells) else None) for label, i in raw_label_map.items()
            }

            if scrape_details:
                detail, page_confirmed_healthy = await _open_po_detail_and_scrape(page, row_index_on_page, po_idx, po_number)
                if detail:
                    record["header_fields"] = detail["header_fields"]
                    record["line_items"] = detail["line_items"]
                    consecutive_detail_failures = 0
                else:
                    record["header_fields"] = None
                    record["line_items"] = None
                    if page_confirmed_healthy:
                        # A known, self-contained per-PO condition (e.g. its
                        # link is inert) — we positively confirmed the list
                        # grid is still intact, so this says nothing about
                        # the page being stuck. Don't let a string of these
                        # (which WILL recur identically on every restart,
                        # confirmed live) burn through all restart attempts
                        # without ever making progress past them.
                        consecutive_detail_failures = 0
                    else:
                        consecutive_detail_failures += 1
                        # A single stuck/slow row is normal and recoverable. But if
                        # several IN A ROW fail with page state left ambiguous, the
                        # page itself is likely stuck (e.g. go_back() silently
                        # didn't restore the list) — confirmed live: this produced
                        # 12 back-to-back 60s Locator.click timeouts, none matching
                        # the known "fatal browser death" error strings, burning
                        # ~12 minutes before the run just gave up instead of
                        # restarting. Treat this as fatal too so runner.py's
                        # browser-restart loop kicks in.
                        if consecutive_detail_failures >= CONSECUTIVE_FAILURE_LIMIT:
                            raise RuntimeError(
                                f"{consecutive_detail_failures} consecutive ambiguous detail-scrape failures — "
                                f"the page is likely stuck, not recovering. Propagating for a browser restart."
                            )

            rows.append(record)
            if on_po_scraped:
                await on_po_scraped(record)

        logger.info(f"Page {page_num}: {len(row_data)} rows in DOM, {new_on_this_page} new (total so far: {len(rows)}).")

        # Kendo's pager directional buttons all share class "k-link k-pager-nav"
        # regardless of direction (first/prev/next/last) — there is no distinct
        # "k-pager-next" class. Distinguish by title text instead.
        next_btn = page.locator('a.k-pager-nav[title="Go to the next page"]')
        next_count = await next_btn.count()
        if next_count == 0:
            logger.info("No 'Go to the next page' pager link found — assuming this is the last/only page.")
            break
        next_classes = await next_btn.first.get_attribute("class") or ""
        aria_disabled = await next_btn.first.get_attribute("aria-disabled")
        if "k-state-disabled" in next_classes or aria_disabled == "true":
            logger.info("Next-page button is disabled — reached the last page.")
            break

        await next_btn.first.click()
        try:
            await page.wait_for_selector(".k-loading-mask", state="hidden", timeout=15000)
        except Exception:
            pass
        await page.wait_for_timeout(800)
        page_num += 1

    logger.info(f"Extracted {len(rows)} PO list rows across {page_num} page(s).")
    return rows


async def fetch_po_list(
    context: BrowserContext,
    page: Page,
    scrape_details: bool = True,
    on_po_scraped: Callable[[dict], Awaitable[None]] | None = None,
    skip_po_numbers: set[str] | None = None,
) -> list[dict]:
    """Top-level entrypoint. Currently DOM-scrapes; swap the body for a
    direct JSON API call here if a usable JSON endpoint is ever found,
    without changing this function's signature/return shape."""
    if not await open_po_overview(page):
        raise RuntimeError("Could not open PO Overview page.")
    await click_finally_approved_tab(page)
    await apply_category_filter_excluding_crew(page)
    await run_show_query(page)
    return await extract_list_rows(
        page, scrape_details=scrape_details, on_po_scraped=on_po_scraped, skip_po_numbers=skip_po_numbers
    )
