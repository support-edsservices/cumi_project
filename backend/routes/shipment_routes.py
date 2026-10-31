import hashlib
import json
import logging
import re
import uuid
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Any

import mysql.connector
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field

from config.db_config import get_connection
from config.settings import DB_PROCEDURES, DB_TABLES, DB_VIEWS, DOCS_ROOT, MASTER_DB, MAX_UPLOAD_BYTES
from utils.auth_helper import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/shipments", tags=["Shipments"])

WRITE_ROLES = {"manager", "admin", "superadmin"}
ADMIN_ROLES = {"admin", "superadmin"}
DOC_TYPES = {"PO", "INVOICE", "BL", "MAWB", "HAWB", "BOE", "OTHER"}
DOCUMENT_PROPERTIES = {
    "PO": "poDocument",
    "INVOICE": "invoiceDocument",
    "BL": "blDocument",
    "MAWB": "mawbDocument",
    "HAWB": "hawbDocument",
    "BOE": "boeDocument",
}


class ShipmentInput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    supplier: str = Field(min_length=1, max_length=150)
    poNo: str = Field(default="", max_length=20654)
    poDate: str | None = None
    material: str = Field(default="", max_length=500)
    invoiceNo: str = Field(default="", max_length=20654)
    invoiceDate: str | None = None
    proformaInvoiceNo: str = Field(default="", max_length=20654)
    proformaInvoiceDate: str | None = None
    portOfLoading: str = Field(default="", max_length=120)
    portOfLanding: str | None = Field(default=None, max_length=120)
    blNo: str = Field(default="", max_length=20654)
    blDate: str | None = None
    mawb: str = Field(default="", max_length=60)
    hawb: str = Field(default="", max_length=60)
    cha: str = Field(default="", max_length=120)
    documentStatus: str = "Pending"
    modeOfShipment: str = "Sea"
    otherModeDetail: str | None = Field(default=None, max_length=80)
    boeNo: str = Field(default="", max_length=10454)
    boeDate: str | None = None
    country: str = Field(default="", max_length=80)
    paymentType: str = "Others"
    paymentStatus: str = "NOT PAID"
    paymentTerms: str | None = Field(default=None, max_length=255)
    bankReferenceNo: str = Field(default="", max_length=100)
    receiptDate: str | None = None
    materialStatus: str = "Pending Shipment"
    warehouseName: str | None = Field(default=None, max_length=120)
    arrivedDate: str | None = None
    etd: str | None = None
    eta: str | None = None
    link: str = Field(default="", max_length=500)
    leadTime: int = Field(default=45, ge=0, le=65535)
    createdAt: str | None = None


class InvoicePaymentInput(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=15, decimal_places=2)
    paidDate: str
    bankReferenceNo: str | None = Field(default=None, max_length=100)
    note: str | None = Field(default=None, max_length=255)


def _connection():
    conn = get_connection(MASTER_DB)
    if conn is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")
    return conn


def _require_role(user: dict[str, Any], allowed: set[str]) -> dict[str, Any]:
    role = str(user.get("role", "")).lower()
    if role not in allowed:
        raise HTTPException(status_code=403, detail="Your account is not allowed to perform this action")
    if not user.get("is_granted", True):
        raise HTTPException(status_code=403, detail="Your account has not been granted access")
    return user


def require_writer(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return _require_role(user, WRITE_ROLES)


def require_admin(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return _require_role(user, ADMIN_ROLES)


def _actor(user: dict[str, Any]) -> str | None:
    phone = user.get("phone_number")
    return str(phone)[:20] if phone else None


def _clean_date(value: str | None, field: str) -> date | None:
    if value is None or not value.strip() or value.strip() == "?":
        return None
    try:
        parsed = date.fromisoformat(value.strip())
        if parsed.year < 1000:
            raise ValueError("date is outside the MySQL supported range")
        return parsed
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"{field} must use YYYY-MM-DD format") from exc


def _date_values(value: str | None, field: str) -> list[date | None]:
    if value is None or not value.strip():
        return []
    return [_clean_date(item, field) for item in value.split("_")]


def _document_rows(
    numbers: str,
    dates: str | None,
    number_field: str,
    date_field: str,
    max_number_length: int,
) -> list[tuple[str, date | None]]:
    number_values = [
        value.strip()
        for value in numbers.split("_")
        if value.strip() and value.strip().casefold() not in {"bl-pending", "boe-pending"}
    ]
    date_values = _date_values(dates, date_field)
    if not number_values:
        return []
    if date_values and len(date_values) != len(number_values):
        raise HTTPException(
            status_code=422,
            detail=f"Provide one {date_field} for each {number_field}, separated by underscores",
        )
    if len(number_values) > 255:
        raise HTTPException(status_code=422, detail=f"At most 255 {number_field} values are allowed")
    if any(len(value) > max_number_length for value in number_values):
        raise HTTPException(status_code=422, detail=f"Each {number_field} must be at most {max_number_length} characters")
    aligned_dates = date_values or [None] * len(number_values)
    return list(zip(number_values, aligned_dates))


def _enum(value: str, mapping: dict[str, str], field: str) -> str:
    result = mapping.get(value.strip().casefold())
    if result is None:
        raise HTTPException(status_code=422, detail=f"Unsupported {field} value")
    return result


def _supplier(cursor, name: str) -> tuple[int, str]:
    clean_name = name.strip()
    cursor.execute(
        f"SELECT id, docs_folder, is_active FROM {DB_TABLES['suppliers']} WHERE name = %s",
        (clean_name,),
    )
    existing = cursor.fetchone()
    if existing is None or not existing["is_active"]:
        raise HTTPException(status_code=422, detail="Select an active supplier from Master Data")
    return int(existing["id"]), str(existing["docs_folder"])


def _lookup_id(cursor, table: str, name: str | None) -> int | None:
    clean_name = (name or "").strip()
    if not clean_name:
        return None
    if table not in {DB_TABLES["ports"], DB_TABLES["chas"], DB_TABLES["warehouses"], DB_TABLES["countries"]}:
        raise RuntimeError("Unexpected lookup table")
    if table == DB_TABLES["ports"]:
        cursor.execute(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = %s AND column_name = 'is_active'
            """,
            (table,),
        )
        has_active_column = cursor.fetchone() is not None
        active_filter = " AND is_active = 1" if has_active_column else ""
    else:
        active_filter = " AND is_active = 1"
    cursor.execute(f"SELECT id FROM {table} WHERE name = %s{active_filter}", (clean_name,))
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=422, detail="Select an active value from Master Data")
    return int(row["id"])


def _require_master_table(cursor, table: str) -> None:
    cursor.execute(
        """
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = %s
        """,
        (table,),
    )
    if cursor.fetchone() is None:
        raise HTTPException(
            status_code=503,
            detail=f"Required master table '{table}' is missing. Apply backend/sql/master_lookup_tables.sql.",
        )


def _shipment_mode(cursor, name: str) -> str:
    clean_name = name.strip()
    if not clean_name or len(clean_name) > 40:
        raise HTTPException(status_code=422, detail="Select a shipment mode (up to 40 characters)")
    if clean_name.casefold() == "others":
        raise HTTPException(status_code=422, detail="Select the specific shipment mode instead of 'Others'")
    _require_master_table(cursor, DB_TABLES["shipment_modes"])
    cursor.execute(
        f"SELECT code FROM {DB_TABLES['shipment_modes']} WHERE name = %s AND is_active = 1",
        (clean_name,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=422, detail="Select an active shipment mode from Master Data")
    return str(row["code"])


def _payment_fields(cursor, data: ShipmentInput) -> tuple[int | None, str, int | None, str | None]:
    term = (data.paymentTerms or "").strip()
    if not term:
        return None, "LC" if data.paymentType.strip().casefold() == "lc" else "OTHER", None, None
    _require_master_table(cursor, DB_TABLES["payment_terms"])
    cursor.execute(
        f"""
        SELECT id, payment_type, credit_days, credit_basis
        FROM {DB_TABLES['payment_terms']}
        WHERE label = %s AND is_active = 1
        """,
        (term,),
    )
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=422, detail="Select an active payment term from Master Data")
    payment_type = str(row["payment_type"])
    credit_days = int(row["credit_days"]) if row["credit_days"] is not None else None
    credit_basis = str(row["credit_basis"]) if row["credit_basis"] is not None else None
    if _uses_proforma_invoice(term, credit_basis):
        payment_type = "CREDIT_DAYS"
        term_days = re.search(
            r"\b(\d+)\s*days?\s+(?:from|after)\s+(?:the\s+)?(?:pro\s*forma|per\s*forma)\s+invoice\b",
            term,
            re.IGNORECASE,
        )
        if credit_days is None:
            credit_days = int(term_days.group(1)) if term_days else 0
        credit_basis = "PROFORMA_INVOICE_DATE"
    return (
        int(row["id"]),
        payment_type,
        credit_days,
        credit_basis,
    )


def _uses_proforma_invoice(term: str, credit_basis: str | None = None) -> bool:
    return (
        credit_basis == "PROFORMA_INVOICE_DATE"
        or re.search(r"\b(?:pro\s*forma|per\s*forma)\s+invoice\b", term, re.IGNORECASE) is not None
    )


def _payment_status(cursor, data: ShipmentInput) -> tuple[str, str | None]:
    value = data.paymentStatus.strip().upper().replace("_", " ")
    _require_master_table(cursor, DB_TABLES["prw_statuses"])
    cursor.execute(
        f"SELECT name FROM {DB_TABLES['prw_statuses']} WHERE name = %s AND is_active = 1",
        (value,),
    )
    if cursor.fetchone() is None:
        raise HTTPException(status_code=422, detail="Select an active PRW/payment status from Master Data")
    mapping = {
        "PAID": ("PAID", None),
        "NOT PAID": ("UNPAID", None),
        "UNPAID": ("UNPAID", None),
        "PARTIAL": ("PARTIAL", None),
        "2 WAY": ("TWO_WAY", "2 WAY"),
        "TWO WAY": ("TWO_WAY", "2 WAY"),
        "SR DATE": ("UNPAID", "SR DATE"),
        "ADVANCE": ("UNPAID", "ADVANCE"),
    }
    if value not in mapping:
        raise HTTPException(status_code=422, detail="Unsupported payment status value")
    return mapping[value]


def _shipment_input_values(cursor, data: ShipmentInput, *, creating: bool, actor: str | None) -> dict[str, Any]:
    supplier_id, supplier_folder = _supplier(cursor, data.supplier)
    loading_port_id = _lookup_id(cursor, DB_TABLES["ports"], data.portOfLoading)
    landing_port_id = _lookup_id(cursor, DB_TABLES["ports"], data.portOfLanding)
    cha_id = _lookup_id(cursor, DB_TABLES["chas"], data.cha)
    warehouse_id = _lookup_id(cursor, DB_TABLES["warehouses"], data.warehouseName)
    term_id, payment_type, credit_days, credit_basis = _payment_fields(cursor, data)
    payment_status, payment_raw = _payment_status(cursor, data)

    mode = _shipment_mode(cursor, data.modeOfShipment)
    if data.country.strip():
        _require_master_table(cursor, DB_TABLES["countries"])
        _lookup_id(cursor, DB_TABLES["countries"], data.country)
    material_status = _enum(
        data.materialStatus,
        {
            "pending shipment": "PENDING_SHIPMENT",
            "in transit": "IN_TRANSIT",
            "at port": "AT_PORT",
            "customs clearance": "CUSTOMS_CLEARANCE",
            "arrived": "ARRIVED",
        },
        "material status",
    )
    document_status = _enum(
        data.documentStatus,
        {
            "pending": "NOT_PROVIDED",
            "received": "PROVIDED",
            "in process": "PARTIALLY_PROVIDED",
            "completed": "PROVIDED",
        },
        "document status",
    )
    arrived_date = _clean_date(data.arrivedDate, "Arrival date")
    receipt_date = _clean_date(data.receiptDate, "Receipt date")
    etd = _clean_date(data.etd, "ETD")
    eta = _clean_date(data.eta, "ETA")
    if etd and eta and eta < etd:
        raise HTTPException(status_code=422, detail="ETA cannot be earlier than ETD")
    if material_status == "ARRIVED" and arrived_date is None:
        raise HTTPException(status_code=422, detail="Arrival date is required when material status is Arrived")

    child_rows = {
        DB_TABLES["shipment_pos"]: _document_rows(data.poNo, data.poDate, "PO number", "PO date", 80),
        DB_TABLES["shipment_invoices"]: _document_rows(data.invoiceNo, data.invoiceDate, "invoice number", "invoice date", 80),
        DB_TABLES["shipment_bls"]: _document_rows(data.blNo, data.blDate, "BL number", "BL date", 80),
        DB_TABLES["shipment_boes"]: _document_rows(data.boeNo, data.boeDate, "BOE number", "BOE date", 40),
    }
    if not child_rows[DB_TABLES["shipment_pos"]]:
        raise HTTPException(status_code=422, detail="At least one PO number is required")
    if not child_rows[DB_TABLES["shipment_invoices"]]:
        raise HTTPException(status_code=422, detail="At least one invoice number is required")
    proforma_rows = _document_rows(
        data.proformaInvoiceNo,
        data.proformaInvoiceDate,
        "proforma invoice number",
        "proforma invoice date",
        80,
    )
    invoice_rows = child_rows[DB_TABLES["shipment_invoices"]]
    has_proforma_number = bool(data.proformaInvoiceNo.strip())
    has_proforma_date = bool(data.proformaInvoiceDate and data.proformaInvoiceDate.strip())
    proforma_required = _uses_proforma_invoice(data.paymentTerms or "", credit_basis)
    if has_proforma_number != has_proforma_date:
        raise HTTPException(
            status_code=422,
            detail="Provide both a proforma invoice number and date for each entry",
        )
    if proforma_required and len(proforma_rows) != len(invoice_rows):
        raise HTTPException(
            status_code=422,
            detail="Provide one proforma invoice number and date for each invoice because the payment term uses a proforma invoice",
        )
    if proforma_rows and any(not number or item_date is None for number, item_date in proforma_rows):
        raise HTTPException(
            status_code=422,
            detail="Provide a valid proforma invoice date for each proforma invoice number",
        )
    if proforma_rows and len(proforma_rows) != len(invoice_rows):
        raise HTTPException(
            status_code=422,
            detail="Provide one proforma invoice number and date for each invoice",
        )

    return {
        "supplier_id": supplier_id,
        "supplier_folder": supplier_folder,
        "material_summary": data.material.strip() or None,
        "country": data.country.strip() or None,
        "mode_of_shipment": mode,
        "other_mode_detail": data.otherModeDetail.strip() if data.otherModeDetail else None,
        "port_of_loading_id": loading_port_id,
        "port_of_landing_id": landing_port_id,
        "mawb_no": data.mawb.strip() or None,
        "hawb_no": data.hawb.strip() or None,
        "cha_id": cha_id,
        "warehouse_id": warehouse_id,
        "document_status": document_status,
        "payment_term_id": term_id,
        "payment_terms_text": (data.paymentTerms or "").strip() or None,
        "payment_type": payment_type,
        "credit_days": credit_days,
        "credit_basis": credit_basis,
        "proforma_rows": proforma_rows or [(None, None)] * len(invoice_rows),
        "prw_status": payment_status,
        "prw_raw": payment_raw,
        "bank_reference_no": data.bankReferenceNo.strip() or None,
        "lead_time_days": data.leadTime,
        "material_status": material_status,
        "etd": etd,
        "eta": eta,
        "arrived_date": arrived_date or receipt_date,
        "created_by": actor if creating else None,
        "updated_by": actor,
        "child_rows": child_rows,
    }


def _insert_children(
    cursor,
    sh_no: str,
    rows: dict[str, list[tuple[str, date | None]]],
    proforma_rows: list[tuple[str | None, date | None]],
) -> None:
    definitions = {
        DB_TABLES["shipment_pos"]: ("po_no", "po_date", True),
        DB_TABLES["shipment_invoices"]: ("invoice_no", "invoice_date", False),
        DB_TABLES["shipment_bls"]: ("bl_no", "bl_date", False),
        DB_TABLES["shipment_boes"]: ("boe_no", "boe_date", False),
    }
    for table, records in rows.items():
        number_column, date_column, has_material = definitions[table]
        if not records:
            continue
        if table == DB_TABLES["shipment_invoices"]:
            cursor.executemany(
                f"""
                INSERT INTO {table}
                    (sh_no, line_no, {number_column}, {date_column},
                     proforma_invoice_no, proforma_invoice_date)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                [
                    (sh_no, index, number, item_date, proforma_no, proforma_date)
                    for index, (number, item_date) in enumerate(records, 1)
                    for proforma_no, proforma_date in [proforma_rows[index - 1]]
                ],
            )
            continue
        if has_material:
            cursor.executemany(
                f"INSERT INTO {table} (sh_no, line_no, {number_column}, {date_column}, material) VALUES (%s, %s, %s, %s, %s)",
                [(sh_no, index, number, item_date, None) for index, (number, item_date) in enumerate(records, 1)],
            )
        else:
            cursor.executemany(
                f"INSERT INTO {table} (sh_no, line_no, {number_column}, {date_column}) VALUES (%s, %s, %s, %s)",
                [(sh_no, index, number, item_date) for index, (number, item_date) in enumerate(records, 1)],
            )


def _link_invoice_documents(cursor, sh_no: str) -> None:
    cursor.execute(f"SELECT id, line_no FROM {DB_TABLES['shipment_invoices']} WHERE sh_no = %s ORDER BY line_no", (sh_no,))
    invoices = cursor.fetchall()
    cursor.execute(f"SELECT id, line_no FROM {DB_TABLES['shipment_pos']} WHERE sh_no = %s ORDER BY line_no", (sh_no,))
    pos = cursor.fetchall()
    cursor.execute(f"SELECT id, line_no FROM {DB_TABLES['shipment_bls']} WHERE sh_no = %s ORDER BY line_no", (sh_no,))
    bls = cursor.fetchall()

    def matching_document(records: list[dict[str, Any]], line_no: int) -> int | None:
        if len(records) == 1:
            return int(records[0]["id"])
        if len(records) != len(invoices):
            return None
        matching = next((record for record in records if record["line_no"] == line_no), None)
        return int(matching["id"]) if matching else None

    for invoice in invoices:
        cursor.execute(
            f"UPDATE {DB_TABLES['shipment_invoices']} SET po_id = %s, bl_id = %s WHERE id = %s",
            (
                matching_document(pos, int(invoice["line_no"])),
                matching_document(bls, int(invoice["line_no"])),
                invoice["id"],
            ),
        )


def _date_string(value: Any) -> str:
    return value.isoformat() if isinstance(value, (date, datetime)) else ""


def _iso_joined_dates(value: str | None) -> str:
    if not value:
        return ""
    formatted = []
    for item in value.split("_"):
        if not item or item == "?":
            formatted.append("")
            continue
        try:
            formatted.append(datetime.strptime(item, "%d-%m-%Y").date().isoformat())
        except ValueError:
            logger.warning("Unexpected date from shipment overview view")
            formatted.append("")
    return "_".join(formatted)


def _payment_status_for_ui(row: dict[str, Any]) -> str:
    raw = str(row.get("prw_raw") or "").upper()
    if raw in {"ADVANCE", "SR DATE"}:
        return raw
    return {
        "PAID": "PAID",
        "UNPAID": "NOT PAID",
        "PARTIAL": "PARTIAL",
        "LC": "NOT PAID",
        "SR": "SR DATE",
        "TWO_WAY": "2 WAY",
        "NO_PAYMENT": "NOT PAID",
    }.get(str(row.get("prw_status")), "NOT PAID")


def _shape_shipment(row: dict[str, Any], attachments: list[dict[str, Any]]) -> dict[str, Any]:
    sh_no = str(row["sh_no"])
    document_fields: dict[str, dict[str, Any]] = {}
    for attachment in attachments:
        prop = DOCUMENT_PROPERTIES.get(str(attachment["doc_type"]))
        if prop and prop not in document_fields:
            document_fields[prop] = {
                "name": attachment["file_name"],
                "url": f"/api/shipments/{sh_no}/attachments/{attachment['id']}",
                "type": attachment["mime_type"] or "application/octet-stream",
                "id": int(attachment["id"]),
            }

    payment_type = str(row.get("payment_type") or "OTHER")
    return {
        "id": sh_no,
        "supplier": row.get("supplier_name") or "",
        "poNo": row.get("po_nos") or "",
        "poDate": _iso_joined_dates(row.get("po_dates")),
        "poDocument": document_fields.get("poDocument"),
        "material": row.get("material_summary") or "",
        "invoiceNo": row.get("invoice_nos") or "",
        "invoiceDate": _iso_joined_dates(row.get("invoice_dates")),
        "proformaInvoiceNo": row.get("proforma_invoice_nos") or "",
        "proformaInvoiceDate": _iso_joined_dates(row.get("proforma_invoice_dates")),
        "invoiceDocument": document_fields.get("invoiceDocument"),
        "portOfLoading": row.get("port_of_loading") or "",
        "portOfLanding": row.get("port_of_landing") or "",
        "blNo": row.get("bl_nos") or "",
        "blDate": _iso_joined_dates(row.get("bl_dates")),
        "blDocument": document_fields.get("blDocument"),
        "mawb": row.get("mawb_no") or "",
        "mawbDocument": document_fields.get("mawbDocument"),
        "hawb": row.get("hawb_no") or "",
        "hawbDocument": document_fields.get("hawbDocument"),
        "cha": row.get("cha_name") or "",
        "documentStatus": {
            "NOT_PROVIDED": "Pending",
            "PARTIALLY_PROVIDED": "In Process",
            "PROVIDED": "Completed",
        }.get(str(row.get("document_status")), "Pending"),
        "modeOfShipment": row.get("mode_name") or {
            "SEA": "Sea",
            "AIR": "Air",
            "OTHERS": "Others",
        }.get(str(row.get("mode_of_shipment")), str(row.get("mode_of_shipment") or "")),
        "otherModeDetail": row.get("other_mode_detail") or "",
        "boeNo": row.get("boe_nos") or "",
        "boeDate": _iso_joined_dates(row.get("boe_dates")),
        "boeDocument": document_fields.get("boeDocument"),
        "country": row.get("country") or "",
        "paymentType": "LC" if payment_type == "LC" else "Others",
        "creditDays": row.get("credit_days"),
        "creditDaysFrom": {
            "INVOICE_DATE": "Invoice Date",
            "BL_DATE": "BL Date",
            "PO_DATE": "PO Date",
            "RECEIPT_DATE": "Receipt Date",
            "PROFORMA_INVOICE_DATE": "Proforma Invoice Date",
        }.get(str(row.get("credit_basis") or "")),
        "paymentStatus": _payment_status_for_ui(row),
        "paymentTerms": row.get("payment_terms_text") or "",
        "bankReferenceNo": row.get("bank_reference_no") or "",
        "receiptDate": _date_string(row.get("arrived_date")),
        "materialStatus": {
            "PENDING_SHIPMENT": "Pending Shipment",
            "IN_TRANSIT": "In Transit",
            "AT_PORT": "At Port",
            "CUSTOMS_CLEARANCE": "Customs Clearance",
            "ARRIVED": "Arrived",
        }.get(str(row.get("material_status")), "Pending Shipment"),
        "warehouseName": row.get("warehouse_name") or "",
        "arrivedDate": _date_string(row.get("arrived_date")),
        "etd": _date_string(row.get("etd")),
        "eta": _date_string(row.get("eta")),
        "link": "",
        "docsFolderPath": row.get("docs_folder_path") or "",
        "leadTime": row.get("lead_time_days") or 0,
        "createdAt": _date_string(row.get("created_at")),
        **document_fields,
    }


def _shipment_rows(cursor, sh_no: str | None = None, *, limit: int = 200, offset: int = 0) -> list[dict[str, Any]]:
    cursor.execute("SET SESSION group_concat_max_len = 8192")
    filter_sql = "WHERE overview.sh_no = %s" if sh_no else ""
    parameters: tuple[Any, ...] = (sh_no,) if sh_no else (limit, offset)
    limit_sql = "" if sh_no else "LIMIT %s OFFSET %s"
    cursor.execute(
        f"""
        SELECT overview.*, s.other_mode_detail, s.prw_raw, s.arrived_date,
               shipment_mode.name AS mode_name,
               (SELECT GROUP_CONCAT(i.proforma_invoice_no ORDER BY i.line_no SEPARATOR '_')
                FROM {DB_TABLES['shipment_invoices']} i WHERE i.sh_no = s.sh_no) AS proforma_invoice_nos,
               (SELECT GROUP_CONCAT(COALESCE(DATE_FORMAT(i.proforma_invoice_date, '%d-%m-%Y'), '?')
                                    ORDER BY i.line_no SEPARATOR '_')
                FROM {DB_TABLES['shipment_invoices']} i WHERE i.sh_no = s.sh_no) AS proforma_invoice_dates
        FROM {DB_VIEWS['shipment_overview']} AS overview
        JOIN {DB_TABLES['shipments']} AS s ON s.sh_no = overview.sh_no
        LEFT JOIN {DB_TABLES['shipment_modes']} AS shipment_mode
            ON shipment_mode.code = s.mode_of_shipment
        {filter_sql}
        ORDER BY overview.created_at DESC
        {limit_sql}
        """,
        parameters,
    )
    return cursor.fetchall()


def _load_attachments(cursor, shipment_numbers: list[str]) -> dict[str, list[dict[str, Any]]]:
    if not shipment_numbers:
        return {}
    placeholders = ",".join(["%s"] * len(shipment_numbers))
    cursor.execute(
        f"""
        SELECT id, sh_no, doc_type, file_name, mime_type, uploaded_at
        FROM {DB_TABLES['shipment_attachments']}
        WHERE sh_no IN ({placeholders}) AND deleted_at IS NULL
        ORDER BY uploaded_at DESC, id DESC
        """,
        tuple(shipment_numbers),
    )
    attachments: dict[str, list[dict[str, Any]]] = {}
    for row in cursor.fetchall():
        attachments.setdefault(str(row["sh_no"]), []).append(row)
    return attachments


def _serialize_rows(cursor, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    attachment_map = _load_attachments(cursor, [str(row["sh_no"]) for row in rows])
    return [
        _shape_shipment(row, attachment_map.get(str(row["sh_no"]), []))
        for row in rows
    ]


def _audit(cursor, sh_no: str, action: str, summary: str, actor: str | None) -> None:
    cursor.execute(
        f"INSERT INTO {DB_TABLES['shipment_audit']} (sh_no, action, summary, changes, actor) VALUES (%s, %s, %s, %s, %s)",
        (sh_no, action, summary[:255], json.dumps({"action": action.lower()}), actor),
    )


@router.get("")
def list_shipments(
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _user: dict[str, Any] = Depends(get_current_user),
):
    conn = _connection()
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        return _serialize_rows(cursor, _shipment_rows(cursor, limit=limit, offset=offset))
    except mysql.connector.Error as exc:
        logger.exception("Could not load shipment list")
        raise HTTPException(status_code=500, detail="Could not load shipments") from exc
    finally:
        if cursor is not None:
            cursor.close()
        conn.close()


@router.get("/{sh_no}")
def get_shipment(sh_no: str, _user: dict[str, Any] = Depends(get_current_user)):
    conn = _connection()
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        rows = _shipment_rows(cursor, sh_no=sh_no)
        if not rows:
            raise HTTPException(status_code=404, detail="Shipment not found")
        return _serialize_rows(cursor, rows)[0]
    except HTTPException:
        raise
    except mysql.connector.Error as exc:
        logger.exception("Could not load shipment")
        raise HTTPException(status_code=500, detail="Could not load shipment") from exc
    finally:
        if cursor is not None:
            cursor.close()
        conn.close()


@router.get("/{sh_no}/invoices")
def list_shipment_invoices(sh_no: str, _user: dict[str, Any] = Depends(get_current_user)):
    conn = _connection()
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            f"""
            SELECT invoice_id, invoice_no, invoice_date, proforma_invoice_no, proforma_invoice_date,
                   amount, currency, due_date,
                   payment_state, days_to_due, base_date, paid_amount, payment_type,
                   credit_days, credit_basis
            FROM {DB_VIEWS['invoice_due']}
            WHERE sh_no = %s
            ORDER BY invoice_id
            """,
            (sh_no,),
        )
        rows = cursor.fetchall()
        if not rows:
            cursor.execute(
                f"SELECT sh_no FROM {DB_TABLES['shipments']} WHERE sh_no = %s AND deleted_at IS NULL",
                (sh_no,),
            )
            if cursor.fetchone() is None:
                raise HTTPException(status_code=404, detail="Shipment not found")
        return [
            {
                **row,
                "invoice_date": _date_string(row.get("invoice_date")),
                "proforma_invoice_date": _date_string(row.get("proforma_invoice_date")),
                "due_date": _date_string(row.get("due_date")),
                "base_date": _date_string(row.get("base_date")),
                "amount": str(row["amount"]) if row.get("amount") is not None else None,
                "paid_amount": str(row["paid_amount"]),
            }
            for row in rows
        ]
    except mysql.connector.Error as exc:
        logger.exception("Could not load shipment invoices")
        raise HTTPException(status_code=500, detail="Could not load shipment invoices") from exc
    finally:
        if cursor is not None:
            cursor.close()
        conn.close()


@router.get("/{sh_no}/invoices/{invoice_id}/payments")
def list_invoice_payments(
    sh_no: str,
    invoice_id: int,
    _user: dict[str, Any] = Depends(get_current_user),
):
    conn = _connection()
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            f"""
            SELECT p.id, p.amount, p.paid_date, p.bank_reference_no, p.note,
                   p.created_by, p.created_at
            FROM {DB_TABLES['invoice_payments']} p
            JOIN {DB_TABLES['shipment_invoices']} i ON i.id = p.invoice_id
            JOIN {DB_TABLES['shipments']} s ON s.sh_no = i.sh_no
            WHERE i.id = %s AND i.sh_no = %s AND s.deleted_at IS NULL
            ORDER BY p.paid_date DESC, p.id DESC
            """,
            (invoice_id, sh_no),
        )
        rows = cursor.fetchall()
        if not rows:
            cursor.execute(
                f"""
                SELECT i.id
                FROM {DB_TABLES['shipment_invoices']} i
                JOIN {DB_TABLES['shipments']} s ON s.sh_no = i.sh_no
                WHERE i.id = %s AND i.sh_no = %s AND s.deleted_at IS NULL
                """,
                (invoice_id, sh_no),
            )
            if cursor.fetchone() is None:
                raise HTTPException(status_code=404, detail="Invoice not found")
        return [
            {
                **row,
                "amount": str(row["amount"]),
                "paid_date": _date_string(row["paid_date"]),
                "created_at": _date_string(row["created_at"]),
            }
            for row in rows
        ]
    except HTTPException:
        raise
    except mysql.connector.Error as exc:
        logger.exception("Could not load invoice payments")
        raise HTTPException(status_code=500, detail="Could not load invoice payments") from exc
    finally:
        if cursor is not None:
            cursor.close()
        conn.close()


@router.post("/{sh_no}/invoices/{invoice_id}/payments", status_code=status.HTTP_201_CREATED)
def create_invoice_payment(
    sh_no: str,
    invoice_id: int,
    data: InvoicePaymentInput,
    user: dict[str, Any] = Depends(require_writer),
):
    paid_date = _clean_date(data.paidDate, "Payment date")
    if paid_date is None:
        raise HTTPException(status_code=422, detail="Payment date is required")
    conn = _connection()
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            f"""
            SELECT i.amount
            FROM {DB_TABLES['shipment_invoices']} i
            JOIN {DB_TABLES['shipments']} s ON s.sh_no = i.sh_no
            WHERE i.id = %s AND i.sh_no = %s AND s.deleted_at IS NULL
            FOR UPDATE
            """,
            (invoice_id, sh_no),
        )
        invoice = cursor.fetchone()
        if invoice is None:
            raise HTTPException(status_code=404, detail="Invoice not found")
        cursor.execute(f"SELECT COALESCE(SUM(amount), 0) AS paid_amount FROM {DB_TABLES['invoice_payments']} WHERE invoice_id = %s", (invoice_id,))
        paid_amount = Decimal(str(cursor.fetchone()["paid_amount"]))
        if invoice["amount"] is not None and paid_amount + data.amount > Decimal(str(invoice["amount"])):
            raise HTTPException(status_code=422, detail="Payment exceeds the invoice's outstanding amount")
        cursor.execute(
            f"""
            INSERT INTO {DB_TABLES['invoice_payments']} (
                invoice_id, amount, paid_date, bank_reference_no, note, created_by
            ) VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                invoice_id, data.amount, paid_date, data.bankReferenceNo,
                data.note, _actor(user),
            ),
        )
        payment_id = int(cursor.lastrowid)
        _audit(cursor, sh_no, "PAYMENT", "Invoice payment recorded", _actor(user))
        conn.commit()
        return {
            "id": payment_id,
            "invoice_id": invoice_id,
            "amount": str(data.amount),
            "paid_date": paid_date.isoformat(),
            "bank_reference_no": data.bankReferenceNo,
            "note": data.note,
        }
    except HTTPException:
        conn.rollback()
        raise
    except mysql.connector.IntegrityError as exc:
        conn.rollback()
        logger.warning("Invoice payment rejected by a database constraint (%s)", type(exc).__name__)
        raise HTTPException(status_code=409, detail="Could not record invoice payment") from exc
    except mysql.connector.Error as exc:
        conn.rollback()
        logger.exception("Could not record invoice payment")
        raise HTTPException(status_code=500, detail="Could not record invoice payment") from exc
    finally:
        if cursor is not None:
            cursor.close()
        conn.close()


@router.post("", status_code=status.HTTP_201_CREATED)
def create_shipment(data: ShipmentInput, user: dict[str, Any] = Depends(require_writer)):
    conn = _connection()
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        actor = _actor(user)
        values = _shipment_input_values(cursor, data, creating=True, actor=actor)
        cursor.execute(
            f"CALL {DB_PROCEDURES['next_shipment_number']}(%s, %s, @generated_sh_no, @generated_fy_code)",
            (values["supplier_id"], date.today()),
        )
        cursor.execute("SELECT @generated_sh_no AS sh_no, @generated_fy_code AS fy_code")
        generated = cursor.fetchone()
        sh_no = str(generated["sh_no"])
        fy_code = str(generated["fy_code"])
        docs_folder_path = f"fy{fy_code[2:4]}-{fy_code[5:7]}_docs/{values['supplier_folder']}/{sh_no}"
        cursor.execute(
            f"""
            INSERT INTO {DB_TABLES['shipments']} (
                sh_no, fy_code, supplier_id, material_summary, country,
                mode_of_shipment, other_mode_detail, port_of_loading_id, port_of_landing_id,
                mawb_no, hawb_no, cha_id, warehouse_id, document_status, docs_folder_path,
                payment_term_id, payment_terms_text, payment_type, credit_days, credit_basis,
                prw_status, prw_raw, bank_reference_no, lead_time_days, material_status,
                etd, eta, arrived_date, created_by, updated_by
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            """,
            (
                sh_no, fy_code, values["supplier_id"], values["material_summary"], values["country"],
                values["mode_of_shipment"], values["other_mode_detail"], values["port_of_loading_id"],
                values["port_of_landing_id"], values["mawb_no"], values["hawb_no"], values["cha_id"],
                values["warehouse_id"], values["document_status"], docs_folder_path, values["payment_term_id"],
                values["payment_terms_text"], values["payment_type"], values["credit_days"], values["credit_basis"],
                values["prw_status"], values["prw_raw"], values["bank_reference_no"], values["lead_time_days"],
                values["material_status"], values["etd"], values["eta"], values["arrived_date"], actor, actor,
            ),
        )
        _insert_children(cursor, sh_no, values["child_rows"], values["proforma_rows"])
        _link_invoice_documents(cursor, sh_no)
        _audit(cursor, sh_no, "CREATE", "Shipment created", actor)
        result = _serialize_rows(cursor, _shipment_rows(cursor, sh_no=sh_no))[0]
        conn.commit()
        return result
    except HTTPException:
        conn.rollback()
        raise
    except mysql.connector.IntegrityError as exc:
        conn.rollback()
        logger.warning("Shipment insert rejected by a database constraint (%s)", type(exc).__name__)
        raise HTTPException(status_code=409, detail="Shipment conflicts with an existing database record") from exc
    except mysql.connector.Error as exc:
        conn.rollback()
        logger.exception("Could not create shipment")
        raise HTTPException(status_code=500, detail="Could not create shipment") from exc
    finally:
        if cursor is not None:
            cursor.close()
        conn.close()


def _reorder_child_lines(cursor, table: str, sh_no: str, target_lines: dict[int, int]) -> None:
    cursor.execute(f"SELECT id, line_no FROM {table} WHERE sh_no = %s", (sh_no,))
    line_by_id = {int(row["id"]): int(row["line_no"]) for row in cursor.fetchall()}
    line_to_id = {line: row_id for row_id, line in line_by_id.items()}
    remaining = set(target_lines)
    while remaining:
        movable = next(
            (row_id for row_id in remaining if target_lines[row_id] not in line_to_id),
            None,
        )
        if movable is not None:
            current_line = line_by_id[movable]
            target_line = target_lines[movable]
            cursor.execute(f"UPDATE {table} SET line_no = %s WHERE id = %s", (target_line, movable))
            del line_to_id[current_line]
            line_to_id[target_line] = movable
            line_by_id[movable] = target_line
            remaining.remove(movable)
            continue

        start_id = next(iter(remaining))
        temporary_line = next(line for line in range(256) if line not in line_to_id)
        start_line = line_by_id[start_id]
        cursor.execute(f"UPDATE {table} SET line_no = %s WHERE id = %s", (temporary_line, start_id))
        del line_to_id[start_line]
        line_to_id[temporary_line] = start_id
        line_by_id[start_id] = temporary_line
        free_line = start_line

        while True:
            predecessor = next(
                row_id for row_id in remaining if target_lines[row_id] == free_line
            )
            if predecessor == start_id:
                cursor.execute(
                    f"UPDATE {table} SET line_no = %s WHERE id = %s",
                    (free_line, start_id),
                )
                del line_to_id[temporary_line]
                line_to_id[free_line] = start_id
                line_by_id[start_id] = free_line
                remaining.remove(start_id)
                break

            current_line = line_by_id[predecessor]
            cursor.execute(
                f"UPDATE {table} SET line_no = %s WHERE id = %s",
                (free_line, predecessor),
            )
            del line_to_id[current_line]
            line_to_id[free_line] = predecessor
            line_by_id[predecessor] = free_line
            remaining.remove(predecessor)
            free_line = current_line


def _replace_children(
    cursor,
    sh_no: str,
    rows: dict[str, list[tuple[str, date | None]]],
    proforma_rows: list[tuple[str | None, date | None]],
) -> None:
    definitions = {
        DB_TABLES["shipment_pos"]: ("po_no", "po_date", "po_id", True),
        DB_TABLES["shipment_invoices"]: ("invoice_no", "invoice_date", "invoice_id", False),
        DB_TABLES["shipment_bls"]: ("bl_no", "bl_date", "bl_id", False),
        DB_TABLES["shipment_boes"]: ("boe_no", "boe_date", "boe_id", False),
    }
    for table, records in rows.items():
        number_column, date_column, attachment_column, has_material = definitions[table]
        cursor.execute(
            f"SELECT id, line_no, {number_column} AS number FROM {table} WHERE sh_no = %s ORDER BY line_no",
            (sh_no,),
        )
        existing_rows = cursor.fetchall()
        existing = {str(row["number"]): row for row in existing_rows}
        desired = {number for number, _ in records}
        if len(desired) != len(records):
            raise HTTPException(status_code=422, detail=f"Duplicate {number_column.replace('_', ' ')} values are not allowed")

        for number, row in existing.items():
            if number in desired:
                continue
            row_id = int(row["id"])
            if table == DB_TABLES["shipment_invoices"]:
                cursor.execute(
                    f"SELECT COUNT(*) AS count FROM {DB_TABLES['invoice_payments']} WHERE invoice_id = %s",
                    (row_id,),
                )
                if int(cursor.fetchone()["count"]):
                    raise HTTPException(
                        status_code=409,
                        detail="An invoice with recorded payments cannot be removed",
                    )
            cursor.execute(
                f"SELECT COUNT(*) AS count FROM {DB_TABLES['shipment_attachments']} WHERE {attachment_column} = %s AND deleted_at IS NULL",
                (row_id,),
            )
            if int(cursor.fetchone()["count"]):
                raise HTTPException(
                    status_code=409,
                    detail=f"Remove or move the attached {number_column.replace('_', ' ')} document before removing that number",
                )
            cursor.execute(
                f"UPDATE {DB_TABLES['shipment_attachments']} SET {attachment_column} = NULL WHERE {attachment_column} = %s",
                (row_id,),
            )
            cursor.execute(f"DELETE FROM {table} WHERE id = %s", (row_id,))
            del existing[number]

        cursor.execute(f"SELECT line_no FROM {table} WHERE sh_no = %s", (sh_no,))
        used_lines = {int(row["line_no"]) for row in cursor.fetchall()}
        available_lines = [line for line in range(256) if line not in used_lines]
        row_targets: dict[int, int] = {}
        for target_line, (number, item_date) in enumerate(records, 1):
            proforma_no, proforma_date = (
                proforma_rows[target_line - 1]
                if table == DB_TABLES["shipment_invoices"]
                else (None, None)
            )
            if number in existing:
                row_id = int(existing[number]["id"])
                if table == DB_TABLES["shipment_invoices"]:
                    cursor.execute(
                        f"""
                        UPDATE {table}
                        SET {date_column} = %s, proforma_invoice_no = %s, proforma_invoice_date = %s
                        WHERE id = %s
                        """,
                        (item_date, proforma_no, proforma_date, row_id),
                    )
                else:
                    cursor.execute(
                        f"UPDATE {table} SET {date_column} = %s WHERE id = %s",
                        (item_date, row_id),
                    )
            else:
                if not available_lines:
                    raise HTTPException(status_code=422, detail="At most 255 document rows of each type are allowed")
                temporary_line = available_lines.pop(0)
                if has_material:
                    cursor.execute(
                        f"INSERT INTO {table} (sh_no, line_no, {number_column}, {date_column}, material) VALUES (%s, %s, %s, %s, %s)",
                        (sh_no, temporary_line, number, item_date, None),
                    )
                elif table == DB_TABLES["shipment_invoices"]:
                    cursor.execute(
                        f"""
                        INSERT INTO {table}
                            (sh_no, line_no, {number_column}, {date_column},
                             proforma_invoice_no, proforma_invoice_date)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        """,
                        (sh_no, temporary_line, number, item_date, proforma_no, proforma_date),
                    )
                else:
                    cursor.execute(
                        f"INSERT INTO {table} (sh_no, line_no, {number_column}, {date_column}) VALUES (%s, %s, %s, %s)",
                        (sh_no, temporary_line, number, item_date),
                    )
                row_id = int(cursor.lastrowid)
            row_targets[row_id] = target_line
        _reorder_child_lines(cursor, table, sh_no, row_targets)


@router.put("/{sh_no}")
def update_shipment(sh_no: str, data: ShipmentInput, user: dict[str, Any] = Depends(require_writer)):
    conn = _connection()
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(f"SELECT sh_no FROM {DB_TABLES['shipments']} WHERE sh_no = %s AND deleted_at IS NULL FOR UPDATE", (sh_no,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Shipment not found")
        actor = _actor(user)
        values = _shipment_input_values(cursor, data, creating=False, actor=actor)
        cursor.execute(
            f"""
            UPDATE {DB_TABLES['shipments']} SET
                supplier_id = %s, material_summary = %s, country = %s,
                mode_of_shipment = %s, other_mode_detail = %s, port_of_loading_id = %s,
                port_of_landing_id = %s, mawb_no = %s, hawb_no = %s, cha_id = %s,
                warehouse_id = %s, document_status = %s, payment_term_id = %s,
                payment_terms_text = %s, payment_type = %s, credit_days = %s,
                credit_basis = %s, prw_status = %s, prw_raw = %s,
                bank_reference_no = %s, lead_time_days = %s, material_status = %s,
                etd = %s, eta = %s, arrived_date = %s, updated_by = %s
            WHERE sh_no = %s
            """,
            (
                values["supplier_id"], values["material_summary"], values["country"],
                values["mode_of_shipment"], values["other_mode_detail"], values["port_of_loading_id"],
                values["port_of_landing_id"], values["mawb_no"], values["hawb_no"], values["cha_id"],
                values["warehouse_id"], values["document_status"], values["payment_term_id"],
                values["payment_terms_text"], values["payment_type"], values["credit_days"],
                values["credit_basis"], values["prw_status"], values["prw_raw"],
                values["bank_reference_no"], values["lead_time_days"], values["material_status"],
                values["etd"], values["eta"], values["arrived_date"], actor, sh_no,
            ),
        )
        _replace_children(cursor, sh_no, values["child_rows"], values["proforma_rows"])
        _link_invoice_documents(cursor, sh_no)
        _audit(cursor, sh_no, "UPDATE", "Shipment updated", actor)
        result = _serialize_rows(cursor, _shipment_rows(cursor, sh_no=sh_no))[0]
        conn.commit()
        return result
    except HTTPException:
        conn.rollback()
        raise
    except mysql.connector.IntegrityError as exc:
        conn.rollback()
        logger.warning("Shipment update rejected by a database constraint (%s)", type(exc).__name__)
        raise HTTPException(status_code=409, detail="Shipment conflicts with an existing database record") from exc
    except mysql.connector.Error as exc:
        conn.rollback()
        logger.exception("Could not update shipment")
        raise HTTPException(status_code=500, detail="Could not update shipment") from exc
    finally:
        if cursor is not None:
            cursor.close()
        conn.close()


@router.delete("/{sh_no}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shipment(sh_no: str, user: dict[str, Any] = Depends(require_admin)):
    conn = _connection()
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(f"SELECT sh_no FROM {DB_TABLES['shipments']} WHERE sh_no = %s AND deleted_at IS NULL FOR UPDATE", (sh_no,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Shipment not found")
        cursor.execute(
            f"UPDATE {DB_TABLES['shipments']} SET deleted_at = CURRENT_TIMESTAMP, updated_by = %s WHERE sh_no = %s",
            (_actor(user), sh_no),
        )
        _audit(cursor, sh_no, "DELETE", "Shipment soft deleted", _actor(user))
        conn.commit()
    except HTTPException:
        conn.rollback()
        raise
    except mysql.connector.Error as exc:
        conn.rollback()
        logger.exception("Could not delete shipment")
        raise HTTPException(status_code=500, detail="Could not delete shipment") from exc
    finally:
        if cursor is not None:
            cursor.close()
        conn.close()


def _safe_storage_path(storage_path: str) -> Path:
    relative = PurePosixPath(storage_path)
    if relative.is_absolute() or any(part in {"", ".", ".."} for part in relative.parts):
        raise HTTPException(status_code=500, detail="Invalid stored document path")
    target = (DOCS_ROOT / Path(*relative.parts)).resolve()
    try:
        target.relative_to(DOCS_ROOT)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail="Invalid stored document path") from exc
    return target


def _remove_saved_file(path: Path | None) -> None:
    if path is None:
        return
    try:
        path.unlink(missing_ok=True)
    except OSError:
        logger.exception("Could not clean up an uncommitted uploaded document")


@router.post("/{sh_no}/attachments", status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    sh_no: str,
    doc_type: str = Query(..., alias="type"),
    file: UploadFile = File(...),
    user: dict[str, Any] = Depends(require_writer),
):
    normalized_type = doc_type.strip().upper()
    if normalized_type not in DOC_TYPES:
        raise HTTPException(status_code=422, detail="Unsupported document type")
    original_name = PureWindowsPath(PurePosixPath(file.filename or "document").name).name
    original_name = re.sub(r"[\x00-\x1f\x7f]", "", original_name).strip()
    if not original_name:
        raise HTTPException(status_code=422, detail="Document filename is required")
    original_name = original_name[:255]
    extension = Path(original_name).suffix.lower()
    if not re.fullmatch(r"\.[a-z0-9]{1,10}", extension):
        extension = ""
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if not content:
        raise HTTPException(status_code=422, detail="The uploaded document is empty")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"Document exceeds the {MAX_UPLOAD_BYTES}-byte upload limit")

    conn = _connection()
    cursor = None
    written_path: Path | None = None
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            f"""
            SELECT s.docs_folder_path
            FROM {DB_TABLES['shipments']} s
            WHERE s.sh_no = %s AND s.deleted_at IS NULL AND s.record_status = 'ACTIVE'
            FOR UPDATE
            """,
            (sh_no,),
        )
        shipment = cursor.fetchone()
        if shipment is None:
            raise HTTPException(status_code=404, detail="Shipment not found")

        stored_name = f"{normalized_type}_{uuid.uuid4().hex}{extension}"
        folder_path = shipment.get("docs_folder_path")
        if not folder_path:
            raise HTTPException(status_code=500, detail="Shipment has no configured document folder")
        storage_path = (PurePosixPath(folder_path) / stored_name).as_posix()
        written_path = _safe_storage_path(storage_path)
        written_path.parent.mkdir(parents=True, exist_ok=True)
        with written_path.open("xb") as document:
            document.write(content)

        cursor.execute(
            f"""
            INSERT INTO {DB_TABLES['shipment_attachments']} (
                sh_no, doc_type, file_name, stored_name, storage_path, mime_type,
                size_bytes, sha256, uploaded_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                sh_no, normalized_type, original_name, stored_name, storage_path,
                (file.content_type or "application/octet-stream")[:100],
                len(content), hashlib.sha256(content).hexdigest(), _actor(user),
            ),
        )
        attachment_id = int(cursor.lastrowid)
        _audit(cursor, sh_no, "ATTACH", f"{normalized_type} document uploaded", _actor(user))
        conn.commit()
        return {
            "id": attachment_id,
            "docType": normalized_type,
            "name": original_name,
            "url": f"/api/shipments/{sh_no}/attachments/{attachment_id}",
            "type": (file.content_type or "application/octet-stream")[:100],
        }
    except HTTPException:
        conn.rollback()
        _remove_saved_file(written_path)
        raise
    except mysql.connector.IntegrityError as exc:
        conn.rollback()
        _remove_saved_file(written_path)
        logger.warning("Document metadata rejected by a database constraint (%s)", type(exc).__name__)
        raise HTTPException(status_code=409, detail="Could not store document metadata") from exc
    except (OSError, mysql.connector.Error) as exc:
        conn.rollback()
        _remove_saved_file(written_path)
        logger.exception("Could not save shipment document")
        raise HTTPException(status_code=500, detail="Could not save shipment document") from exc
    finally:
        if cursor is not None:
            cursor.close()
        conn.close()


@router.get("/{sh_no}/attachments/{attachment_id}")
def download_attachment(sh_no: str, attachment_id: int, _user: dict[str, Any] = Depends(get_current_user)):
    conn = _connection()
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            f"""
            SELECT a.file_name, a.storage_path, a.mime_type
            FROM {DB_TABLES['shipment_attachments']} a
            JOIN {DB_TABLES['shipments']} s ON s.sh_no = a.sh_no
            WHERE a.id = %s AND a.sh_no = %s AND a.deleted_at IS NULL AND s.deleted_at IS NULL
            """,
            (attachment_id, sh_no),
        )
        attachment = cursor.fetchone()
        if attachment is None:
            raise HTTPException(status_code=404, detail="Document not found")
        path = _safe_storage_path(str(attachment["storage_path"]))
        if not path.is_file():
            raise HTTPException(status_code=404, detail="Document file is missing from storage")
        return FileResponse(
            path,
            media_type=attachment["mime_type"] or "application/octet-stream",
            filename=attachment["file_name"],
            headers={"X-Content-Type-Options": "nosniff"},
        )
    except HTTPException:
        raise
    except mysql.connector.Error as exc:
        logger.exception("Could not read shipment document")
        raise HTTPException(status_code=500, detail="Could not read shipment document") from exc
    finally:
        if cursor is not None:
            cursor.close()
        conn.close()


@router.delete("/{sh_no}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment(sh_no: str, attachment_id: int, user: dict[str, Any] = Depends(require_admin)):
    conn = _connection()
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            f"""
            SELECT a.storage_path
            FROM {DB_TABLES['shipment_attachments']} a
            JOIN {DB_TABLES['shipments']} s ON s.sh_no = a.sh_no
            WHERE a.id = %s AND a.sh_no = %s AND a.deleted_at IS NULL AND s.deleted_at IS NULL
            FOR UPDATE
            """,
            (attachment_id, sh_no),
        )
        attachment = cursor.fetchone()
        if attachment is None:
            raise HTTPException(status_code=404, detail="Document not found")
        storage_path = str(attachment["storage_path"])
        cursor.execute(
            f"UPDATE {DB_TABLES['shipment_attachments']} SET deleted_at = CURRENT_TIMESTAMP WHERE id = %s",
            (attachment_id,),
        )
        _audit(cursor, sh_no, "DETACH", "Shipment document deleted", _actor(user))
        conn.commit()
        try:
            _safe_storage_path(storage_path).unlink(missing_ok=True)
        except OSError as exc:
            logger.exception("Document metadata was removed but the file could not be deleted")
            raise HTTPException(
                status_code=500,
                detail="Document record was removed but the file could not be deleted",
            ) from exc
    except HTTPException:
        conn.rollback()
        raise
    except mysql.connector.Error as exc:
        conn.rollback()
        logger.exception("Could not remove shipment document")
        raise HTTPException(status_code=500, detail="Could not remove shipment document") from exc
    finally:
        if cursor is not None:
            cursor.close()
        conn.close()
