from pydantic import BaseModel, Field, AliasChoices, ConfigDict, RootModel
from typing import List, Optional, Dict, Any, Union
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
    model_config = ConfigDict(validate_by_name=True)
    performance: List[str]= Field(..., validation_alias=AliasChoices("Performance & Scalability", "performance"))
    data_quality: List[str]= Field(..., validation_alias=AliasChoices("Data Quality & Integration", "data_quality"))
    reliability: List[str]= Field(..., validation_alias=AliasChoices("Reliability", "reliability"))
    security: List[str]= Field(..., validation_alias=AliasChoices("Security/Compliance/Privacy", "security"))    
 
class UseCaseItem(BaseModel):
    use_case: str
    actor: str
    goal: str
    scenario: str
 
class CanvasFieldList(BaseModel):
    model_config = ConfigDict(validate_by_name=True)
    Title: str = Field(..., validation_alias=AliasChoices("Title", "title"))
    Problem_Statement: str = Field(..., validation_alias=AliasChoices("Problem Statement", "problem_statement"))
    Objectives: List[str] = Field(..., validation_alias=AliasChoices("Objectives", "objectives"))
    KPIs: List[KPIItem] = Field(..., validation_alias=AliasChoices("KPIs", "kpis"))
    Success_Criteria: List[str] = Field(..., validation_alias=AliasChoices("Success Criteria", "success_criteria"))
    Key_Features: List[KeyFeatureItem] = Field(..., validation_alias=AliasChoices("Key Features", "key_features"))
    Risks: List[RiskItem] = Field(..., validation_alias=AliasChoices("Risks", "risks"))
    Assumptions: List[str] = Field(..., validation_alias=AliasChoices("Assumptions", "assumptions"))
    Non_Functional_Requirements: NonFunctionalRequirementItem = Field(..., validation_alias=AliasChoices("Non Functional Requirements", "non_functional_requirements"))
    Use_Cases: List[UseCaseItem] = Field(..., validation_alias=AliasChoices("Use Cases", "use_cases"))
    Governance: Optional[Dict[str, Any]] = Field(None, validation_alias=AliasChoices("Governance", "governance"))
    Relevant_Facts: Optional[List[str]] = Field(None, validation_alias=AliasChoices("Relevant Facts", "relevant_facts"))  
 
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