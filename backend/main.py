
# main.py

import asyncio
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware


# MySQL configuration
from config.db_config import get_connection
from config.settings import MASTER_DB, User_Table

app = FastAPI()

# Application health endpoint
@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok"}


# MySQL connection test
@app.get("/health/db", tags=["Database"])
def check_mysql_connection():
    conn = None
    cursor = None

    try:
        conn = get_connection(MASTER_DB)

        if conn is None:
            raise HTTPException(status_code=503,detail="Unable to connect to MySQL",)

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
        raise HTTPException(status_code=500,detail="MySQL connection test failed",)

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
