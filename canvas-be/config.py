import os
from dotenv import load_dotenv
from keys.bao_store import read_bao_secret
import logging

load_dotenv()

class Settings:
    """Application configuration settings loaded from environment variables and OpenBao.""" 
    # aiforce endpoints
    AIFORCE_HEALTH_CHECK = os.getenv("AIFORCE_HEALTH_CHECK")
    AIFORCE_PMS = os.getenv("AIFORCE_PMS")
    AIFORCE_GCS = os.getenv("AIFORCE_GCS")
    
    # dynamic function to fetch AI Force bearer token from OpenBAO
    @staticmethod
    def get_aiforce_config():
        return read_bao_secret(env="dev", app="aiforce") or {}

    # Dynamic function to fetch Azure OpenAI credentials from OpenBAO
    @staticmethod
    def get_azure_openai_config():
        return read_bao_secret(env="dev", app="llm") or {}

    # PostgreSQL Configuration
    POSTGRES_HOST = os.getenv("POSTGRES_HOST")
    POSTGRES_PORT = os.getenv("POSTGRES_PORT")
    POSTGRES_DB = os.getenv("POSTGRES_DB")
    POSTGRES_USER = os.getenv("POSTGRES_USER")
    POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")
    
    # Application Settings
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",") if os.getenv("CORS_ORIGINS") != "*" else ["*"]
    
    # File Upload Settings
    UPLOAD_DIR = "./temp_uploads"
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    
    @classmethod
    def validate(cls):
        """Validate required environment variables"""
        required = ["POSTGRES_HOST", "POSTGRES_DB", "POSTGRES_USER"]
        missing = [var for var in required if not getattr(cls, var)]
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

settings = Settings()
settings.validate()