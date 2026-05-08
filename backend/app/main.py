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
    classes as classes_router,
    library
)
from app.schemas.slides_ai import GenerateSlidesRequest, GenerateSlidesResponse
from app.utils.ai_slide_deck import generate_slide_deck as run_generate_slide_deck

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

# Curriculum Library
app.include_router(library.router, prefix="/api/library", tags=["Library"])

# Spec alias: POST /api/generate-slides (same handler as admin route)
@app.post("/api/generate-slides", response_model=GenerateSlidesResponse, tags=["AI Slides"])
async def standalone_generate_slides(body: GenerateSlidesRequest):
    return await run_generate_slide_deck(body)

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
            # Branch city + class section
            "ALTER TABLE branches ADD COLUMN IF NOT EXISTS city VARCHAR(100);",
            "ALTER TABLE classes ADD COLUMN IF NOT EXISTS section VARCHAR(50);",
            "ALTER TABLE classes ADD COLUMN IF NOT EXISTS manual_student_count INTEGER DEFAULT 0;",
            # User properties for teachers/employees
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50);",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);",
            # Design Templates tables
            """CREATE TABLE IF NOT EXISTS design_templates (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL UNIQUE,
                category VARCHAR(100),
                description TEXT,
                is_system BOOLEAN DEFAULT true,
                created_by UUID REFERENCES users(id),
                theme_config JSONB NOT NULL,
                style_config JSONB,
                preview_image_url TEXT,
                usage_count INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );""",
            """CREATE TABLE IF NOT EXISTS topic_templates (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
                design_template_id UUID REFERENCES design_templates(id) ON DELETE SET NULL,
                applied_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(topic_id)
            );""",
            """CREATE TABLE IF NOT EXISTS ai_slide_generations (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                topic TEXT NOT NULL,
                content JSONB NOT NULL,
                template VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW()
            );""",
            """CREATE TABLE IF NOT EXISTS ai_slide_template_presets (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                config JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );""",
            # Ensure theme_config column exists on older design_templates tables
            "ALTER TABLE design_templates ADD COLUMN IF NOT EXISTS theme_config JSONB;",
        ]
        for sql in migrations:
            try:
                await execute_write(sql)
            except Exception as e:
                pass  # Table may already exist
        logger.info("✅ Schema migrations applied")
    except Exception as e:
        logger.warning(f"⚠️  Schema migration warning: {str(e)}")

    # Seed default design templates
    try:
        from app.utils.database import execute_one
        existing = await execute_one("SELECT COUNT(*) as cnt FROM design_templates WHERE is_system = true")
        if not existing or existing.get("cnt", 0) == 0:
            import json
            default_templates = [
                {"name": "Ocean Depth", "category": "ocean", "description": "Deep ocean gradient with cyan accents", 
                 "theme_config": {"bg": "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #0891b2 100%)", "accent": "#38bdf8", "accentDark": "#0369a1", "text": "#ffffff", "subtext": "rgba(255,255,255,0.75)", "card": "rgba(255,255,255,0.08)", "cardBorder": "rgba(56,189,248,0.3)", "bullet": "#38bdf8", "pill": "rgba(56,189,248,0.15)"}},
                {"name": "Emerald Forest", "category": "nature", "description": "Lush green gradient for biology and ecology",
                 "theme_config": {"bg": "linear-gradient(135deg, #052e16 0%, #166534 55%, #15803d 100%)", "accent": "#4ade80", "accentDark": "#16a34a", "text": "#ffffff", "subtext": "rgba(255,255,255,0.75)", "card": "rgba(255,255,255,0.08)", "cardBorder": "rgba(74,222,128,0.3)", "bullet": "#86efac", "pill": "rgba(74,222,128,0.15)"}},
                {"name": "Golden Sunset", "category": "vibrant", "description": "Warm orange-gold gradient, energetic",
                 "theme_config": {"bg": "linear-gradient(135deg, #431407 0%, #c2410c 55%, #d97706 100%)", "accent": "#fbbf24", "accentDark": "#b45309", "text": "#ffffff", "subtext": "rgba(255,255,255,0.75)", "card": "rgba(255,255,255,0.08)", "cardBorder": "rgba(251,191,36,0.3)", "bullet": "#fde68a", "pill": "rgba(251,191,36,0.15)"}},
                {"name": "Royal Purple", "category": "elegant", "description": "Purple to magenta, premium presentations",
                 "theme_config": {"bg": "linear-gradient(135deg, #2e1065 0%, #6d28d9 55%, #c026d3 100%)", "accent": "#e879f9", "accentDark": "#a21caf", "text": "#ffffff", "subtext": "rgba(255,255,255,0.75)", "card": "rgba(255,255,255,0.08)", "cardBorder": "rgba(232,121,249,0.3)", "bullet": "#f0abfc", "pill": "rgba(232,121,249,0.15)"}},
                {"name": "Midnight", "category": "minimal", "description": "Dark indigo, minimalist and professional",
                 "theme_config": {"bg": "linear-gradient(135deg, #020617 0%, #1e1b4b 55%, #312e81 100%)", "accent": "#818cf8", "accentDark": "#4338ca", "text": "#ffffff", "subtext": "rgba(255,255,255,0.7)", "card": "rgba(255,255,255,0.06)", "cardBorder": "rgba(129,140,248,0.25)", "bullet": "#a5b4fc", "pill": "rgba(129,140,248,0.12)"}},
                {"name": "Rose Bloom", "category": "vibrant", "description": "Pink to red, warm and inviting",
                 "theme_config": {"bg": "linear-gradient(135deg, #4c0519 0%, #be123c 55%, #e11d48 100%)", "accent": "#fda4af", "accentDark": "#be123c", "text": "#ffffff", "subtext": "rgba(255,255,255,0.75)", "card": "rgba(255,255,255,0.08)", "cardBorder": "rgba(253,164,175,0.3)", "bullet": "#fecdd3", "pill": "rgba(253,164,175,0.15)"}},
                {"name": "Arctic Aurora", "category": "tech", "description": "Bright cyan, modern and tech-focused",
                 "theme_config": {"bg": "linear-gradient(135deg, #083344 0%, #0e7490 55%, #0891b2 100%)", "accent": "#67e8f9", "accentDark": "#0e7490", "text": "#ffffff", "subtext": "rgba(255,255,255,0.75)", "card": "rgba(255,255,255,0.08)", "cardBorder": "rgba(103,232,249,0.3)", "bullet": "#a5f3fc", "pill": "rgba(103,232,249,0.15)"}},
                {"name": "Volcano", "category": "vibrant", "description": "Fiery orange-red, dynamic and attention-grabbing",
                 "theme_config": {"bg": "linear-gradient(135deg, #1c1917 0%, #9a3412 55%, #ea580c 100%)", "accent": "#fb923c", "accentDark": "#c2410c", "text": "#ffffff", "subtext": "rgba(255,255,255,0.75)", "card": "rgba(255,255,255,0.08)", "cardBorder": "rgba(251,146,60,0.3)", "bullet": "#fed7aa", "pill": "rgba(251,146,60,0.15)"}},
            ]
            for tmpl in default_templates:
                await execute_write(
                    "INSERT INTO design_templates (name, category, description, is_system, theme_config, style_config) VALUES ($1, $2, $3, true, $4, $5)",
                    tmpl["name"], tmpl["category"], tmpl["description"],
                    json.dumps(tmpl["theme_config"]), json.dumps({"font": "'Inter', sans-serif", "border_radius": "12px"})
                )
            logger.info(f"✅ Seeded {len(default_templates)} design templates")
    except Exception as e:
        logger.warning(f"⚠️  Design template seeding warning: {str(e)}")

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
        log_level="info" if settings.DEBUG else "warning",
        timeout_keep_alive=300,
        timeout_graceful_shutdown=300,
    )
