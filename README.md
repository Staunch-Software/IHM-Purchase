# IHM - Purchase

Internal tool that scrapes Purchase Order data from SmartPAL (`smartpal.ozellar.com`) via
a scheduled Playwright job, stores it in PostgreSQL, and serves it through a role-based
React + FastAPI web app.

## Structure

- `backend/` — FastAPI + PostgreSQL (async SQLAlchemy) + JWT auth + Playwright scraper.
- `frontend/` — React (JavaScript) + Vite, plain CSS (CSS Modules) with a shared design-token
  system (`src/styles/variables.css`, `breakpoints.css`), TanStack Table/Query, `@dnd-kit`
  for column drag-and-drop, `@tanstack/react-virtual` for row virtualization.

See `C:\Users\sajin\.claude\plans\hey-i-need-to-floating-eagle.md` for the full design plan.

## Local development

### 1. Database

```bash
docker compose up -d
```

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
copy .env.example .env   # then fill in SECRET_KEY, SMARTPAL_EMAIL/PASSWORD
alembic revision --autogenerate -m "init"
alembic upgrade head
python -m scripts.create_admin --email you@example.com --password changeme --name "Your Name"
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173 (proxies `/api/*` to the backend on port 8000)

## Scraper

The scraper (`backend/app/scraper/`) logs into SmartPAL, navigates to the Purchase Order
Overview grid, applies the "Finally Approved" tab + category filter (excluding the 11 crew
categories), extracts every row, then opens each PO's detail page for its line items.

Before relying on the DOM-scraping path for a full run, run the API investigation spike to
check whether SmartPAL exposes a JSON grid endpoint that can be called directly instead:

```bash
cd backend
python -m app.scraper.api_probe
```

Manual/dev run of the full scraper (non-headless, for debugging selectors against the real site):

```bash
python -m app.scraper.runner --headed
```

Scheduled runs happen automatically via the FastAPI app's startup scheduler
(`SCRAPER_CRON_HOUR` / `SCRAPER_CRON_MINUTE` in `.env`, default 2:00 AM daily).

**Selectors in `po_overview_scraper.py` and `po_detail_scraper.py` are a best-effort based on
screenshots and need to be verified/adjusted against the live SmartPAL site** before a full
1500+ row run — see the plan's Milestone 3–4 for the recommended verification approach.
