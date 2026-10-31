import hashlib
import logging
import re
from typing import Any

import mysql.connector
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from config.db_config import get_connection
from config.settings import DB_TABLES, MASTER_DB
from utils.auth_helper import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/masters", tags=["Master Data"])

MASTER_TABLES = {
    "suppliers": DB_TABLES["suppliers"],
    "ports": DB_TABLES["ports"],
    "chas": DB_TABLES["chas"],
    "warehouses": DB_TABLES["warehouses"],
    "payment-terms": DB_TABLES["payment_terms"],
    "modes": DB_TABLES["shipment_modes"],
    "countries": DB_TABLES["countries"],
    "prw": DB_TABLES["prw_statuses"],
    "materials": DB_TABLES["materials"],
}
PRW_VALUES = {"PAID", "NOT PAID", "PARTIAL", "ADVANCE", "2 WAY", "SR DATE"}
CREDIT_BASES = {
    "INVOICE_DATE",
    "BL_DATE",
    "PO_DATE",
    "PROFORMA_INVOICE_DATE",
}


class MasterEntryInput(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    paymentType: str = Field(default="OTHER", max_length=30)
    creditDays: int | None = Field(default=None, ge=0, le=65535)
    creditBasis: str | None = None
    needsReview: bool = False


def _connection():
    conn = get_connection(MASTER_DB)
    if conn is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")
    return conn


def _has_column(cursor, table: str, column: str) -> bool:
    cursor.execute(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = %s AND column_name = %s
        """,
        (table, column),
    )
    return cursor.fetchone() is not None


def _require_table(cursor, table: str) -> None:
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
            detail=(
                f"Required master table '{table}' is missing from database '{MASTER_DB}'. "
                "Apply backend/sql/master_lookup_tables.sql to the configured database."
            ),
        )


def require_master_writer(
    user: dict[str, Any] = Depends(get_current_user),
):
    if str(user.get("role", "")).lower() not in {"manager", "admin", "superadmin"}:
        raise HTTPException(status_code=403, detail="Your account is not allowed to manage master data")
    if not user.get("is_granted", True):
        raise HTTPException(status_code=403, detail="Your account has not been granted access")
    return user


def _validate_master_name(master_type: str, name: str) -> str:
    clean_name = name.strip()
    if not clean_name:
        raise HTTPException(status_code=422, detail="Name cannot be empty")
    if master_type == "modes":
        if len(clean_name) > 40:
            raise HTTPException(status_code=422, detail="Shipment mode must be at most 40 characters")
        if clean_name.casefold() == "others":
            raise HTTPException(status_code=422, detail="Enter the specific shipment mode instead of 'Others'")
    if master_type == "prw" and clean_name.upper() not in PRW_VALUES:
        raise HTTPException(status_code=422, detail="Unsupported PRW/payment status")
    return clean_name


def _validate_payment_term(data: MasterEntryInput) -> tuple[str, str | None, int | None, bool]:
    payment_type = data.paymentType.strip().upper()
    if payment_type not in {"LC", "CREDIT_DAYS", "OTHER"}:
        raise HTTPException(status_code=422, detail="Unsupported payment type")
    if data.creditBasis and data.creditBasis not in CREDIT_BASES:
        raise HTTPException(status_code=422, detail="Unsupported payment date basis")
    if (data.creditDays is None) != (data.creditBasis is None):
        raise HTTPException(status_code=422, detail="Credit days and date basis must be provided together")
    return payment_type, data.creditBasis, data.creditDays, data.needsReview


@router.get("/{master_type}")
def list_master_entries(master_type: str, _user: dict[str, Any] = Depends(get_current_user)):
    table = MASTER_TABLES.get(master_type)
    if table is None:
        raise HTTPException(status_code=404, detail="Unknown master list")

    conn = _connection()
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        _require_table(cursor, table)
        if master_type == "suppliers":
            cursor.execute(
                f"SELECT id, name, sh_prefix AS code, docs_folder, is_active FROM {table} ORDER BY name"
            )
        elif master_type == "ports":
            active_column = "is_active" if _has_column(cursor, table, "is_active") else "1 AS is_active"
            cursor.execute(f"SELECT id, name, kind AS detail, {active_column} FROM {table} ORDER BY name")
        elif master_type == "payment-terms":
            cursor.execute(
                f"""
                SELECT id, label AS name, payment_type, credit_days, credit_basis,
                       needs_review, is_active
                FROM {table}
                ORDER BY label
                """
            )
        elif master_type == "modes":
            cursor.execute(
                f"SELECT id, name, code, is_active FROM {table} "
                "WHERE LOWER(name) <> 'others' ORDER BY name"
            )
        else:
            cursor.execute(f"SELECT id, name, is_active FROM {table} ORDER BY name")
        return cursor.fetchall()
    except mysql.connector.Error as exc:
        logger.exception("Could not load %s master entries", master_type)
        raise HTTPException(status_code=500, detail="Could not load master entries") from exc
    finally:
        if cursor is not None:
            cursor.close()
        conn.close()


@router.post("/{master_type}", status_code=status.HTTP_201_CREATED)
def create_master_entry(
    master_type: str,
    data: MasterEntryInput,
    _user: dict[str, Any] = Depends(require_master_writer),
):
    table = MASTER_TABLES.get(master_type)
    if table is None:
        raise HTTPException(status_code=404, detail="Unknown master list")
    name = _validate_master_name(master_type, data.name)

    if master_type == "payment-terms":
        payment_type, credit_basis, credit_days, needs_review = _validate_payment_term(data)
    if master_type == "suppliers":
        letters = re.sub(r"[^A-Za-z]", "", name).upper()
        if len(letters) < 2:
            raise HTTPException(status_code=422, detail="Supplier name must contain at least two letters")
        folder = re.sub(r"[^A-Za-z0-9_-]+", "", name).upper().strip("_-")[:100]
        if not folder:
            raise HTTPException(status_code=422, detail="Supplier name cannot be used as a documents folder")
        if len(name) > 150:
            raise HTTPException(status_code=422, detail="Supplier name must be at most 150 characters")
    elif master_type == "countries" and len(name) > 80:
        raise HTTPException(status_code=422, detail="Country name must be at most 80 characters")
    elif master_type in {"ports", "chas", "warehouses"} and len(name) > 120:
        raise HTTPException(status_code=422, detail="Name must be at most 120 characters")
    elif master_type == "materials" and len(name) > 255:
        raise HTTPException(status_code=422, detail="Material name must be at most 255 characters")

    conn = _connection()
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        _require_table(cursor, table)
        if master_type == "suppliers":
            cursor.execute(f"SELECT id FROM {table} WHERE docs_folder = %s", (folder,))
            if cursor.fetchone():
                suffix = hashlib.sha256(name.casefold().encode("utf-8")).hexdigest()[:8].upper()
                folder = f"{folder[:90]}-{suffix}"
            cursor.execute(
                f"INSERT INTO {table} (name, sh_prefix, docs_folder) VALUES (%s, %s, %s)",
                (name, letters[:2], folder),
            )
        elif master_type == "ports":
            cursor.execute(f"INSERT INTO {table} (name, kind) VALUES (%s, 'BOTH')", (name,))
        elif master_type in {"chas", "warehouses", "countries", "prw", "materials"}:
            cursor.execute(f"INSERT INTO {table} (name) VALUES (%s)", (name.upper() if master_type == "prw" else name,))
        elif master_type == "modes":
            cursor.execute(
                f"INSERT INTO {table} (name, code) VALUES (%s, %s)",
                (name, name),
            )
        else:
            cursor.execute(
                f"""
                INSERT INTO {table} (
                    label, payment_type, credit_days, credit_basis, needs_review
                ) VALUES (%s, %s, %s, %s, %s)
                """,
                (name, payment_type, credit_days, credit_basis, needs_review),
            )
        conn.commit()
        return {"id": int(cursor.lastrowid), "name": name}
    except mysql.connector.IntegrityError as exc:
        conn.rollback()
        raise HTTPException(status_code=409, detail="A matching master entry already exists") from exc
    except mysql.connector.Error as exc:
        conn.rollback()
        logger.exception("Could not create %s master entry", master_type)
        raise HTTPException(status_code=500, detail="Could not create master entry") from exc
    finally:
        if cursor is not None:
            cursor.close()
        conn.close()


@router.put("/{master_type}/{entry_id}")
def update_master_entry(
    master_type: str,
    entry_id: int,
    data: MasterEntryInput,
    _user: dict[str, Any] = Depends(require_master_writer),
):
    table = MASTER_TABLES.get(master_type)
    if table is None:
        raise HTTPException(status_code=404, detail="Unknown master list")
    if master_type == "prw":
        raise HTTPException(status_code=409, detail="PRW values are fixed system statuses and cannot be renamed")

    name = _validate_master_name(master_type, data.name)
    if master_type == "suppliers" and len(name) > 150:
        raise HTTPException(status_code=422, detail="Supplier name must be at most 150 characters")
    if master_type == "countries" and len(name) > 80:
        raise HTTPException(status_code=422, detail="Country name must be at most 80 characters")
    if master_type in {"ports", "chas", "warehouses"} and len(name) > 120:
        raise HTTPException(status_code=422, detail="Name must be at most 120 characters")
    if master_type == "materials" and len(name) > 255:
        raise HTTPException(status_code=422, detail="Material name must be at most 255 characters")
    if master_type == "payment-terms":
        payment_type, credit_basis, credit_days, needs_review = _validate_payment_term(data)

    conn = _connection()
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        _require_table(cursor, table)
        name_column = "label AS name" if master_type == "payment-terms" else "name"
        cursor.execute(
            f"SELECT id, {name_column} FROM {table} WHERE id = %s FOR UPDATE",
            (entry_id,),
        )
        existing = cursor.fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="Master entry not found")

        if master_type == "payment-terms":
            cursor.execute(
                f"""
                UPDATE {table}
                SET label = %s, payment_type = %s, credit_days = %s,
                    credit_basis = %s, needs_review = %s
                WHERE id = %s
                """,
                (name, payment_type, credit_days, credit_basis, needs_review, entry_id),
            )
        else:
            cursor.execute(f"UPDATE {table} SET name = %s WHERE id = %s", (name, entry_id))
            if master_type == "countries" and name != existing["name"]:
                cursor.execute(
                    f"UPDATE {DB_TABLES['shipments']} SET country = %s WHERE country = %s",
                    (name, existing["name"]),
                )
            elif master_type == "materials" and name != existing["name"]:
                cursor.execute(
                    f"UPDATE {DB_TABLES['shipments']} SET material_summary = %s WHERE material_summary = %s",
                    (name, existing["name"]),
                )
        conn.commit()
        return {"id": entry_id, "name": name}
    except HTTPException:
        conn.rollback()
        raise
    except mysql.connector.IntegrityError as exc:
        conn.rollback()
        raise HTTPException(status_code=409, detail="A matching master entry already exists") from exc
    except mysql.connector.Error as exc:
        conn.rollback()
        logger.exception("Could not update %s master entry", master_type)
        raise HTTPException(status_code=500, detail="Could not update master entry") from exc
    finally:
        if cursor is not None:
            cursor.close()
        conn.close()


@router.patch("/{master_type}/{entry_id}/deactivate", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_master_entry(
    master_type: str,
    entry_id: int,
    _user: dict[str, Any] = Depends(require_master_writer),
):
    table = MASTER_TABLES.get(master_type)
    if table is None:
        raise HTTPException(status_code=404, detail="Unknown master list")
    conn = _connection()
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        _require_table(cursor, table)
        if not _has_column(cursor, table, "is_active"):
            conn.rollback()
            raise HTTPException(
                status_code=409,
                detail=f"The {table} table has no is_active column. Apply the master lookup migration SQL, then try again.",
            )
        if master_type in {"countries", "modes", "prw", "materials"}:
            if master_type == "countries":
                cursor.execute(
                    f"""
                    SELECT COUNT(*) AS count
                    FROM {DB_TABLES['shipments']}
                    WHERE country = (SELECT name FROM {table} WHERE id = %s)
                      AND deleted_at IS NULL
                    """,
                    (entry_id,),
                )
            elif master_type == "modes":
                cursor.execute(
                    f"""
                    SELECT COUNT(*) AS count
                    FROM {DB_TABLES['shipments']}
                    WHERE mode_of_shipment = (SELECT code FROM {table} WHERE id = %s)
                      AND deleted_at IS NULL
                    """,
                    (entry_id,),
                )
            elif master_type == "materials":
                cursor.execute(
                    f"""
                    SELECT COUNT(*) AS count
                    FROM {DB_TABLES['shipments']}
                    WHERE material_summary = (SELECT name FROM {table} WHERE id = %s)
                      AND deleted_at IS NULL
                    """,
                    (entry_id,),
                )
            else:
                status_map = {
                    "PAID": ("PAID", None),
                    "NOT PAID": ("UNPAID", None),
                    "PARTIAL": ("PARTIAL", None),
                    "ADVANCE": ("UNPAID", "ADVANCE"),
                    "2 WAY": ("TWO_WAY", None),
                    "SR DATE": ("UNPAID", "SR DATE"),
                }
                cursor.execute(f"SELECT name FROM {table} WHERE id = %s", (entry_id,))
                status_row = cursor.fetchone()
                stored_status, stored_raw = status_map.get(
                    str(status_row["name"]).upper() if status_row else "",
                    ("", None),
                )
                cursor.execute(
                    f"""
                    SELECT COUNT(*) AS count
                    FROM {DB_TABLES['shipments']}
                    WHERE prw_status = %s
                      AND COALESCE(prw_raw, '') = COALESCE(%s, '')
                      AND deleted_at IS NULL
                    """,
                    (stored_status, stored_raw),
                )
            if int(cursor.fetchone()["count"]):
                conn.rollback()
                raise HTTPException(status_code=409, detail="This entry is used by existing shipments")

        cursor.execute(f"UPDATE {table} SET is_active = 0 WHERE id = %s AND is_active = 1", (entry_id,))
        if cursor.rowcount == 0:
            conn.rollback()
            raise HTTPException(status_code=404, detail="Active master entry not found")
        conn.commit()
    except HTTPException:
        raise
    except mysql.connector.Error as exc:
        conn.rollback()
        logger.exception("Could not deactivate %s master entry", master_type)
        raise HTTPException(
            status_code=409,
            detail="This entry cannot be deactivated because it is in use or the database rejected the change",
        ) from exc
    finally:
        if cursor is not None:
            cursor.close()
        conn.close()


@router.delete("/{master_type}/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_master_entry(
    master_type: str,
    entry_id: int,
    _user: dict[str, Any] = Depends(require_master_writer),
):
    table = MASTER_TABLES.get(master_type)
    if table is None:
        raise HTTPException(status_code=404, detail="Unknown master list")

    conn = _connection()
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        _require_table(cursor, table)
        if master_type == "payment-terms":
            select_columns = "id, label AS name, NULL AS code"
        elif master_type == "modes":
            select_columns = "id, name, code"
        else:
            select_columns = "id, name, NULL AS code"
        cursor.execute(
            f"SELECT {select_columns} FROM {table} WHERE id = %s FOR UPDATE",
            (entry_id,),
        )
        entry = cursor.fetchone()
        if entry is None:
            raise HTTPException(status_code=404, detail="Master entry not found")

        if master_type == "suppliers":
            cursor.execute(
                f"SELECT COUNT(*) AS count FROM {DB_TABLES['shipments']} WHERE supplier_id = %s",
                (entry_id,),
            )
        elif master_type == "ports":
            cursor.execute(
                f"""
                SELECT COUNT(*) AS count FROM {DB_TABLES['shipments']}
                WHERE port_of_loading_id = %s OR port_of_landing_id = %s
                """,
                (entry_id, entry_id),
            )
        elif master_type == "chas":
            cursor.execute(
                f"SELECT COUNT(*) AS count FROM {DB_TABLES['shipments']} WHERE cha_id = %s",
                (entry_id,),
            )
        elif master_type == "warehouses":
            cursor.execute(
                f"SELECT COUNT(*) AS count FROM {DB_TABLES['shipments']} WHERE warehouse_id = %s",
                (entry_id,),
            )
        elif master_type == "payment-terms":
            cursor.execute(
                f"SELECT COUNT(*) AS count FROM {DB_TABLES['shipments']} WHERE payment_term_id = %s",
                (entry_id,),
            )
        elif master_type == "modes":
            cursor.execute(
                f"SELECT COUNT(*) AS count FROM {DB_TABLES['shipments']} WHERE mode_of_shipment = %s",
                (entry["code"],),
            )
        elif master_type == "countries":
            cursor.execute(
                f"SELECT COUNT(*) AS count FROM {DB_TABLES['shipments']} WHERE country = %s",
                (entry["name"],),
            )
        elif master_type == "materials":
            cursor.execute(
                f"SELECT COUNT(*) AS count FROM {DB_TABLES['shipments']} WHERE material_summary = %s",
                (entry["name"],),
            )
        else:
            status_map = {
                "PAID": ("PAID", None),
                "NOT PAID": ("UNPAID", None),
                "PARTIAL": ("PARTIAL", None),
                "ADVANCE": ("UNPAID", "ADVANCE"),
                "2 WAY": ("TWO_WAY", None),
                "SR DATE": ("UNPAID", "SR DATE"),
            }
            stored_status, stored_raw = status_map.get(str(entry["name"]).upper(), ("", None))
            cursor.execute(
                f"""
                SELECT COUNT(*) AS count FROM {DB_TABLES['shipments']}
                WHERE prw_status = %s
                  AND COALESCE(prw_raw, '') = COALESCE(%s, '')
                """,
                (stored_status, stored_raw),
            )

        if int(cursor.fetchone()["count"]):
            raise HTTPException(status_code=409, detail="This entry is used by existing shipments and cannot be deleted")

        cursor.execute(f"DELETE FROM {table} WHERE id = %s", (entry_id,))
        conn.commit()
    except HTTPException:
        conn.rollback()
        raise
    except mysql.connector.IntegrityError as exc:
        conn.rollback()
        raise HTTPException(status_code=409, detail="This entry is referenced by other records and cannot be deleted") from exc
    except mysql.connector.Error as exc:
        conn.rollback()
        logger.exception("Could not delete %s master entry", master_type)
        raise HTTPException(status_code=500, detail="Could not delete master entry") from exc
    finally:
        if cursor is not None:
            cursor.close()
        conn.close()


@router.patch("/{master_type}/{entry_id}/activate", status_code=status.HTTP_204_NO_CONTENT)
def activate_master_entry(
    master_type: str,
    entry_id: int,
    _user: dict[str, Any] = Depends(require_master_writer),
):
    table = MASTER_TABLES.get(master_type)
    if table is None:
        raise HTTPException(status_code=404, detail="Unknown master list")
    conn = _connection()
    cursor = None
    try:
        cursor = conn.cursor()
        _require_table(cursor, table)
        if master_type == "modes":
            cursor.execute(f"SELECT name FROM {table} WHERE id = %s", (entry_id,))
            entry = cursor.fetchone()
            if entry is not None and str(entry[0]).casefold() == "others":
                raise HTTPException(status_code=409, detail="The legacy 'Others' mode cannot be reactivated")
        cursor.execute(f"UPDATE {table} SET is_active = 1 WHERE id = %s AND is_active = 0", (entry_id,))
        if cursor.rowcount == 0:
            conn.rollback()
            raise HTTPException(status_code=404, detail="Inactive master entry not found")
        conn.commit()
    except HTTPException:
        raise
    except mysql.connector.Error as exc:
        conn.rollback()
        logger.exception("Could not activate %s master entry", master_type)
        raise HTTPException(status_code=409, detail="Could not activate master entry") from exc
    finally:
        if cursor is not None:
            cursor.close()
        conn.close()
