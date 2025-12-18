import os
import time
from fastapi import FastAPI, File, UploadFile, HTTPException
from pydantic import BaseModel
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from openai import AzureOpenAI
from typing import List, Optional
from dotenv import load_dotenv
import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)

load_dotenv()

app = FastAPI()

# CORS configuration
origins = [
    "http://localhost:3000",  # Frontend URL (React, Vue.js, etc.)
    "http://your-frontend-domain.com",  # Other allowed frontend origins
    "*",  # Allow all origins (not recommended for production)
]

# Add CORS middleware to allow requests from the specified origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  
    allow_credentials=True,
    allow_methods=["*"],    
    allow_headers=["*"],    
)

# Initialize the AzureOpenAI client
client = AzureOpenAI(
    api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_key=os.getenv("AZURE_OPENAI_API_KEY")
)

# Store file_id for the session (in-memory storage for simplicity)
session_files = {}

# Store canvas_id to thread_id mapping (in-memory storage for simplicity)
canvas_to_thread = {}

# Create an assistant (using a global assistant to avoid creating one each time)
assistant = client.beta.assistants.create(
    name="Business Canvas Assistant",
    instructions="""You are a helpful assistant that helps users create business model canvases.
                    Answer as concisely as possible. Use the attached files to answer questions.
                    Extract information from attached .pdf, .docx, .txt files to answer user questions.
                    Remember previous conversation history in the thread to provide better answers.
                    Information in your responses must be based on the content of the files.
                    Do not add any additional commentary.""",
    model="gpt-5-mini",
    tools=[{"type": "file_search"}]
)

# Utility function to upload a file and return file_id
def upload_file(client: AzureOpenAI, file_path: str)-> str:
    """
    Upload a file to Azure OpenAI and return the file_id.
    Args:
        client (AzureOpenAI): The Azure OpenAI client instance.
        file_path (str): The path to the file to be uploaded.
    Returns:
        str: The file_id of the uploaded file.
    """
    with open(file_path, "rb") as file:
        file_upload = client.files.create(file=file, purpose="assistants") 
        file_id = file_upload.id
    return file_id

# Utility function to run thread with assistant
def run_thread_with_assistant(client: AzureOpenAI, thread_id: str, assistant_id: str, user_message: str, file_id: str = None) -> dict:
    """
    Run a conversation thread with the assistant.
    Args:
        client (AzureOpenAI): The Azure OpenAI client instance.
        thread_id (str): The ID of the conversation thread.
        assistant_id (str): The ID of the assistant.
        user_message (str): The user's message to send to the assistant.
        file_id (str, optional): The file_id of the uploaded file to attach. Defaults to None.
    Returns:
        dict: The completed run information.
    """
    if file_id:
        attachments = [{"file_id": file_id, "tools": [{"type": "file_search"}]}]
        message = client.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content=user_message,
            attachments=attachments
        )
    else:
        message = client.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content=user_message
        )

    run = client.beta.threads.runs.create(
        thread_id=thread_id,
        assistant_id=assistant_id,
    )

    while True:
        run = client.beta.threads.runs.retrieve(
            thread_id=thread_id,
            run_id=run.id
        )
        time.sleep(2)
        if run.status == "completed":
            break
    return run

# Pydantic model for the request
class QueryRequest(BaseModel):
    user_message: str

class FileUploadResponse(BaseModel):
    file_id: str

# FastAPI endpoint for uploading files
@app.post("/upload_file/", response_model=FileUploadResponse)
async def upload_file_endpoint(file: UploadFile = File(...))-> JSONResponse:
    """
    Upload a file and return the file_id.
    Args:
        file (UploadFile): The file to be uploaded.
    Returns:
        JSONResponse: A JSON response containing the file_id.
    """
    try:
        file_location = f"temp_{file.filename}"
        with open(file_location, "wb") as f:
            f.write(file.file.read())

        # Upload file to Azure OpenAI and get file_id
        file_id = upload_file(client, file_location)
        
        # Store the file_id in the session (using a simple dictionary for this example)
        session_files[file.filename] = file_id

        return JSONResponse(content={"file_id": file_id})
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")

# FastAPI endpoint for creating a new canvas
@app.post("/create_new_canvas/")
async def create_new_canvas()-> JSONResponse:
    """
    Create a unique canvas_id and new conversation thread for a new business model canvas.
    Map the thread_id to the canvas_id.
    Args:
        None
    Returns:
        JSONResponse: A JSON response containing the new thread ID.
    """
    try:
        # Create a unique canvas_id (for simplicity, using timestamp here)
        canvas_id = str(time.time()).replace('.', '')  # Generate a unique canvas_id based on the current timestamp
        
        # Check if a canvas with this ID already exists
        if canvas_id in canvas_to_thread:
            return JSONResponse(content={"thread_id": canvas_to_thread[canvas_id]})

        # Create a new conversation thread
        thread = client.beta.threads.create()

        # Map the thread_id to the canvas_id
        canvas_to_thread[canvas_id] = thread.id

        return JSONResponse(content={"canvas_id": canvas_id, "thread_id": thread.id})

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating new canvas: {str(e)}")

# FastAPI endpoint for interacting with the assistant
@app.post("/ask_assistant/")
async def ask_assistant(request: QueryRequest, canvas_id: str, file_id: Optional[str] = None)-> JSONResponse:
    """
    Ask a question to the assistant in an ongoing thread for the given canvas.
    Args:
        request (QueryRequest): The request containing the user message.
        canvas_id (str): The ID of the canvas (thread will be pulled from this).
        file_id (str, optional): The file_id of the uploaded file to attach. Defaults to None.
    Returns:
        JSONResponse: A JSON response containing the assistant's reply.
    """
    # Retrieve the thread_id for the given canvas_id
    try:
        thread_id = canvas_to_thread[canvas_id]
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Canvas ID {canvas_id} not found. Please create a new canvas.")

    # Retrieve the thread
    try:
        thread = client.beta.threads.retrieve(thread_id=thread_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Thread not found: {str(e)}")

    # If the file_id was not provided in the request, use the first uploaded file_id
    if not file_id:
        if not session_files:
            raise HTTPException(status_code=400, detail="No file uploaded yet. Please upload a file first.")
        file_id = list(session_files.values())[0]

    # Run the thread with assistant and retrieve the response
    try:
        run = run_thread_with_assistant(
            client=client,
            thread_id=thread.id,
            assistant_id=assistant.id,
            user_message=request.user_message,
            file_id=file_id
        )

        # Retrieve last messages in the thread
        messages = client.beta.threads.messages.list(thread_id=thread.id)
        assistant_response = None
        for msg in messages.data:
            if msg.role == "assistant":
                assistant_response = msg.content[0].text.value
                break

        if assistant_response:
            return JSONResponse(content={"response": assistant_response})
        else:
            raise HTTPException(status_code=500, detail="No assistant response found")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

# FastAPI endpoint for retrieving conversation history
@app.get("/conversation_history/{canvas_id}")
async def get_conversation_history(canvas_id: str)-> JSONResponse:
    """
    Retrieve the conversation history for a given canvas.
    Args:
        canvas_id (str): The ID of the canvas.
    Returns:
        JSONResponse: A JSON response containing the conversation history.
    """
    try:
        thread_id = canvas_to_thread[canvas_id]
        messages = client.beta.threads.messages.list(thread_id=thread_id)
        history = [{"role": msg.role, "content": msg.content[0].text.value} for msg in messages.data]
        return JSONResponse(content={"history": history})
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Canvas ID {canvas_id} not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving conversation history: {str(e)}")

# You can run this FastAPI app by saving it as `app.py` and running `uvicorn app:app --reload`

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8010)
