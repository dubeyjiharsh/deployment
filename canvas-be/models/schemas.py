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
    title: str
    updated_at: datetime
    problem_statement: str
 
class KPIItem(BaseModel):
    metric: str
    target: str
    measurement_frequency: str
 
class KeyFeatureItem(BaseModel):
    feature: str
    description: str
    priority: str  # Should be one of ["High", "Medium", "Low"]
 
class RiskItem(BaseModel):
    risk: str
    impact: str  # Should be one of ["High", "Medium", "Low"]
    probability: str  # Should be one of ["High", "Medium", "Low"]
    mitigation: str
 
class NonFunctionalRequirementItem(BaseModel):
    category: str
    requirement: str
 
class UseCaseItem(BaseModel):
    use_case: str
    actor: str
    description: str
 
class CanvasFieldList(BaseModel):
    Title: str = Field(..., alias="Title")
    Problem_Statement: str = Field(..., alias="Problem Statement")
    Objectives: List[str] = Field(..., alias="Objectives")
    KPIs: List[KPIItem] = Field(..., alias="KPIs")
    Success_Criteria: List[str] = Field(..., alias="Success Criteria")
    Key_Features: List[KeyFeatureItem] = Field(..., alias="Key Features")
    Risks: List[RiskItem] = Field(..., alias="Risks")
    Assumptions: List[str] = Field(..., alias="Assumptions")
    Non_Functional_Requirements: List[NonFunctionalRequirementItem] = Field(..., alias="Non Functional Requirements")
    Use_Cases: List[UseCaseItem] = Field(..., alias="Use Cases")
    Governance: Optional[Dict[str, Any]] = Field(None, alias="Governance")
    Relevant_Facts: List[str] = Field(..., alias="Relevant Facts")  
 
class CanvasListResponse(BaseModel):
    """Response for listing canvases"""
    canvases: List[CanvasList]
 
class ErrorResponse(BaseModel):
    """Error response model"""
    error: str
    detail: Optional[str] = None