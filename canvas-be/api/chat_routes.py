from typing import Optional, List
from fastapi import APIRouter, HTTPException, Form, File, UploadFile
from models.schemas import (
    MessageResponse,
    ConversationHistoryResponse
)
from services.assistant_service import AssistantService
from services.file_service import FileService
from storage.memory_store import memory_store
from utils.json_parser import validate_canvas_structure

router = APIRouter(prefix="/api/canvas", tags=["Chat Interface"])

# Initialize services
assistant_service = AssistantService()
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
        canvas_id: The canvas session ID
        message: User's message or problem statement
        files: Optional files to upload for context
    
    Returns:
        chat_response: Response to display in chat interface
        canvas_json: Updated business model canvas JSON
        conversation_history: Full conversation history
    """
    try:
        # Verify session exists
        session = memory_store.get_session(canvas_id)
        if not session:
            raise HTTPException(status_code=404, detail="Canvas session not found")
        
        # Check if this is the first message (no conversation history yet)
        history = assistant_service.get_conversation_history(session.thread_id)
        is_first_message = len(history) == 0
        
        # Upload files if provided
        new_file_ids = []
        if files:
            new_file_ids = await file_service.upload_files(files)
            # Add to session
            for file_id in new_file_ids:
                memory_store.add_file_to_session(canvas_id, file_id)
        
        # Get all file IDs for this session
        all_file_ids = session.file_ids
        
        # Send message and get response
        chat_response, canvas_json = assistant_service.send_message(
            thread_id=session.thread_id,
            assistant_id=session.assistant_id,
            message=message,
            file_ids=all_file_ids if all_file_ids else None,
            is_first_message=is_first_message
        )
        
        # Validate canvas structure
        is_valid, errors = validate_canvas_structure(canvas_json)
        if not is_valid:
            print(f"Warning: Canvas validation errors: {errors}")
            # Still return the response but log the errors
        
        # Get updated conversation history
        updated_history = assistant_service.get_conversation_history(session.thread_id)
        
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

@router.get("/{canvas_id}/history", response_model=ConversationHistoryResponse)
async def get_conversation_history(canvas_id: str):
    """
    Get the full conversation history for a canvas session
    
    Args:
        canvas_id: The canvas session ID
    
    Returns:
        Full conversation history with roles and content
    """
    try:
        # Verify session exists
        session = memory_store.get_session(canvas_id)
        if not session:
            raise HTTPException(status_code=404, detail="Canvas session not found")
        
        # Get conversation history
        history = assistant_service.get_conversation_history(session.thread_id)
        
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