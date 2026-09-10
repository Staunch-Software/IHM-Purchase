import re
from datetime import datetime
from pathlib import Path

from playwright.async_api import Page
from playwright.async_api import TimeoutError as PlaywrightTimeout

from app.core.config import settings
from app.core.logging import logger

_FAILURE_DIAGNOSTICS_DIR = Path(__file__).resolve().parents[2] / "scratch_diagnostics" / "login_failures"


async def _dump_failure_diagnostics(page: Page) -> None:
    """Best-effort capture of what's actually on screen when login fails,
    so a stuck/unexpected Microsoft SSO page (MFA challenge, automation
    verification, etc.) can be diagnosed after the fact instead of guessed
    at blind from a bare timeout in the logs."""
    try:
        _FAILURE_DIAGNOSTICS_DIR.mkdir(parents=True, exist_ok=True)
        stamp = datetime.utcnow().strftime("%Y%m%dT%H%M%S%f")
        await page.screenshot(path=str(_FAILURE_DIAGNOSTICS_DIR / f"{stamp}.png"), full_page=True)
        (_FAILURE_DIAGNOSTICS_DIR / f"{stamp}.txt").write_text(
            f"url: {page.url}\ntitle: {await page.title()}\n\n{await page.content()}",
            encoding="utf-8",
        )
        logger.error(f"Login failure diagnostics saved: {stamp} (url was {page.url})")
    except Exception as diag_error:
        logger.warning(f"Could not save login failure diagnostics: {diag_error}")


async def login(page: Page) -> bool:
    """Log into SmartPAL via Microsoft SSO. Adapted verbatim from the
    report-tracker project's `_login()` — same portal, same SSO flow."""
    try:
        logger.info("Navigating to SmartPAL...")
        await page.goto(settings.SMARTPAL_BASE_URL, timeout=120000)

        await page.get_by_text("Login with your Microsoft account").click(timeout=15000)
        await page.wait_for_url("**/login.microsoftonline.com/**", timeout=15000)

        await page.locator("input[type='email']").fill(settings.SMARTPAL_EMAIL)
        await page.get_by_role("button", name="Next").click()
        await page.wait_for_timeout(1500)

        await page.locator("input[type='password']").fill(settings.SMARTPAL_PASSWORD)
        await page.get_by_role("button", name="Sign in").click()

        try:
            await page.get_by_role("button", name="Yes").click(timeout=5000)
        except PlaywrightTimeout:
            pass

        # Confirmed live: after several rapid re-logins in a short window
        # (browser-restart-heavy runs), Microsoft started landing on a
        # "Stay signed in?" page at .../kmsi with a slightly different
        # button (seen stuck there past the 60s wait below). Handle it
        # explicitly in addition to the generic "Yes" click above.
        try:
            if "kmsi" in page.url:
                for name in ("Yes", "No"):
                    try:
                        await page.get_by_role("button", name=name).click(timeout=3000)
                        break
                    except PlaywrightTimeout:
                        continue
        except Exception:
            pass

        await page.wait_for_url(re.compile(r".*ozellar\.com.*(Dashboard|Home|Landing).*"), timeout=60000)
        logger.info("Login successful.")
        return True

    except Exception as e:
        logger.error(f"Login error: {e}")
        await _dump_failure_diagnostics(page)
        return False
