"""API-vs-DOM investigation helper (plan Milestone 3).

Before building the full DOM-based extractor, run this against the real
PO Overview page (manually driving the Finally Approved tab, Category
filter, and Show click) to check whether the Kendo/Telerik grid loads its
data from a clean JSON endpoint. If one is found, `po_overview_scraper.py`
should call it directly via `context.request` instead of scraping the DOM.

Usage (manual, non-headless, for investigation only):
    python -m app.scraper.api_probe
"""
import asyncio
import json

from playwright.async_api import Page, Request, Response

from app.core.logging import logger

JSON_ENDPOINT_MARKERS = ["Read", "GetPOList", "POOverview", "json", "/api/"]


def looks_like_grid_endpoint(url: str) -> bool:
    return any(marker.lower() in url.lower() for marker in JSON_ENDPOINT_MARKERS)


async def attach_probe(page: Page) -> list[dict]:
    """Attach request/response listeners; returns a list you can inspect
    after driving the page manually (filter/Show clicks etc)."""
    captured: list[dict] = []

    async def on_response(response: Response):
        request: Request = response.request
        if request.resource_type not in ("xhr", "fetch"):
            return
        if not looks_like_grid_endpoint(response.url):
            return
        try:
            content_type = response.headers.get("content-type", "")
            if "json" not in content_type:
                return
            body = await response.json()
            captured.append({"url": response.url, "method": request.method, "sample": body})
            logger.info(f"[api_probe] Candidate JSON endpoint: {response.url}")
        except Exception:
            pass

    page.on("response", on_response)
    return captured


if __name__ == "__main__":
    from app.scraper.browser import launch_context
    from app.scraper.login import login

    async def main():
        async with launch_context(headless=False) as (browser, context):
            page = await context.new_page()
            captured = await attach_probe(page)
            ok = await login(page)
            if not ok:
                return
            await page.goto("https://smartpal.ozellar.com/PurchasePALApp/Purchase/POOverview")
            print("Manually drive the page now: click Finally Approved, set the Category filter, click Show.")
            print("Press Enter here once you've clicked Show and the grid has loaded...")
            await asyncio.get_event_loop().run_in_executor(None, input)
            print(json.dumps(captured, indent=2, default=str)[:5000])

    asyncio.run(main())
