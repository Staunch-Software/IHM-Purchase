import asyncio, json
from app.core.database import SessionLocal
from sqlalchemy import text
async def main():
    async with SessionLocal() as db:
        res = await db.execute(text('SELECT po_number, header_fields, line_items FROM scrape_po_details LIMIT 1'))
        print(json.dumps([dict(row._mapping) for row in res], default=str))
asyncio.run(main())
