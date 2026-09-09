import uuid
from datetime import datetime

from sqlalchemy import DateTime, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    po_number: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)

    vessel: Mapped[str | None] = mapped_column(String(255), index=True)
    status: Mapped[str | None] = mapped_column(String(64), index=True)
    po_send_status: Mapped[str | None] = mapped_column(String(128))
    category: Mapped[str | None] = mapped_column(String(128), index=True)
    approved_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    created_on: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[str | None] = mapped_column(String(255))
    items_count: Mapped[int | None] = mapped_column()
    title: Mapped[str | None] = mapped_column(String(500))
    vendor_name: Mapped[str | None] = mapped_column(String(255))
    vendor_reference: Mapped[str | None] = mapped_column(String(255))
    base_currency_amount: Mapped[float | None] = mapped_column(Numeric(18, 2))
    currency: Mapped[str | None] = mapped_column(String(16))
    exch_rate: Mapped[float | None] = mapped_column(Numeric(18, 6))
    priority: Mapped[str | None] = mapped_column(String(64))
    delivery_port: Mapped[str | None] = mapped_column(String(255))
    payment: Mapped[str | None] = mapped_column(String(64))
    payment_due_after_days: Mapped[int | None] = mapped_column()
    budget_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    entity: Mapped[str | None] = mapped_column(String(255))
    delivery_to: Mapped[str | None] = mapped_column(String(255))
    eta: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    readiness_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    project: Mapped[str | None] = mapped_column(String(255))
    department: Mapped[str | None] = mapped_column(String(255))
    delivery_terms: Mapped[str | None] = mapped_column(String(255))
    grand_total: Mapped[float | None] = mapped_column(Numeric(18, 2))
    remarks: Mapped[str | None] = mapped_column(Text)
    attachments_count: Mapped[int | None] = mapped_column()

    # Promoted from the list/detail grids' remaining ~65 columns because
    # they're commonly populated and worth filtering/sorting on directly.
    # Everything scraped (all 86 list + all detail-page fields, including
    # these) is ALSO captured verbatim in extra_fields — these columns are
    # a query-friendly convenience, not the only place the data lives.
    operating_unit: Mapped[str | None] = mapped_column(String(128))
    coupa_po_number: Mapped[str | None] = mapped_column(String(128))
    tag_name: Mapped[str | None] = mapped_column(String(255))
    logistic_priority: Mapped[str | None] = mapped_column(String(64))
    process: Mapped[str | None] = mapped_column(String(128))
    po_type: Mapped[str | None] = mapped_column(String(128))
    po_location: Mapped[str | None] = mapped_column(String(255))
    requisition_no: Mapped[str | None] = mapped_column(String(255))
    enquiry_no: Mapped[str | None] = mapped_column(String(255))
    grn_no: Mapped[str | None] = mapped_column(String(255))
    do_no: Mapped[str | None] = mapped_column(String(255))
    equipment: Mapped[str | None] = mapped_column(String(255))
    owner_approved: Mapped[str | None] = mapped_column(String(16))
    post_invoice: Mapped[str | None] = mapped_column(String(16))
    port_schedule_status: Mapped[str | None] = mapped_column(String(128))
    revision_no: Mapped[str | None] = mapped_column(String(64))
    cost_centre_wbs: Mapped[str | None] = mapped_column(String(255))
    account_re_allocation: Mapped[str | None] = mapped_column(String(255))
    account_code: Mapped[str | None] = mapped_column(String(255))
    analysis_code: Mapped[str | None] = mapped_column(String(128))
    quote: Mapped[str | None] = mapped_column(String(255))
    ar_invoice_no: Mapped[str | None] = mapped_column(String(255))
    local_purchase: Mapped[str | None] = mapped_column(String(64))
    actioned_on: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    forwarded_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    value_of_interfaced_qty: Mapped[float | None] = mapped_column(Numeric(18, 3))
    insurance_claim_no: Mapped[str | None] = mapped_column(String(255))
    transfer_method: Mapped[str | None] = mapped_column(String(128))
    organisation_assignment: Mapped[str | None] = mapped_column(String(255))
    po_update: Mapped[str | None] = mapped_column(String(255))
    afe_po: Mapped[str | None] = mapped_column(String(128))
    afe_status: Mapped[str | None] = mapped_column(String(128))
    approved_by: Mapped[str | None] = mapped_column(String(255))
    invoice_status: Mapped[str | None] = mapped_column(String(128))
    schd_delivery_port: Mapped[str | None] = mapped_column(String(255))
    vessel_eta: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    post_invoice_remarks: Mapped[str | None] = mapped_column(Text)
    asn_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    send_reminder: Mapped[str | None] = mapped_column(String(128))
    recharge_applicable_to: Mapped[str | None] = mapped_column(String(255))
    recharge: Mapped[str | None] = mapped_column(String(255))
    issue_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expected_delivery_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivery_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deadline_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    afe_approved_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    eff_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    est_vessel_delivery: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    org_commit_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Full verbatim capture of every column from both the list grid (86
    # columns) and the detail page, keyed by the grid's own header label —
    # nothing scraped is ever dropped, even fields with no dedicated column
    # above (or ones SmartPAL adds later without code changes here).
    extra_fields: Mapped[dict | None] = mapped_column(JSONB)

    list_scraped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    detail_scraped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    line_items: Mapped[list["POLineItem"]] = relationship(
        back_populates="purchase_order", cascade="all, delete-orphan", order_by="POLineItem.s_no"
    )
