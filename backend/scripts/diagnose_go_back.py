"""Verify: after opening a PO detail page (same-tab navigation) and going
back, does the list grid restore its filtered/paginated state, or does it
reset (losing the crew-exclusion filter / current page)?"""
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


async def records_text(page):
    return await page.evaluate(
        """() => {
            const all = Array.from(document.querySelectorAll('span, div'));
            const match = all.filter(e => e.children.length === 0 && /records found/i.test(e.innerText || ""));
            return match.length ? match[0].innerText.trim() : "NOT FOUND";
        }"""
    )


async def first_po(page):
    return await page.evaluate(
        """() => {
            const row = document.querySelector(".k-grid-content-locked tbody tr");
            if (!row) return null;
            const cells = Array.from(row.querySelectorAll("td"));
            const link = cells[10] ? cells[10].querySelector("a") : null;
            return link ? link.innerText.trim() : null;
        }"""
    )


async def current_page_number(page):
    return await page.evaluate(
        """() => {
            const el = document.querySelector(".k-pager-numbers .k-state-selected");
            return el ? el.innerText.trim() : null;
        }"""
    )


async def main():
    async with launch_context(headless=True) as (browser, context):
        page = await context.new_page()
        await login(page)
        await open_po_overview(page)
        await click_finally_approved_tab(page)
        await apply_category_filter_excluding_crew(page)
        await run_show_query(page)
        await page.wait_for_timeout(2000)

        print("Before click:")
        print("  records:", await records_text(page))
        print("  first PO:", await first_po(page))
        print("  URL:", page.url)

        # Go to page 2 first, so we can check if "back" preserves pagination too.
        await page.locator('a.k-pager-nav[title="Go to the next page"]').first.click()
        await page.wait_for_timeout(2000)
        print("\nOn page 2:")
        print("  first PO:", await first_po(page))
        print("  page number:", await current_page_number(page))

        target_po = await first_po(page)
        await page.locator(".k-grid-content-locked tbody tr").first.locator("td").nth(10).locator("a").click()
        try:
            await page.wait_for_selector(".k-grid tbody tr td", timeout=15000)
        except Exception:
            pass
        await page.wait_for_timeout(2000)
        print("\nAfter opening detail page:")
        print("  URL:", page.url)

        await page.go_back()
        await page.wait_for_timeout(3000)
        try:
            await page.wait_for_selector(".k-loading-mask", state="hidden", timeout=10000)
        except Exception:
            pass
        await page.wait_for_timeout(1000)

        print("\nAfter go_back():")
        print("  URL:", page.url)
        print("  records:", await records_text(page))
        print("  page number:", await current_page_number(page))
        print("  first PO now:", await first_po(page))
        print(f"  Expected first PO (page 2's original first row): {target_po}")
        print("  Match:", (await first_po(page)) == target_po)

        await page.screenshot(path=str(OUT_DIR / "after_go_back.png"))


if __name__ == "__main__":
    asyncio.run(main())
