from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.po_line_item import POLineItem
from app.models.purchase_order import PurchaseOrder


def _parse_number(value):
    if value in (None, ""):
        return None
    try:
        return float(str(value).replace(",", ""))
    except ValueError:
        return None


def _parse_int(value):
    n = _parse_number(value)
    return int(n) if n is not None else None


def _parse_date(value):
    """Parses SmartPAL's "15-Aug-2026" style dates."""
    if not value:
        return None
    try:
        return datetime.strptime(value, "%d-%b-%Y")
    except ValueError:
        return None


async def upsert_po_list_row(db: AsyncSession, row: dict) -> PurchaseOrder:
    po_number = row["po_number"]
    result = await db.execute(select(PurchaseOrder).where(PurchaseOrder.po_number == po_number))
    po = result.scalars().first()

    if not po:
        po = PurchaseOrder(po_number=po_number)
        db.add(po)

    po.vessel = row.get("vessel") or po.vessel
    po.category = row.get("category") or po.category
    po.title = row.get("title") or po.title
    po.vendor_name = row.get("vendor_name") or po.vendor_name
    po.items_count = _parse_int(row.get("items_count")) or po.items_count
    po.currency = row.get("currency") or po.currency
    po.base_currency_amount = _parse_number(row.get("base_currency_amount")) or po.base_currency_amount
    po.created_by = row.get("created_by") or po.created_by
    po.status = row.get("status") or po.status
    po.po_send_status = row.get("po_send_status") or po.po_send_status
    po.department = row.get("department") or po.department
    po.priority = row.get("priority") or po.priority
    po.created_on = _parse_date(row.get("created_on")) or po.created_on
    po.approved_date = _parse_date(row.get("approved_date")) or po.approved_date

    po.operating_unit = row.get("operating_unit") or po.operating_unit
    po.coupa_po_number = row.get("coupa_po_number") or po.coupa_po_number
    po.tag_name = row.get("tag_name") or po.tag_name
    po.logistic_priority = row.get("logistic_priority") or po.logistic_priority
    po.process = row.get("process") or po.process
    po.po_type = row.get("po_type") or po.po_type
    po.po_location = row.get("po_location") or po.po_location
    po.requisition_no = row.get("requisition_no") or po.requisition_no
    po.enquiry_no = row.get("enquiry_no") or po.enquiry_no
    po.grn_no = row.get("grn_no") or po.grn_no
    po.do_no = row.get("do_no") or po.do_no
    po.equipment = row.get("equipment") or po.equipment
    po.owner_approved = row.get("owner_approved") or po.owner_approved
    po.post_invoice = row.get("post_invoice") or po.post_invoice
    po.port_schedule_status = row.get("port_schedule_status") or po.port_schedule_status
    po.revision_no = row.get("revision_no") or po.revision_no
    po.cost_centre_wbs = row.get("cost_centre_wbs") or po.cost_centre_wbs
    po.account_re_allocation = row.get("account_re_allocation") or po.account_re_allocation
    po.analysis_code = row.get("analysis_code") or po.analysis_code
    po.quote = row.get("quote") or po.quote
    po.ar_invoice_no = row.get("ar_invoice_no") or po.ar_invoice_no
    po.local_purchase = row.get("local_purchase") or po.local_purchase
    po.actioned_on = _parse_date(row.get("actioned_on")) or po.actioned_on
    po.forwarded_date = _parse_date(row.get("forwarded_date")) or po.forwarded_date
    po.value_of_interfaced_qty = _parse_number(row.get("value_of_interfaced_qty")) or po.value_of_interfaced_qty
    po.insurance_claim_no = row.get("insurance_claim_no") or po.insurance_claim_no
    po.transfer_method = row.get("transfer_method") or po.transfer_method
    po.organisation_assignment = row.get("organisation_assignment") or po.organisation_assignment
    po.po_update = row.get("po_update") or po.po_update
    po.afe_po = row.get("afe_po") or po.afe_po
    po.afe_status = row.get("afe_status") or po.afe_status
    po.approved_by = row.get("approved_by") or po.approved_by
    po.invoice_status = row.get("invoice_status") or po.invoice_status
    po.schd_delivery_port = row.get("schd_delivery_port") or po.schd_delivery_port
    po.vessel_eta = _parse_date(row.get("vessel_eta")) or po.vessel_eta
    po.post_invoice_remarks = row.get("post_invoice_remarks") or po.post_invoice_remarks
    po.asn_date = _parse_date(row.get("asn_date")) or po.asn_date
    po.send_reminder = row.get("send_reminder") or po.send_reminder
    po.recharge_applicable_to = row.get("recharge_applicable_to") or po.recharge_applicable_to
    po.recharge = row.get("recharge") or po.recharge
    po.issue_date = _parse_date(row.get("issue_date")) or po.issue_date
    po.expected_delivery_date = _parse_date(row.get("expected_delivery_date")) or po.expected_delivery_date
    po.delivery_date = _parse_date(row.get("delivery_date")) or po.delivery_date
    po.deadline_date = _parse_date(row.get("deadline_date")) or po.deadline_date
    po.closed_date = _parse_date(row.get("closed_date")) or po.closed_date
    po.afe_approved_date = _parse_date(row.get("afe_approved_date")) or po.afe_approved_date
    po.eff_date = _parse_date(row.get("eff_date")) or po.eff_date
    po.est_vessel_delivery = _parse_date(row.get("est_vessel_delivery")) or po.est_vessel_delivery
    po.org_commit_date = _parse_date(row.get("org_commit_date")) or po.org_commit_date

    # account_code has no dedicated column; approved_by and invoice_status
    # are now proper model columns (see above).
    # raw_list_fields is the COMPLETE verbatim capture of all 86+ grid
    # columns (see po_overview_scraper) — merged, not overwritten, since
    # upsert_po_detail also writes into extra_fields under "detail".
    extra = dict(po.extra_fields or {})
    extra["list"] = {}  # account_code now a proper column
    po.account_code = row.get("account_code") or po.account_code
    extra["list_raw"] = row.get("raw_list_fields") or extra.get("list_raw")
    po.extra_fields = extra

    po.list_scraped_at = datetime.utcnow()

    await db.commit()
    await db.refresh(po)
    return po


async def upsert_po_detail(db: AsyncSession, po_number: str, header_fields: dict, line_items: list[dict]) -> PurchaseOrder:
    result = await db.execute(
        select(PurchaseOrder)
        .where(PurchaseOrder.po_number == po_number)
        .options(selectinload(PurchaseOrder.line_items))
    )
    po = result.scalars().first()
    if not po:
        po = PurchaseOrder(po_number=po_number)
        db.add(po)
        await db.flush()

    po.vendor_name = header_fields.get("vendor_name") or po.vendor_name
    po.title = header_fields.get("title") or po.title
    po.priority = header_fields.get("priority") or po.priority
    po.delivery_port = header_fields.get("delivery_port") or po.delivery_port
    po.payment = header_fields.get("payment") or po.payment
    po.entity = header_fields.get("entity") or po.entity
    po.currency = header_fields.get("currency") or po.currency
    po.exch_rate = _parse_number(header_fields.get("exch_rate")) or po.exch_rate
    po.delivery_to = header_fields.get("delivery_to") or po.delivery_to
    po.project = header_fields.get("project") or po.project
    po.vendor_reference = header_fields.get("vendor_reference") or po.vendor_reference
    po.payment_due_after_days = _parse_int(header_fields.get("payment_due_after_days")) or po.payment_due_after_days
    po.department = header_fields.get("department") or po.department
    po.delivery_terms = header_fields.get("delivery_terms") or po.delivery_terms

    extra = dict(po.extra_fields or {})
    extra["detail"] = {k: v for k, v in header_fields.items() if k != "_raw_detail_fields"}
    # Complete verbatim capture of every label+input pair found on the
    # detail page (see po_detail_scraper.extract_header_fields).
    extra["detail_raw"] = header_fields.get("_raw_detail_fields") or extra.get("detail_raw")
    po.extra_fields = extra

    existing_by_sno = {li.s_no: li for li in po.line_items}
    for item in line_items:
        s_no = _parse_int(item.get("s_no"))
        li = existing_by_sno.get(s_no)
        if not li:
            li = POLineItem(purchase_order=po, s_no=s_no)
            db.add(li)
        li.part_number = item.get("part_number")
        li.item_description = item.get("item_description")
        li.rob = _parse_number(item.get("rob"))
        li.unit_price = _parse_number(item.get("unit_price"))
        li.qty = _parse_number(item.get("qty"))
        li.discount_pct = _parse_number(item.get("discount_pct"))
        amount = _parse_number(item.get("amount"))
        if amount is None and li.unit_price is not None and li.qty is not None:
            # "Total Amount [USD]" appears twice in the live item grid's
            # headers (a display duplicate) and the wrong one is
            # occasionally picked up as blank — fall back to computing it
            # rather than losing the figure.
            amount = round(li.unit_price * li.qty, 2)
        li.amount = amount
        li.account_code = item.get("account_code")
        li.plate_drawing_number = item.get("plate_drawing_number")
        li.uom = item.get("uom")
        li.brand = item.get("brand")
        li.weight = item.get("weight")
        li.item_category = item.get("item_category")
        li.item_code = item.get("item_code")
        li.equipment_name = item.get("equipment_name")
        li.drawing_number = item.get("drawing_number")
        li.section = item.get("section")
        li.warranty_applicable = item.get("warranty_applicable")
        li.warranty_period_days = item.get("warranty_period_days")
        li.hazardous_material = item.get("hazardous_material")
        li.oem_item = item.get("oem_item")
        li.export_control = item.get("export_control")
        li.lead_days = item.get("lead_days")
        li.remarks_to_vendor = item.get("remarks_to_vendor")
        li.remarks_from_office = item.get("remarks_from_office")
        li.remarks_from_vessel = item.get("remarks_from_vessel")
        li.readiness_date = item.get("readiness_date")
        li.vendor_remarks = item.get("vendor_remarks")
        li.item_subsection = item.get("item_subsection")
        # Complete verbatim capture of every column in this item's row
        # (see po_detail_scraper.extract_line_items).
        li.extra_fields = item.get("raw_fields")

    po.detail_scraped_at = datetime.utcnow()

    await db.commit()
    await db.refresh(po)
    return po
