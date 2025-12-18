import os
import time
from fastapi import FastAPI, File, UploadFile, HTTPException
from pydantic import BaseModel
from fastapi.responses import JSONResponse
from openai import AzureOpenAI
from typing import List, Optional
from dotenv import load_dotenv
load_dotenv()

app = FastAPI()

# Initialize the AzureOpenAI client
client = AzureOpenAI(
    api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_key=os.getenv("AZURE_OPENAI_API_KEY")
)

# Store file_id for the session (in-memory storage for simplicity)
session_files = {}

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
def upload_file(client, file_path):
    with open(file_path, "rb") as file:
        file_upload = client.files.create(file=file, purpose="assistants")  # Adjust purpose if needed
        file_id = file_upload.id
    return file_id

# Utility function to run thread with assistant
def run_thread_with_assistant(client, thread_id, assistant_id, user_message="", file_id=None, instructions=None):
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
async def upload_file_endpoint(file: UploadFile = File(...)):
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

# FastAPI endpoint for interacting with the assistant
@app.post("/ask_assistant/")
async def ask_assistant(request: QueryRequest, file_id: Optional[str] = None):
    thread = client.beta.threads.create()  # Create a new thread for each request

    # If the file_id was not provided in the request, use the first uploaded file_id
    if not file_id:
        if not session_files:
            raise HTTPException(status_code=400, detail="No file uploaded yet. Please upload a file first.")
        # Use the first available file_id in the session (you can modify this logic as per your needs)
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

# You can run this FastAPI app by saving it as `app.py` and running `uvicorn app:app --reload`

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8010)
 