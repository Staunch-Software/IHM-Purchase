"""Check whether the 'not allocated' error is universal or specific to
certain vessels/categories, by trying several different PO rows."""
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


async def try_click(page, index, po_number, vessel, category):
    await page.locator(".k-grid-content-locked tbody tr td a").nth(index).click()
    await page.wait_for_timeout(1500)
    error_visible = await page.evaluate(
        """() => {
            const el = Array.from(document.querySelectorAll("div, span")).find(e => e.innerText && e.innerText.includes("not allocated"));
            return !!el;
        }"""
    )
    print(f"[{index}] {po_number} | {vessel} | {category} -> {'BLOCKED (not allocated)' if error_visible else 'OK, opened'}")
    if error_visible:
        # Dismiss the modal.
        await page.evaluate(
            """() => {
                const btns = Array.from(document.querySelectorAll("button"));
                const gotIt = btns.find(b => b.innerText.trim() === "Got It");
                if (gotIt) gotIt.click();
            }"""
        )
        await page.wait_for_timeout(500)
        return False
    return True


async def main():
    async with launch_context(headless=True) as (browser, context):
        page = await context.new_page()
        await login(page)
        await open_po_overview(page)
        await click_finally_approved_tab(page)
        await apply_category_filter_excluding_crew(page)
        await run_show_query(page)
        await page.wait_for_timeout(2000)

        rows = await page.evaluate(
            """() => {
                const lockedRows = Array.from(document.querySelectorAll(".k-grid-content-locked tbody tr"));
                const scrollRows = Array.from(document.querySelectorAll(".k-grid-content.k-auto-scrollable tbody tr"));
                const n = Math.min(lockedRows.length, scrollRows.length, 10);
                const out = [];
                for (let i = 0; i < n; i++) {
                    const poLink = lockedRows[i].querySelector("td a");
                    const scrollCells = Array.from(scrollRows[i].querySelectorAll("td")).map(td => td.innerText.trim());
                    out.push({
                        po: poLink ? poLink.innerText.trim() : null,
                        vessel: scrollCells[1] || null,
                        category: scrollCells[2] || null,
                    });
                }
                return out;
            }"""
        )

        for i, r in enumerate(rows):
            opened = await try_click(page, i, r["po"], r["vessel"], r["category"])
            if opened:
                print("  -> First successful open! Stopping here.")
                await page.screenshot(path=str(Path(__file__).resolve().parents[1] / "scratch_diagnostics" / "po_detail_opened.png"))
                text = await page.evaluate("() => document.body.innerText")
                (Path(__file__).resolve().parents[1] / "scratch_diagnostics" / "po_detail_opened.txt").write_text(text, encoding="utf-8")
                break


if __name__ == "__main__":
    asyncio.run(main())
