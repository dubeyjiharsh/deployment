import pymysql
import os
from dotenv import load_dotenv
from datetime import datetime
import json
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
            print('error', user_name, f"user_name is missing")
            return f"Doc_id or user_name or session_id is missing"
        
        with connection.cursor() as cursor:
            cursor.execute("SELECT doc_id FROM form_fields WHERE user_name = %s", (user_name))
            result = cursor.fetchall()
            if result:
                print('info', user_name, session_id, f"Doc_id's found for user_name: {user_name}")
                return {
                "User Name": user_name,
                "Doc_id": [id["doc_id"] for id in result], 
                }
                
            else:
                print('error', user_name, session_id, f"{user_name} does not exist")
                return f"{user_name} does not exist"
    except Exception as e:
        print('error', user_name, session_id, f"Fetching form fields failed: {e}")
        return e
        
    
    
def get_form_fields(doc_id, user_name: str = "unkown", session_id: str = "unknown"):
    try:
        if not doc_id:
            print('error', user_name, session_id, f"Doc_id or user_name or session_id is missing")
            return f"Doc_id or user_name or session_id is missing"
        
        with connection.cursor() as cursor:
            cursor.execute("SELECT form_fields FROM form_fields WHERE doc_id = %s", (f"DOC_{(doc_id)}"))
            result = cursor.fetchone()
            if result:
                print('info', user_name, session_id, f"Doc_id: {doc_id} found, getting form fields")
                return {
                "User Name": user_name,
                "Doc_id": doc_id,
                "description": result
            }
                
            else:
                print('error', user_name, session_id, f"Doc_id: {doc_id} does not exist")
                return f"Doc_id: {doc_id} does not exist"
    except Exception as e:
        print('error', doc_id, f"Fetching form fields failed: {e}")
        return e

# if __name__ == "__main__":
    # print(get_doc_id(user_name="PS"))
    # a = get_form_fields(doc_id="23748319")
    # print(type(a["description"]))