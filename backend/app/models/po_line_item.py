import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class POLineItem(Base):
    __tablename__ = "po_line_items"
    __table_args__ = (UniqueConstraint("purchase_order_id", "s_no", name="uq_po_line_item_po_sno"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purchase_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False
    )

    s_no: Mapped[int | None] = mapped_column()
    part_number: Mapped[str | None] = mapped_column(String(128))
    item_description: Mapped[str | None] = mapped_column(String(1000))
    rob: Mapped[float | None] = mapped_column(Numeric(18, 3))
    unit_price: Mapped[float | None] = mapped_column(Numeric(18, 3))
    qty: Mapped[float | None] = mapped_column(Numeric(18, 3))
    discount_pct: Mapped[float | None] = mapped_column(Numeric(9, 3))
    amount: Mapped[float | None] = mapped_column(Numeric(18, 2))
    account_code: Mapped[str | None] = mapped_column(String(255))
    plate_drawing_number: Mapped[str | None] = mapped_column(String(255))

    # Promoted from the item grid's remaining ~59 columns for the same
    # reason as PurchaseOrder's extras — commonly populated, worth
    # querying directly. Full verbatim capture (all 69 columns) still
    # lives in extra_fields regardless.
    uom: Mapped[str | None] = mapped_column(String(32))
    brand: Mapped[str | None] = mapped_column(String(255))
    weight: Mapped[str | None] = mapped_column(String(64))
    item_category: Mapped[str | None] = mapped_column(String(128))
    item_code: Mapped[str | None] = mapped_column(String(128))
    equipment_name: Mapped[str | None] = mapped_column(String(255))
    drawing_number: Mapped[str | None] = mapped_column(String(255))
    section: Mapped[str | None] = mapped_column(String(128))
    warranty_applicable: Mapped[str | None] = mapped_column(String(16))
    warranty_period_days: Mapped[str | None] = mapped_column(String(32))
    hazardous_material: Mapped[str | None] = mapped_column(String(16))
    oem_item: Mapped[str | None] = mapped_column(String(16))
    export_control: Mapped[str | None] = mapped_column(String(16))
    lead_days: Mapped[str | None] = mapped_column(String(32))
    remarks_to_vendor: Mapped[str | None] = mapped_column(String(1000))
    remarks_from_office: Mapped[str | None] = mapped_column(String(1000))
    remarks_from_vessel: Mapped[str | None] = mapped_column(String(1000))
    readiness_date: Mapped[str | None] = mapped_column(String(64))
    vendor_remarks: Mapped[str | None] = mapped_column(String(1000))
    item_subsection: Mapped[str | None] = mapped_column(String(128))

    # Full verbatim capture of every column from the item grid, keyed by
    # its own header label — see PurchaseOrder.extra_fields for the same
    # rationale.
    extra_fields: Mapped[dict | None] = mapped_column(JSONB)

    purchase_order = relationship("PurchaseOrder", back_populates="line_items")
