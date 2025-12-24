from fastapi import APIRouter, HTTPException
from models.schemas import (
    CreateCanvasResponse,
    CanvasListResponse,
    CanvasList
)
from services.assistant_service import AssistantService
from storage.memory_store import memory_store

router = APIRouter(prefix="/api/canvas", tags=["Canvas Management"])

# Initialize services
assistant_service = AssistantService()

@router.post("/create", response_model=CreateCanvasResponse)
async def create_canvas():
    """
    Create a new canvas session
    
    Returns:
        canvas_id: Unique identifier for the canvas session
    """
    try:
        # Create new assistant and thread
        assistant_id = assistant_service.create_assistant()
        thread_id = assistant_service.create_thread()
        
        # Store in memory
        canvas_id = memory_store.create_session(thread_id, assistant_id)
        
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
        sessions = memory_store.get_all_sessions()
        
        canvas_list = [
            CanvasList(
                canvas_id=session.canvas_id,
                created_at=session.created_at,
                thread_id=session.thread_id
            )
            for session in sessions
        ]
        
        return CanvasListResponse(canvases=canvas_list)
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve canvas list: {str(e)}"
        )
