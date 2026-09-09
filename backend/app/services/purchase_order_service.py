from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.purchase_order import PurchaseOrder


async def list_purchase_orders(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 100,
    fetch_all: bool = False,
    search: str | None = None,
) -> tuple[list[PurchaseOrder], int]:
    stmt = select(PurchaseOrder)
    count_stmt = select(func.count()).select_from(PurchaseOrder)

    if search:
        like = f"%{search}%"
        cond = (
            PurchaseOrder.po_number.ilike(like)
            | PurchaseOrder.vessel.ilike(like)
            | PurchaseOrder.vendor_name.ilike(like)
            | PurchaseOrder.title.ilike(like)
        )
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)

    total = (await db.execute(count_stmt)).scalar_one()

    stmt = stmt.order_by(PurchaseOrder.approved_date.desc().nullslast())
    if not fetch_all:
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(stmt)
    return list(result.scalars().all()), total


async def get_purchase_order_detail(db: AsyncSession, po_number: str) -> PurchaseOrder | None:
    stmt = (
        select(PurchaseOrder)
        .where(PurchaseOrder.po_number == po_number)
        .options(selectinload(PurchaseOrder.line_items))
    )
    result = await db.execute(stmt)
    return result.scalars().first()
