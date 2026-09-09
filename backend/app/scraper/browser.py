from contextlib import asynccontextmanager

from playwright.async_api import Browser, BrowserContext, async_playwright


@asynccontextmanager
async def launch_context(headless: bool = True):
    """Launch a chromium browser + context with the conventions used by the
    old report-tracker scraper (60s global timeout, downloads enabled).

    `--disable-gpu` (and friends) avoid a real, reproduced-live GPU-process
    crash ("GPU process exited unexpectedly: exit_code=143") seen during
    long headless runs on this host — the scraper never needs GPU-accelerated
    rendering, so disabling it removes an unnecessary failure mode."""
    async with async_playwright() as p:
        browser: Browser = await p.chromium.launch(
            headless=headless,
            args=["--disable-gpu", "--disable-software-rasterizer", "--disable-dev-shm-usage"],
        )
        context: BrowserContext = await browser.new_context(accept_downloads=True, ignore_https_errors=True)
        context.set_default_timeout(60000)
        try:
            yield browser, context
        finally:
            # A browser that already crashed (Page/Target/GPU crash — all
            # observed live) can make close() itself raise or hang. Since
            # the process is going away regardless, swallow that rather
            # than letting it mask the real error that triggered teardown,
            # or block the caller's retry loop.
            try:
                await browser.close()
            except Exception:
                pass
