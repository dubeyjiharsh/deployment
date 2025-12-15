# Import necessary libraries
import pymysql
from fastapi import FastAPI,HTTPException,Form
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware


app=FastAPI()    

# CORS Middleware if calling from a frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000"],  # Allow Angular app on this URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginCredentials(BaseModel):
    username: str
    Password: str
    
# Database connection details
HOSTNAME= "localhost"
PORT= 3306
USERNAME="root"
PASSWORD="Admin@123"
DATABASE="intelliform"   

@app.post("/api/login")
def login(data: LoginCredentials):
    username=data.username
    Password=data.Password
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
        
        cursor.execute("SELECT * FROM user WHERE name = %s", (username,))
        result = cursor.fetchone()        
        if not result:
            raise HTTPException(status_code=404, detail="User not found")
        
        stored_password=result[2]
        
        if Password==stored_password:
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
            
