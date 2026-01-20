from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, RootModel
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
    canvas_json: Optional[Dict[str, Any]] = None
 
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
    metric : str
    baseline: str
    target: str
    measurement_frequency: str
 
class KeyFeatureItem(BaseModel):
    feature: str
    description: str
    priority: str  # Should be one of ["P1", "P2", "P3"]
 
class RiskItem(BaseModel):
    risk: str
    mitigation: str
 
class NonFunctionalRequirementItem(BaseModel):
    performance: List[str]= Field(..., alias="Performance & Scalability")
    data_quality: List[str]= Field(..., alias="Data Quality & Integration")
    reliability: List[str]= Field(..., alias="Reliability")
    security: List[str]= Field(..., alias="Security/Compliance/Privacy")    
 
class UseCaseItem(BaseModel):
    use_case: str
    actor: str
    goal: str
    scenario: str
 
class CanvasFieldList(BaseModel):
    Title: str = Field(..., alias="Title")
    Problem_Statement: str = Field(..., alias="Problem Statement")
    Objectives: List[str] = Field(..., alias="Objectives")
    KPIs: List[KPIItem] = Field(..., alias="KPIs")
    Success_Criteria: List[str] = Field(..., alias="Success Criteria")
    Key_Features: List[KeyFeatureItem] = Field(..., alias="Key Features")
    Risks: List[RiskItem] = Field(..., alias="Risks")
    Assumptions: List[str] = Field(..., alias="Assumptions")
    Non_Functional_Requirements: NonFunctionalRequirementItem = Field(..., alias="Non Functional Requirements")
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

# Openbao Config Models
class OpenBAOAzureLLMConfig(BaseModel):
    """Model for Azure OpenAI configuration stored in OpenBAO"""
    azure_openai_endpoint: str
    azure_openai_api_key: str
    azure_openai_deployment_name: str
    azure_openai_api_version: str

class OpenBAOGeminiLLMConfig(BaseModel):
    """Model for Gemini configuration stored in OpenBAO"""
    gemini_endpoint: str
    gemini_api_key: str
    gemini_model_name: str

class OpenBAOAIForceLLMConfig(RootModel):
    """Model for AI Force configuration stored in OpenBAO"""
    root: Union[OpenBAOAzureLLMConfig, OpenBAOGeminiLLMConfig]

class OpenBAOAIForceBearerTokenConfig(BaseModel):
    """Model for AI Force bearer token configuration stored in OpenBAO"""
    bearer_token: str