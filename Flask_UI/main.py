import json
import os
import tempfile
from typing import Dict, Any
from datetime import datetime
from pathlib import Path

import pytesseract
from pdf2image import convert_from_path
from PIL import Image, ImageEnhance
from dotenv import load_dotenv
from langchain_openai import AzureChatOpenAI
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import uvicorn
from utils.pdfextractor import PDFFormExtractor
# Standard library imports
import os
import json
from typing import Dict, List, Optional, Any, Union

# Third-party imports
from dotenv import load_dotenv
from fastapi import FastAPI, Form, HTTPException, File, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Langchain imports
from langchain_openai import AzureChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

# Utility functions
from utils.get_bic_response import get_bic_response
# from utils.getdraftutils import get_draft_sessions_for_user
from utils.fileutils import generate_file_summary, save_files_to_blob_storage
# from utils.uisaveandretriveutils import ui_2_db, db_2_ui
from utils.botutils import (
    read_json,
    save_to_json,
    identify_missing_fields,
    new_prompt,
    generate_business_canvas,
    single_field_update,
    yes_no_check,
    additional_comments
)
# from utils.bicsaveutils import save_bic_response
# from utils.myrequestutils import get_my_request
# from utils.draftdeleteutils import draft_delete
from utils.logutils import get_logger, log_context
from utils.bic_save_db import save_bic_response
# from utils.sessionutils import get_session_manager, initialize_MySQL_db

# Load environment variables
load_dotenv()

# Proxy Configurations (Optional / Set here if required)
# os.environ["HTTP_PROXY"] = os.getenv("HTTP_PROXY")
# os.environ["HTTPS_PROXY"] = os.getenv("HTTPS_PROXY")
# os.environ["SSL_CERT_FILE"] = os.getenv("SSL_CERT_FILE")
# os.environ["NO_PROXY"] = os.getenv("NO_PROXY")

# Get logger from logutils
logger = get_logger()

# Load environment variables
load_dotenv()


app = FastAPI(
    title="Business Canvas API",
    description="API for generating business canvas",
    version="1.0.0"
)


# Initialize extractor
extractor = None

@app.on_event("startup")
async def startup_event():
    """Initialize the extractor on startup"""
    global extractor
    
    # Check required environment variables
    required_vars = ['AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        raise HTTPException(
            status_code=500,
            detail=f"Missing environment variables: {', '.join(missing_vars)}"
        )
    
    try:
        # Auto-detect paths for Windows
        tesseract_path = None
        poppler_path = None
        
        if os.name == 'nt':  # Windows
            # Find Tesseract
            tesseract_paths = [
                r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
                r"C:\Users\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"
            ]
            for path in tesseract_paths:
                if os.path.exists(path):
                    tesseract_path = path
                    break
            
            # Find Poppler
            poppler_paths = [
                r"C:\poppler-23.01.0\Library\bin",
                r"C:\Poppler\poppler-24.08.0\Library\bin",
                r"C:\poppler\Library\bin",
                r"C:\Program Files\poppler\Library\bin",
                r"C:\Program Files (x86)\poppler\Library\bin"
            ]
            for path in poppler_paths:
                if os.path.exists(path):
                    poppler_path = path
                    break
        
        extractor = PDFFormExtractor(
            tesseract_path=tesseract_path, 
            poppler_path=poppler_path
        )
        print("✅ PDF Form Extractor initialized successfully")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Business Canvas - Intelliform API",
        "version": "1.0.0",
        # "endpoints": {
        #     "/extract-upload": "Upload PDF file for form field extraction",
        #     "/extract-path": "Extract from PDF file path (server-side)",
        #     "/health": "Health check"
        # }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "extractor_ready": extractor is not None
    }

@app.get("/diagnose")
async def diagnose_dependencies():
    """Diagnose Tesseract and Poppler installation"""
    diagnostics = {
        "timestamp": datetime.now().isoformat(),
        "platform": os.name,
        "tesseract": {"status": "unknown", "version": None, "path": None},
        "poppler": {"status": "unknown", "paths_checked": []},
        "suggestions": []
    }
    
    # Check Tesseract
    try:
        version = pytesseract.get_tesseract_version()
        diagnostics["tesseract"]["status"] = "working"
        diagnostics["tesseract"]["version"] = str(version)
        diagnostics["tesseract"]["path"] = pytesseract.pytesseract.tesseract_cmd
    except Exception as e:
        diagnostics["tesseract"]["status"] = "error"
        diagnostics["tesseract"]["error"] = str(e)
        diagnostics["suggestions"].append("Install Tesseract: https://github.com/UB-Mannheim/tesseract/wiki")
    
    # Check Poppler paths
    if os.name == 'nt':  # Windows
        poppler_paths = [
            r"C:\poppler-23.01.0\Library\bin",
            r"C:\poppler-24.02.0\Library\bin", 
            r"C:\poppler\Library\bin",
            r"C:\Program Files\poppler\Library\bin",
            r"C:\Program Files (x86)\poppler\Library\bin",
            r"C:\Tools\poppler\Library\bin"
        ]
        
        found_paths = []
        for path in poppler_paths:
            diagnostics["poppler"]["paths_checked"].append({
                "path": path,
                "exists": os.path.exists(path)
            })
            if os.path.exists(path):
                found_paths.append(path)
        
        if found_paths:
            diagnostics["poppler"]["status"] = "found"
            diagnostics["poppler"]["available_paths"] = found_paths
        else:
            diagnostics["poppler"]["status"] = "not_found"
            diagnostics["suggestions"].append("Install Poppler: https://github.com/oschwartz10612/poppler-windows/releases/")
    
    # Test PDF conversion if possible
    if diagnostics["tesseract"]["status"] == "working":
        try:
            # Try to import and test basic functionality
            from pdf2image import convert_from_path
            diagnostics["pdf2image"] = {"status": "imported_successfully"}
        except Exception as e:
            diagnostics["pdf2image"] = {"status": "import_error", "error": str(e)}
    
    return diagnostics

@app.post("/extract-upload")
async def extract_from_upload(file: UploadFile = File(...)):
    """
    Extract form fields from uploaded PDF file
    
    Args:
        file: Uploaded PDF file
        
    Returns:
        JSON response with extracted form fields
    """
    # Validate file
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    if file.size and file.size > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")
    
    temp_file_path = None
    try:
        # Save uploaded file temporarily
        file_content = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            temp_file.write(file_content)
            temp_file_path = temp_file.name
        
        # Step 1: Extract text using OCR
        ocr_result = extractor.extract_text_from_pdf(temp_file_path)
        
        if not ocr_result['success']:
            return JSONResponse(
                status_code=500,
                content={
                    "error": "OCR extraction failed",
                    "details": ocr_result.get('error', 'Unknown error')
                }
            )
        
        # Step 2: Generate form fields JSON using OpenAI
        ai_result = extractor.generate_form_fields_json(ocr_result['combined_text'])
        
        if not ai_result['success']:
            return JSONResponse(
                status_code=500,
                content={
                    "error": "AI analysis failed",
                    "details": ai_result.get('error', 'Unknown error'),
                    "ocr_success": True,
                    "extracted_text_length": len(ocr_result['combined_text'])
                }
            )
        
        # Combine results
        final_result = {
            "filename": file.filename,
            "file_size": len(file_content),
            "ocr_info": {
                "total_pages": ocr_result['total_pages'],
                "extraction_timestamp": ocr_result['extraction_timestamp']
            },
            "form_analysis": ai_result['form_data']
        }
        
        return JSONResponse(content=final_result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")
    
    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except:
                pass

@app.post("/extract-path")
async def extract_from_path(request: dict):
    """
    Extract form fields from PDF file using file path
    
    Args:
        request: JSON with 'file_path' key
        
    Returns:
        JSON response with extracted form fields
    """
    file_path = request.get('file_path')
    if not file_path:
        raise HTTPException(status_code=400, detail="file_path is required")
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
    
    if not file_path.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    try:
        # Step 1: Extract text using OCR
        ocr_result = extractor.extract_text_from_pdf(file_path)
        
        if not ocr_result['success']:
            return JSONResponse(
                status_code=500,
                content={
                    "error": "OCR extraction failed",
                    "details": ocr_result.get('error', 'Unknown error')
                }
            )
        
        # Step 2: Generate form fields JSON using OpenAI
        ai_result = extractor.generate_form_fields_json(ocr_result['combined_text'])
        
        if not ai_result['success']:
            return JSONResponse(
                status_code=500,
                content={
                    "error": "AI analysis failed", 
                    "details": ai_result.get('error', 'Unknown error'),
                    "ocr_success": True,
                    "extracted_text_length": len(ocr_result['combined_text'])
                }
            )
        
        # Combine results
        final_result = {
            "file_path": file_path,
            "file_size": os.path.getsize(file_path),
            "ocr_info": {
                "total_pages": ocr_result['total_pages'],
                "extraction_timestamp": ocr_result['extraction_timestamp']
            },
            "form_analysis": ai_result['form_data']
        }
        
        return JSONResponse(content=final_result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


# Data Models
class UserRequest(BaseModel):
    session_id: str
    user_name: str
    user_message: Optional[Union[str, None]] = None
    edit_field: Optional[Union[str, None]] = None

class UserResponse(BaseModel):
    session_id: str
    user_name: str
    bot_message: Union[str, Dict]
    BIC: Optional[Union[Dict, None]] = None
    button: Optional[Union[List, None]] = None
    drop_down: bool = None
    session_metrics: Optional[Dict] = None

class UserAdditionalFileUpload(BaseModel):
    session_id: str
    user_name: str

class UI2DBUpload(BaseModel):
    session_id: str
    user_name: str
    session_data: str
    timestamp: str

class UI2DBResponse(BaseModel):
    message: str

class DB2UIRequest(BaseModel):
    session_id: str
    user_name: str

class DB2UIResponse(BaseModel):
    message_session_data: str

class DraftResponse(BaseModel):
    draft_data: Any

class MyResponse_Submitted(BaseModel):
    my_request_submitted_data: Any

class DeleteDraftResponse(BaseModel):
    message: str

class UpdateBICFieldsResponse(BaseModel):
    message: str

NO="No, I'd like to review and make edits"
YES="Yes, everything looks good"
# Process user input and generate a response for the business canvas application.
def process_user_input(
        user_message: str = None, 
        form_response: Optional[Dict] = None, 
        form_field: Optional[str] = None, 
        user_name: str = "Unknown", 
        session_id: str = "Unknown",
        description: Dict = None,
        field_list: List = None) -> dict:
    try:
        if field_list is None or description is None:
            log_context('error', user_name, session_id, f"user message: Field list or description argument is empty")
            return {"bot_message": "Field list or description argument is empty"}

        if user_message == YES:
            response = yes_no_check(user_input=user_message)
            remaining_fields = identify_missing_fields(form_response)
            button = None
            log_context('info', user_name, session_id, f"user message: {YES}")
            if remaining_fields:
                button = remaining_fields
            else:
                button = []
            # button.append("I will complete them later")
            return {
                "bot_message": response,
                "form_response": form_response,
                "button": button,
                "drop_down": False
            }
        elif user_message == NO:
            response = yes_no_check(user_input=user_message)
            log_context('info', user_name, session_id, f"user message: {NO}")
            return {
                "bot_message": response, 
                "form_response": form_response, 
                "button": None, 
                "drop_down": False
            }
        
        if form_field and not user_message:
            log_context('info', user_name, session_id, f"Request for question and guidelines for: {form_field}; Functionality yet to be completed")
            pass
            # Code block for returning question and guidelines

        if form_field and user_message:
            log_context('info', user_name, session_id, f"Single field update for: {form_field}")
            user_message = single_field_update(user_input=user_message, field_name=form_field)
        
        if form_response:
            log_context('info', user_name, session_id, "Updating existing canvas with new input")
            canvas_data = new_prompt(
                field_list=field_list, 
                user_input=user_message, 
                current_canvas=form_response,
                description=description
            )
        else:
            log_context('info', user_name, session_id, "Generating new business canvas")
            canvas_data = generate_business_canvas(
                user_input=user_message, 
                field_list=field_list,
                description=description
            )

        if not canvas_data:
            log_context('error', user_name, session_id, "Failed to process user input")
            return {"bot_message": "I couldn't process your input. Please try again.", "form_response": form_response, "button": None, "drop_down": False}
        
        
        remaining_fields = identify_missing_fields(canvas_data)
        button = None

        # Count completed fields for logging purposes only
        completed_fields = sum(1 for value in canvas_data.values() if value and isinstance(value, str) and value.strip())
        log_context('info', user_name, session_id, f"Canvas has {completed_fields} completed fields out of 9")

        if "feedback" in canvas_data:
            msg = canvas_data["feedback"]
            del canvas_data["feedback"]
        else:
            msg = "Thank you for your input! We appreciate you taking the time to share your thoughts."

        if remaining_fields:
            log_context('info', user_name, session_id, f"Missing mandatory fields: {', '.join(remaining_fields)}")
            button = [YES, NO]
        else:
            log_context('info', user_name, session_id, "All fields completed")
            button = None

        return {"bot_message": msg, "form_response": canvas_data, "button": button, "drop_down": False}
    
    except Exception as e:
        error_message = f"Error processing user input: {str(e)}"
        log_context('error', user_name, session_id, error_message)
        raise HTTPException(status_code=500, detail=error_message)

# Process uploaded files and generate summaries of their contents
async def get_file_summary(files, user_name, session_id):
    """
    Process uploaded files and generate summaries of their contents.
    
    This function handles reading the content of each uploaded file, 
    generating summaries using the generate_file_summary utility function,
    and combining them into a single string.
    
    Args:
        files: A list of FastAPI UploadFile objects to process, or None if no files
        user_name: User identifier for logging purposes
        session_id: Session identifier for logging purposes
    
    Returns:
        Optional[str]: A string containing summaries of all files concatenated with newlines, or None if no files were provided
    
    Raises:
        HTTPException: With status code 500 if there's an error processing the files
    """
    if files:
        file_contents = []
        log_context('info', user_name, session_id, f"Processing {len(files)} uploaded files")
        
        for file in files:
            # Read the file content
            file_content = await file.read()
            file_contents.append((file.filename, file_content))
            log_context('info', user_name, session_id, f"Read file: {file.filename}")
        
        # Generate file summaries
        try:
            uploaded_file_summaries = generate_file_summary(
                user_name=user_name, 
                session_id=session_id, 
                files=file_contents
            )
            uploaded_file_summaries = "\n".join(list(uploaded_file_summaries.values()))
            log_context('info', user_name, session_id, "File summaries generated successfully")
            return uploaded_file_summaries
        
        except Exception as e:
            error_message = f"Error processing files: {str(e)}"
            log_context('error', user_name, session_id, error_message)
            raise HTTPException(
                status_code=500,
                detail=error_message
            )
    return None


# Main ChatBot Route
@app.post("/ada", response_model=UserResponse)
async def chat(
    request: str = Form(...),
    description: str = Form(...),
    files: Optional[List[UploadFile]] = File(None)
):
    """
    Process chat messages and file uploads for the business canvas application.
    
    This endpoint handles:
    - Receiving user messages and optional file uploads
    - Managing user sessions
    - Processing user input and generating responses
    - Updating conversation history
    - Tracking business canvas completion
    
    Args:
        request: JSON string containing session information and user message
                Expected format: {
                    "session_id": str,
                    "user_name": str,
                    "user_message": str,
                    "edit_field": Optional[str],
                    "confirmation": Optional[str],
                    "include_metrics": Optional[bool]
                }
        files: Optional list of uploaded files to be processed and included in the conversation
    
    Returns:
        UserResponse: Object containing session information, bot response, and business canvas data
    
    Raises:
        HTTPException: 
            - 400: If request has invalid JSON format or missing required fields
            - 404: If edit_field is provided but no BIC exists
            - 500: For unexpected errors during processing
    """
    # Parse the JSON request data
    try:
        request_data = json.loads(request)
        session_id = request_data.get("session_id")
        user_name = request_data.get("user_name")
        user_message = request_data.get("user_message")
        edit_field = request_data.get("edit_field")
        confirmation = request_data.get("confirmation")
        description = json.loads(description)
        field_list = [key for key in description.keys()]

        log_context('info', user_name if user_name else 'unknown', 
                   session_id if session_id else 'unknown', 
                   f"Received request: edit_field={edit_field}, has_files={files is not None}")

        if not session_id or not user_name:
            log_context('error', 'unknown', 'unknown', "Missing required fields: session_id and user_name")
            raise HTTPException(status_code=400, detail="Missing required fields: session_id and user_name")
        
        
        # If files are uploaded, their contents will be extracted and appended to the user message
        try:
            if files:
                uploaded_file_summaries = await get_file_summary(files, user_name, session_id)
                if uploaded_file_summaries is not None:
                    user_message = user_message + "\n" + uploaded_file_summaries
                    log_context('info', user_name, session_id, "File content appended to user message")
        except Exception as e:
            log_context('error', user_name, session_id, f"Error processing uploaded files: {str(e)}")
            raise HTTPException(status_code=500, detail="Error processing uploaded files")
        
        # Get session from MySQL DB or create new one
        session = get_bic_response(session_id)
        if not session:
            # Initialize a new session in MySQL DB
            save_bic_response(user_name, session_id, None)
            session = get_bic_response(session_id)
            log_context('info', user_name, session_id, "Created new session")
        else:
            log_context('info', user_name, session_id, "Retrieved existing session")
        
        if not session["Fields"] and edit_field:
            log_context('error', user_name, session_id, "Requested to edit field but BIC not found")
            raise HTTPException(status_code=404, detail="Bad Request: BIC not found")
        
        # For existing sessions, ensure user_message is provided
        if not user_message and not edit_field:
            log_context('error', user_name, session_id, "Missing required field: user_message")
            raise HTTPException(status_code=400, detail="Missing required field: user_message")
        
        # Process the user input
        bot_response = process_user_input(
            user_message=user_message,
            form_response=session["Fields"],
            form_field=edit_field,
            user_name=user_name,
            session_id=session_id,
            description=description,
            field_list=field_list
        )
        print(bot_response)
        # Update the session with the new BIC response
        session["form_response"] = bot_response["form_response"]
        
        # No need to track field completion status
        if bot_response["form_response"]:
            # Simply log that the BIC response was updated
            log_context('info', user_name, session_id, "BIC response updated with user input")
        
        
        # Update the session in MySQL DB
        success = save_bic_response(user_name=user_name, session_id=session_id, update_data=bot_response["form_response"])
        if success:
            log_context('info', user_name, session_id, "Session updated successfully in MYSQL DB")
        else:
            log_context('warning', user_name, session_id, "Failed to update session in MySQL DB")
        
        # Save the updated BIC to a JSON file with the session ID (optional, could be removed in production)
        if bot_response["form_response"]:
            save_bic_response(user_name, session_id, bot_response["form_response"])
        
        log_context('info', user_name, session_id, "Request processed successfully")
        if confirmation == None and "confirmation" in bot_response["form_response"]:
            confirmation = bot_response["form_response"]["confirmation"]
            del bot_response["form_response"]["confirmation"]
        
        if confirmation == "True" and user_message not in (None, 'No', '', 'Yes', YES, NO):
            bot_response["button"] = [YES, NO]
        elif edit_field and not user_message:
            pass
        elif confirmation == "None":
            bot_response["button"] = None

        return UserResponse(
            session_id=session_id,
            user_name=user_name,
            bot_message=bot_response["bot_message"],
            BIC=bot_response["form_response"],
            button=bot_response["button"],
            drop_down=bot_response["drop_down"]
        )
    except json.JSONDecodeError:
        log_context('error', 'unknown', 'unknown', "Invalid JSON format in request in chat endpoint")
        raise HTTPException(status_code=400, detail="Invalid JSON format in request in chat endpoint")
    except Exception as e:
        error_message = f"Unexpected error in chat endpoint: {str(e)}"
        log_context('error', user_name if 'user_name' in locals() else 'unknown', 
                    session_id if 'session_id' in locals() else 'unknown', 
                    error_message)
        raise HTTPException(status_code=500, detail=error_message)


@app.get("/bic_response/{session_id}")
def bic_response(session_id: str):
    """
    FastAPI endpoint to get BIC response for a given session ID.
    Args:
        session_id (str): The session ID for which to fetch form data.
    Returns:
        dict: A dictionary containing all dynamic form fields and metadata.
    """
    response = get_bic_response(session_id)
    if "error" in response:
        raise HTTPException(status_code=404, detail=response["error"])
    return response

# if __name__ == "__main__":
#     uvicorn.run(
#         "main:app",
#         host="127.0.0.1",
#         port=8008,
#         reload=True
#     )