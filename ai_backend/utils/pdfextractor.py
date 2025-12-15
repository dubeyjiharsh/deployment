import json
import os
import tempfile
from typing import Dict, Any
from datetime import datetime
from pathlib import Path

import pytesseract
from pdf2image import convert_from_path
from PIL import Image, ImageEnhance
from dotenv import load_dotenv
from langchain_openai import AzureChatOpenAI
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import uvicorn

class PDFFormExtractor:
    def __init__(self, tesseract_path: str = None, poppler_path: str = None):
        """Initialize the PDF Form Field Extractor"""
        # Set Tesseract path from parameter, environment variable, or auto-detect
        tesseract_path = tesseract_path or os.getenv('TESSERACT_PATH')
        
        if tesseract_path and os.path.exists(tesseract_path):
            pytesseract.pytesseract.tesseract_cmd = tesseract_path
            print(f"✅ Using Tesseract from: {tesseract_path}")
        elif tesseract_path:
            print(f"⚠️ Tesseract path not found: {tesseract_path}")
        
        # Set Poppler path
        self.poppler_path = poppler_path or os.getenv('POPPLER_PATH')
        if self.poppler_path:
            print(f"✅ Using Poppler from: {self.poppler_path}")
        
        # Test if Tesseract is accessible
        try:
            pytesseract.get_tesseract_version()
            print("✅ Tesseract is accessible")
        except Exception as e:
            raise Exception(f"Tesseract not found or not accessible: {str(e)}")
        
        # Initialize Azure OpenAI client
        try:
            self.llm = AzureChatOpenAI(
                azure_endpoint=os.getenv('AZURE_OPENAI_ENDPOINT'),
                api_key=os.getenv('AZURE_OPENAI_API_KEY'),
                api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
                deployment_name=os.getenv('AZURE_OPENAI_DEPLOYMENT_NAME', 'gpt-4o'),
                temperature=0.6,
                # max_tokens=4000
            )
        except Exception as e:
            raise Exception(f"Failed to initialize OpenAI client: {str(e)}")

    def extract_text_from_pdf(self, pdf_path: str, dpi: int = 300) -> Dict[str, Any]:
        """
        Function 1: Extract all text from PDF using OCR (pytesseract)
        
        Args:
            pdf_path: Path to PDF file
            dpi: DPI for image conversion
            
        Returns:
            Dictionary containing extracted text and metadata
        """
        try:
            # Try multiple approaches to convert PDF to images
            pages = None
            error_messages = []
            
            # Method 1: Use specified poppler path
            if self.poppler_path and os.path.exists(self.poppler_path):
                try:
                    pages = convert_from_path(
                        pdf_path, 
                        dpi=dpi, 
                        poppler_path=self.poppler_path
                    )
                    print(f"✅ PDF converted using Poppler from: {self.poppler_path}")
                except Exception as e:
                    error_messages.append(f"Method 1 (custom poppler path): {str(e)}")
            
            # Method 2: Try common Windows paths
            if not pages and os.name == 'nt':
                common_poppler_paths = [
                    r"C:\Poppler\poppler-24.08.0\Library\bin",
                    r"C:\poppler-23.01.0\Library\bin",
                    r"C:\poppler-24.02.0\Library\bin",
                    r"C:\poppler\Library\bin",
                    r"C:\Program Files\poppler\Library\bin",
                    r"C:\Program Files (x86)\poppler\Library\bin",
                    r"C:\Tools\poppler\Library\bin"
                ]
                
                for poppler_path in common_poppler_paths:
                    if os.path.exists(poppler_path):
                        try:
                            pages = convert_from_path(
                                pdf_path, 
                                dpi=dpi, 
                                poppler_path=poppler_path
                            )
                            print(f"✅ PDF converted using Poppler from: {poppler_path}")
                            break
                        except Exception as e:
                            error_messages.append(f"Method 2 ({poppler_path}): {str(e)}")
            
            # Method 3: Try without specifying poppler path (assume it's in PATH)
            if not pages:
                try:
                    pages = convert_from_path(pdf_path, dpi=dpi)
                    print("✅ PDF converted using Poppler from PATH")
                except Exception as e:
                    error_messages.append(f"Method 3 (PATH): {str(e)}")
            
            # If all methods failed, return error
            if not pages:
                return {
                    'success': False,
                    'error': f'Failed to convert PDF to images. Tried methods: {"; ".join(error_messages)}',
                    'combined_text': '',
                    'page_texts': [],
                    'suggestion': 'Please install Poppler: https://github.com/oschwartz10612/poppler-windows/releases/'
                }
                
            all_text = []
            page_texts = []
            
            for page_num, page_image in enumerate(pages, 1):
                # Enhance image for better OCR
                if page_image.mode != 'RGB':
                    page_image = page_image.convert('RGB')
                
                # Convert to grayscale and enhance
                gray_image = page_image.convert('L')
                enhancer = ImageEnhance.Contrast(gray_image)
                enhanced_image = enhancer.enhance(1.5)
                
                # Extract text using pytesseract
                page_text = pytesseract.image_to_string(
                    enhanced_image,
                    config='--oem 3 --psm 6'
                )
                
                page_texts.append({
                    'page_number': page_num,
                    'text': page_text.strip()
                })
                
                # Add page separator for combined text
                all_text.append(f"\n--- PAGE {page_num} ---\n")
                all_text.append(page_text.strip())
            
            combined_text = '\n'.join(all_text)
            
            return {
                'success': True,
                'total_pages': len(pages),
                'combined_text': combined_text,
                'page_texts': page_texts,
                'extraction_timestamp': datetime.now().isoformat(),
                'method': 'pytesseract_ocr'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'OCR extraction failed: {str(e)}',
                'combined_text': '',
                'page_texts': []
            }

    def generate_form_fields_json(self, extracted_text: str) -> Dict[str, Any]:
        """
        Function 2: Use OpenAI API to analyze text and generate JSON response
        
        Args:
            extracted_text: Text extracted from PDF via OCR
            
        Returns:
            Dictionary containing form fields in JSON format
        """
        try:
            # Create prompt for OpenAI
            prompt = f"""You are an expert at analyzing form documents. Given the raw text extracted from a form, identify all form fields and their characteristics.

    Return ONLY a valid JSON object with this exact structure:
    {{
        "form_fields": {{
            "field_name_1": {{
                "description": "What this field is asking for",
                "output": "free_text|mcq|msq|date|number|email|phone",
                "drop_down": "comma,separated,options (only if output is mcq or msq)"
            }},
            "field_name_2": {{
                "description": "What this field is asking for", 
                "output": "free_text|mcq|msq|date|number|email|phone",
                "drop_down": "comma,separated,options (only if output is mcq or msq)"
            }}
        }},
        "metadata": {{
            "total_fields": 0,
            "form_title": "Detected form title or 'Unknown'",
            "analysis_timestamp": "{datetime.now().isoformat()}"
        }}
    }}

    Extracted Text:
    {extracted_text}"""  # Limit text to avoid token limits

            # Get response from OpenAI
            response = self.llm.invoke(prompt)
            response_text = response.content.strip()
            
            # Extract JSON from response
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            
            if json_start != -1 and json_end > json_start:
                json_text = response_text[json_start:json_end]
                parsed_json = json.loads(json_text)
                
                # Add processing metadata
                parsed_json['processing_info'] = {
                    'api_model': 'gpt-4o',
                    'processing_timestamp': datetime.now().isoformat(),
                    'status': 'success'
                }
                
                return {
                    'success': True,
                    'form_data': parsed_json
                }
            else:
                return {
                    'success': False,
                    'error': 'Could not extract valid JSON from OpenAI response',
                    'raw_response': response_text[:500]  # First 500 chars for debugging
                }
                
        except json.JSONDecodeError as e:
            return {
                'success': False,
                'error': f'JSON parsing error: {str(e)}',
                'raw_response': response_text[:500] if 'response_text' in locals() else 'No response'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'OpenAI API error: {str(e)}'
            }
