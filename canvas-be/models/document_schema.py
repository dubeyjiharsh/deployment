# Document rendering schema for canvas fields
# Maps each field to a rendering type: 'table', 'bullets', or 'paragraph'

document_schema = {
    "Title": "heading",
    "Problem Statement": "paragraph",
    "Objectives": "bullets",
    "KPIs": "table",
    "Success Criteria": "bullets",
    "Key Features": "table",
    "Risks": "table",
    "Assumptions": "bullets",
    "Non Functional Requirements": "table",
    "Use Cases": "table"
}

def get_document_schema():
    return document_schema
