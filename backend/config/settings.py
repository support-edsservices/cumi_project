import os
from dotenv import load_dotenv

# Load .env from the project root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(BASE_DIR, ".env")

load_dotenv(ENV_PATH)

# MySQL connection settings
MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")

MASTER_DB = os.getenv("MASTER_DB", "cumi")
User_Table = os.getenv("USER_TABLE", "userDetails")

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
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "cumi-enterprise-access-secret-key-production-change-2026")
JWT_REFRESH_SECRET_KEY = os.getenv("JWT_REFRESH_SECRET_KEY", "cumi-enterprise-refresh-secret-key-production-change-2026")
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
