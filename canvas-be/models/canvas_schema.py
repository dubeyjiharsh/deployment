import json

BMC_SCHEMA = {
    "type": "object",
    "properties": {
        "Title": {
            "type": "string",
            "description": "A concise, descriptive title for the business model or project"
        },
        "Problem Statement": {
            "type": "string",
            "description": "Clear articulation of the problem being addressed"
        },
        "Objectives": {
            "type": "array",
            "items": {"type": "string"},
            "description": "List of SMART objectives"
        },
        "KPIs": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "metric": {"type": "string"},
                    "target": {"type": "string"},
                    "measurement_frequency": {"type": "string"}
                },
                "required": ["metric", "target", "measurement_frequency"]
            },
            "description": "Key Performance Indicators"
        },
        "Success Criteria": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Specific criteria that define project success"
        },
        "Key Features": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "feature": {"type": "string"},
                    "description": {"type": "string"},
                    "priority": {"type": "string", "enum": ["High", "Medium", "Low"]}
                },
                "required": ["feature", "description", "priority"]
            },
            "description": "Core features with priority levels"
        },
        "Risks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "risk": {"type": "string"},
                    "impact": {"type": "string", "enum": ["High", "Medium", "Low"]},
                    "probability": {"type": "string", "enum": ["High", "Medium", "Low"]},
                    "mitigation": {"type": "string"}
                },
                "required": ["risk", "impact", "probability", "mitigation"]
            },
            "description": "Identified risks with mitigation strategies"
        },
        "Assumptions": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Key assumptions underlying the business model"
        },
        "Non Functional Requirements": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "category": {"type": "string"},
                    "requirement": {"type": "string"}
                },
                "required": ["category", "requirement"]
            },
            "description": "Non-functional requirements"
        },
        "Use Cases": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "use_case": {"type": "string"},
                    "actor": {"type": "string"},
                    "description": {"type": "string"}
                },
                "required": ["use_case", "actor", "description"]
            },
            "description": "Primary use cases"
        }
    },
    "required": [
        "Title", "Problem Statement", "Objectives", "KPIs", 
        "Success Criteria", "Key Features", "Risks", "Assumptions", 
        "Non Functional Requirements", "Use Cases"
    ]
}

def get_schema_json_string() -> str:
    """Returns the schema as a formatted JSON string for prompts"""
    return json.dumps(BMC_SCHEMA, indent=2)