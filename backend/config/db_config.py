import logging

import mysql.connector

from config.settings import (
    MASTER_DB,
    MYSQL_HOST,
    MYSQL_PASSWORD,
    MYSQL_PORT,
    MYSQL_USER,
)

logger = logging.getLogger(__name__)


def get_connection(database: str = MASTER_DB):
    """Open a MySQL connection or return None after logging a safe error."""
    try:
        return mysql.connector.connect(
            host=MYSQL_HOST,
            port=MYSQL_PORT,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            database=database,
            connection_timeout=10,
            charset="utf8mb4",
            autocommit=False,
        )
    except mysql.connector.Error as exc:
        logger.error(
            "MySQL connection failed for %s:%s/%s (%s)",
            MYSQL_HOST,
            MYSQL_PORT,
            database,
            type(exc).__name__,
        )
        return None
