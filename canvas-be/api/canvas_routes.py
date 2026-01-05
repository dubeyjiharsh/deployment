from fastapi import APIRouter, HTTPException, Response
import os
from models.schemas import (
    CreateCanvasResponse,
    CanvasListResponse,
    CanvasList
)
from services.assistant_service import AssistantService
from services.export_service import ExportService
from db.postgres_store import postgres_store
from typing import Dict, Any

router = APIRouter(prefix="/api/canvas", tags=["Canvas Management"])

# Initialize services
assistant_service = AssistantService()
assistant_id = assistant_service.create_assistant()
exp_service = ExportService()

@router.post("/create/{user_id}", response_model=CreateCanvasResponse)
async def create_canvas(user_id: str):
    """
    Create a new canvas for logged in user

    Args: User authentication context
        user_id: The user identifier    
    
    Returns:
        canvas_id: Unique identifier for the canvas session (UUID)
    """
    try:
        # Create new thread for the canvas
        thread_id = assistant_service.create_thread()
        
        # Store in PostgreSQL
        canvas_id = postgres_store.create_canvas(
            user_id=user_id,
            thread_id=thread_id,
            assistant_id=assistant_id,
            name="Untitled Canvas",
            status="created"
        )
        
        return CreateCanvasResponse(
            canvas_id=canvas_id,
            message="Canvas session created successfully"
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create canvas session: {str(e)}"
        )

@router.get("/list/{user_id}", response_model=CanvasListResponse)
async def list_canvases(user_id: str):
    """
    Get list of all canvas sessions

    Args: Gets all canvases for logged in user
        user_id: The user identifier
    
    Returns:
        List of canvas sessions with metadata
    """
    try:
        canvases = postgres_store.get_all_canvases(user_id=user_id)
        canvas_list = [
            CanvasList(
                canvas_id=canvas["canvas_id"],
                created_at=canvas["created_at"],
                thread_id=canvas["thread_id"],
                title=canvas["name"],
                updated_at=canvas["updated_at"],
                problem_statement=canvas["problem_statement"]
            )
            for canvas in canvases # if canvas.get("status") == "drafted"
        ]
        return CanvasListResponse(canvases=canvas_list)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve canvas list: {str(e)}"
        )

@router.get("/{canvas_id}/fields")
async def get_canvas_fields(canvas_id: str) -> Dict[str, Any]:
    """
    Get canvas fields (Business Model Canvas data) for a specific canvas
    
    Args:
        canvas_id: The canvas session UUID
    
    Returns:
        Canvas fields data or empty dict if not yet generated
    """
    try:
        # Verify canvas exists
        if not postgres_store.canvas_exists(canvas_id):
            raise HTTPException(status_code=404, detail="Canvas session not found")
        
        # Get canvas fields
        fields = postgres_store.get_canvas_fields(canvas_id)
        
        if not fields:
            return {
                "canvas_id": canvas_id,
                "message": "Canvas fields not yet generated. Send a message to generate the canvas.",
                "fields": None
            }
        
        return {
            "canvas_id": canvas_id,
            "fields": fields
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve canvas fields: {str(e)}"
        )

@router.get("/{canvas_id}/export-canvas")
async def export_canvas(canvas_id: str, format: str = "docx"):
    """
    Generate a DOCX or PDF document for the given canvas_id.
    Args:
        canvas_id: The canvas session UUID
        format: 'docx' or 'pdf'
    Returns:
        The generated file as a download response
    """
    # Check canvas exists and has fields
    if not postgres_store.canvas_exists(canvas_id):
        raise HTTPException(status_code=404, detail="Canvas session not found")
    fields = postgres_store.get_canvas_fields(canvas_id)
    if not fields:
        raise HTTPException(status_code=404, detail="Canvas fields not yet generated")

    # Generate file
    if format == "pdf":
        file_path = exp_service.generate_pdf(fields)
        media_type = "application/pdf"
        filename = f"canvas_{canvas_id}.pdf"
    else:
        file_path = exp_service.generate_docx(fields)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = f"canvas_{canvas_id}.docx"

    # Read file and return as response
    try:
        with open(file_path, "rb") as f:
            data = f.read()
        headers = {"Content-Disposition": f"attachment; filename={filename}"}
        return Response(content=data, media_type=media_type, headers=headers)
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

@router.post("/{canvas_id}")
async def delete_canvas(canvas_id: str, action: str = "archive"):
    """
    Perform action based on the specified action for a canvas session.
    Actions possible: Delete, Restore, Archive(default)
    
    Args:
        canvas_id: The canvas session UUID
        action: The action to perform (3 options)
    
    Returns:
        Success message
    """
    try:
        # Verify canvas exists
        if not postgres_store.canvas_exists(canvas_id):
            raise HTTPException(status_code=404, detail="Canvas session not found")
        
        # Get canvas to cleanup Azure resources
        canvas = postgres_store.get_canvas(canvas_id)
        
        if action == "archive":
            # Update status to 'archived'
            postgres_store.update_status(canvas_id, action='archived')
            return {
                "message": f"Canvas session {canvas_id} archived successfully"
            }
        
        elif action == "restore":
            # Update status to 'drafted'
            postgres_store.update_status(canvas_id, action='drafted')
            return {
                "message": f"Canvas session {canvas_id} restored successfully"
            }
        
        elif action == "delete":
        
            # Optional: Cleanup Azure resources
            assistant_service.delete_assistant(canvas["assistant_id"])
            assistant_service.delete_thread(canvas["thread_id"])
            
            # Delete from database
            postgres_store.delete_canvas(canvas_id)
            
            return {
                "message": f"Canvas session {canvas_id} deleted successfully"
            }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete canvas session: {str(e)}"
        )