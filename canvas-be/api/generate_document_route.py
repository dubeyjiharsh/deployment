from fastapi import APIRouter, HTTPException, Response
from db.postgres_store import postgres_store
from services.document_service import DocumentService
import os


router = APIRouter(prefix="/api/canvas", tags=[" Interface"])

doc_service = DocumentService()

@router.get("/{canvas_id}/generate-document")
async def generate_document(canvas_id: str, format: str = "docx"):
    """
    Generate a DOCX or PDF document for the given canvas_id.
    Args:
        canvas_id: The canvas session UUID
        format: 'docx' or 'pdf'
    Returns:
        The generated file as a download response
    """
    # Check canvas exists and has fields
    if not postgres_store.canvas_exists(canvas_id):
        raise HTTPException(status_code=404, detail="Canvas session not found")
    fields = postgres_store.get_canvas_fields(canvas_id)
    if not fields:
        raise HTTPException(status_code=404, detail="Canvas fields not yet generated")

    # Generate file
    if format == "pdf":
        file_path = doc_service.generate_pdf(fields)
        media_type = "application/pdf"
        filename = f"canvas_{canvas_id}.pdf"
    else:
        file_path = doc_service.generate_docx(fields)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = f"canvas_{canvas_id}.docx"

    # Read file and return as response
    try:
        with open(file_path, "rb") as f:
            data = f.read()
        headers = {"Content-Disposition": f"attachment; filename={filename}"}
        return Response(content=data, media_type=media_type, headers=headers)
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)
