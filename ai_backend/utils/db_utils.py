import pymysql
import os
from dotenv import load_dotenv
#from utils.logutils import log_context
 
load_dotenv()
 
MYSQL_CONFIG = {
    'host': os.getenv("MYSQL_HOST"),
    'user': os.getenv("MYSQL_USER"),
    'password': os.getenv("MYSQL_PASSWORD"),
    'database': os.getenv("MYSQL_DB"),
    'port': int(os.getenv("MYSQL_PORT", 3306))
}
 
def get_connection():
    try:
        return pymysql.connect(
            host=MYSQL_CONFIG['host'],
            user=MYSQL_CONFIG['user'],
            password=MYSQL_CONFIG['password'],
            database=MYSQL_CONFIG['database'],
            port=MYSQL_CONFIG['port'],
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=True
        )
    except Exception as e:
        #log_context('error', 'system', 'connection', f"MySQL Connection Error: {e}")
        return None
 
def create_table_if_not_exists():
    conn = get_connection()
    if not conn:
        return False
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_sessions (
                    id VARCHAR(255) PRIMARY KEY,
                    user_name VARCHAR(255),
                    session_id VARCHAR(255),
                    session_data TEXT,
                    timestamp VARCHAR(255)
                )
            """)
        return True
    except Exception as e:
        #log_context('error', 'system', 'schema', f"Table creation failed: {e}")
        return False
    
# if __name__ == "__main__":
    # create_table_if_not_exists()
    
    