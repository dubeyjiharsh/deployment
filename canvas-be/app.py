import os
import time
import json
import re
import warnings
import uvicorn
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import AzureOpenAI
from jsonschema import validate, ValidationError
 
# Ignore DeprecationWarnings
warnings.filterwarnings("ignore", category=DeprecationWarning)
 
load_dotenv()
 
app = FastAPI(title="Business Model Canvas Chatbot")
 
# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
 
# Initialize Azure OpenAI
client = AzureOpenAI(
    api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_key=os.getenv("AZURE_OPENAI_API_KEY")
)
 
# --- JSON Schema ---
BMC_SCHEMA = {
    "type": "object",
    "properties": {
        "Title": {"type": "string"},
        "Problem Statement": {"type": "string"},
        "Objectives": {"type": "array", "items": {"type": "string"}},
        "KPIs": {"type": "array", "items": {"type": "object", "properties": {"metric": {"type": "string"}, "target": {"type": "string"}, "measurement_frequency": {"type": "string"}}}},
        "Success Criteria": {"type": "array", "items": {"type": "string"}},
        "Key Features": {"type": "array", "items": {"type": "object", "properties": {"feature": {"type": "string"}, "description": {"type": "string"}, "priority": {"type": "string", "enum": ["High", "Medium", "Low"]}}}},
        "Risks": {"type": "array", "items": {"type": "object", "properties": {"risk": {"type": "string"}, "impact": {"type": "string"}, "probability": {"type": "string"}, "mitigation": {"type": "string"}}}},
        "Assumptions": {"type": "array", "items": {"type": "string"}},
        "Non Functional Requirements": {"type": "array", "items": {"type": "object", "properties": {"category": {"type": "string"}, "requirement": {"type": "string"}}}},
        "Use Cases": {"type": "array", "items": {"type": "object", "properties": {"use_case": {"type": "string"}, "actor": {"type": "string"}, "description": {"type": "string"}}}},
        "Governance": {"type": "object", "properties": {"stakeholders": {"type": "array", "items": {"type": "string"}}, "decision_making_process": {"type": "string"}, "compliance_requirements": {"type": "array", "items": {"type": "string"}}, "reporting_structure": {"type": "string"}}}
    },
    "required": ["Title", "Problem Statement", "Objectives", "KPIs", "Success Criteria", "Key Features", "Risks", "Assumptions", "Non Functional Requirements", "Use Cases", "Governance"]
}
 
# --- Detailed System Prompt (Strictly preserved) ---
SYSTEM_PROMPT = f"""You are an expert business analyst and strategic consultant specializing in Business Model Canvas creation. Your task is to analyze uploaded documents and generate a comprehensive, structured business model canvas in JSON format.
 
**Your Analysis Approach:**
1. Carefully read and analyze all uploaded documents to extract relevant business information
2. Identify the core problem, objectives, and strategic elements
3. Structure your findings according to the specified JSON schema
4. Ensure all fields are populated with meaningful, actionable insights
5. Be specific, quantifiable, and realistic in your recommendations
 
**Field Guidelines:**
 
- **Title**: Create a concise, descriptive title (max 100 characters) that captures the essence of the business model or project
 
- **Problem Statement**: Articulate the core problem in 2-4 sentences. Include:
• Current pain points or challenges
• Impact on stakeholders
• Market gap or opportunity
• Why this problem needs solving now
 
- **Objectives**: List 3-7 SMART objectives (Specific, Measurable, Achievable, Relevant, Time-bound). Each objective should clearly state what will be accomplished.
 
- **KPIs**: Define 5-10 measurable KPIs. For each KPI include:
• metric: The specific metric name
• target: Quantifiable target value
• measurement_frequency: How often it's measured (e.g., "Daily", "Weekly", "Monthly", "Quarterly")
 
- **Success Criteria**: List 3-6 concrete criteria that define project success. These should be verifiable outcomes or achievements.
 
- **Key Features**: Identify 5-12 core features. For each feature:
• feature: Feature name
• description: 1-2 sentence description of functionality and value
• priority: "High", "Medium", or "Low"
 
- **Risks**: Identify 5-10 potential risks. For each risk:
• risk: Description of the risk
• impact: "High", "Medium", or "Low"
• probability: "High", "Medium", or "Low"
• mitigation: Specific mitigation strategy
 
- **Assumptions**: List 5-8 key assumptions underlying the business model. These are conditions assumed to be true for the model to work.
 
- **Non Functional Requirements**: Define 6-10 NFRs across categories like:
• Performance (response times, throughput)
• Security (authentication, encryption, compliance)
• Scalability (user growth, data volume)
• Availability (uptime requirements)
• Usability (accessibility, user experience)
• Maintainability (documentation, modularity)
 
- **Use Cases**: Document 5-10 primary use cases. For each:
• use_case: Name of the use case
• actor: Who performs this action (role/user type)
• description: 2-3 sentence description of the scenario
 
- **Governance**: Define the governance framework:
• stakeholders: List 5-10 key stakeholders (roles, not names)
• decision_making_process: Describe how decisions are made
• compliance_requirements: List relevant regulations, standards, or policies
• reporting_structure: Describe reporting hierarchy and frequency
 
**Output Requirements:**
- Respond ONLY with valid JSON matching the provided schema
- Do NOT include any markdown formatting, code blocks, or explanatory text
- Do NOT include preambles like "Here is the JSON" or "```json"
- Ensure all required fields are present
- Use proper JSON syntax with double quotes
- Base all content on information from uploaded files when available
- If information is missing from files, use industry best practices and reasonable inferences
 
**JSON Schema:**
{json.dumps(BMC_SCHEMA, indent=2)}
"""
 
# Initialize Assistant
assistant = client.beta.assistants.create(
    name="Business Canvas Assistant",
    model="gpt-4o-mini",
    instructions=SYSTEM_PROMPT,
    tools=[{"type": "file_search"}],
)
 
# --- Memory Store ---
# Maps canvas_id -> {thread_id, file_ids}
canvas_to_session = {}
 
# --- Pydantic Models ---
class QueryRequest(BaseModel):
    user_message: str
 
# --- Helper Functions ---
 
def parse_json_from_response(text: str) -> Dict[str, Any]:
    try:
        clean_text = re.sub(r"```json\s*|\s*```", "", text).strip()
        match = re.search(r"(\{.*\})", clean_text, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        return json.loads(clean_text)
    except Exception as e:
        raise ValueError(f"Failed to parse Assistant JSON: {str(e)}")
 
def wait_for_run(thread_id, run_id):
    while True:
        run = client.beta.threads.runs.retrieve(thread_id=thread_id, run_id=run_id)
        if run.status == "completed":
            return run
        if run.status in ["failed", "cancelled", "expired"]:
            raise HTTPException(status_code=500, detail=f"Assistant run {run.status}")
        time.sleep(1)
 
# --- Consolidated Endpoints ---
 
@app.post("/generate_bmc_instant/")
async def generate_bmc_instant(
    problem_statement: str = Form(...),
    files: Optional[List[UploadFile]] = File(None)
):
    """
    Step 1: Accept problem and files. Generate ID. Store context. Return BMC.
    """
    canvas_id = f"canvas_{int(time.time())}"
    file_ids = []
    
    # 1. Process Uploads
    if files:
        for file in files:
            temp_path = f"temp_{file.filename}"
            try:
                with open(temp_path, "wb") as f:
                    f.write(await file.read())
                with open(temp_path, "rb") as f:
                    uploaded = client.files.create(file=f, purpose="assistants")
                    file_ids.append(uploaded.id)
            finally:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
 
    # 2. Setup Memory
    thread = client.beta.threads.create()
    canvas_to_session[canvas_id] = {
        "thread_id": thread.id,
        "file_ids": file_ids
    }
 
    # 3. Trigger Generation
    user_msg = f"USER PROBLEM STATEMENT: {problem_statement}\n\nPlease generate the Business Model Canvas JSON."
    attachments = [{"file_id": fid, "tools": [{"type": "file_search"}]} for fid in file_ids]
 
    client.beta.threads.messages.create(
        thread_id=thread.id,
        role="user",
        content=user_msg,
        attachments=attachments
    )
 
    run = client.beta.threads.runs.create(thread_id=thread.id, assistant_id=assistant.id)
    wait_for_run(thread.id, run.id)
 
    # 4. Extract BMC
    messages = client.beta.threads.messages.list(thread_id=thread.id)
    raw_content = messages.data[0].content[0].text.value
    bmc_data = parse_json_from_response(raw_content)
 
    return {
        "metadata": {
            "canvas_id": canvas_id,
            "file_ids": file_ids
        },
        "bmc_result": bmc_data
    }
 
@app.post("/ask_assistant/{canvas_id}")
async def ask_assistant(canvas_id: str, request: QueryRequest):
    """
    Step 2: Ask follow-ups. IDs are pulled from memory automatically.
    """
    session = canvas_to_session.get(canvas_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
 
    thread_id = session["thread_id"]
    file_ids = session["file_ids"]
 
    # AI context remains grounded by original files
    attachments = [{"file_id": fid, "tools": [{"type": "file_search"}]} for fid in file_ids]
 
    client.beta.threads.messages.create(
        thread_id=thread_id,
        role="user",
        content=request.user_message,
        attachments=attachments
    )
 
    run = client.beta.threads.runs.create(thread_id=thread_id, assistant_id=assistant.id)
    wait_for_run(thread_id, run.id)
 
    messages = client.beta.threads.messages.list(thread_id=thread_id)
    return {"response": messages.data[0].content[0].text.value}
 
@app.get("/conversation_history/{canvas_id}")
async def get_history(canvas_id: str):
    session = canvas_to_session.get(canvas_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    
    messages = client.beta.threads.messages.list(thread_id=session["thread_id"])
    history = [
        {"role": m.role, "content": m.content[0].text.value if m.content else ""}
        for m in reversed(messages.data)
    ]
    return {"history": history}
 
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8010)