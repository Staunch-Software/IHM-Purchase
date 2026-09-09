"""Same as full2 but write JSON to a file instead of stdout (stdout capture
is truncated for large outputs)."""
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

        try:
            await page.wait_for_selector(".k-grid tbody tr td", timeout=20000)
        except Exception:
            pass
        await page.wait_for_timeout(3000)
        try:
            await page.wait_for_selector("text=Processing your request", state="hidden", timeout=10000)
        except Exception:
            pass
        await page.wait_for_timeout(1000)

        line_items = await page.evaluate(
            """() => {
                const grids = Array.from(document.querySelectorAll(".k-grid"));
                const candidates = grids.filter(g => g.offsetWidth > 0 && g.querySelector("tbody tr"));
                if (candidates.length === 0) return {error: "no grid with rows found"};
                candidates.sort((a, b) => b.querySelectorAll("thead th").length - a.querySelectorAll("thead th").length);
                const g = candidates[0];
                const headers = Array.from(g.querySelectorAll("thead th")).map(th => th.innerText.trim());
                const rows = Array.from(g.querySelectorAll("tbody tr")).map(tr =>
                    Array.from(tr.querySelectorAll("td")).map(td => td.innerText.trim())
                );
                // Zip headers with first row's cells for readability.
                const firstRowLabeled = {};
                if (rows[0]) {
                    headers.forEach((h, i) => { if (h) firstRowLabeled[h] = rows[0][i]; });
                }
                return {headerCount: headers.length, headers, rowCount: rows.length, firstRowLabeled};
            }"""
        )
        (OUT_DIR / "line_items_result.json").write_text(json.dumps(line_items, indent=2), encoding="utf-8")
        print("Wrote line_items_result.json, headerCount:", line_items.get("headerCount"), "rowCount:", line_items.get("rowCount"))


if __name__ == "__main__":
    asyncio.run(main())
