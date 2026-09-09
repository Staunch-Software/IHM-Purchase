"""Same as diagnose_po_detail_full.py but waits properly for the line-items
grid to actually finish loading before inspecting it."""
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

        await page.locator(".k-grid-content-locked tbody tr").first.locator("td").nth(10).locator("a").click()

        # Wait for the line-items grid specifically (a .k-grid with actual rows).
        try:
            await page.wait_for_selector(".k-grid tbody tr td", timeout=20000)
        except Exception as e:
            print("Timed out waiting for any grid row:", e)

        await page.wait_for_timeout(3000)
        try:
            await page.wait_for_selector("text=Processing your request", state="hidden", timeout=10000)
        except Exception:
            pass
        await page.wait_for_timeout(1000)

        print("Current URL:", page.url)
        await page.screenshot(path=str(OUT_DIR / "po_detail_full2.png"))

        line_items = await page.evaluate(
            """() => {
                const grids = Array.from(document.querySelectorAll(".k-grid"));
                const candidates = grids.filter(g => g.offsetWidth > 0 && g.querySelector("tbody tr"));
                if (candidates.length === 0) return {error: "no grid with rows found", totalKGrids: grids.length};
                candidates.sort((a, b) => b.querySelectorAll("thead th").length - a.querySelectorAll("thead th").length);
                const g = candidates[0];
                const headers = Array.from(g.querySelectorAll("thead th")).map(th => th.innerText.trim());
                const rows = Array.from(g.querySelectorAll("tbody tr")).map(tr =>
                    Array.from(tr.querySelectorAll("td")).map(td => td.innerText.trim())
                );
                return {headers, rowCount: rows.length, rows: rows.slice(0, 3)};
            }"""
        )
        print("\nLine items grid:", json.dumps(line_items, indent=2))

        # Also grab header field VALUES (input elements, not just labels).
        header_values = await page.evaluate(
            """() => {
                const inputs = Array.from(document.querySelectorAll("input[type='text'], input:not([type]), textarea"));
                return inputs.filter(i => i.offsetWidth > 0).map(i => ({id: i.id, name: i.name, value: i.value, placeholder: i.placeholder})).slice(0, 20);
            }"""
        )
        print("\nVisible input values (sample):", json.dumps(header_values, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
