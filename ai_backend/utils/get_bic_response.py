import pymysql
import os
from dotenv import load_dotenv
 
load_dotenv()
 
# MySQL connection
connection = pymysql.connect(
    host=os.getenv("MYSQL_HOST"),
    port=int(os.getenv("MYSQL_PORT")),
    user=os.getenv("MYSQL_USER"),
    password=os.getenv("MYSQL_PASSWORD"),
    database=os.getenv("MYSQL_DB"),
    cursorclass=pymysql.cursors.DictCursor,
    autocommit=True
)
 
def get_bic_response(session_id, document_id, user_name):
    """
    Retrieves all BIC form fields for a given session ID as a JSON dictionary.
    Args:
        session_id (str): The session ID for which to fetch form data.
    Returns:
        dict: A dictionary containing all dynamic form fields and metadata.
    """
    try:
        with connection.cursor() as cursor:
            # Get submission metadata
            cursor.execute("SELECT id, user_name, request_number, submitted_date, last_updated, status, doc_id FROM submissions WHERE session_id = %s AND doc_id = %s and user_name = %s", (session_id, document_id, user_name))
            submission = cursor.fetchone()
            if not submission:
                print(f"error: No submission found for session_id: {session_id}")
                return None
            submission_id = submission["id"]
 
            # Get dynamic fields
            cursor.execute("""
                SELECT field_name, field_value
                FROM submission_fields
                WHERE submission_id = %s
            """, (submission_id,))
            fields = cursor.fetchall()
 
            # Build response
            result = {
                "Session ID": session_id,
                "User Name": submission["user_name"],
                "Request Number": submission["request_number"],
                "Submitted Date": str(submission["submitted_date"]),
                "Last Updated": str(submission["last_updated"]),
                "Status": submission["status"],
                "Fields": {field["field_name"]: field["field_value"] for field in fields}
            }
 
            return result
    except Exception as e:
        return {"error": str(e)}
    

# response_json = get_bic_response("session_345")
# print(response_json)