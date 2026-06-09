# app/main.py
"""Main FastAPI application entry point."""

import bcrypt
# Monkeypatch bcrypt for passlib compatibility
if not hasattr(bcrypt, "__about__"):
    bcrypt.__about__ = bcrypt

import os
import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Setup structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

from app.config import settings
from app.database import get_client, get_db
from app.routes import auth, employees, attendance, departments, dashboard, reports, settings as settings_routes, leaves, advances, loans, assets, payroll

app = FastAPI(
    title="HR Attendance AI API",
    description="Backend API for the real-time HR Attendance AI System",
    version="2.0.0",
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected internal server error occurred. Please try again later."},
    )

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded photos
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.on_event("startup")
def startup_db_client():
    # Trigger client and DB connection + index creation
    get_db()
    logger.info("🚀 Connected to MongoDB and ensured indexes.")


@app.on_event("shutdown")
def shutdown_db_client():
    get_client().close()
    logger.info("🛑 MongoDB connection closed.")


# Include routers
app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(attendance.router)
app.include_router(departments.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(settings_routes.router)
app.include_router(leaves.router)
app.include_router(advances.router)
app.include_router(loans.router)
app.include_router(assets.router)
app.include_router(payroll.router)

# Serve frontend static assets explicitly if they exist
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")
ASSETS_DIR = os.path.join(STATIC_DIR, "assets")

if os.path.exists(ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="frontend_assets")

# SPA Catch-all for React Router
@app.api_route("/{full_path:path}", methods=["GET", "HEAD", "OPTIONS"])
async def serve_spa(full_path: str, request: Request):
    # Handle OPTIONS preflight requests for the root explicitly
    if request.method == "OPTIONS":
        return JSONResponse(status_code=200, content={"status": "ok"})

    # Do not intercept actual API endpoints (should be handled by routers)
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
        
    # Check if a specific file is requested (like favicon.svg, vite.svg)
    file_path = os.path.join(STATIC_DIR, full_path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
        
    # Fallback to index.html for React Router
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
        
    return {
        "status": "online",
        "system": "HR Attendance AI Backend",
        "version": "2.0.0",
        "company": settings.COMPANY_NAME,
        "note": "Frontend is not built or static files are missing."
    }
