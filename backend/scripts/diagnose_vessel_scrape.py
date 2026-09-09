import asyncio
import sys
from pathlib import Path
import json

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.scraper.browser import launch_context
from app.scraper.login import login
from app.scraper.po_overview_scraper import (
    open_po_overview,
    click_finally_approved_tab,
)
from app.core.logging import logger, setup_logging

async def main():
    setup_logging()
    async with launch_context(headless=True) as (browser, context):
        page = await context.new_page()
        if not await login(page):
            logger.error("Login failed")
            return
        
        if not await open_po_overview(page):
            logger.error("Could not open PO Overview")
            return
            
        await click_finally_approved_tab(page)
        
        # Click the vessel dropdown
        logger.info("Clicking vessel dropdown...")
        await page.evaluate('''() => {
            const spans = Array.from(document.querySelectorAll("span"));
            const vesselSpan = spans.find(el => el.className.includes("myVesselName"));
            if (vesselSpan) vesselSpan.click();
        }''')
        
        await page.wait_for_timeout(1500)
        
        # Dump vessel items
        info = await page.evaluate('''() => {
            // Find visible vessel options in the popup
            // They might be in a list or table
            const vessels = [];
            const container = document.querySelector(".vessel-search-tab, .vesselSearch-container, .popover");
            if (container) {
                // look for anything that looks like a vessel row
                const items = Array.from(container.querySelectorAll("li, tr, .vessel-item, a"));
                for (const item of items) {
                    if (item.innerText && item.innerText.trim().length > 0) {
                        vessels.push(item.innerText.trim());
                    }
                }
            }
            return vessels;
        }''')
        
        print(json.dumps(info, indent=2))
        
if __name__ == "__main__":
    asyncio.run(main())
