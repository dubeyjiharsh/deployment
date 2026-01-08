import os
import logging
import aiofiles
from typing import List, Tuple
from docx import Document
from fastapi import UploadFile
from openai import AzureOpenAI
from config import settings

class FileService:
    """Service for handling file uploads and management"""
    
    def __init__(self):
        self.client = AzureOpenAI(
            api_version=settings.AZURE_OPENAI_API_VERSION,
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
            api_key=settings.AZURE_OPENAI_API_KEY
        )
        self._ensure_upload_dir()
    
    def _ensure_upload_dir(self):
        """Ensure upload directory exists"""
        if not os.path.exists(settings.UPLOAD_DIR):
            os.makedirs(settings.UPLOAD_DIR)
    
    async def upload_files(self, files: List[UploadFile]) -> Tuple[List[str], List[str]]:
        """
        Upload supported files to Azure OpenAI and extract text from .docx files.
        Returns tuple: (file_ids, docx_texts)
        """
        file_ids = []
        docx_texts = []
        for file in files:
            ext = os.path.splitext(file.filename)[1].lower()
            if ext == ".pdf":
                file_id = await self._upload_single_file(file)
                if file_id:
                    file_ids.append(file_id)
            elif ext == ".docx":
                text = await self._extract_docx_text(file)
                if text:
                    docx_texts.append(text)
            else:
                logging.warning(f"Unsupported file type: {file.filename}")
        return file_ids, docx_texts

    async def _extract_docx_text(self, file: UploadFile) -> str:
        """
        Extract text from a .docx file
        """
        temp_path = os.path.join(settings.UPLOAD_DIR, f"temp_{file.filename}")
        try:
            async with aiofiles.open(temp_path, 'wb') as f:
                content = await file.read()
                await f.write(content)
            doc = Document(temp_path)
            text = "\n".join([para.text for para in doc.paragraphs])
            return text
        except Exception as e:
            logging.error(f"Error extracting text from docx {file.filename}: {e}")
            return ""
        finally:
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception as e:
                    logging.error(f"Error removing temp file {temp_path}: {e}")
    
    async def _upload_single_file(self, file: UploadFile) -> str:
        """
        Upload a single file to Azure OpenAI
        
        Args:
            file: The uploaded file
        
        Returns:
            File ID from Azure OpenAI
        """
        temp_path = os.path.join(settings.UPLOAD_DIR, f"temp_{file.filename}")
        
        try:
            # Save file temporarily
            async with aiofiles.open(temp_path, 'wb') as f:
                content = await file.read()
                await f.write(content)
            
            # Upload to Azure OpenAI
            with open(temp_path, 'rb') as f:
                uploaded_file = self.client.files.create(
                    file=f,
                    purpose="assistants"
                )
            
            return uploaded_file.id
        
        except Exception as e:
            logging.error(f"Error uploading file {file.filename}: {e}")
            return None
        
        finally:
            # Clean up temporary file
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception as e:
                    logging.error(f"Error removing temp file {temp_path}: {e}")