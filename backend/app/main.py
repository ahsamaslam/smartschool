"""
Main FastAPI application entry point
"""
import os
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
import time
import logging

from app.config import settings
from app.routers import (
    auth,
    students,
    teachers,
    managers,
    admins,
    videos,
    quizzes,
    qa,
    attendance,
    analytics,
    classes as classes_router
)

# Configure logging
logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-Powered Education Platform with Video Learning, Quizzes, and Analytics",
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
)

# ============================================
# MIDDLEWARE
# ============================================

# CORS - Allow frontend to make requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add processing time to response headers"""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response

# ============================================
# EXCEPTION HANDLERS
# ============================================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors"""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": exc.errors(),
            "message": "Validation error occurred"
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle all other exceptions"""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An internal error occurred",
            "message": str(exc) if settings.DEBUG else "Internal server error"
        }
    )

# ============================================
# ROUTERS
# ============================================

# Authentication
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])

# Student routes
app.include_router(students.router, prefix="/api/students", tags=["Students"])

# Teacher routes
app.include_router(teachers.router, prefix="/api/teachers", tags=["Teachers"])

# Manager routes
app.include_router(managers.router, prefix="/api/managers", tags=["Managers"])

# Admin routes
app.include_router(admins.router, prefix="/api/admins", tags=["Admins"])

# Video management
app.include_router(videos.router, prefix="/api/videos", tags=["Videos"])

# Quiz system
app.include_router(quizzes.router, prefix="/api/quizzes", tags=["Quizzes"])

# Q&A Bot
app.include_router(qa.router, prefix="/api/qa", tags=["Q&A"])

# Attendance
app.include_router(attendance.router, prefix="/api/attendance", tags=["Attendance"])

# Analytics & Reports
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])

# Classes management
app.include_router(classes_router.router, prefix="/api/classes", tags=["Classes"])

# Serve generated audio/video/image files
os.makedirs("static/audio", exist_ok=True)
os.makedirs("static/videos", exist_ok=True)
os.makedirs("static/teacher_faces", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# ============================================
# STARTUP & SHUTDOWN EVENTS
# ============================================

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("🚀 Education Platform API Starting...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Debug Mode: {settings.DEBUG}")
    
    # Initialize Redis connection
    try:
        from app.utils.cache import init_cache
        await init_cache()
        logger.info("✅ Redis cache connected")
    except Exception as e:
        logger.warning(f"⚠️  Redis cache not available: {str(e)}")
    
    # Initialize database connection pool
    try:
        from app.utils.database import init_db, execute_write
        await init_db()
        logger.info("✅ Database connected")
    except Exception as e:
        logger.error(f"❌ Database connection failed: {str(e)}")

    # Run idempotent schema migrations
    try:
        from app.utils.database import execute_write
        migrations = [
            "ALTER TABLE topics ADD COLUMN IF NOT EXISTS chapter_name VARCHAR(255);",
            "ALTER TABLE topics ADD COLUMN IF NOT EXISTS chapter_number INTEGER DEFAULT 0;",
            "ALTER TABLE video_templates ALTER COLUMN video_url DROP NOT NULL;",
            "ALTER TABLE video_templates ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ready';",
            "ALTER TABLE video_templates ADD COLUMN IF NOT EXISTS visual_elements JSONB;",
            "ALTER TABLE video_templates ADD COLUMN IF NOT EXISTS key_points JSONB;",
            # Manim + D-ID + FFmpeg pipeline columns
            "ALTER TABLE video_templates ADD COLUMN IF NOT EXISTS audio_url TEXT;",
            "ALTER TABLE video_templates ADD COLUMN IF NOT EXISTS whiteboard_url TEXT;",
            "ALTER TABLE video_templates ADD COLUMN IF NOT EXISTS avatar_url TEXT;",
            "ALTER TABLE video_templates ADD COLUMN IF NOT EXISTS final_video_url TEXT;",
            # Teacher face photo per-teacher
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT;",
            # Slide deck JSON stored per topic
            "ALTER TABLE topics ADD COLUMN IF NOT EXISTS slides_json TEXT;",
            "ALTER TABLE topics ADD COLUMN IF NOT EXISTS content TEXT;",
        ]
        for sql in migrations:
            try:
                await execute_write(sql)
            except Exception:
                pass  # Column may already exist or type matches
        logger.info("✅ Schema migrations applied")
    except Exception as e:
        logger.warning(f"⚠️  Schema migration warning: {str(e)}")

    # Bootstrap the sole admin user from env vars.
    # If the user already exists it is updated to match the env values;
    # every other user in the table is deactivated so only this admin
    # can log in until additional users are explicitly created.
    try:
        from app.utils.auth import hash_password
        from app.utils.database import execute_write, execute_one

        admin_email = settings.ADMIN_EMAIL
        admin_password_hash = hash_password(settings.ADMIN_PASSWORD)

        # Upsert the admin user
        await execute_write(
            """
            INSERT INTO users (id, email, full_name, role, password_hash, is_active)
            VALUES (
                '00000000-0000-0000-0000-000000000001',
                $1, 'System Admin', 'admin', $2, true
            )
            ON CONFLICT (id) DO UPDATE
                SET email         = EXCLUDED.email,
                    password_hash = EXCLUDED.password_hash,
                    is_active     = true,
                    updated_at    = NOW();
            """,
            admin_email,
            admin_password_hash,
        )

        # Deactivate every other user so they cannot log in
        await execute_write(
            """
            UPDATE users
            SET is_active = false
            WHERE id <> '00000000-0000-0000-0000-000000000001';
            """
        )

        logger.info(f"✅ Admin user bootstrapped: {admin_email}")
    except Exception as e:
        logger.error(f"❌ Admin bootstrap failed: {str(e)}")

    logger.info("✅ Education Platform API Started Successfully!")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("🛑 Education Platform API Shutting Down...")
    
    # Close Redis connection
    try:
        from app.utils.cache import close_cache
        await close_cache()
        logger.info("✅ Redis cache closed")
    except Exception as e:
        logger.warning(f"⚠️  Error closing cache: {str(e)}")
    
    # Close database connections
    try:
        from app.utils.database import close_db
        await close_db()
        logger.info("✅ Database connections closed")
    except Exception as e:
        logger.warning(f"⚠️  Error closing database: {str(e)}")

# ============================================
# HEALTH CHECK ENDPOINTS
# ============================================

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Education Platform API",
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/api/docs" if settings.DEBUG else None
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "version": settings.APP_VERSION
    }

@app.get("/api/health/db")
async def database_health():
    """Check database connectivity"""
    try:
        from app.utils.database import check_db_health
        is_healthy = await check_db_health()
        return {
            "status": "healthy" if is_healthy else "unhealthy",
            "database": "connected" if is_healthy else "disconnected"
        }
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "database": "disconnected",
                "error": str(e)
            }
        )

@app.get("/api/health/cache")
async def cache_health():
    """Check Redis cache connectivity"""
    try:
        from app.utils.cache import check_cache_health
        is_healthy = await check_cache_health()
        return {
            "status": "healthy" if is_healthy else "unhealthy",
            "cache": "connected" if is_healthy else "disconnected"
        }
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "cache": "disconnected",
                "error": str(e)
            }
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info" if settings.DEBUG else "warning"
    )
