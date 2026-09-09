"""Confirmed: clicking the actual PO Number link (cell index 10, class
'link poclick OpenNewTab') opens the detail page correctly, no permission
error. Now verify the line-items table extracts correctly."""
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

        print("Pages before click:", len(context.pages))
        await page.locator(".k-grid-content-locked tbody tr").first.locator("td").nth(10).locator("a").click()

        # Wait for the "Processing your request" overlay to clear.
        try:
            await page.wait_for_selector("text=Processing your request", state="hidden", timeout=15000)
        except Exception:
            pass
        await page.wait_for_timeout(2000)
        print("Pages after click:", len(context.pages))
        print("Current URL:", page.url)

        await page.screenshot(path=str(OUT_DIR / "po_detail_loaded.png"))
        text = await page.evaluate("() => document.body.innerText")
        (OUT_DIR / "po_detail_loaded.txt").write_text(text, encoding="utf-8")
        print("Body text length:", len(text))
        print("First 1500 chars:\n", text[:1500])

        # Try to extract the line-items grid.
        line_items = await page.evaluate(
            """() => {
                const grids = Array.from(document.querySelectorAll(".k-grid"));
                const candidates = grids.filter(g => g.offsetWidth > 0 && g.querySelector("tbody tr"));
                if (candidates.length === 0) return {error: "no grid found"};
                candidates.sort((a, b) => b.querySelectorAll("thead th").length - a.querySelectorAll("thead th").length);
                const g = candidates[0];
                const headers = Array.from(g.querySelectorAll("thead th")).map(th => th.innerText.trim());
                const rows = Array.from(g.querySelectorAll("tbody tr")).map(tr =>
                    Array.from(tr.querySelectorAll("td")).map(td => td.innerText.trim())
                );
                return {headers, rowCount: rows.length, firstRow: rows[0] || null, allGridsCount: candidates.length};
            }"""
        )
        print("\nLine items grid:", json.dumps(line_items, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
