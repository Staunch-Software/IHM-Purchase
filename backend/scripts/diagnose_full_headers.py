"""Capture the FULL header list for both the PO list grid (locked +
scrollable) and the PO detail item grid, written to JSON. Used to design a
complete column mapping instead of the narrow subset picked earlier."""
import asyncio
import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.scraper.browser import launch_context  # noqa: E402
from app.scraper.login import login  # noqa: E402
from app.scraper.po_overview_scraper import (  # noqa: E402
    _READ_HEADERS_JS,
    apply_category_filter_excluding_crew,
    click_finally_approved_tab,
    open_po_overview,
    run_show_query,
)

OUT_DIR = Path(__file__).resolve().parents[1] / "scratch_diagnostics"
OUT_DIR.mkdir(exist_ok=True)


async def main():
    async with launch_context(headless=True) as (browser, context):
        page = await context.new_page()
        await login(page)
        await open_po_overview(page)
        await click_finally_approved_tab(page)
        await apply_category_filter_excluding_crew(page)
        await run_show_query(page)
        await page.wait_for_timeout(2000)

        list_headers = await page.evaluate(_READ_HEADERS_JS)
        (OUT_DIR / "list_grid_full_headers.json").write_text(json.dumps(list_headers, indent=2), encoding="utf-8")
        print(f"List grid: {len(list_headers)} headers -> list_grid_full_headers.json")

        # Also grab the FIRST real row's cells so we can see actual sample
        # values aligned to each header index (helps disambiguate blank
        # header labels and duplicate labels like "Total Amount [USD]").
        first_row = await page.evaluate(
            """() => {
                const lockedRows = Array.from(document.querySelectorAll(".k-grid-content-locked tbody tr"));
                const scrollRows = Array.from(document.querySelectorAll(".k-grid-content.k-auto-scrollable tbody tr"));
                if (lockedRows.length === 0 || scrollRows.length === 0) return [];
                const lockedCells = Array.from(lockedRows[0].querySelectorAll("td")).map(td => td.innerText.trim());
                const scrollCells = Array.from(scrollRows[0].querySelectorAll("td")).map(td => td.innerText.trim());
                return lockedCells.concat(scrollCells);
            }"""
        )
        labeled = [{"index": i, "header": h, "sample": (first_row[i] if i < len(first_row) else None)} for i, h in enumerate(list_headers)]
        (OUT_DIR / "list_grid_headers_labeled.json").write_text(json.dumps(labeled, indent=2), encoding="utf-8")
        print("Wrote list_grid_headers_labeled.json")


if __name__ == "__main__":
    asyncio.run(main())
