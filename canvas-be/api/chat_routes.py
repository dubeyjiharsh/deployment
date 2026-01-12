from typing import Optional, List
import logging
from fastapi import APIRouter, HTTPException, Form, File, UploadFile, Body
from models.schemas import (
    MessageResponse,
    ConversationHistoryResponse,
    CanvasFieldList
)

from services.responses_service import ResponsesService
from services.file_service import FileService
from db.postgres_store import postgres_store
from utils.json_parser import validate_canvas_structure

router = APIRouter(prefix="/api/canvas", tags=["Chat Interface"])

# Initialize services
responses_service = ResponsesService()
file_service = FileService()

@router.post("/{canvas_id}/message", response_model=MessageResponse)
async def send_message(
    canvas_id: str,
    message: str = Form(..., description="User message or problem statement"),
    files: Optional[List[UploadFile]] = File(None, description="Optional files for context")
):
    """
    Send a message to the canvas conversation

    Args:
        canvas_id: The canvas session UUID
        message: User's message or problem statement
        files: Optional files to upload for context

    Returns:
        chat_response: Response to display in chat interface
        canvas_json: Updated business model canvas JSON
        conversation_history: Full conversation history
    """
    try:
        # Validate message is not empty or whitespace
        if message is None or not message.strip():
            return MessageResponse(
                canvas_id=canvas_id,
                chat_response="Please enter a valid problem statement. Message cannot be empty or whitespace.",
                canvas_json=None,
            )

        # Verify canvas exists
        canvas = postgres_store.get_canvas(canvas_id)
        if not canvas:
            raise HTTPException(status_code=404, detail="Canvas session not found")

        # Check if this is the first message (no conversation history yet)
        is_first_message = canvas["status"] == 'created'

        # Upload files if provided
        new_file_ids = []
        if files:
            try:
                new_file_ids = await file_service.upload_files(files)
            except ValueError as ve:
                raise HTTPException(status_code=422, detail=str(ve))
            # Add to database
            for file_id in new_file_ids:
                postgres_store.add_file_to_canvas(canvas_id, file_id)

        # Send message and get response
        thread_id, chat_response, canvas_json = responses_service.send_message(
            message=message,
            previous_response_id=canvas["thread_id"] if canvas["thread_id"] else None,
            file_ids=new_file_ids if new_file_ids else None,
            is_first_message=is_first_message
        )

        # Validate canvas structure
        is_valid, errors = validate_canvas_structure(canvas_json)
        if not is_valid:
            logging.warning(f"Canvas validation errors: {errors}")

        # Save canvas fields to database
        try:
            # Update the name and thread ID in the canvas table
            new_title = canvas_json.get("Title")
            postgres_store.update_canvas(canvas_id, new_name=new_title, thread_id=thread_id)
            postgres_store.upsert_canvas_fields(canvas_id, canvas_json)
            # update status from created to drafted
            if canvas["status"] == "created":
                postgres_store.update_status(canvas_id)
        except Exception as e:
            logging.warning(f"Failed to save canvas fields: {str(e)}")
            # Continue execution - we still want to return the response

        # Get updated conversation history
        updated_history = responses_service.get_conversation_history(canvas["thread_id"])

        return MessageResponse(
            canvas_id=canvas_id,
            chat_response=chat_response,
            canvas_json=canvas_json,
            conversation_history=updated_history
        )
    
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to parse response: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process message: {str(e)}"
        
        )

@router.post("/{canvas_id}/save_canvas")
async def save_canvas(
    canvas_id: str,
    canvas_json: CanvasFieldList = Body(..., description="Updated business model canvas JSON")
):
    """
    Edit the canvas JSON directly
    
    Args:
        canvas_id: The canvas session UUID
        canvas_json: Updated business model canvas JSON
    
    Returns:
        Success message
    """
    try:
        # Verify canvas exists
        canvas = postgres_store.get_canvas(canvas_id)
        if not canvas:
            raise HTTPException(status_code=404, detail="Canvas session not found")

        # Pydantic validation is already performed by FastAPI via CanvasFieldList
        # Convert to dict with aliases for DB/storage
        canvas_dict = canvas_json.dict(by_alias=True, exclude_unset=True)

        # Sync the canvas table's name column with the Title
        title = canvas_dict.get("Title")
        if title and title != canvas["name"]:
            postgres_store.update_canvas(canvas_id, new_name=title, thread_id=canvas["thread_id"])

        # Validate canvas structure (optional, if you want extra validation)
        is_valid, errors = validate_canvas_structure(canvas_dict)
        if not is_valid:
            raise HTTPException(
                status_code=422,
                detail=f"Canvas validation errors: {errors}"
            )

        # Save canvas fields to database
        postgres_store.upsert_canvas_fields(canvas_id, canvas_dict)

        return {"message": "Canvas updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update canvas: {str(e)}"
        )

@router.get("/{canvas_id}/history", response_model=ConversationHistoryResponse)
async def get_conversation_history(canvas_id: str):
    """
    Get the full conversation history for a canvas session
    
    Args:
        canvas_id: The canvas session UUID
    
    Returns:
        Full conversation history with roles and content
    """
    try:
        # Verify canvas exists
        canvas = postgres_store.get_canvas(canvas_id)
        if not canvas:
            raise HTTPException(status_code=404, detail="Canvas session not found")

        # Get conversation history
        history = responses_service.get_conversation_history(canvas["thread_id"])

        return ConversationHistoryResponse(
            canvas_id=canvas_id,
            history=history
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve conversation history: {str(e)}"
        )