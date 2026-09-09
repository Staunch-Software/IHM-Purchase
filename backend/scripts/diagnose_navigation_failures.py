"""Investigate why so many rows failed to navigate on click in the last
full run (39/64). Check specifically whether it's the same 'not allocated
for vessel/category' modal we found earlier, now happening for more POs,
or something else entirely (e.g. click landing on the wrong element)."""
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

# A few PO numbers confirmed to fail "did not navigate" in the last run.
TARGET_POS = ["KIRT/O-0232/PO26"]


async def main():
    async with launch_context(headless=True) as (browser, context):
        page = await context.new_page()
        await login(page)
        await open_po_overview(page)
        await click_finally_approved_tab(page)
        await apply_category_filter_excluding_crew(page)
        await run_show_query(page)
        await page.wait_for_timeout(2000)

        for target in TARGET_POS:
            # Use the PO Number search filter to jump straight to it.
            search_box = page.locator("#autoCompletePOText")
            await search_box.fill("")
            await search_box.fill(target)
            await page.wait_for_timeout(1500)
            # Pick the autocomplete suggestion if one appears, else just show.
            try:
                await page.locator(".k-list-container li, .k-animation-container li").first.click(timeout=3000)
                await page.wait_for_timeout(500)
            except Exception:
                pass

            await page.locator(".btn-icon-apply-search-result").click()
            await page.wait_for_timeout(2500)
            try:
                await page.wait_for_selector(".k-loading-mask", state="hidden", timeout=15000)
            except Exception:
                pass

            row_count = await page.evaluate(
                """() => document.querySelectorAll(".k-grid-content-locked tbody tr").length"""
            )
            print(f"\n=== {target} === rows after search: {row_count}")
            if row_count == 0:
                print("  No row found for this PO after searching — skipping click test.")
                continue

            await page.locator(".k-grid-content-locked tbody tr").first.locator("td").nth(10).locator("a").click()
            await page.wait_for_timeout(2500)

            error_visible = await page.evaluate(
                """() => {
                    const el = Array.from(document.querySelectorAll("div, span")).find(e => e.innerText && e.innerText.includes("not allocated"));
                    return el ? el.closest('.modal, [class*=modal]')?.innerText || el.innerText : null;
                }"""
            )
            current_url = page.url
            print(f"  URL after click: {current_url}")
            print(f"  'not allocated' modal text: {error_visible!r}")

            safe_name = target.replace("/", "_")
            await page.screenshot(path=str(OUT_DIR / f"navfail_{safe_name}.png"))

            if error_visible:
                await page.evaluate(
                    """() => {
                        const btns = Array.from(document.querySelectorAll("button"));
                        const gotIt = btns.find(b => b.innerText.trim() === "Got It");
                        if (gotIt) gotIt.click();
                    }"""
                )
                await page.wait_for_timeout(500)
            elif "POCreation" in current_url:
                await page.go_back()
                await page.wait_for_timeout(1500)


if __name__ == "__main__":
    asyncio.run(main())
