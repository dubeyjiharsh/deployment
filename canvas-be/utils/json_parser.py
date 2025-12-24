import json
import re
from typing import Dict, Any, Tuple

def parse_dual_response(response_text: str) -> Tuple[str, Dict[str, Any]]:
    """
    Parse the assistant's dual response format:
    ---CHAT_RESPONSE---
    [chat text]
    
    ---CANVAS_JSON---
    [json]
    
    Returns:
        Tuple[str, Dict]: (chat_response, canvas_json)
    """
    try:
        # Split by markers
        parts = response_text.split("---CANVAS_JSON---")
        
        if len(parts) != 2:
            raise ValueError("Response does not contain both CHAT_RESPONSE and CANVAS_JSON sections")
        
        # Extract chat response
        chat_part = parts[0]
        if "---CHAT_RESPONSE---" in chat_part:
            chat_response = chat_part.split("---CHAT_RESPONSE---")[1].strip()
        else:
            chat_response = chat_part.strip()
        
        # Extract and parse JSON
        json_part = parts[1].strip()
        canvas_json = parse_json_from_text(json_part)
        
        return chat_response, canvas_json
    
    except Exception as e:
        raise ValueError(f"Failed to parse dual response: {str(e)}")

def parse_json_from_text(text: str) -> Dict[str, Any]:
    """
    Extract and parse JSON from text, handling various formats:
    - Pure JSON
    - JSON with markdown code blocks
    - JSON with preambles
    """
    try:
        # Remove markdown code blocks if present
        text = re.sub(r"```json\s*|\s*```", "", text).strip()
        
        # Try to find JSON object in the text
        # Look for content between outermost curly braces
        match = re.search(r"(\{.*\})", text, re.DOTALL)
        
        if match:
            json_str = match.group(1)
            return json.loads(json_str)
        
        # If no match, try parsing the entire text
        return json.loads(text)
    
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON format: {str(e)}")
    except Exception as e:
        raise ValueError(f"Failed to parse JSON: {str(e)}")

def validate_canvas_structure(canvas_data: Dict[str, Any]) -> Tuple[bool, list]:
    """
    Basic validation of canvas JSON structure
    
    Returns:
        Tuple[bool, list]: (is_valid, list_of_errors)
    """
    errors = []
    
    required_fields = [
        "Title", "Problem Statement", "Objectives", "KPIs", 
        "Success Criteria", "Key Features", "Risks", "Assumptions", 
        "Non Functional Requirements", "Use Cases", "Governance"
    ]
    
    # Check for required fields
    for field in required_fields:
        if field not in canvas_data:
            errors.append(f"Missing required field: '{field}'")
    
    # Type validation
    if "Title" in canvas_data and not isinstance(canvas_data["Title"], str):
        errors.append("'Title' must be a string")
    
    if "Problem Statement" in canvas_data and not isinstance(canvas_data["Problem Statement"], str):
        errors.append("'Problem Statement' must be a string")
    
    array_fields = ["Objectives", "KPIs", "Success Criteria", "Key Features", 
                    "Risks", "Assumptions", "Non Functional Requirements", "Use Cases"]
    
    for field in array_fields:
        if field in canvas_data and not isinstance(canvas_data[field], list):
            errors.append(f"'{field}' must be an array")
    
    if "Governance" in canvas_data and not isinstance(canvas_data["Governance"], dict):
        errors.append("'Governance' must be an object")
    
    return len(errors) == 0, errors