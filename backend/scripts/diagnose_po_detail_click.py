"""Diagnostic: what actually happens when you click a PO Number link —
new tab, same-page navigation, or an in-place panel/modal?"""
import asyncio
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

        print("Pages in context before click:", len(context.pages))

        # Click the first PO Number link in the locked table.
        try:
            async with context.expect_page(timeout=8000) as new_page_info:
                await page.locator(".k-grid-content-locked tbody tr td a").first.click()
            new_page = await new_page_info.value
            await new_page.wait_for_load_state("domcontentloaded", timeout=15000)
            print("NEW TAB opened. URL:", new_page.url)
            await new_page.wait_for_timeout(2000)
            await new_page.screenshot(path=str(OUT_DIR / "po_detail_new_tab.png"))
            text = await new_page.evaluate("() => document.body.innerText")
            (OUT_DIR / "po_detail_new_tab.txt").write_text(text, encoding="utf-8")
            print("Dumped new tab content, length:", len(text))
        except Exception as e:
            print("No new tab opened within timeout:", e)
            print("Pages in context after click attempt:", len(context.pages))
            # Maybe it's an in-place panel/modal on the SAME page instead.
            await page.wait_for_timeout(1500)
            await page.screenshot(path=str(OUT_DIR / "po_detail_same_page.png"))
            text = await page.evaluate("() => document.body.innerText")
            (OUT_DIR / "po_detail_same_page.txt").write_text(text, encoding="utf-8")
            print("Dumped same-page content after click, length:", len(text))


if __name__ == "__main__":
    asyncio.run(main())
