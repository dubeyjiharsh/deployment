
from docx import Document
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas as pdf_canvas
import tempfile
import os

class DocumentService:
    """Service for generating DOCX and PDF documents from canvas data"""

    @staticmethod
    def generate_docx(canvas_data: dict) -> str:
        """
        Generate a DOCX file from canvas data and return the file path
        """
        doc = Document()
        doc.add_heading(canvas_data.get("Title", "Business Model Canvas"), 0)
        
        # Exclude technical/ID fields
        exclude_fields = {"canvas_id", "id", "created_at", "updated_at", "tags", "relevant_facts", "governance"}
        for key, value in canvas_data.items():
            if key == "Title" or key in exclude_fields:
                continue
            heading = key.replace("_", " ").title()
            doc.add_heading(heading, level=1)
            if isinstance(value, list) and value and all(isinstance(item, dict) for item in value):
                # Render as table
                columns = list(value[0].keys())
                table = doc.add_table(rows=1, cols=len(columns))
                table.style = 'Table Grid'
                hdr_cells = table.rows[0].cells
                for i, col in enumerate(columns):
                    hdr_cells[i].text = col.replace('_', ' ').title()
                for entry in value:
                    row_cells = table.add_row().cells
                    for i, col in enumerate(columns):
                        row_cells[i].text = str(entry.get(col, ""))
            elif isinstance(value, list):
                for item in value:
                    doc.add_paragraph(str(item), style='List Bullet')
            elif isinstance(value, dict):
                for k, v in value.items():
                    doc.add_paragraph(f"{k}: {v}", style='List Bullet')
            elif value:
                doc.add_paragraph(str(value))
        
        temp_dir = tempfile.gettempdir()
        file_path = os.path.join(temp_dir, f"canvas_{canvas_data.get('Title', 'document')}.docx")
        doc.save(file_path)
        return file_path

    @staticmethod
    def generate_pdf(canvas_data: dict) -> str:
        """
        Generate a PDF file from canvas data and return the file path
        """
        temp_dir = tempfile.gettempdir()
        file_path = os.path.join(temp_dir, f"canvas_{canvas_data.get('Title', 'document')}.pdf")
        c = pdf_canvas.Canvas(file_path, pagesize=letter)
        width, height = letter
        y = height - 40
        c.setFont("Helvetica-Bold", 16)
        c.drawString(40, y, canvas_data.get("Title", "Business Model Canvas"))
        y -= 30
        exclude_fields = {"canvas_id", "id", "created_at", "updated_at", "tags", "relevant_facts", "governance"}
        for key, value in canvas_data.items():
            if key == "Title" or key in exclude_fields:
                continue
            heading = key.replace("_", " ").title()
            c.setFont("Helvetica-Bold", 12)
            c.drawString(40, y, heading)
            y -= 20
            c.setFont("Helvetica", 11)
            if isinstance(value, list) and value and all(isinstance(item, dict) for item in value):
                # Render as table
                columns = list(value[0].keys())
                col_width = (width - 80) / max(len(columns), 1)
                # Header
                c.setFont("Helvetica-Bold", 11)
                for i, col in enumerate(columns):
                    c.drawString(60 + i * col_width, y, col.replace('_', ' ').title())
                y -= 15
                c.setFont("Helvetica", 11)
                for item in value:
                    for i, col in enumerate(columns):
                        c.drawString(60 + i * col_width, y, str(item.get(col, "")))
                    y -= 15
                    if y < 50:
                        c.showPage()
                        y = height - 40
            elif isinstance(value, list):
                for item in value:
                    c.drawString(60, y, f"• {item}")
                    y -= 15
                    if y < 50:
                        c.showPage()
                        y = height - 40
            elif isinstance(value, dict):
                for k, v in value.items():
                    c.drawString(60, y, f"• {k}: {v}")
                    y -= 15
                    if y < 50:
                        c.showPage()
                        y = height - 40
            elif value:
                c.drawString(60, y, f"• {value}")
                y -= 15
                if y < 50:
                    c.showPage()
                    y = height - 40
        c.save()
        return file_path
