#!/usr/bin/env python3
"""
PDF Form Filler Script
A standalone Python script for filling PDF forms with JSON data.
"""

import io
import json
import requests
from pypdf import PdfReader, PdfWriter
from pypdf.generic import BooleanObject, NameObject, IndirectObject
import tempfile
import os
from datetime import datetime
from pathlib import Path


class PDFFormFiller:
    """Class to handle PDF form filling operations."""
    
    def __init__(self):
        self.temp_dir = tempfile.gettempdir()
    
    def fill_pdf_form(self, user_name, session_id, pdf_source, form_data_json, output_path=None):
        """
        Fill a PDF form with data from JSON and save to file.
        
        Args:
            user_name (str): Name of the user
            session_id (str): Session identifier
            pdf_source (str): Path to local PDF file or URL to PDF
            form_data_json (dict or str): JSON data with field names as keys and values to fill
            output_path (str, optional): Path where to save the filled PDF
        
        Returns:
            str: Path to the filled PDF file
        """
        try:
            # Parse JSON data if it's a string
            if isinstance(form_data_json, str):
                form_data = json.loads(form_data_json)
            else:
                form_data = form_data_json
            
            # Get PDF content
            if pdf_source.startswith(('http://', 'https://')):
                # Download PDF from URL
                response = requests.get(pdf_source)
                response.raise_for_status()
                pdf_buffer = io.BytesIO(response.content)
            else:
                # Read local PDF file
                with open(pdf_source, 'rb') as f:
                    pdf_buffer = io.BytesIO(f.read())
            
            # Create PDF reader and writer
            reader = PdfReader(pdf_buffer)
            writer = PdfWriter()
            
            # Check if PDF has form fields
            if "/AcroForm" not in reader.trailer["/Root"]:
                raise ValueError("PDF does not contain form fields")
            
            # Copy all pages to writer
            for page in reader.pages:
                writer.add_page(page)
            
            # Fill form fields with better compatibility
            if writer.get_form() is not None:
                # Try to get all form field names
                try:
                    # Method 1: Try using writer's form fields
                    writer_fields = writer.get_form()
                    if hasattr(writer_fields, 'get_fields'):
                        available_fields = writer_fields.get_fields()
                    else:
                        available_fields = {}
                    
                    for field_name, field_value in form_data.items():
                        try:
                            # Convert value to string
                            value_str = str(field_value) if field_value is not None else ""
                            
                            # Try different update methods
                            if hasattr(writer, 'update_page_form_field_values'):
                                writer.update_page_form_field_values(
                                    writer.pages[0],
                                    {field_name: value_str}
                                )
                            elif available_fields and field_name in available_fields:
                                # Direct field update
                                available_fields[field_name].update({"/V": value_str})
                            else:
                                print(f"Field '{field_name}' not found in PDF")
                                
                        except Exception as field_error:
                            print(f"Warning: Could not fill field '{field_name}': {field_error}")
                            
                except Exception as form_error:
                    print(f"Warning: Error accessing form fields: {form_error}")
                    # Fallback: try the original method
                    for field_name, field_value in form_data.items():
                        try:
                            value_str = str(field_value) if field_value is not None else ""
                            writer.update_page_form_field_values(
                                writer.pages[0],
                                {field_name: value_str}
                            )
                        except Exception as field_error:
                            print(f"Warning: Could not fill field '{field_name}': {field_error}")
            else:
                print("Warning: No form object found in PDF")
            
            # Generate output filename if not provided
            if output_path is None:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"filled_form_{user_name}_{session_id}_{timestamp}.pdf"
                output_path = os.path.join(self.temp_dir, filename)
            
            # Write filled PDF to file
            with open(output_path, 'wb') as output_file:
                writer.write(output_file)
            
            print(f"PDF form filled successfully. Output saved to: {output_path}")
            return output_path
            
        except requests.RequestException as e:
            raise Exception(f"Error downloading PDF: {str(e)}")
        except json.JSONDecodeError as e:
            raise Exception(f"Error parsing JSON data: {str(e)}")
        except Exception as e:
            raise Exception(f"Error filling PDF form: {str(e)}")

    def fill_pdf_form_advanced(self, user_name, session_id, pdf_source, form_data_json, output_path=None, flatten=False):
        """
        Advanced PDF form filler with better field handling and error recovery.
        
        Args:
            user_name (str): Name of the user
            session_id (str): Session identifier
            pdf_source (str): Path to local PDF file or URL to PDF
            form_data_json (dict or str): JSON data with field names as keys and values to fill
            output_path (str, optional): Path where to save the filled PDF
            flatten (bool): Whether to flatten the form (make fields non-editable)
        
        Returns:
            str: Path to the filled PDF file
        """
        try:
            # Parse JSON data
            if isinstance(form_data_json, str):
                form_data = json.loads(form_data_json)
            else:
                form_data = form_data_json
            
            # Get PDF content
            if pdf_source.startswith(('http://', 'https://')):
                response = requests.get(pdf_source)
                response.raise_for_status()
                pdf_buffer = io.BytesIO(response.content)
            else:
                with open(pdf_source, 'rb') as f:
                    pdf_buffer = io.BytesIO(f.read())
            
            # Read PDF
            reader = PdfReader(pdf_buffer)
            writer = PdfWriter()
            
            # Copy pages
            for page in reader.pages:
                writer.add_page(page)
            
            # Get form fields info
            form_fields = {}
            if hasattr(reader, 'get_form_field_names') and reader.get_form_field_names():
                for field_name in reader.get_form_field_names():
                    form_fields[field_name] = reader.get_form_field(field_name)
            elif hasattr(reader, 'get_fields') and reader.get_fields():
                form_fields = reader.get_fields()
            else:
                # Try to get fields from the form object directly
                if "/AcroForm" in reader.trailer["/Root"] and "/Fields" in reader.trailer["/Root"]["/AcroForm"]:
                    fields = reader.trailer["/Root"]["/AcroForm"]["/Fields"]
                    for field_ref in fields:
                        field_obj = field_ref.get_object()
                        if "/T" in field_obj:
                            field_name = field_obj["/T"]
                            form_fields[field_name] = field_obj
            
            # Fill each page's form fields
            for page_num, page in enumerate(writer.pages):
                page_updates = {}
                
                for field_name, field_value in form_data.items():
                    if field_name in form_fields:
                        # Handle different field types
                        if field_value is not None:
                            if isinstance(field_value, bool):
                                # For checkboxes
                                page_updates[field_name] = field_value
                            else:
                                # For text fields
                                page_updates[field_name] = str(field_value)
                
                # Update fields for this page
                if page_updates:
                    try:
                        writer.update_page_form_field_values(page, page_updates)
                    except Exception as page_error:
                        print(f"Warning: Error updating page {page_num}: {page_error}")
            
            # Flatten form (make fields non-editable) if requested
            if flatten:
                writer.flatten()
            
            # Generate output filename if not provided
            if output_path is None:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"filled_form_advanced_{user_name}_{session_id}_{timestamp}.pdf"
                output_path = os.path.join(self.temp_dir, filename)
            
            # Write to file
            with open(output_path, 'wb') as output_file:
                writer.write(output_file)
            
            print(f"PDF form filled successfully (advanced). Output saved to: {output_path}")
            return output_path
            
        except Exception as e:
            raise Exception(f"Error in advanced PDF form filling: {str(e)}")

    def get_pdf_form_fields(self, pdf_source):
        """
        Utility function to inspect PDF form fields.
        Useful for debugging and understanding the PDF structure.
        
        Args:
            pdf_source (str): Path to local PDF file or URL to PDF
        
        Returns:
            dict: Dictionary of field names and their properties
        """
        try:
            # Get PDF content
            if pdf_source.startswith(('http://', 'https://')):
                response = requests.get(pdf_source)
                response.raise_for_status()
                pdf_buffer = io.BytesIO(response.content)
            else:
                with open(pdf_source, 'rb') as f:
                    pdf_buffer = io.BytesIO(f.read())
            
            reader = PdfReader(pdf_buffer)
            fields_info = {}
            
            # Try different methods to get form fields based on pypdf version
            field_names = []
            
            if hasattr(reader, 'get_form_field_names') and reader.get_form_field_names():
                field_names = reader.get_form_field_names()
            elif hasattr(reader, 'get_fields') and reader.get_fields():
                field_names = list(reader.get_fields().keys())
            else:
                # Try to get fields from the form object directly
                try:
                    if "/AcroForm" in reader.trailer["/Root"] and "/Fields" in reader.trailer["/Root"]["/AcroForm"]:
                        fields = reader.trailer["/Root"]["/AcroForm"]["/Fields"]
                        for field_ref in fields:
                            field_obj = field_ref.get_object()
                            if "/T" in field_obj:
                                field_names.append(str(field_obj["/T"]))
                except Exception as e:
                    print(f"Could not extract field names: {e}")
            
            if field_names:
                for field_name in field_names:
                    try:
                        if hasattr(reader, 'get_form_field'):
                            field = reader.get_form_field(field_name)
                        elif hasattr(reader, 'get_fields'):
                            field = reader.get_fields().get(field_name)
                        else:
                            field = None
                            
                        fields_info[field_name] = {
                            'type': str(type(field)) if field else 'Unknown',
                            'value': getattr(field, 'value', 'N/A') if field else 'N/A',
                            'options': getattr(field, 'options', 'N/A') if field else 'N/A'
                        }
                    except Exception as e:
                        fields_info[field_name] = {'error': str(e)}
            else:
                print("No form fields found in PDF")
            
            return fields_info
            
        except Exception as e:
            return {"error": str(e)}

    def create_sample_data(self):
        """Create sample form data for testing."""
        return {
            "name": "John Doe",
            "email": "john.doe@example.com",
            "phone": "555-0123",
            "address": "123 Main St, Anytown, USA",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "checkbox_field": True,
            "dropdown_field": "Option 1"
        }


def test_pdf_form_filler():
    """Test function to demonstrate usage."""
    
    # Initialize the PDF form filler
    filler = PDFFormFiller()
    
    print("=== PDF Form Filler Test Suite ===")
    print(f"pypdf version info: {hasattr(PdfReader, 'get_form_field_names')}")
    
    # Test with a sample PDF (you need to provide this)
    sample_pdf = "sample_form.pdf"  # Replace with your PDF path
    
    # Check if sample PDF exists
    if os.path.exists(sample_pdf):
        print(f"\n=== Testing with {sample_pdf} ===")
        
        # Example 1: Inspect PDF form fields
        print("=== Testing PDF Form Field Inspection ===")
        fields = filler.get_pdf_form_fields(sample_pdf)
        print("Form fields found:")
        if isinstance(fields, dict) and 'error' not in fields:
            for field_name, field_info in fields.items():
                print(f"  {field_name}: {field_info}")
        else:
            print(f"  {fields}")
        
        # Example 2: Create sample form data
        print("\n=== Creating Sample Form Data ===")
        sample_data = filler.create_sample_data()
        print("Sample form data:")
        print(json.dumps(sample_data, indent=2))
        
        # Example 3: Fill PDF form
        print("\n=== Testing PDF Form Filling ===")
        try:
            output_path = filler.fill_pdf_form(
                user_name="test_user",
                session_id="test_session_123",
                pdf_source=sample_pdf,
                form_data_json=sample_data
            )
            print(f"Success! Filled PDF saved to: {output_path}")
        except Exception as e:
            print(f"Error: {e}")
        
        # Example 4: Advanced form filling with flattening
        print("\n=== Testing Advanced PDF Form Filling ===")
        try:
            output_path = filler.fill_pdf_form_advanced(
                user_name="test_user",
                session_id="test_session_123",
                pdf_source=sample_pdf,
                form_data_json=sample_data,
                flatten=False  # Set to True to make form non-editable
            )
            print(f"Success! Advanced filled PDF saved to: {output_path}")
        except Exception as e:
            print(f"Error: {e}")
            
    else:
        print(f"\n=== Sample PDF '{sample_pdf}' not found ===")
        print("Creating a simple test to check pypdf compatibility...")
        
        # Test pypdf methods availability
        print("\n=== pypdf Method Compatibility Check ===")
        
        # Create a minimal test
        try:
            # Test if we can create a simple PDF
            from reportlab.pdfgen import canvas
            from reportlab.lib.pagesizes import letter
            
            # Create a simple PDF with form fields for testing
            test_pdf_path = "test_form.pdf"
            c = canvas.Canvas(test_pdf_path, pagesize=letter)
            c.drawString(100, 750, "Test Form")
            c.drawString(100, 700, "Name: ________________")
            c.drawString(100, 650, "Email: ________________")
            c.save()
            
            print(f"Created test PDF: {test_pdf_path}")
            print("Note: This is a simple PDF without interactive form fields.")
            print("For testing form filling, you need a PDF with actual form fields.")
            
        except ImportError:
            print("reportlab not available for creating test PDF")
            print("Install with: pip install reportlab")
    
    print("\n=== Test Complete ===")
    print("To test with real form data:")
    print("1. Get a PDF file with interactive form fields")
    print("2. Use filler.get_pdf_form_fields('your_pdf.pdf') to see available fields")
    print("3. Create form data dictionary matching the field names")
    print("4. Use filler.fill_pdf_form() to fill the form")


def create_test_form_pdf():
    """Create a test PDF with form fields using reportlab."""
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfbase import pdfform
        from reportlab.lib.colors import black, blue, red
        
        test_pdf_path = "interactive_test_form.pdf"
        c = canvas.Canvas(test_pdf_path, pagesize=letter)
        
        # Add title
        c.setFont("Helvetica-Bold", 16)
        c.drawString(50, 750, "Interactive Test Form")
        
        # Add form fields with compatible parameters
        c.setFont("Helvetica", 12)
        
        # Full Name field
        c.drawString(50, 700, "Full Name:")
        c.acroForm.textfield(name='Full Name', tooltip='Enter your full name',
                           x=150, y=695, borderStyle='inset',
                           width=200, height=20, textColor=black,
                           forceBorder=True)
        
        # Email field
        c.drawString(50, 650, "Email:")
        c.acroForm.textfield(name='Email', tooltip='Enter your email',
                           x=150, y=645, borderStyle='inset',
                           width=200, height=20, textColor=black,
                           forceBorder=True)
        
        # Gender dropdown
        c.drawString(50, 600, "Gender:")
        c.acroForm.choice(name='Gender', tooltip='Select your gender',
                         value='Male', x=150, y=595, width=100, height=20,
                         borderStyle='inset', forceBorder=True,
                         options=[('Male', 'Male'), ('Female', 'Female'), ('Other', 'Other')])
        
        # Address field (larger)
        c.drawString(50, 550, "Address:")
        c.acroForm.textfield(name='Address', tooltip='Enter your address',
                           x=150, y=530, borderStyle='inset',
                           width=300, height=40, textColor=black,
                           forceBorder=True)
        
        # Phone field
        c.drawString(50, 480, "Phone:")
        c.acroForm.textfield(name='Phone', tooltip='Enter your phone number',
                           x=150, y=475, borderStyle='inset',
                           width=200, height=20, textColor=black,
                           forceBorder=True)
        
        # Checkbox
        c.drawString(50, 430, "Subscribe to newsletter:")
        c.acroForm.checkbox(name='Subscribe', tooltip='Check to subscribe',
                          x=220, y=425, borderStyle='inset',
                          size=15, forceBorder=True)
        
        c.save()
        print(f"Created interactive test form: {test_pdf_path}")
        return test_pdf_path
        
    except ImportError:
        print("reportlab not available. Install with: pip install reportlab")
        return None
    except Exception as e:
        print(f"Error creating test PDF: {e}")
        return None


if __name__ == "__main__":
    # Run the test function
    test_pdf_form_filler()
    
    # Optionally create a test form
    print("\n=== Creating Test Form ===")
    # test_form_path = create_test_form_pdf()
    test_form_path = r"interactive_test_form.pdf"
    
    if test_form_path:
        print(f"\nTesting with created form: {test_form_path}")
        filler = PDFFormFiller()
        
        # Test the created form
        fields = filler.get_pdf_form_fields(test_form_path)
        print("Fields in test form:")
        for field_name, field_info in fields.items():
            print(f"  {field_name}: {field_info}")
        
        # Test filling the form
        test_data = {
            "Full Name": "John Doe",
            "Email": "john.doe@example.com", 
            "Gender": "Male",
            "Address": "123 Main St, Anytown, USA",
            "Phone": "555-0123",
            "Subscribe": True
        }
        
        try:
            output_path = filler.fill_pdf_form_advanced(
                user_name="test_user",
                session_id="test_session",
                pdf_source=test_form_path,
                form_data_json=test_data
            )
            print(f"Successfully filled test form: {output_path}")
        except Exception as e:
            print(f"Error filling test form: {e}")
    
    # Example of direct usage:
    # filler = PDFFormFiller()
    # 
    # # Inspect form fields first
    # fields = filler.get_pdf_form_fields("your_form.pdf")
    # print("Available fields:", list(fields.keys()))
    # 
    # # Fill the form
    # form_data = {"field1": "value1", "field2": "value2"}
    # output_file = filler.fill_pdf_form(
    #     user_name="john_doe",
    #     session_id="session_123",
    #     pdf_source="your_form.pdf",
    #     form_data_json=form_data
    # )