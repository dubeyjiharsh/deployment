from docx import Document
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
import tempfile
import os
import json


class DocumentService:
    """Service for generating DOCX and PDF documents from canvas data"""

    @staticmethod
    def _get_clean_data():
        return {
            "exclude": {
                "canvas_id", "id", "created_at", "updated_at",
                "tags", "relevant_facts", "governance"
            },
            "tables": {
                "KPIs",
                "Key Features",
                "Risks",
                "Non Functional Requirements",
                "Use Cases"
            }
        }

    # Helper: normalize LLM table data (JSON string → dict)
    @staticmethod
    def _normalize_table_data(value):
        normalized = []
        for item in value:
            if isinstance(item, dict):
                normalized.append(item)
            elif isinstance(item, str):
                try:
                    normalized.append(json.loads(item))
                except json.JSONDecodeError:
                    continue
        return normalized

    # DOCX GENERATION
    @staticmethod
    def generate_docx(canvas_data: dict) -> str:
        doc = Document()
        config = DocumentService._get_clean_data()
        table_keys = {k.lower() for k in config["tables"]}

        # Title
        doc.add_heading(canvas_data.get("Title", "Business Model Canvas"), 0)

        for key, value in canvas_data.items():
            if key == "Title" or key in config["exclude"] or not value:
                continue

            heading = key.replace("_", " ").title()
            doc.add_heading(heading, level=1)

            #TABLE FIELDS 
            if key.lower() in table_keys and isinstance(value, list):
                value = DocumentService._normalize_table_data(value)
                if not value:
                    continue

                columns = list(value[0].keys())
                table = doc.add_table(rows=1, cols=len(columns))
                table.style = "Table Grid"

                # Header row
                for i, col in enumerate(columns):
                    table.rows[0].cells[i].text = col.replace("_", " ").title()

                # Data rows
                for entry in value:
                    row_cells = table.add_row().cells
                    for i, col in enumerate(columns):
                        row_cells[i].text = str(entry.get(col, ""))

            #LIST FIELDS 
            elif isinstance(value, list):
                for item in value:
                    doc.add_paragraph(str(item), style="List Bullet")

            #DICT FIELDS 
            elif isinstance(value, dict):
                for k, v in value.items():
                    p = doc.add_paragraph(style="List Bullet")
                    p.add_run(f"{k.replace('_', ' ').title()}: ").bold = True
                    p.add_run(str(v))

            #TEXT 
            else:
                doc.add_paragraph(str(value))

        temp_file = os.path.join(
            tempfile.gettempdir(), f"canvas_{os.urandom(4).hex()}.docx"
        )
        doc.save(temp_file)
        return temp_file

    # PDF GENERATION
    @staticmethod
    def generate_pdf(canvas_data: dict) -> str:
        config = DocumentService._get_clean_data()
        table_keys = {k.lower() for k in config["tables"]}

        temp_file = os.path.join(
            tempfile.gettempdir(), f"canvas_{os.urandom(4).hex()}.pdf"
        )

        doc = SimpleDocTemplate(temp_file, pagesize=letter)
        styles = getSampleStyleSheet()
        elements = []

        # Title
        elements.append(Paragraph(
            canvas_data.get("Title", "Business Model Canvas"),
            styles["Title"]
        ))
        elements.append(Spacer(1, 12))

        for key, value in canvas_data.items():
            if key == "Title" or key in config["exclude"] or not value:
                continue

            elements.append(Paragraph(
                key.replace("_", " ").title(),
                styles["Heading1"]
            ))
            elements.append(Spacer(1, 6))

            #TABLE FIELDS
            if key.lower() in table_keys and isinstance(value, list):
                value = DocumentService._normalize_table_data(value)
                if not value:
                    continue

                headers = [h.replace("_", " ").title() for h in value[0].keys()]
                data = [headers]

                for entry in value:
                    row = [
                        Paragraph(str(entry.get(k, "")), styles["BodyText"])
                        for k in value[0].keys()
                    ]
                    data.append(row)

                table = Table(
                    data,
                    colWidths=[doc.width / len(headers)] * len(headers)
                )

                table.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("GRID", (0, 0), (-1, -1), 1, colors.black),
                    ("BACKGROUND", (0, 1), (-1, -1), colors.beige),
                ]))

                elements.append(table)
                elements.append(Spacer(1, 12))

            # LIST FIELDS 
            elif isinstance(value, list):
                for item in value:
                    elements.append(Paragraph(f"• {item}", styles["BodyText"]))
                elements.append(Spacer(1, 12))

            #DICT FIELDS
            elif isinstance(value, dict):
                for k, v in value.items():
                    elements.append(
                        Paragraph(f"<b>{k}:</b> {v}", styles["BodyText"])
                    )
                elements.append(Spacer(1, 12))

            #TEXT
            else:
                elements.append(Paragraph(str(value), styles["BodyText"]))
                elements.append(Spacer(1, 12))

        doc.build(elements)
        return temp_file
