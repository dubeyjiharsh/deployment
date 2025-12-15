import json
import ast
from db_utils import get_connection, create_table_if_not_exists
#from utils.logutils import log_context
 
def ui_2_db(user_name, session_id, session_data, timestamp):
    if not user_name or not session_id or session_data is None:
        #log_context('error', user_name, session_id, "Missing required parameters")
        return "Data Save Operation Unsuccessful"
 
    create_table_if_not_exists()
 
    try:
        if isinstance(session_data, str):
            try:
                json.loads(session_data)
                session_data_str = session_data
            except json.JSONDecodeError:
                try:
                    session_data_str = json.dumps(ast.literal_eval(session_data))
                except Exception:
                    session_data_str = session_data
        else:
            session_data_str = json.dumps(session_data)
 
        conn = get_connection()
        if not conn:
            return "Data Save Operation Unsuccessful"
 
        item_id = f"{user_name}_{session_id}"
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO user_sessions (id, user_name, session_id, session_data, timestamp)
                VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE session_data=%s, timestamp=%s
            """, (item_id, user_name, session_id, session_data_str, timestamp, session_data_str, timestamp))
 
        #log_context('info', user_name, session_id, f"Session {item_id} saved successfully.")
        return "Data Save Operation Successful"
 
    except Exception as e:
        #log_context('error', user_name, session_id, f"Data Save failed: {e}")
        return "Data Save Operation Failed"
    
def db_2_ui(user_name, session_id):
    if not user_name or not session_id:
        #log_context('error', user_name, session_id, "Missing required parameters")
        return "Data Retrieval Error"
 
    conn = get_connection()
    if not conn:
        return "Data Retrieval Error"
 
    item_id = f"{user_name}_{session_id}"
 
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT session_data FROM user_sessions WHERE id=%s", (item_id,))
            result = cursor.fetchone()
            if result:
                #log_context('info', user_name, session_id, f"Session {item_id} retrieved.")
                return result['session_data']
            else:
               # log_context('warning', user_name, session_id, f"Session {item_id} not found.")
                return "Data Retrieval Error"
    except Exception as e:
        #log_context('error', user_name, session_id, f"Retrieval error: {e}")
        return "Data Retrieval Error"

def delete_session_item(user_name, session_id):
    if not user_name or not session_id:
        #log_context('error', user_name, session_id, "Missing required parameters")
        return "Deletion Failed"
 
    conn = get_connection()
    if not conn:
        return "Deletion Failed"
 
    item_id = f"{user_name}_{session_id}"
 
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM user_sessions WHERE id=%s", (item_id,))
            if cursor.rowcount > 0:
                #log_context('info', user_name, session_id, f"Session {item_id} deleted.")
                return "Deletion Complete"
            else:
               # log_context('warning', user_name, session_id, f"Session {item_id} not found.")
                return "Deletion Error"
    except Exception as e:
        #log_context('error', user_name, session_id, f"Deletion error: {e}")
        return "Deletion Error"
    

