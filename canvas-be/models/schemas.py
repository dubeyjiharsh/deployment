from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

# Request Models
class CreateCanvasRequest(BaseModel):
    """Request model for creating a new canvas"""
    pass

class SendMessageRequest(BaseModel):
    """Request model for sending a message"""
    message: str = Field(..., min_length=1, description="User message or problem statement")

# Response Models
class CanvasMetadata(BaseModel):
    """Canvas session metadata"""
    canvas_id: str
    thread_id: str
    assistant_id: str
    file_ids: List[str]
    created_at: datetime

class CreateCanvasResponse(BaseModel):
    """Response for canvas creation"""
    canvas_id: str
    message: str

class ConversationMessage(BaseModel):
    """Single message in conversation history"""
    role: str  # "user" or "assistant"
    content: str  # Clean message content without JSON blocks

class MessageResponse(BaseModel):
    """Response for sending a message"""
    canvas_id: str
    chat_response: str
    canvas_json: Dict[str, Any]
    conversation_history: List[ConversationMessage]

class ConversationHistoryResponse(BaseModel):
    """Response for conversation history"""
    canvas_id: str
    history: List[ConversationMessage]

class CanvasList(BaseModel):
    """List of canvas sessions"""
    canvas_id: str
    created_at: datetime
    thread_id: str

class CanvasListResponse(BaseModel):
    """Response for listing canvases"""
    canvases: List[CanvasList]

class ErrorResponse(BaseModel):
    """Error response model"""
    error: str
    detail: Optional[str] = None