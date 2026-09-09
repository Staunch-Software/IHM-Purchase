"""Precisely verify which link gets clicked: locate the PO Number cell by
its confirmed index (10) within the locked table's first row, confirm its
text is literally the PO number before clicking, then click exactly that
link (not '.first' over all anchors in the row, which also matches an
Attachment icon anchor)."""
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

        # Inspect ALL anchors in the first locked row, with their cell index and text.
        anchors_info = await page.evaluate(
            """() => {
                const row = document.querySelector(".k-grid-content-locked tbody tr");
                if (!row) return {error: "no row"};
                const cells = Array.from(row.querySelectorAll("td"));
                return cells.map((td, idx) => {
                    const link = td.querySelector("a");
                    return {
                        cellIndex: idx,
                        cellText: td.innerText.trim(),
                        hasLink: !!link,
                        linkText: link ? link.innerText.trim() : null,
                        linkClass: link ? link.className : null,
                        linkHref: link ? link.getAttribute("href") : null,
                    };
                });
            }"""
        )
        print("All cells in first row:")
        for c in anchors_info:
            print(f"  cell[{c['cellIndex']}]: text={c['cellText']!r} hasLink={c['hasLink']} linkText={c['linkText']!r} linkClass={c['linkClass']!r}")

        # Now specifically click cell index 10 (confirmed PO Number column) 's anchor.
        po_number_before = anchors_info[10]["linkText"] if len(anchors_info) > 10 else None
        print(f"\nCell[10] link text (should be the PO number): {po_number_before!r}")

        await page.locator(".k-grid-content-locked tbody tr").first.locator("td").nth(10).locator("a").click()
        await page.wait_for_timeout(1500)

        error_visible = await page.evaluate(
            """() => {
                const el = Array.from(document.querySelectorAll("div, span")).find(e => e.innerText && e.innerText.includes("not allocated"));
                return !!el;
            }"""
        )
        print(f"After clicking cell[10]'s link specifically: {'BLOCKED (not allocated)' if error_visible else 'opened OK'}")
        await page.screenshot(path=str(OUT_DIR / "verify_click_target.png"))


if __name__ == "__main__":
    asyncio.run(main())
