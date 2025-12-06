"""
Main FastAPI application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import os
from pathlib import Path

from app.database import create_db_and_tables, get_session
from app.api import sets, pieces, auth
from app.api import collections
from app.api.chess_engine import router as chess_router
from app.api.ai_generation import router as ai_router
from app.api.prices import router as prices_router
from app.services.seeding import seed_if_needed


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifecycle manager for FastAPI application
    """
    # Startup
    print("🚀 Starting Chess Set Design Manager API...")
    
    # Create database tables
    create_db_and_tables()
    print("✅ Database tables created")
    
    # Ensure upload directory exists
    upload_dir = Path(os.getenv("UPLOAD_DIR", "/app/uploads"))
    upload_dir.mkdir(parents=True, exist_ok=True)
    print(f"✅ Upload directory ready: {upload_dir}")
    
    # Run seeding for default chess sets
    from sqlmodel import Session
    from app.database import engine
    with Session(engine) as session:
        seed_if_needed(session)
    
    yield
    
    # Shutdown
    print("👋 Shutting down...")


# Create FastAPI app
app = FastAPI(
    title="Chess Set Design Manager API",
    description="API for managing chess set designs with 3D models and images",
    version="1.0.0",
    lifespan=lifespan
)


# Configure CORS - MUST be first middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8000", "*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# Include routers BEFORE mounting static files
app.include_router(auth.router, prefix="/api")
app.include_router(sets.router, prefix="/api")
app.include_router(pieces.router, prefix="/api")
app.include_router(collections.router, prefix="/api")
app.include_router(chess_router, prefix="/api")
app.include_router(ai_router, prefix="/api")
app.include_router(prices_router, prefix="/api")


# Custom endpoint for serving uploaded files with CORS
@app.get("/uploads/{file_path:path}")
async def serve_upload(file_path: str):
    """Serve uploaded files with CORS headers"""
    upload_dir = Path(os.getenv("UPLOAD_DIR", "/app/uploads"))
    file_location = upload_dir / file_path
    
    if not file_location.exists() or not file_location.is_file():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(file_location)


@app.get("/")
def root():
    """Root endpoint"""
    return {
        "message": "Chess Set Design Manager API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
