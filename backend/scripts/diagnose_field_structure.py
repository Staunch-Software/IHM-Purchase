"""Find the real form-group wrapper structure around header fields so we
can build a reliable label->value extractor (the naive label-proximity
approach returned garbage)."""
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

        # Find every .form-group (or similar) that contains BOTH a label-like
        # element and an input/select, capture the pairing.
        info = await page.evaluate(
            """() => {
                const candidates = Array.from(document.querySelectorAll(".form-group, [class*='col-']"));
                const results = [];
                const seen = new Set();
                for (const el of candidates) {
                    const label = el.querySelector("label");
                    const input = el.querySelector("input, select, textarea");
                    if (!label || !input) continue;
                    const labelText = label.innerText.trim();
                    if (!labelText || seen.has(labelText)) continue;
                    // Only consider direct-ish containers (avoid huge ancestor divs matching many fields)
                    const inputCount = el.querySelectorAll("input, select, textarea").length;
                    if (inputCount > 3) continue;
                    seen.add(labelText);
                    let value = input.value;
                    if (input.tagName === "SELECT") {
                        value = input.options[input.selectedIndex] ? input.options[input.selectedIndex].text : "";
                    }
                    results.push({
                        label: labelText,
                        wrapperClass: el.className,
                        inputTag: input.tagName,
                        inputId: input.id,
                        inputCls: input.className,
                        value: value,
                    });
                }
                return results;
            }"""
        )
        (OUT_DIR / "field_structure.json").write_text(json.dumps(info, indent=2), encoding="utf-8")
        print(f"Found {len(info)} label/input pairs. Sample:")
        for r in info[:40]:
            print(f"  {r['label']!r} -> {r['value']!r} (id={r['inputId']!r}, tag={r['inputTag']})")


if __name__ == "__main__":
    asyncio.run(main())
