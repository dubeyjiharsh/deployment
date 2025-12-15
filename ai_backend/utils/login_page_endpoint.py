# Import necessary libraries
import pymysql
from fastapi import FastAPI,HTTPException,Form
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from blob_store_retreive import upload_to_blob, update_db
from fastapi.responses import JSONResponse
from fastapi import UploadFile, File
from io import BytesIO
from azure.storage.blob import BlobServiceClient
import certifi
import os
from azure.core.pipeline.transport import RequestsTransport

import uuid
from monkey_patch import patch_requests_ssl

app=FastAPI()    

# CORS Middleware if calling from a frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5009"],  # Allow Angular app on this URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginCredentials(BaseModel):
    username: str
    password: str
    
# Database connection details
HOSTNAME= os.getenv("MYSQL_HOST")
PORT= os.getenv("MYSQL_PORT")
USERNAME=os.getenv("MYSQL_USER")
PASSWORD=os.getenv("MYSQL_PASSWORD")
DATABASE=os.getenv("MYSQL_DB")   

@app.post("/api/login")
def login(data: LoginCredentials):
    username=data.username
    password=data.password
    """
    Login user with username and password.  
    
    Args:
     The login credentials containing username and password.
        
    Returns:
        str: A message indicating success or failure.
    """
    try:
        print("Attempting DB connection...")
        conn=pymysql.connect(host=HOSTNAME,
            user=USERNAME,
            password=PASSWORD,
            database=DATABASE
        ) 
        cursor=conn.cursor()
        
        cursor.execute("SELECT * FROM user WHERE name = %s limit 1", (username,))
        result = cursor.fetchone()        
        if not result:
            raise HTTPException(status_code=404, detail="User not found")
        
        stored_password=result[1]
        
        if password==stored_password:
            return {"message": f"User '{username}' authenticated successfully."}
        else:
            raise HTTPException(status_code=401, detail="Invalid username or password")
        
    # If the user does not exist, raise an exception
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
            

@app.post("/register/newuser")
def register(data: LoginCredentials):
    username=data.username
    password=data.password
    """
    check if username exists in database anf if not create a new user.
    Args:
        data (LoginCredentials): The login credentials containing username and password.        
    Returns:
        str: A message indicating success or failure.
    """
    try:
        print("Attempting DB connection...")
        conn=pymysql.connect(host=HOSTNAME,
            user=USERNAME,
            password=PASSWORD,
            database=DATABASE
        ) 
        cursor=conn.cursor()
        print(f"Checking user: {username}", flush=True)
         # Check if user exists
        cursor.execute("SELECT * FROM user WHERE name = %s limit 1", (username,))
        result = cursor.fetchone()        
        if not result:
            print(f"User '{username}' not found in database.", flush=True)
            print("Creating new user...", flush=True)
            # If user does not exist, create a new user 
            cursor.execute("INSERT INTO user (name, password,created_at) VALUES (%s, %s, %s)", (username, password,datetime.now()))
            conn.commit()
            if cursor.rowcount == 1:
                return {"message": f"User '{username}' registered successfully."}

                print(f"User '{username}' created successfully.", flush=True)   
     
            else:
                print(f"Failed to create user '{username}'.", flush=True)
                raise HTTPException(status_code=500, detail="Failed to create user")
        else:
            raise HTTPException(status_code=401, detail="User already exists")
    # If the user does not exist, raise an exception
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()
        conn.close()

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    user_name: str = Form(...),
    session_id: str = Form(...)
):
    try:
        blob_name = upload_to_blob(file, user_name, session_id)
        if update_db(file_name=file.filename,full_file_path=blob_name, user_name=user_name, session_id=session_id):
            print("✅ File upload and database update successful.")
        else:
            print("❌ File uploaded to blob, but DB update failed.")
        print(f"File '{file.filename}' uploaded successfully as '{blob_name}'", flush=True)
        return JSONResponse(
            status_code=200,
            content={
                "message": f"Uploaded successfully",
                "blob_name": blob_name
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
