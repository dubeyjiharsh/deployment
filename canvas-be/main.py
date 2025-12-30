import uvicorn
import warnings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from api import canvas_routes, chat_routes
from api.generate_document_route import router as generate_document_router
import sys

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
app.include_router(generate_document_router)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"Invalid port '{sys.argv[1]}', using default port 8025")
            port = 8025
    else:
        port = 8025

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
    )