import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from config.db_config import get_connection
from config.settings import MASTER_DB, CORS_ORIGINS
from routes.auth_routes import router as auth_router
from routes.master_routes import router as master_router
from routes.shipment_routes import router as shipment_router

app = FastAPI(
    title="CUMI Shipment Management API",
    description="Backend API for shipment tracking, documents, and authentication",
    version="1.1.0",
)

# ─────────────────────────────────────────────────────────────────────────────
# Custom Request Validation Handler: Prevents [object Object] errors in client
# ─────────────────────────────────────────────────────────────────────────────
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    messages = []
    for err in errors:
        loc = err.get("loc", [])
        field = loc[-1] if loc else "Field"
        field_name = str(field).replace("_", " ").capitalize()
        msg = err.get("msg", "Invalid value")
        messages.append(f"{field_name}: {msg}")
    
    clean_error_message = "; ".join(messages)
    return JSONResponse(
        status_code=422,
        content={"detail": clean_error_message, "errors": errors},
    )

# ─────────────────────────────────────────────────────────────────────────────
# CORS Middleware: Configured for both local HTTP and cloud HTTPS
# ─────────────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Authentication Router
app.include_router(auth_router)
app.include_router(master_router)
app.include_router(shipment_router)


# ─────────────────────────────────────────────────────────────────────────────
# Health Check Endpoints
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "cumi-backend"}


@app.get("/health/db", tags=["Database"])
def check_mysql_connection():
    conn = None
    cursor = None
    try:
        conn = get_connection(MASTER_DB)
        if conn is None:
            raise HTTPException(status_code=503, detail="Unable to connect to MySQL database")

        cursor = conn.cursor()
        cursor.execute("SELECT DATABASE(), VERSION()")
        result = cursor.fetchone()

        return {
            "status": "success",
            "message": "MySQL connection successful",
            "database": result[0],
            "mysql_version": result[1],
        }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="MySQL connection test failed")
    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=False,
    )
