from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.deps.auth import get_current_user
from app.schemas.purchase_order import PurchaseOrderDetail, PurchaseOrderListResponse
from app.services import purchase_order_service

router = APIRouter(prefix="/po", tags=["purchase-orders"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=PurchaseOrderListResponse)
async def list_purchase_orders_endpoint(
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=5000),
    all: bool = Query(False, description="Return the full dataset for client-side table virtualization"),
    search: str | None = None,
):
    items, total = await purchase_order_service.list_purchase_orders(
        db, page=page, page_size=page_size, fetch_all=all, search=search
    )
    return PurchaseOrderListResponse(total=total, items=items)


# SmartPAL PO numbers contain slashes (e.g. "KIRT/O-0279/PO26"). Even when
# the client percent-encodes them, the server decodes before routing, so a
# plain "{po_number}" segment never matches and every detail request 404s —
# the ":path" converter is what lets the slashes through.
@router.get("/{po_number:path}", response_model=PurchaseOrderDetail)
async def get_purchase_order_endpoint(po_number: str, db: AsyncSession = Depends(get_db)):
    po = await purchase_order_service.get_purchase_order_detail(db, po_number)
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return po
