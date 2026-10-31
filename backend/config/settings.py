import os
import re
import secrets
import warnings
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

load_dotenv(ENV_PATH)

APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
try:
    MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
except ValueError as exc:
    raise RuntimeError("MYSQL_PORT must be an integer between 1 and 65535") from exc
if not 1 <= MYSQL_PORT <= 65535:
    raise RuntimeError("MYSQL_PORT must be an integer between 1 and 65535")
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")

MASTER_DB = os.getenv("MASTER_DB", "cumi")
User_Table = os.getenv("USER_TABLE", "userDetails")
for identifier_name, identifier in (("MASTER_DB", MASTER_DB), ("USER_TABLE", User_Table)):
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", identifier):
        raise RuntimeError(f"{identifier_name} must be a valid MySQL identifier")

DB_TABLES = {
    "users": User_Table,
    "suppliers": "suppliers",
    "ports": "ports",
    "chas": "chas",
    "warehouses": "warehouses",
    "payment_terms": "payment_term_master",
    "shipment_modes": "shipment_modes",
    "countries": "countries",
    "prw_statuses": "prw_statuses",
    "materials": "materials",
    "shipments": "shipments",
    "shipment_pos": "shipment_pos",
    "shipment_invoices": "shipment_invoices",
    "shipment_bls": "shipment_bls",
    "shipment_boes": "shipment_boes",
    "shipment_attachments": "shipment_attachments",
    "shipment_audit": "shipment_audit",
    "invoice_payments": "invoice_payments",
}
DB_VIEWS = {
    "shipment_overview": "v_shipment_overview",
    "invoice_due": "v_invoice_due",
}
DB_PROCEDURES = {
    "next_shipment_number": "sp_next_sh_no",
}
for object_group in (DB_TABLES, DB_VIEWS, DB_PROCEDURES):
    for object_name in object_group.values():
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", object_name):
            raise RuntimeError("Database object names must be valid MySQL identifiers")

_docs_root = Path(os.getenv("DOCS_ROOT", str(BASE_DIR / "docs")))
if not _docs_root.is_absolute():
    _docs_root = BASE_DIR / _docs_root
DOCS_ROOT = _docs_root.resolve()
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(25 * 1024 * 1024)))
if MAX_UPLOAD_BYTES < 1:
    raise RuntimeError("MAX_UPLOAD_BYTES must be greater than zero")

# ─────────────────────────────────────────────────────────────────────────────
# Common Role Configuration (Modify roles centrally here)
# ─────────────────────────────────────────────────────────────────────────────
ALL_ROLES = ["admin", "superadmin", "manager", "user"]

# Roles restricted to at most ONE user in the entire database
SINGLETON_ROLES = ["admin", "superadmin"]

# Roles that are auto-granted isGranted = True upon registration
AUTO_GRANTED_ROLES = ["admin", "superadmin"]

# Default role assigned if none specified
DEFAULT_ROLE = "user"

# ─────────────────────────────────────────────────────────────────────────────
# JWT configuration
# ─────────────────────────────────────────────────────────────────────────────
def _jwt_secret(environment_name: str) -> str:
    value = os.getenv(environment_name, "").strip()
    if value:
        if APP_ENV == "production" and len(value) < 32:
            raise RuntimeError(f"{environment_name} must contain at least 32 characters in production")
        return value
    if APP_ENV == "production":
        raise RuntimeError(f"{environment_name} must be set in production")
    warnings.warn(
        f"{environment_name} is unset; using an ephemeral development key. "
        "Set it in backend/.env to preserve sessions across restarts.",
        RuntimeWarning,
        stacklevel=2,
    )
    return secrets.token_urlsafe(48)


JWT_SECRET_KEY = _jwt_secret("JWT_SECRET_KEY")
JWT_REFRESH_SECRET_KEY = _jwt_secret("JWT_REFRESH_SECRET_KEY")
if JWT_SECRET_KEY == JWT_REFRESH_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY and JWT_REFRESH_SECRET_KEY must be different")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

# Token expiry: Access token = 15 minutes, Refresh token = 3 days
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "3"))

# CORS settings for HTTP & HTTPS support (local dev + cloud)
CORS_ORIGINS_RAW = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8001,http://127.0.0.1:8001"
)
CORS_ORIGINS = [origin.strip() for origin in CORS_ORIGINS_RAW.split(",") if origin.strip()]

# HttpOnly Cookie Configuration (auto-detects HTTP for dev and HTTPS for cloud)
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "auto")  # "auto", "true", or "false"
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax")  # "lax" or "none" (for cross-domain HTTPS)
