import uvicorn
import warnings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from api import canvas_routes, chat_routes

# Ignore deprecation warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)

# Initialize FastAPI app
app = FastAPI(
    title="Business Model Canvas Generator",
    description="API for generating and managing Business Model Canvases using Azure OpenAI",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(canvas_routes.router)
app.include_router(chat_routes.router)

if __name__ == "__main__":
    uvicorn.run(
        app,
        host=settings.HOST,
        port=settings.PORT,
    )