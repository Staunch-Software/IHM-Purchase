"""Orchestrates a full scrape run: login -> walk the PO Overview grid,
scraping each row's list fields AND its detail page (header fields + line
items) inline, upserting incrementally as each PO completes.

IMPORTANT (verified live): a PO's detail page has no independent URL to
navigate to — its "PO Number" link does `href="javascript:void(0)"` and
navigates in the SAME browser tab when clicked. This means list and detail
scraping cannot be two separate passes (extract all list rows, then visit
each independently); it must be one interleaved walk: click a row's PO
Number link -> scrape its detail page -> `page.go_back()` (confirmed to
correctly restore the same filtered + paginated list state) -> next row.
See `po_overview_scraper.extract_list_rows` / `_open_po_detail_and_scrape`
for the actual click/scrape/back sequence.

CRASH RECOVERY: headless Chromium has been observed, live, to crash (GPU
process crash, or the whole browser/context dying outright) after
repeatedly navigating the same tab into this particular detail page and
back — root cause not fully pinned down (disabling GPU acceleration helped
but did not eliminate it). Since a full run visits ~1500+ detail pages,
treating "the browser might die mid-run" as a normal, expected condition
(not a fatal error) is essential — `run_scraper` restarts the browser and
resumes, skipping POs already completed earlier in this run, up to
MAX_BROWSER_RESTARTS times.
"""
import asyncio
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.models.purchase_order import PurchaseOrder
from app.models.scrape_status import ScrapeRowError, ScrapeRun, ScrapeRunStatus, ScrapeRunType
from app.scraper.browser import launch_context
from app.scraper.login import login
from app.scraper.po_overview_scraper import fetch_po_list
from app.scraper.upsert import upsert_po_detail, upsert_po_list_row

MAX_BROWSER_RESTARTS = 8


async def _load_known_po_numbers(db: AsyncSession) -> set[str]:
    """Fetch every PO number that already exists in the database.
    Used by incremental runs to skip POs we've already scraped,
    so only brand-new POs that appeared since the last run are processed.
    Returns an empty set when the database is empty (first-ever run),
    which causes the scraper to behave exactly like a full scrape."""
    result = await db.execute(select(PurchaseOrder.po_number))
    known = {row[0] for row in result.all()}
    logger.info(f"Incremental mode: {len(known)} existing PO(s) in DB will be skipped.")
    return known


class _StopAfterLimit(Exception):
    """Internal signal to unwind cleanly once `max_pos` PO attempts (success
    or failure) have been made — not an error, just an early, deliberate
    stop for a bounded test run."""


async def run_scraper(
    db: AsyncSession,
    run_type: ScrapeRunType = ScrapeRunType.FULL,
    headless: bool = True,
    max_pos: int | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
) -> ScrapeRun:
    """`max_pos` stops the run after that many POs have been ATTEMPTED
    (whether they succeeded or failed) — useful for a small manual
    verification pass before committing to the full multi-hour run."""
    run = ScrapeRun(run_type=run_type, status=ScrapeRunStatus.RUNNING)
    db.add(run)
    await db.commit()
    await db.refresh(run)

    succeeded = 0
    failed = 0
    scrape_details = run_type not in (ScrapeRunType.LIST_ONLY,)

    # INCREMENTAL: seed the skip set with every PO already in the database.
    # On the very first run the DB is empty → skip set is empty → behaves
    # identically to a full scrape. On every subsequent run, only POs whose
    # po_number has never been inserted before are visited.
    if run_type == ScrapeRunType.INCREMENTAL:
        initial_skip = await _load_known_po_numbers(db)
        if not initial_skip:
            logger.info("Incremental run: database is empty — performing a full scrape.")
        else:
            logger.info(f"Incremental run: will scrape only POs newer than the {len(initial_skip)} already stored.")
    else:
        initial_skip: set[str] = set()

    # completed_po_numbers tracks POs finished IN THIS RUN (for crash-resume).
    # It is kept separate from initial_skip so the two concerns don't mix.
    completed_po_numbers: set[str] = set()

    async def on_po_scraped(record: dict) -> None:
        nonlocal succeeded, failed
        po_number = record.get("po_number")
        if not po_number:
            return
        try:
            await upsert_po_list_row(db, record)
        except Exception as e:
            logger.error(f"List upsert failed for {po_number}: {e}")
            db.add(ScrapeRowError(scrape_run_id=run.id, po_number=po_number, stage="list_extract", error_message=str(e)))
            await db.commit()
            failed += 1
            _stop_if_limit_reached()
            return

        if scrape_details:
            header_fields = record.get("header_fields")
            line_items = record.get("line_items")
            if header_fields is None:
                db.add(ScrapeRowError(
                    scrape_run_id=run.id, po_number=po_number, stage="detail_extract",
                    error_message="Detail page scrape failed (see scraper logs for this run)",
                ))
                await db.commit()
                failed += 1
                _stop_if_limit_reached()
                return
            try:
                await upsert_po_detail(db, po_number, header_fields, line_items or [])
            except Exception as e:
                logger.error(f"Detail upsert failed for {po_number}: {e}")
                db.add(ScrapeRowError(scrape_run_id=run.id, po_number=po_number, stage="detail_extract", error_message=str(e)))
                await db.commit()
                failed += 1
                _stop_if_limit_reached()
                return

        succeeded += 1
        completed_po_numbers.add(po_number)
        _stop_if_limit_reached()

    def _stop_if_limit_reached() -> None:
        if max_pos is not None and (succeeded + failed) >= max_pos:
            raise _StopAfterLimit()

    try:
        for attempt in range(1, MAX_BROWSER_RESTARTS + 1):
            try:
                async with launch_context(headless=headless) as (browser, context):
                    page = await context.new_page()

                    if not await login(page):
                        if attempt == MAX_BROWSER_RESTARTS:
                            run.status = ScrapeRunStatus.FAILED
                            run.error_summary = "Login failed"
                            run.finished_at = datetime.utcnow()
                            await db.commit()
                            return run
                        # Give the previous browser/driver process a moment to
                        # fully tear down before starting another — launching
                        # a new Playwright Node driver immediately after one
                        # crashed has been observed to itself crash with an
                        # unhandled EPIPE (broken pipe) that kills the whole
                        # Python process. Same backoff as the exception path
                        # below, for the same reason (also eases off on
                        # rapid-fire Microsoft SSO logins).
                        backoff_seconds = min(2**attempt, 120)
                        logger.warning(
                            f"Login failed on attempt {attempt}, retrying in {backoff_seconds}s with a fresh browser..."
                        )
                        await asyncio.sleep(backoff_seconds)
                        continue

                    await fetch_po_list(
                        context, page,
                        scrape_details=scrape_details,
                        on_po_scraped=on_po_scraped,
                        # Merge: initial_skip (existing DB records, for INCREMENTAL)
                        # + completed_po_numbers (finished in a prior crash-restart
                        # attempt this session). For FULL runs initial_skip is empty.
                        skip_po_numbers=initial_skip | completed_po_numbers,
                        from_date=from_date,
                        to_date=to_date,
                    )
                # Completed a full pass through the pager without the browser dying.
                break
            except _StopAfterLimit:
                logger.info(f"Reached max_pos={max_pos} PO(s) attempted — stopping this test run cleanly.")
                break
            except Exception as e:
                logger.error(f"Browser session crashed on attempt {attempt}/{MAX_BROWSER_RESTARTS} "
                             f"({len(completed_po_numbers)} PO(s) completed so far): {e}")
                if attempt == MAX_BROWSER_RESTARTS:
                    raise
                # Exponential backoff (capped) between restarts. Confirmed
                # live: restarting every ~2s regardless of cause means each
                # restart re-runs the full Microsoft SSO login, and enough
                # of those in a short window got Microsoft to start showing
                # extra "Stay signed in?" friction on the SAME account —
                # spacing restarts out is kinder to that login flow, not
                # just to this app's own retry budget.
                backoff_seconds = min(2 ** attempt, 120)
                logger.info(f"Waiting {backoff_seconds}s before restart attempt {attempt + 1} (backoff)...")
                await asyncio.sleep(backoff_seconds)

        run.total_pos_found = len(completed_po_numbers) + failed
        run.pos_succeeded = succeeded
        run.pos_failed = failed
        run.status = ScrapeRunStatus.SUCCESS if failed == 0 else ScrapeRunStatus.PARTIAL_FAILURE
        run.finished_at = datetime.utcnow()
        await db.commit()
        logger.info(f"Scrape run complete: {succeeded} succeeded, {failed} failed.")

    except Exception as e:
        logger.error(f"Scrape run crashed: {e}")
        run.status = ScrapeRunStatus.FAILED
        run.error_summary = str(e)
        run.pos_succeeded = succeeded
        run.pos_failed = failed
        run.finished_at = datetime.utcnow()
        await db.commit()

    return run


if __name__ == "__main__":
    import argparse
    import asyncio
    from datetime import datetime, timedelta

    from app.core.database import SessionLocal
    from app.core.logging import setup_logging
    
    # Initialize logging so stdout shows INFO logs
    setup_logging()

    parser = argparse.ArgumentParser(description="IHM Purchase scraper")
    parser.add_argument("--list-only", action="store_true", help="Scrape the list grid only, skip PO detail pages")
    parser.add_argument("--incremental", action="store_true", help="Skip POs that are already in the database (scrape only new rows)")
    parser.add_argument("--days-back", type=int, default=30, help="Number of days to look back when running incrementally")
    parser.add_argument("--headed", action="store_true", help="Run with a visible browser window (for debugging)")
    parser.add_argument("--max-pos", type=int, default=None, help="Stop after attempting this many POs")
    parser.add_argument("--from-date", type=str, default=None, help="Start date (DD-MMM-YYYY) for FULL scrape (defaults to 01-Jan-2010)")
    parser.add_argument("--to-date", type=str, default=None, help="End date (DD-MMM-YYYY) for FULL scrape (defaults to today)")
    args = parser.parse_args()

    async def main():
        from_date = None
        to_date = None
        
        now = datetime.now()
        
        if args.incremental:
            run_type = ScrapeRunType.INCREMENTAL
            # Format dates as DD-MMM-YYYY (e.g. 08-Sep-2026)
            to_date = now.strftime("%d-%b-%Y")
            from_date = (now - timedelta(days=args.days_back)).strftime("%d-%b-%Y")
        elif args.list_only:
            run_type = ScrapeRunType.LIST_ONLY
            from_date = args.from_date or "01-Jan-2010"
            to_date = args.to_date or now.strftime("%d-%b-%Y")
        else:
            run_type = ScrapeRunType.FULL
            from_date = args.from_date or "01-Jan-2010"
            to_date = args.to_date or now.strftime("%d-%b-%Y")
            
        async with SessionLocal() as db:
            await run_scraper(
                db, 
                run_type=run_type, 
                headless=not args.headed, 
                max_pos=args.max_pos,
                from_date=from_date,
                to_date=to_date
            )

    asyncio.run(main())
