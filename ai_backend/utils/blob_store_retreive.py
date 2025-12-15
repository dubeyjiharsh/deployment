from pymysql import connect
import os
from azure.storage.blob import BlobServiceClient    
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from fastapi import UploadFile
import uuid
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from io import BytesIO
import csv

load_dotenv()

os.environ["HTTP_PROXY"] = "http://ep.threatpulse.net:80"
os.environ["HTTPS_PROXY"] = "http://ep.threatpulse.net:80"
os.environ["NO_PROXY"]="https://hduopenai.openai.azure.com/, .table.core.windows.net,.core.windows.net, https://account-dufry.documents.azure.com:443/, .documents.azure.com, .azure.com"

# Azure Blob Storage
AZURE_BLOB_STORAGE_NAME = os.getenv("AZURE_BLOB_STORAGE_NAME")
AZURE_BLOB_STORAGE_KEY = os.getenv("AZURE_BLOB_STORAGE_KEY")
AZURE_BLOB_STORAGE_ENDPOINT = os.getenv("AZURE_BLOB_STORAGE_ENDPOINT")
AZURE_BLOB_CONNECTION_STRING= os.getenv("AZURE_BLOB_CONNECTION_STRING")

# MySQL Database connection details
MYSQL_HOST = os.getenv("MYSQL_HOST")
MYSQL_PORT = os.getenv("MYSQL_PORT")
MYSQL_USER = os.getenv("MYSQL_USER")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD")    
MYSQL_DB_intelliform = os.getenv("MYSQL_DB_intelliform")
MYSQL_DB=os.getenv("MYSQL_DB")

def upload_to_blob_doc_id(file: UploadFile, user_name: str, session_id: str, document_id: str):
    try:
        print(f"Uploading file with document_id {document_id} to Azure Blob Storage...", flush=True)
       # blob_service = BlobServiceClient(
        #    account_url=AZURE_BLOB_STORAGE_ENDPOINT,
         #   credential=AZURE_BLOB_STORAGE_KEY,
          #  transport=transport

        #)
        blob_service = BlobServiceClient.from_connection_string(AZURE_BLOB_CONNECTION_STRING)

        print("Blob service client created", flush=True)
        container_client = blob_service.get_container_client(AZURE_BLOB_STORAGE_NAME)
        if not container_client.exists():
            container_client.create_container()
        print(f"Container '{AZURE_BLOB_STORAGE_NAME}' is ready", flush=True)
        # Generate unique blob name
        # file_name = os.path.splitext(file.filename)[0]
        # extension = os.path.splitext(file.filename)[1]
        blob_name = f"{session_id}.pdf"
        full_file_path=AZURE_BLOB_STORAGE_ENDPOINT+AZURE_BLOB_STORAGE_NAME+"/"+blob_name
        print(f"Generated blob name: {blob_name}")
        # Upload the file to the blob storage
        blob_client = container_client.get_blob_client(blob=blob_name)
        print("Blob client created")
        blob_client.upload_blob(file.file, overwrite=True)
        print(f"File '{document_id}' uploaded successfully to blob storage as '{blob_name}'")
        return blob_name  # Return the blob name for further processing
    except Exception as e:
        raise RuntimeError(f"Failed to upload to blob storage: {str(e)}")

def upload_to_blob(file: UploadFile, user_name: str, session_id: str):
    try:
        print(f"Uploading file '{file.filename}' to Azure Blob Storage...", flush=True)
       # blob_service = BlobServiceClient(
        #    account_url=AZURE_BLOB_STORAGE_ENDPOINT,
         #   credential=AZURE_BLOB_STORAGE_KEY,
          #  transport=transport

        #)
        blob_service = BlobServiceClient.from_connection_string(AZURE_BLOB_CONNECTION_STRING)

        print("Blob service client created", flush=True)
        container_client = blob_service.get_container_client(AZURE_BLOB_STORAGE_NAME)
        if not container_client.exists():
            container_client.create_container()
        print(f"Container '{AZURE_BLOB_STORAGE_NAME}' is ready", flush=True)
        # Generate unique blob name
        file_name = os.path.splitext(file.filename)[0]
        extension = os.path.splitext(file.filename)[1]
        blob_name = f"{file_name}-{uuid.uuid4()}{extension}"
        full_file_path=AZURE_BLOB_STORAGE_ENDPOINT+AZURE_BLOB_STORAGE_NAME+"/"+blob_name
        print(f"Generated blob name: {blob_name}")
        # Upload the file to the blob storage
        blob_client = container_client.get_blob_client(blob=blob_name)
        print("Blob client created")
        blob_client.upload_blob(file.file, overwrite=True)
        print(f"File '{file.filename}' uploaded successfully to blob storage as '{blob_name}'")
        return blob_name  # Return the blob name for further processing
    except Exception as e:
        raise RuntimeError(f"Failed to upload to blob storage: {str(e)}")

def read_file_from_blob(file_path:str):
    try:
        print(f"Reading file from Azure Blob Storage: {file_path}")
        # Initialize BlobServiceClient
        blob_service = BlobServiceClient(account_url=AZURE_BLOB_STORAGE_ENDPOINT, credential=AZURE_BLOB_STORAGE_KEY)
        container_client = blob_service.get_container_client(container=AZURE_BLOB_STORAGE_NAME)
        if not container_client.exists():
            container_client.create_container()
        blob_client = container_client.get_blob_client(blob=file_path)
        print("blob client created")
        # Download the blob content 
        stream = blob_client.download_blob()  
        content = stream.readall()  # Read the content of the blob
        return(BytesIO(content))  # Convert to BytesIO for further processing

    except Exception as e:
        print(f"Error reading file from blob: {str(e)}")
        raise RuntimeError(f"Failed to read file from blob storage: {str(e)}")



def update_db(file_name:str,full_file_path:str, user_name:str, session_id:str):
    conn = connect(
            host=MYSQL_HOST,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            database=MYSQL_DB_intelliform
        )
    if conn is None:
        raise HTTPException(status_code=500, detail="Could not connect to database")
    else:
        cursor = conn.cursor()
    try:
        document_id=session_id+"-"+file_name
        cursor.execute("""Insert into files(document_id,user_id,session_id,
                   file_name,file_path,upload_timestamp,status)
                   values (%s, %s, %s, %s, %s, NOW(), 'active')""",
                   (document_id,user_name, session_id, file_name, full_file_path))
        conn.commit()
        if  cursor.rowcount > 0:
            print("Database updated successfully")
            return True
        else:
            print("Failed to update database")
            return False
    except Exception as e:
        print(f"Error updating database: {e}")
    finally:
        cursor.close()
        conn.close()

def get_file_path(file_name:str):
    conn = connect(
            host=MYSQL_HOST,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            database=MYSQL_DB_intelliform
        )
    if conn is None:
        raise HTTPException(status_code=500, detail="Could not connect to database")
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT file_path FROM files WHERE file_name = %s", (file_name,))
        result = cursor.fetchone()
        if result:
            result_file_path=result[0]
            return result_file_path  # Return the file path
        else:
            raise ValueError("File not found in database")
    except Exception as e:
        raise RuntimeError(f"Failed to retrieve file path: {str(e)}")
    finally:
        cursor.close()
        conn.close()


def write_to_csv(session_id: str,user_name: str,doc_id:str):
    try:
        conn = connect(
            host=MYSQL_HOST,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            database=MYSQL_DB
        )

        if conn is None:
            raise HTTPException(status_code=500, detail="Could not connect to database")

        cursor = conn.cursor()
        
        query = """
        SELECT sf.field_name, sf.field_value
        FROM submission_fields sf
        LEFT JOIN submissions s ON sf.submission_id = s.id
        WHERE s.session_id = %s AND s.user_name = %s
        AND s.doc_id= %s
        ORDER BY s.id DESC
        """

        cursor.execute(query, (session_id, user_name,doc_id))
        print(f"Executing query for session_id: {session_id} and user_name: {user_name} and doc_id: {doc_id}")
        rows = cursor.fetchall()
        print(f"Rows fetched: {len(rows)}")
        if not rows:
            raise HTTPException(status_code=404, detail="No data found for the given session ID")
        # Write to CSV
        file_path = f"{session_id}_{user_name}_{doc_id}_form_data.csv"

        with open(file_path, mode="w", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            writer.writerow(["Field Name", "Field Value"])
            writer.writerows(rows)

        print(f"CSV written successfully to {file_path}")
        return file_path  # Return the path to the CSV file

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        print(f"Error writing CSV: {str(e)}")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()