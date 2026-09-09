"""Verify the new interleaved list+detail scraper on a SMALL slice: patch
extract_list_rows' pager loop indirectly by monkeypatching the "next page"
check to stop after page 1, and log every completed record."""
import asyncio
import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.scraper.browser import launch_context  # noqa: E402
from app.scraper.login import login  # noqa: E402
from app.scraper.po_overview_scraper import (  # noqa: E402
    apply_category_filter_excluding_crew,
    click_finally_approved_tab,
    open_po_overview,
    run_show_query,
    extract_list_rows,
)

OUT_DIR = Path(__file__).resolve().parents[1] / "scratch_diagnostics"
OUT_DIR.mkdir(exist_ok=True)

completed = []


class StopSmokeTest(Exception):
    pass


async def on_po_scraped(record):
    completed.append(record)
    print(f"  Scraped: {record['po_number']} | items: {len(record.get('line_items') or [])} | header_fields present: {record.get('header_fields') is not None}")
    if len(completed) >= 5:
        raise StopSmokeTest()


async def main():
    async with launch_context(headless=True) as (browser, context):
        page = await context.new_page()
        await login(page)
        await open_po_overview(page)
        await click_finally_approved_tab(page)
        await apply_category_filter_excluding_crew(page)
        await run_show_query(page)
        try:
            rows = await extract_list_rows(page, scrape_details=True, on_po_scraped=on_po_scraped)
        except StopSmokeTest:
            print("\nStopped intentionally after 3 rows for this smoke test.")

        (OUT_DIR / "interleaved_smoke_test.json").write_text(json.dumps(completed, indent=2), encoding="utf-8")
        print(f"\nTotal completed: {len(completed)}")
        for r in completed:
            print(f"\n=== {r['po_number']} ===")
            print("List fields: vessel=%r category=%r title=%r amount=%r" % (r.get("vessel"), r.get("category"), r.get("title"), r.get("base_currency_amount")))
            hf = r.get("header_fields") or {}
            print("Header fields: vendor_name=%r priority=%r delivery_port=%r" % (hf.get("vendor_name"), hf.get("priority"), hf.get("delivery_port")))
            items = r.get("line_items") or []
            print(f"Line items ({len(items)}):")
            for it in items:
                print("   ", it)


if __name__ == "__main__":
    asyncio.run(main())
