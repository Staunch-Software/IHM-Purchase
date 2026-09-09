import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class POLineItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    s_no: int | None
    part_number: str | None
    item_description: str | None
    rob: float | None
    unit_price: float | None
    qty: float | None
    discount_pct: float | None
    amount: float | None
    account_code: str | None
    plate_drawing_number: str | None
    uom: str | None = None
    brand: str | None = None
    weight: str | None = None
    item_category: str | None = None
    item_code: str | None = None
    equipment_name: str | None = None
    drawing_number: str | None = None
    section: str | None = None
    warranty_applicable: str | None = None
    warranty_period_days: str | None = None
    hazardous_material: str | None = None
    oem_item: str | None = None
    export_control: str | None = None
    lead_days: str | None = None
    remarks_to_vendor: str | None = None
    remarks_from_office: str | None = None
    remarks_from_vessel: str | None = None
    readiness_date: str | None = None
    vendor_remarks: str | None = None
    item_subsection: str | None = None
    extra_fields: dict | None = None


class PurchaseOrderListItem(BaseModel):
    """Every promoted SCALAR field, returned in bulk by GET /po?all=true —
    deliberately excludes `extra_fields` (the raw verbatim JSONB capture),
    which is sizeable per row and only fetched on-demand via the detail
    endpoint when a user opens a specific PO."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    po_number: str
    vessel: str | None
    status: str | None
    po_send_status: str | None
    category: str | None
    approved_date: datetime | None
    created_on: datetime | None
    created_by: str | None
    items_count: int | None
    title: str | None
    vendor_name: str | None
    base_currency_amount: float | None
    currency: str | None
    grand_total: float | None

    vendor_reference: str | None = None
    exch_rate: float | None = None
    priority: str | None = None
    delivery_port: str | None = None
    payment: str | None = None
    payment_due_after_days: int | None = None
    budget_date: datetime | None = None
    entity: str | None = None
    delivery_to: str | None = None
    eta: datetime | None = None
    readiness_date: datetime | None = None
    project: str | None = None
    department: str | None = None
    delivery_terms: str | None = None
    remarks: str | None = None
    attachments_count: int | None = None

    # Promoted fields from the wider list/detail column set (~30 of the
    # ~135 total scraped columns; the rest live in extra_fields, viewable
    # per-PO in the detail sheet's "All Fields" tab).
    operating_unit: str | None = None
    coupa_po_number: str | None = None
    tag_name: str | None = None
    logistic_priority: str | None = None
    process: str | None = None
    po_type: str | None = None
    po_location: str | None = None
    requisition_no: str | None = None
    enquiry_no: str | None = None
    grn_no: str | None = None
    do_no: str | None = None
    equipment: str | None = None
    owner_approved: str | None = None
    post_invoice: str | None = None
    port_schedule_status: str | None = None
    revision_no: str | None = None
    cost_centre_wbs: str | None = None
    account_re_allocation: str | None = None
    account_code: str | None = None
    analysis_code: str | None = None
    quote: str | None = None
    ar_invoice_no: str | None = None
    issue_date: datetime | None = None
    expected_delivery_date: datetime | None = None
    delivery_date: datetime | None = None
    deadline_date: datetime | None = None
    closed_date: datetime | None = None
    afe_approved_date: datetime | None = None
    eff_date: datetime | None = None
    est_vessel_delivery: datetime | None = None
    org_commit_date: datetime | None = None
    local_purchase: str | None = None
    actioned_on: datetime | None = None
    forwarded_date: datetime | None = None
    value_of_interfaced_qty: float | None = None
    insurance_claim_no: str | None = None
    transfer_method: str | None = None
    organisation_assignment: str | None = None
    po_update: str | None = None
    afe_po: str | None = None
    afe_status: str | None = None
    approved_by: str | None = None
    invoice_status: str | None = None
    schd_delivery_port: str | None = None
    vessel_eta: datetime | None = None
    post_invoice_remarks: str | None = None
    asn_date: datetime | None = None
    send_reminder: str | None = None
    recharge_applicable_to: str | None = None
    recharge: str | None = None


class PurchaseOrderDetail(PurchaseOrderListItem):
    # Complete verbatim capture of every column scraped for this PO
    # (list grid + detail page), keyed by SmartPAL's own header labels —
    # under "list_raw" and "detail_raw". Nothing scraped is ever hidden,
    # even fields with no dedicated field above. Only fetched per-PO.
    extra_fields: dict | None = None
    line_items: list[POLineItemOut] = []


class PurchaseOrderListResponse(BaseModel):
    total: int
    items: list[PurchaseOrderListItem]
