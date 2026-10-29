
import mysql.connector
from mysql.connector import Error

from config.settings import (
    MYSQL_HOST,
    MYSQL_PORT,
    MYSQL_USER,
    MYSQL_PASSWORD,
)


def get_connection(database=None):
    conn = None

    try:
        conn = mysql.connector.connect(
            host=MYSQL_HOST,
            port=MYSQL_PORT,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            database=database,
            connection_timeout=10,
        )

        return conn

    except Error as e:
        print(f"Error connecting to MySQL database: {e}")

        if conn is not None and conn.is_connected():
            conn.close()

        return None
