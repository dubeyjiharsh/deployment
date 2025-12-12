import pymysql
import os
from dotenv import load_dotenv
from datetime import datetime
import json
from utils.logutils import log_context
import ast

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

def get_doc_id(user_name: str = None, session_id: str="unknown"):
    try:
        if not user_name:
            log_context('error', user_name, f"user_name is missing")
            return f"Doc_id or user_name or session_id is missing"
        
        with connection.cursor() as cursor:
            cursor.execute("SELECT doc_id FROM form_fields WHERE user_name = %s", (user_name))
            result = cursor.fetchone()
            if result:
                log_context('info', user_name, session_id, f"Doc_id's found for user_name: {user_name}")
                return {
                "User Name": user_name,
                "Doc_id": [id["doc_id"] for id in result], 
                }
                
            else:
                log_context('error', user_name, session_id, f"{user_name} does not exist")
                return f"{user_name} does not exist"
    except Exception as e:
        log_context('error', user_name, session_id, f"Fetching form fields failed: {e}")
        return e
        
    
    
def get_form_fields(doc_id, user_name: str, session_id: str = "unknown"):
    try:
        if not doc_id:
            log_context('error', user_name, session_id, f"Doc_id or user_name or session_id is missing")
            return f"Doc_id or user_name or session_id is missing"
        
        with connection.cursor() as cursor:
            cursor.execute("SELECT form_fields FROM form_fields WHERE doc_id = %s", (f"{doc_id}"))
            result = cursor.fetchone()
            if result:
                log_context('info', user_name, session_id, f"Doc_id: {doc_id} found, getting form fields")
                return {
                "User Name": user_name,
                "Doc_id": doc_id,
                "description": json.loads(result["form_fields"]) if isinstance(result["form_fields"], str) else result["form_fields"],
                "fields": {key: "NO INFORMATION PROVIDED" for key in json.loads(result["form_fields"]).keys()
                           }}
                
            else:
                log_context('error', user_name, session_id, f"Doc_id: {doc_id} does not exist")
                return f"Doc_id: {doc_id} does not exist"
    except Exception as e:
        log_context('error', doc_id, f"Fetching form fields failed: {e}")
        return e
 
def save_form_fields(user_name, session_id, doc_id, description):
    try:
        if not user_name or not doc_id or not description:
            return "Data Save Operation Unsuccessful"
            
        now = datetime.now()
        with connection.cursor() as cursor:
            try:
                if isinstance(description, str):
                    try:
                        json.loads(description)
                        session_data_str = description
                    except json.JSONDecodeError:
                        try:
                            session_data_str = json.dumps(ast.literal_eval(description))
                        except Exception:
                            session_data_str = description
                else:
                    session_data_str = json.dumps(description)
            except Exception as e:
                log_context('error', user_name, session_id, f"Data Save failed: {e}")
                return "Data Save Operation Failed"
            
            # Check if submission exists
            cursor.execute("SELECT doc_id FROM form_fields WHERE doc_id = %s", f"DOC_{(doc_id)}")
            result = cursor.fetchone()
            if result:
                log_context(level='error', user_name=user_name, session_id=session_id, message=f"Savinf form fields failed. doc_id: DOC_{doc_id} already exists")
                return f"Data Save Operation Unsuccessful, Doc_id : DOC_{doc_id} already exists"
            else:
                request_number = f"DOC_{(doc_id)}"
                cursor.execute("""
                    INSERT INTO form_fields (doc_id, user_name, session_id, form_fields, timestamp)
                    VALUES (%s, %s, %s, %s, %s)
                """, (request_number, user_name, session_id, session_data_str, now))
                submission_id = cursor.lastrowid

        log_context("info", user_name, session_id, f"[INFO] Successfully saved data for session: {request_number}")
        return True
    except Exception as e:
        print(f"Error with saving Fields of Form: {e}")
        return False
    
# if __name__ == "__main__":
#     save_form_fields(
#         user_name="PS",
#         session_id="session2311",
#         doc_id="23748319",
#         description="""
# {
#       "Full Name": {
#         "description": "The full name of the traveler",
#         "output": "free_text",
#         "drop_down": ""
#       },
#       "Date of Birth": {
#         "description": "The birth date of the traveler",
#         "output": "date",
#         "drop_down": ""
#       },
#       "Passport Number": {
#         "description": "The passport number of the traveler",
#         "output": "free_text",
#         "drop_down": ""
#       },
#       "Nationality": {
#         "description": "The nationality of the traveler",
#         "output": "free_text",
#         "drop_down": ""
#       },
#       "Email Address": {
#         "description": "The email address of the traveler",
#         "output": "email",
#         "drop_down": ""
#       },
#       "Phone Number": {
#         "description": "The phone number of the traveler",
#         "output": "phone",
#         "drop_down": ""
#       },
#       "Departure City": {
#         "description": "The city from which the traveler will depart",
#         "output": "free_text",
#         "drop_down": ""
#       },
#       "Destination City": {
#         "description": "The city to which the traveler is going",
#         "output": "free_text",
#         "drop_down": ""
#       },
#       "Departure Date": {
#         "description": "The date of departure",
#         "output": "date",
#         "drop_down": ""
#       },
#       "Return Date": {
#         "description": "The date of return",
#         "output": "date",
#         "drop_down": ""
#       },
#       "Preferred Airline": {
#         "description": "The preferred airline for travel",
#         "output": "free_text",
#         "drop_down": ""
#       },
#       "Seat Preference": {
#         "description": "The preferred seat type (Aisle/Window)",
#         "output": "mcq",
#         "drop_down": "Aisle,Window"
#       },
#       "Class": {
#         "description": "The class of travel (Economy/Business/First)",
#         "output": "mcq",
#         "drop_down": "Economy,Business,First"
#       },
#       "Hotel Preference": {
#         "description": "The preferred hotel for accommodation",
#         "output": "free_text",
#         "drop_down": ""
#       },
#       "Room Type": {
#         "description": "The type of room required (Single/Double/Suite)",
#         "output": "mcq",
#         "drop_down": "Single,Double,Suite"
#       },
#       "Check-in Date": {
#         "description": "The date of check-in at the hotel",
#         "output": "date",
#         "drop_down": ""
#       },
#       "Check-out Date": {
#         "description": "The date of check-out from the hotel",
#         "output": "date",
#         "drop_down": ""
#       },
#       "Special Requests": {
#         "description": "Any special requests made by the traveler",
#         "output": "free_text",
#         "drop_down": ""
#       },
#       "Contact Name": {
#         "description": "The name of the emergency contact",
#         "output": "free_text",
#         "drop_down": ""
#       },
#       "Relationship": {
#         "description": "The relationship to the emergency contact",
#         "output": "free_text",
#         "drop_down": ""
#       },
#       "Emergency Phone Number": {
#         "description": "The phone number of the emergency contact",
#         "output": "phone",
#         "drop_down": ""
#       },
#       "Airport Pickup": {
#         "description": "Whether the traveler requires airport pickup (Yes/No)",
#         "output": "mcq",
#         "drop_down": "Yes,No"
#       },
#       "Travel Insurance": {
#         "description": "Whether the traveler requires travel insurance (Yes/No)",
#         "output": "mcq",
#         "drop_down": "Yes,No"
#       },
#       "Meal Preference": {
#         "description": "The preferred meal option for the traveler",
#         "output": "free_text",
#         "drop_down": ""
#       },
#       "Signature": {
#         "description": "The traveler's signature confirming the accuracy of the information",
#         "output": "free_text",
#         "drop_down": ""
#       },
#       "Date": {
#         "description": "The date when the traveler signs the form",
#         "output": "date",
#         "drop_down": ""
#       }
#     }
# """ 
# )

# if __name__ == "__main__":
#     a = get_form_fields(doc_id="complex_travel_booking_form-b4d9a320-d060-46a6-b84b-1245544a8b18.pdf")
#     print(a["description"])