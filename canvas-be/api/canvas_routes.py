from fastapi import APIRouter, HTTPException
from models.schemas import (
    CreateCanvasResponse,
    CanvasListResponse,
    CanvasList
)
from services.assistant_service import AssistantService
from db.postgres_store import postgres_store
from typing import Dict, Any

router = APIRouter(prefix="/api/canvas", tags=["Canvas Management"])

# Initialize services
assistant_service = AssistantService()
assistant_id = assistant_service.create_assistant()

@router.post("/create", response_model=CreateCanvasResponse)
async def create_canvas():
    """
    Create a new canvas session
    
    Returns:
        canvas_id: Unique identifier for the canvas session (UUID)
    """
    try:
        # Create new thread for the canvas
        thread_id = assistant_service.create_thread()
        
        # Store in PostgreSQL
        canvas_id = postgres_store.create_canvas(
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

@router.get("/list", response_model=CanvasListResponse)
async def list_canvases():
    """
    Get list of all canvas sessions
    
    Returns:
        List of canvas sessions with metadata
    """
    try:
        canvases = postgres_store.get_all_canvases()
        canvas_list = [
            CanvasList(
                canvas_id=canvas["canvas_id"],
                created_at=canvas["created_at"],
                thread_id=canvas["thread_id"],
                title=canvas["name"],
                updated_at=canvas["updated_at"],
                problem_statement=canvas["problem_statement"]
            )
            for canvas in canvases if canvas.get("status") == "drafted"
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

# @router.delete("/{canvas_id}")
# async def delete_canvas(canvas_id: str):
#     """
#     Delete a canvas session and cleanup resources
    
#     Args:
#         canvas_id: The canvas session UUID
    
#     Returns:
#         Success message
#     """
#     try:
#         # Verify canvas exists
#         if not postgres_store.canvas_exists(canvas_id):
#             raise HTTPException(status_code=404, detail="Canvas session not found")
        
#         # Get canvas to cleanup Azure resources
#         canvas = postgres_store.get_canvas(canvas_id)
        
#         # Optional: Cleanup Azure resources
#         # assistant_service.delete_assistant(canvas["assistant_id"])
#         # assistant_service.delete_thread(canvas["thread_id"])
        
#         # Delete from database
#         postgres_store.delete_canvas(canvas_id)
        
#         return {
#             "message": f"Canvas session {canvas_id} deleted successfully"
#         }
    
#     except HTTPException:
#         raise
#     except Exception as e:
#         raise HTTPException(
#             status_code=500,
#             detail=f"Failed to delete canvas session: {str(e)}"
#         )