import pymysql
import os
from dotenv import load_dotenv
from datetime import datetime
 
load_dotenv()
 
# Database connection
connection = pymysql.connect(
    host=os.getenv("MYSQL_HOST"),
    port=int(os.getenv("MYSQL_PORT")),
    user=os.getenv("MYSQL_USER"),
    password=os.getenv("MYSQL_PASSWORD"),
    database=os.getenv("MYSQL_DB"),
    cursorclass=pymysql.cursors.DictCursor,
    autocommit=True
)
 
def generate_submission_id():
    with connection.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) AS count FROM submissions")
        result = cursor.fetchone()
        return f"ADA_{(result['count'] + 1):04d}"
 
def save_bic_response(user_name, session_id, update_data):
    try:
        now = datetime.now()
        with connection.cursor() as cursor:
            # Check if submission exists
            cursor.execute("SELECT id FROM submissions WHERE session_id = %s", (session_id,))
            result = cursor.fetchone()
    
            if result:
                submission_id = result['id']
                cursor.execute("UPDATE submissions SET last_updated = %s WHERE id = %s", (now, submission_id))
            else:
                request_number = generate_submission_id()
                cursor.execute("""
                    INSERT INTO submissions (session_id, user_name, request_number, submitted_date, last_updated, status)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (session_id, user_name, request_number, now, now, "in_progress"))
                submission_id = cursor.lastrowid
    
            # Insert/update dynamic fields
            if update_data:
                for field, value in update_data.items():
                    cursor.execute("""
                        SELECT id FROM submission_fields
                        WHERE submission_id = %s AND field_name = %s
                    """, (submission_id, field))
                    field_exists = cursor.fetchone()
        
                    if field_exists:
                        cursor.execute("""
                            UPDATE submission_fields
                            SET field_value = %s
                            WHERE id = %s
                        """, (value, field_exists['id']))
                    else:
                        cursor.execute("""
                            INSERT INTO submission_fields (submission_id, field_name, field_value)
                            VALUES (%s, %s, %s)
                        """, (submission_id, field, value))
    
        print(f"[INFO] Successfully saved data for session: {session_id}")
        return True
    except Exception as e:
        print(f"Error with saving BIC response: {e}")
        return False



# update_data = {
#     "Problem statement": "Disconnected tools",
#     "Impact": "Delays in processing",
#     "Urgency": "Low",
#     "Dynamic field from LLM": "Extracted value",
#     "ALAN":"asddw",
#     "Pratham":"Software engineer"
# }
 
# save_bic_response("Pratham", "session_345", update_data)