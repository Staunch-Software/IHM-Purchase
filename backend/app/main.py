from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.logging import logger, setup_logging
from app.routers import auth, purchase_orders, users

scheduler = AsyncIOScheduler()


async def scheduled_scrape_job():
    from app.scraper.runner import run_scraper
    from app.models.scrape_status import ScrapeRunType

    async with SessionLocal() as db:
        # INCREMENTAL: on first run the DB is empty → full scrape automatically.
        # On every subsequent run, only brand-new POs (never seen before) are visited.
        await run_scraper(db, run_type=ScrapeRunType.INCREMENTAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    scheduler.add_job(
        scheduled_scrape_job,
        "cron",
        hour=settings.SCRAPER_CRON_HOUR,
        minute=settings.SCRAPER_CRON_MINUTE,
        id="daily_po_scrape",
    )
    scheduler.start()
    logger.info(
        "Scraper scheduled daily at %02d:%02d", settings.SCRAPER_CRON_HOUR, settings.SCRAPER_CRON_MINUTE
    )
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="IHM - Purchase API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(purchase_orders.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
