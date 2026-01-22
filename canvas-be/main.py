import uvicorn
import logging
import warnings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from api import bao_routes, canvas_routes, chat_routes, user_routes
import sys, os

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
app.include_router(bao_routes.router)
app.include_router(user_routes.router)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    port = 8000

    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            logging.warning(f"Invalid port '{sys.argv[1]}', using default port {port}")
    else:
        env_port = os.getenv("PORT")
        if env_port:
            try:
                port = int(env_port)
            except ValueError:
                logging.warning(f"Invalid PORT env '{env_port}', using default port {port}")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
    )