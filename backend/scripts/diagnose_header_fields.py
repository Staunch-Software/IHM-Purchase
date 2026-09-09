"""Test whether the existing label-proximity extract_header_fields()
actually works against the real detail page."""
import asyncio
import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.scraper.browser import launch_context  # noqa: E402
from app.scraper.login import login  # noqa: E402
from app.scraper.po_detail_scraper import extract_header_fields  # noqa: E402
from app.scraper.po_overview_scraper import (  # noqa: E402
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

        await page.locator(".k-grid-content-locked tbody tr").first.locator("td").nth(10).locator("a").click()
        try:
            await page.wait_for_selector(".k-grid tbody tr td", timeout=20000)
        except Exception:
            pass
        await page.wait_for_timeout(3000)

        fields = await extract_header_fields(page)
        (OUT_DIR / "header_fields_result.json").write_text(json.dumps(fields, indent=2), encoding="utf-8")
        print("extract_header_fields() result:", json.dumps(fields, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
