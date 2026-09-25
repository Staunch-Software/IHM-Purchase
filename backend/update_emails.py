import asyncio
import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from sqlalchemy import select
from app.core.database import SessionLocal
from app.models.purchase_order import PurchaseOrder
from app.scraper.browser import launch_context
from app.scraper.login import login
from app.scraper.po_overview_scraper import open_po_overview, click_finally_approved_tab, apply_date_filter
from app.scraper.po_detail_scraper import extract_vendor_email, wait_for_detail_page_ready

async def main():
    async with SessionLocal() as db:
        res = await db.execute(
            select(PurchaseOrder).where(
                (PurchaseOrder.vendor_email.is_(None)) | 
                (PurchaseOrder.vendor_email == "-Not Specified-")
            )
        )
        pos = res.scalars().all()
        if not pos:
            print("No POs missing emails.")
            return
            
        po_numbers_needed = {po.po_number for po in pos}
        print(f"Found {len(po_numbers_needed)} POs missing emails in the database.")
        
        async with launch_context(headless=True) as (browser, context):
            page = await context.new_page()
            print("Logging in to SmartPAL...")
            await login(page)
            
            print("Navigating to PO Overview...")
            await open_po_overview(page)
            await click_finally_approved_tab(page)
            
            # SmartPAL resets its filter to 30 days usually. Let's make sure we see everything.
            await apply_date_filter(page, "01-Jan-2010", "31-Dec-2030")
            
            print("Applying Show button...")
            await page.locator(".btn-icon-apply-search-result").click()
            await page.wait_for_timeout(2500)
            try:
                await page.wait_for_selector(".k-loading-mask", state="hidden", timeout=30000)
            except:
                pass
            await page.wait_for_timeout(1000)
            
            await page.wait_for_selector(".k-grid-content-locked tbody tr td", timeout=15000)
            
            updated_count = 0
            page_num = 1
            
            while po_numbers_needed:
                print(f"Scanning page {page_num}...")
                
                # Extract all PO numbers on the current page
                row_data = await page.evaluate("""() => {
                    const lockedRows = Array.from(document.querySelectorAll(".k-grid-content-locked tbody tr"));
                    return lockedRows.map((tr, idx) => {
                        const link = tr.querySelector("td a.link.poclick.OpenNewTab");
                        return {
                            index: idx,
                            poNumber: link ? link.innerText.trim() : null
                        };
                    });
                }""")
                
                for row in row_data:
                    po_num = row.get("poNumber")
                    idx = row.get("index")
                    
                    if po_num in po_numbers_needed:
                        print(f"Found {po_num} on page {page_num}. Extracting email...")
                        
                        try:
                            # Click the row
                            clicked = await page.evaluate(f"""(rowIdx) => {{
                                const rows = document.querySelectorAll(".k-grid-content-locked tbody tr");
                                if (rows.length <= rowIdx) return false;
                                const link = rows[rowIdx].querySelector("a.link.poclick");
                                if (link) {{
                                    link.click();
                                    return true;
                                }}
                                return false;
                            }}""", idx)
                            
                            if not clicked:
                                print(f" -> Could not click row for {po_num}.")
                                po_numbers_needed.remove(po_num)
                                continue
                            
                            # Wait for detail page
                            await wait_for_detail_page_ready(page)
                            await page.wait_for_timeout(1500) # Wait a bit for bindings
                            
                            email = await extract_vendor_email(page)
                            if email and email != "-Not Specified-":
                                # Update DB
                                db_po = next((p for p in pos if p.po_number == po_num), None)
                                if db_po:
                                    db_po.vendor_email = email
                                    await db.commit()
                                    print(f" -> Saved: {email}")
                                    updated_count += 1
                            else:
                                print(f" -> No email found for {po_num}.")
                                
                            po_numbers_needed.remove(po_num)
                            
                            # Go back to list
                            await page.evaluate("""() => {
                                const btn = document.querySelector("#btnBack");
                                if (btn) btn.click();
                            }""")
                            
                            # Wait for grid to reload
                            await page.wait_for_selector(".k-grid-content-locked", timeout=20000)
                            try:
                                await page.wait_for_selector(".k-loading-mask", state="hidden", timeout=10000)
                            except:
                                pass
                            await page.wait_for_timeout(1000)
                        
                        except Exception as e:
                            print(f" -> Error processing {po_num}: {e}")
                            # Close and reopen page to recover state
                            await page.close()
                            page = await context.new_page()
                            await login(page)
                            await open_po_overview(page)
                            await click_finally_approved_tab(page)
                            await apply_date_filter(page, "01-Jan-2010", "31-Dec-2030")
                            await page.locator(".btn-icon-apply-search-result").click()
                            await page.wait_for_timeout(2500)
                            try:
                                await page.wait_for_selector(".k-loading-mask", state="hidden", timeout=30000)
                            except:
                                pass
                            await page.wait_for_timeout(1000)
                            await page.wait_for_selector(".k-grid-content-locked tbody tr td", timeout=15000)
                            
                            # We'll just break and let the outer loop re-evaluate which page to go to, or restart from page 1.
                            # It's safest to reset page_num to 1.
                            page_num = 0 # will become 1 at the end of the outer while if we don't break, wait, outer loop doesn't reset page_num.
                            break # Break the for loop, we need to restart pagination from page 1
                            
                if not po_numbers_needed:
                    print("All targeted POs processed.")
                    break
                    
                # If we broke out due to error, we need to handle pagination manually or just let it restart?
                # Actually, if we reset page, we are back on page 1. So let's just reset page_num to 1 and continue.
                if 'e' in locals() and po_numbers_needed:
                    page_num = 1
                    del e
                    continue
                    
                # Go to next page
                next_btn = page.locator('a.k-pager-nav[title="Go to the next page"]')
                next_count = await next_btn.count()
                if next_count == 0:
                    break
                    
                aria_disabled = await next_btn.first.get_attribute("aria-disabled")
                if "k-state-disabled" in (await next_btn.first.get_attribute("class") or "") or aria_disabled == "true":
                    break
                    
                print("Moving to next page...")
                await next_btn.first.click()
                try:
                    await page.wait_for_selector(".k-loading-mask", state="hidden", timeout=30000)
                except:
                    pass
                await page.wait_for_timeout(1000)
                page_num += 1

            print(f"Run complete. Updated {updated_count} emails.")

if __name__ == "__main__":
    asyncio.run(main())
