import asyncio
import sys
from pathlib import Path
from collections import defaultdict

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.database import SessionLocal
from app.scraper.browser import launch_context
from app.scraper.login import login
from app.scraper.po_overview_scraper import (
    open_po_overview,
    click_finally_approved_tab,
    apply_category_filter_excluding_crew,
    run_show_query,
    _build_column_index_map,
    _READ_ROWS_JS,
    _open_po_detail_and_scrape
)
from app.scraper.upsert import upsert_po_list_row, upsert_po_detail
from app.core.logging import logger, setup_logging

async def check_all_vessels():
    setup_logging()
    vessel_counts = defaultdict(int)
    TARGET = 10
    
    async with SessionLocal() as db:
        async with launch_context(headless=True) as (browser, context):
            page = await context.new_page()
            if not await login(page):
                logger.error("Login failed")
                return
                
            if not await open_po_overview(page):
                logger.error("Could not open PO Overview")
                return
                
            await click_finally_approved_tab(page)
            await apply_category_filter_excluding_crew(page)
            await run_show_query(page)
            
            try:
                await page.wait_for_selector(".k-grid-content-locked tbody tr td", timeout=15000)
            except Exception:
                pass

            index_map, raw_label_map = await _build_column_index_map(page)
            po_idx = index_map.get("po_number")
            vessel_idx = index_map.get("vessel")
            
            if po_idx is None or vessel_idx is None:
                logger.error("Could not find PO Number or Vessel column")
                return

            page_num = 1
            while True:
                row_data = await page.evaluate(_READ_ROWS_JS)
                
                for row_index_on_page, entry in enumerate(row_data):
                    cells = entry["cells"]
                    if len(cells) <= po_idx or len(cells) <= vessel_idx:
                        continue
                        
                    po_number = cells[po_idx]
                    vessel = cells[vessel_idx]
                    
                    if not po_number or not vessel:
                        continue
                        
                    if vessel_counts[vessel] < TARGET:
                        logger.info(f"Checking {po_number} for {vessel}...")
                        detail, healthy = await _open_po_detail_and_scrape(page, row_index_on_page, po_idx, po_number)
                        if detail:
                            # Save to DB so it shows in UI
                            record = {field: (cells[i] if i < len(cells) else None) for field, i in index_map.items()}
                            record["raw_list_fields"] = {label: (cells[i] if i < len(cells) else None) for label, i in raw_label_map.items()}
                            record["po_number"] = po_number # ensure it's there
                            
                            try:
                                await upsert_po_list_row(db, record)
                                await upsert_po_detail(db, po_number, detail["header_fields"], detail["line_items"] or [])
                                vessel_counts[vessel] += 1
                                logger.info(f"Successfully scraped and saved {po_number} for {vessel} ({vessel_counts[vessel]}/{TARGET})")
                            except Exception as e:
                                logger.error(f"Failed to save to DB for {po_number}: {e}")
                        else:
                            logger.warning(f"Failed to scrape detail for {po_number} (Vessel: {vessel})")
                            if not healthy:
                                logger.error("Page state unhealthy, aborting run.")
                                return
                                
                completed_vessels = sum(1 for v, c in vessel_counts.items() if c >= TARGET)
                logger.info(f"Page {page_num} done. Vessels completed: {completed_vessels}. Total known vessels: {len(vessel_counts)}")
                
                if completed_vessels >= 14:
                    logger.info("Reached 10 rows for 14 vessels! Check passed.")
                    break

                next_btn = page.locator('a.k-pager-nav[title="Go to the next page"]')
                next_count = await next_btn.count()
                if next_count == 0:
                    break
                
                aria_disabled = await next_btn.first.get_attribute("aria-disabled")
                if aria_disabled == "true":
                    break
                    
                await next_btn.first.click()
                try:
                    await page.wait_for_selector(".k-loading-mask", state="hidden", timeout=15000)
                except Exception:
                    pass
                await page.wait_for_timeout(800)
                page_num += 1

            logger.info("Final vessel counts:")
            for v, c in sorted(vessel_counts.items()):
                logger.info(f"{v}: {c}")

if __name__ == "__main__":
    asyncio.run(check_all_vessels())
