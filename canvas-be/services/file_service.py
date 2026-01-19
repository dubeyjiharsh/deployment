import os
import logging
import aiofiles
from typing import List
from docx import Document
from fastapi import UploadFile
from openai import OpenAI
from config import settings

class FileService:
    """Service for handling file uploads and management"""
    
    _client = None
    _last_config = None

    @classmethod
    def reload_client(cls):
        azure_config = settings.get_azure_openai_config()
        cls._client = OpenAI(
            base_url=azure_config.get("azure_openai_endpoint", "")+"openai/v1/",
            api_key=azure_config.get("azure_openai_api_key", ""),
        )
        cls._last_config = azure_config

    def __init__(self):
        if not self.__class__._client:
            self.__class__.reload_client()
        self.azure_config = self.__class__._last_config
        self._ensure_upload_dir()

    @property
    def client(self):
        if not self.__class__._client:
            self.__class__.reload_client()
        return self.__class__._client
    
    def _ensure_upload_dir(self):
        """Ensure upload directory exists"""
        if not os.path.exists(settings.UPLOAD_DIR):
            os.makedirs(settings.UPLOAD_DIR)

    async def _upload_single_file(self, file: UploadFile) -> str:
        """
        Upload a single file to Azure OpenAI
        
        Args:
            file: The uploaded file
        
        Returns:
            File ID from Azure OpenAI
        """
        # Sanitize filename to prevent directory traversal
        safe_filename = os.path.basename(file.filename)
        temp_path = os.path.join(settings.UPLOAD_DIR, f"temp_{safe_filename}")
        # Ensure the path stays within the intended upload directory
        if not os.path.abspath(temp_path).startswith(os.path.abspath(settings.UPLOAD_DIR)):
            raise ValueError("Invalid file path detected.")
        
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
    
    async def upload_files(self, files: List[UploadFile]) -> List[str]:
        """
        Upload only PDF files to Azure OpenAI
        Returns list of file IDs
        Limits the number of attachments to 10.
        """
        if len(files) > 10:
            raise ValueError("A maximum of 10 attachments is allowed.")
        
        allowed_file_types = [".pdf"]
        allowed_file_size = 5 * 1024 * 1024  # 5MB
        file_ids = []
        for file in files:
            ext = os.path.splitext(file.filename)[1].lower()
            if ext not in allowed_file_types:
                raise ValueError(f"Unsupported file type: {file.filename}. Only {', '.join(allowed_file_types)} files are allowed.")
            
            # Check file size (5MB = 5 * 1024 * 1024 bytes)
            contents = await file.read()
            if len(contents) > allowed_file_size:
                raise ValueError(f"File '{file.filename}' exceeds the {allowed_file_size} bytes size limit.")
            # Reset file pointer for actual upload
            await file.seek(0)

            file_id = await self._upload_single_file(file)
            if file_id:
                file_ids.append(file_id)
        return file_ids