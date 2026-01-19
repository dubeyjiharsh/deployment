import psycopg2
from psycopg2.extras import RealDictCursor
from config import settings

def get_db_connection():
    """
    Create and return a database connection
    """
    try:
        conn = psycopg2.connect(
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
            database=settings.POSTGRES_DB,
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD
        )
        return conn
    except Exception as e:
        raise Exception(f"Failed to connect to database: {str(e)}")

def get_db_cursor(connection, dict_cursor=False):
    """
    Get a cursor from connection
    
    Args:
        connection: Database connection
        dict_cursor: If True, returns RealDictCursor for dict-like results
    """
    if dict_cursor:
        return connection.cursor(cursor_factory=RealDictCursor)
    return connection.cursor()