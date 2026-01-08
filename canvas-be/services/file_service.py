import os
import aiofiles
from typing import List
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
    
    async def upload_files(self, files: List[UploadFile]) -> List[str]:
        """
        Upload files to Azure OpenAI and return file IDs
        
        Args:
            files: List of uploaded files
        
        Returns:
            List of file IDs
        """
        file_ids = []
        
        for file in files:
            file_id = await self._upload_single_file(file)
            if file_id:
                file_ids.append(file_id)
        
        return file_ids
    
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
            print(f"Error uploading file {file.filename}: {e}")
            return None
        
        finally:
            # Clean up temporary file
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception as e:
                    print(f"Error removing temp file {temp_path}: {e}")