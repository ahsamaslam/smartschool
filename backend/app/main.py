"""
Main FastAPI application entry point
"""
import os
import socketio
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
    student_learning,
    teachers,
    managers,
    admins,
    videos,
    quizzes,
    qa,
    attendance,
    analytics,
    classes as classes_router,
    library,
    exams,
    homework,
    chat,
    metrics,
)
from app.schemas.slides_ai import GenerateSlidesRequest, GenerateSlidesResponse
from app.utils.ai_slide_deck import generate_slide_deck as run_generate_slide_deck
from app.utils.socket_manager import sio

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

# CORS — browsers require Access-Control-Allow-Origin on API responses from another port (e.g. :3000 → :8000).
# If .env CORS_ORIGINS is wrong or empty, requests fail with "blocked by CORS policy".
# In DEBUG mode, allow all localhost origins to support any dev port.
if settings.DEBUG:
    _cors_kw = dict(
        allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    _cors_kw = dict(
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.add_middleware(CORSMiddleware, **_cors_kw)

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
app.include_router(student_learning.router, prefix="/api/students", tags=["Student Learning"])

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

# Exam Module
app.include_router(exams.router, prefix="/api/exams", tags=["Exams"])

# Homework (interactive + upload, topic-scoped)
app.include_router(homework.router, prefix="/api/homework", tags=["Homework"])

# Chat (academic communication, WebSocket + REST)
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])

# Metrics & Historical Analytics
app.include_router(metrics.router, prefix="/api/metrics", tags=["Metrics"])

# Spec alias: POST /api/generate-slides (same handler as admin route)
@app.post("/api/generate-slides", response_model=GenerateSlidesResponse, tags=["AI Slides"])
async def standalone_generate_slides(body: GenerateSlidesRequest):
    return await run_generate_slide_deck(body)

# Serve generated audio/video/image files + chat uploads
os.makedirs("static/audio", exist_ok=True)
os.makedirs("static/videos", exist_ok=True)
os.makedirs("static/teacher_faces", exist_ok=True)
os.makedirs("static/chat_uploads", exist_ok=True)
os.makedirs("static/chat_uploads/images", exist_ok=True)
os.makedirs("static/chat_uploads/files", exist_ok=True)
os.makedirs("static/chat_uploads/voice", exist_ok=True)
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
        from app.routers.homework import ensure_homework_schema
        await ensure_homework_schema()
        os.makedirs(os.path.join("static", "homework_uploads"), exist_ok=True)
    except Exception as e:
        logger.error(f"❌ Database connection failed: {str(e)}")

    # Run idempotent schema migrations
    try:
        from app.utils.database import execute_write
        migrations = [
            "ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';",
            """CREATE TABLE IF NOT EXISTS tenants (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL UNIQUE,
                is_active BOOLEAN DEFAULT true,
                created_by_super_admin_id UUID,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );""",
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
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;",
            "ALTER TABLE schools ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;",
            "ALTER TABLE branches ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;",
            "ALTER TABLE classes ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;",
            "ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;",
            "ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);",
            "ALTER TABLE schools ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES users(id) ON DELETE SET NULL;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50);",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);",
            # Teacher-specific fields
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(100);",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS contact VARCHAR(20);",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(20);",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_status VARCHAR(50);",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_joining DATE;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS qualifications TEXT;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS experience_years INTEGER;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS languages TEXT;",
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
            # Ensure theme_config / style_config columns exist on older design_templates tables
            "ALTER TABLE design_templates ADD COLUMN IF NOT EXISTS theme_config JSONB;",
            "ALTER TABLE design_templates ADD COLUMN IF NOT EXISTS style_config JSONB;",
            # Exam module — extend teacher_exams and add exam_questions
            "ALTER TABLE teacher_exams ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft';",
            "ALTER TABLE teacher_exams ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();",
            "ALTER TABLE teacher_exams ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id);",
            "ALTER TABLE teacher_exams ADD COLUMN IF NOT EXISTS library_subject_id UUID;",
            """CREATE TABLE IF NOT EXISTS exam_questions (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                exam_id UUID REFERENCES teacher_exams(id) ON DELETE CASCADE,
                question_type VARCHAR(50) NOT NULL,
                question_text TEXT NOT NULL,
                options JSONB,
                correct_answer TEXT,
                marks INTEGER DEFAULT 1,
                order_index INTEGER DEFAULT 0,
                is_manual BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW()
            );""",
            # Exam geography (school / branch / board) — derived from class + optional board selection
            "ALTER TABLE teacher_exams ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;",
            "ALTER TABLE teacher_exams ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;",
            "ALTER TABLE teacher_exams ADD COLUMN IF NOT EXISTS board_id UUID;",
            "ALTER TABLE teacher_exams ADD COLUMN IF NOT EXISTS due_at TIMESTAMP;",
            "ALTER TABLE teacher_exams ADD COLUMN IF NOT EXISTS exam_date DATE;",
            "ALTER TABLE teacher_exams ADD COLUMN IF NOT EXISTS exam_time VARCHAR(10);",
            # Student learning progress (library topics)
            """CREATE TABLE IF NOT EXISTS student_topic_progress (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                topic_id UUID NOT NULL,
                slides_viewed_count INTEGER DEFAULT 0,
                slides_total INTEGER DEFAULT 0,
                slides_completed BOOLEAN DEFAULT false,
                lecture_watch_percent DOUBLE PRECISION DEFAULT 0,
                watch_time_seconds INTEGER DEFAULT 0,
                lecture_position_seconds DOUBLE PRECISION DEFAULT 0,
                lecture_completed BOOLEAN DEFAULT false,
                topic_completed BOOLEAN DEFAULT false,
                last_opened_at TIMESTAMP,
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(student_id, topic_id)
            );""",
            # Future: attempts / assignment rows when online exam delivery ships
            """CREATE TABLE IF NOT EXISTS student_exam_assignments (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                exam_id UUID NOT NULL REFERENCES teacher_exams(id) ON DELETE CASCADE,
                assigned_at TIMESTAMP DEFAULT NOW(),
                started_at TIMESTAMP,
                submitted_at TIMESTAMP,
                status VARCHAR(30) DEFAULT 'available',
                score DOUBLE PRECISION,
                attempts INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(student_id, exam_id)
            );""",
            """CREATE TABLE IF NOT EXISTS student_exam_answers (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                exam_id UUID NOT NULL REFERENCES teacher_exams(id) ON DELETE CASCADE,
                student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                question_id UUID NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
                answer_text TEXT,
                is_correct BOOLEAN,
                marks_awarded NUMERIC(5,2) DEFAULT 0,
                UNIQUE(student_id, question_id)
            );""",
            """ALTER TABLE student_exam_assignments ADD COLUMN IF NOT EXISTS upload_files_json JSONB DEFAULT '[]'::jsonb;""",
            # Chat system — 9 tables + 3 users columns + constraints + indexes
            # Users table additions for chat
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS accept_new_requests BOOLEAN DEFAULT true;",
            # Conversations table
            """CREATE TABLE IF NOT EXISTS chat_conversations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
                participant_a_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                participant_b_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                conversation_key VARCHAR(200) NOT NULL,
                initiator_id UUID NOT NULL REFERENCES users(id),
                status VARCHAR(30) NOT NULL DEFAULT 'pending',
                is_muted BOOLEAN DEFAULT false,
                is_restricted BOOLEAN DEFAULT false,
                blocked_by_teacher BOOLEAN DEFAULT false,
                blocked_at TIMESTAMP,
                slow_mode_seconds INTEGER DEFAULT 0,
                attachments_allowed BOOLEAN DEFAULT true,
                request_message TEXT,
                request_responded_at TIMESTAMP,
                last_message_at TIMESTAMP,
                last_message_preview TEXT,
                last_message_sender_id UUID REFERENCES users(id),
                archived_by_teacher BOOLEAN DEFAULT false,
                deleted_by_a BOOLEAN DEFAULT false,
                deleted_by_b BOOLEAN DEFAULT false,
                auto_flagged BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(conversation_key),
                CHECK (status IN ('pending','active','rejected','blocked','archived','closed'))
            );""",
            "CREATE INDEX IF NOT EXISTS idx_chat_conv_a ON chat_conversations(participant_a_id);",
            "CREATE INDEX IF NOT EXISTS idx_chat_conv_b ON chat_conversations(participant_b_id);",
            "CREATE INDEX IF NOT EXISTS idx_chat_conv_key ON chat_conversations(conversation_key);",
            "CREATE INDEX IF NOT EXISTS idx_chat_conv_school ON chat_conversations(school_id);",
            # Messages table
            """CREATE TABLE IF NOT EXISTS chat_messages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
                sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                message_type VARCHAR(20) NOT NULL DEFAULT 'text',
                content TEXT,
                file_url TEXT,
                file_name TEXT,
                file_size_bytes INTEGER,
                mime_type VARCHAR(100),
                duration_seconds INTEGER,
                delivery_status VARCHAR(20) DEFAULT 'sent',
                is_read BOOLEAN DEFAULT false,
                is_deleted BOOLEAN DEFAULT false,
                edited_at TIMESTAMP,
                deleted_at TIMESTAMP,
                reply_to_message_id UUID REFERENCES chat_messages(id),
                attachment_category VARCHAR(30),
                scan_status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT NOW(),
                CHECK (delivery_status IN ('sent','delivered','read')),
                CHECK (attachment_category IN ('image','pdf','document','voice','generic_file'))
            );""",
            "CREATE INDEX IF NOT EXISTS idx_chat_msg_conv ON chat_messages(conversation_id);",
            "CREATE INDEX IF NOT EXISTS idx_chat_msg_created ON chat_messages(created_at);",
            "CREATE INDEX IF NOT EXISTS idx_unread_messages ON chat_messages(conversation_id, is_read) WHERE is_read = false;",
            "CREATE INDEX IF NOT EXISTS idx_chat_msg_content_gin ON chat_messages USING GIN(to_tsvector('english', content));",
            # Announcements table
            """CREATE TABLE IF NOT EXISTS chat_announcements (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
                subject_id UUID,
                book_id UUID,
                topic_id UUID,
                homework_id UUID,
                exam_id UUID,
                lecture_id UUID,
                school_id UUID REFERENCES schools(id),
                title VARCHAR(255),
                content TEXT NOT NULL,
                file_url TEXT,
                file_name TEXT,
                message_type VARCHAR(20) DEFAULT 'text',
                priority VARCHAR(20) DEFAULT 'normal',
                requires_acknowledgement BOOLEAN DEFAULT false,
                expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                CHECK (priority IN ('normal','important','urgent'))
            );""",
            "CREATE INDEX IF NOT EXISTS idx_announce_teacher ON chat_announcements(teacher_id);",
            "CREATE INDEX IF NOT EXISTS idx_announce_class ON chat_announcements(class_id);",
            # Announcement reads table
            """CREATE TABLE IF NOT EXISTS chat_announcement_reads (
                announcement_id UUID NOT NULL REFERENCES chat_announcements(id) ON DELETE CASCADE,
                student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                acknowledged BOOLEAN DEFAULT false,
                read_at TIMESTAMP DEFAULT NOW(),
                PRIMARY KEY (announcement_id, student_id)
            );""",
            # Slow mode log table
            """CREATE TABLE IF NOT EXISTS chat_slow_mode_log (
                conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
                student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                last_message_at TIMESTAMP NOT NULL DEFAULT NOW(),
                PRIMARY KEY (conversation_id, student_id)
            );""",
            # School chat settings table
            """CREATE TABLE IF NOT EXISTS school_chat_settings (
                school_id UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
                exam_chat_mode VARCHAR(30) DEFAULT 'moderated',
                student_monthly_upload_limit INTEGER DEFAULT 100,
                student_voice_monthly_limit INTEGER DEFAULT 50,
                max_voice_seconds INTEGER DEFAULT 180,
                allow_manager_student_chat BOOLEAN DEFAULT false,
                allow_admin_student_chat BOOLEAN DEFAULT true,
                enable_read_receipts BOOLEAN DEFAULT true,
                enable_typing_indicators BOOLEAN DEFAULT true,
                message_retention_days INTEGER DEFAULT 30,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );""",
            # Audit logs table
            """CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                actor_id UUID REFERENCES users(id),
                school_id UUID REFERENCES schools(id),
                action_type VARCHAR(100) NOT NULL,
                entity_type VARCHAR(50),
                entity_id UUID,
                metadata JSONB,
                created_at TIMESTAMP DEFAULT NOW()
            );""",
            "CREATE INDEX IF NOT EXISTS idx_audit_school ON audit_logs(school_id);",
            "CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);",
            # Notifications table
            """CREATE TABLE IF NOT EXISTS notifications (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL,
                title VARCHAR(255),
                body TEXT,
                entity_type VARCHAR(50),
                entity_id UUID,
                is_read BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW()
            );""",
            "CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);",
            "CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(user_id, is_read);",
            # Conversation reads table
            """CREATE TABLE IF NOT EXISTS chat_conversation_reads (
                conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                last_seen_message_id UUID REFERENCES chat_messages(id),
                updated_at TIMESTAMP DEFAULT NOW(),
                PRIMARY KEY (conversation_id, user_id)
            );""",
            "CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);",
            "CREATE INDEX IF NOT EXISTS idx_schools_tenant ON schools(tenant_id);",
            "CREATE INDEX IF NOT EXISTS idx_branches_tenant ON branches(tenant_id);",
            "CREATE INDEX IF NOT EXISTS idx_classes_tenant ON classes(tenant_id);",
            # Historical Metrics & Snapshot System
            """CREATE TABLE IF NOT EXISTS daily_student_metrics (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
                date DATE NOT NULL,
                video_completion_rate NUMERIC(5,2) DEFAULT 0,
                homework_submission_rate NUMERIC(5,2) DEFAULT 0,
                attendance_rate NUMERIC(5,2) DEFAULT 0,
                homework_retakes_avg NUMERIC(5,2) DEFAULT 0,
                topic_revisits_avg NUMERIC(5,2) DEFAULT 0,
                study_duration_minutes NUMERIC(8,2) DEFAULT 0,
                daily_shs NUMERIC(5,2),
                risk_level VARCHAR(20),
                consistency_score NUMERIC(5,2),
                behavioral_score NUMERIC(5,2),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(student_id, class_id, date)
            );""",
            "CREATE INDEX IF NOT EXISTS idx_daily_metrics_student ON daily_student_metrics(student_id);",
            "CREATE INDEX IF NOT EXISTS idx_daily_metrics_class ON daily_student_metrics(class_id);",
            "CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_student_metrics(date);",
            """CREATE TABLE IF NOT EXISTS student_health_scores (
                student_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
                current_shs NUMERIC(5,2),
                weekly_shs NUMERIC(5,2),
                monthly_shs NUMERIC(5,2),
                momentum NUMERIC(5,2),
                risk_level VARCHAR(20),
                last_updated TIMESTAMP DEFAULT NOW(),
                UNIQUE(student_id, class_id)
            );""",
            "CREATE INDEX IF NOT EXISTS idx_health_student ON student_health_scores(student_id);",
            """CREATE TABLE IF NOT EXISTS performance_alerts (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                alert_type VARCHAR(50),
                severity VARCHAR(20),
                student_id UUID REFERENCES users(id) ON DELETE CASCADE,
                class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
                teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
                message TEXT,
                action_required TEXT,
                is_resolved BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW(),
                resolved_at TIMESTAMP,
                UNIQUE(alert_type, student_id, class_id, DATE(created_at))
            );""",
            "CREATE INDEX IF NOT EXISTS idx_alerts_student ON performance_alerts(student_id);",
            "CREATE INDEX IF NOT EXISTS idx_alerts_teacher ON performance_alerts(teacher_id);",
            "CREATE INDEX IF NOT EXISTS idx_alerts_severity ON performance_alerts(severity);",
            # Video focus metrics
            """CREATE TABLE IF NOT EXISTS video_focus_metrics (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                topic_id UUID NOT NULL,
                date DATE DEFAULT CURRENT_DATE,
                pause_count INTEGER DEFAULT 0,
                rewind_count INTEGER DEFAULT 0,
                drops_count INTEGER DEFAULT 0,
                avg_watch_speed NUMERIC(3,2) DEFAULT 1.0,
                total_watch_seconds INTEGER DEFAULT 0,
                video_duration_seconds INTEGER DEFAULT 0,
                focus_score NUMERIC(5,2),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(student_id, topic_id, date)
            );""",
            "CREATE INDEX IF NOT EXISTS idx_focus_student ON video_focus_metrics(student_id);",
            "CREATE INDEX IF NOT EXISTS idx_focus_date ON video_focus_metrics(date);",
            # Update student_topic_progress to track revisits
            "ALTER TABLE student_topic_progress ADD COLUMN IF NOT EXISTS revisit_count INTEGER DEFAULT 1;",
            "ALTER TABLE student_topic_progress ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP DEFAULT NOW();",
            # Update student_session_logs for login/logout tracking
            "ALTER TABLE student_session_logs ADD COLUMN IF NOT EXISTS login_at TIMESTAMP DEFAULT NOW();",
            "ALTER TABLE student_session_logs ADD COLUMN IF NOT EXISTS logout_at TIMESTAMP;",
            "ALTER TABLE student_session_logs ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;",
            # AI Performance Insights table
            """CREATE TABLE IF NOT EXISTS ai_performance_insights (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                entity_type VARCHAR(20),
                entity_id UUID,
                analysis_date DATE,
                predictions JSONB,
                recommendations JSONB,
                confidence_score NUMERIC(5,2),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(entity_type, entity_id, analysis_date)
            );""",
            "CREATE INDEX IF NOT EXISTS idx_insights_entity ON ai_performance_insights(entity_type, entity_id);",
            "CREATE INDEX IF NOT EXISTS idx_insights_date ON ai_performance_insights(analysis_date);",
        ]
        for sql in migrations:
            try:
                await execute_write(sql)
            except Exception as e:
                pass  # Table may already exist
        logger.info("✅ Schema migrations applied")
    except Exception as e:
        logger.warning(f"⚠️  Schema migration warning: {str(e)}")

    # Optionally ensure a default tenant exists and backfill legacy rows.
    if settings.AUTO_CREATE_DEFAULT_TENANT:
        try:
            from app.utils.database import execute_one, execute_write

            default_tenant_name = "Default Tenant"
            tenant = await execute_one(
                "SELECT id FROM tenants WHERE name = $1",
                default_tenant_name,
            )
            if not tenant:
                tenant = await execute_one(
                    """
                    INSERT INTO tenants (name, is_active)
                    VALUES ($1, true)
                    RETURNING id
                    """,
                    default_tenant_name,
                )

            default_tenant_id = tenant["id"]

            backfills = [
                ("UPDATE users SET tenant_id = $1::uuid WHERE tenant_id IS NULL", default_tenant_id),
                ("UPDATE schools SET tenant_id = $1::uuid WHERE tenant_id IS NULL", default_tenant_id),
                (
                    """
                    UPDATE branches b
                    SET tenant_id = COALESCE(b.tenant_id, s.tenant_id, $1::uuid)
                    FROM schools s
                    WHERE b.school_id = s.id AND b.tenant_id IS NULL
                    """,
                    default_tenant_id,
                ),
                (
                    """
                    UPDATE classes c
                    SET tenant_id = COALESCE(c.tenant_id, b.tenant_id, $1::uuid)
                    FROM branches b
                    WHERE c.branch_id = b.id AND c.tenant_id IS NULL
                    """,
                    default_tenant_id,
                ),
                (
                    """
                    UPDATE teacher_profiles tp
                    SET tenant_id = COALESCE(tp.tenant_id, u.tenant_id, $1::uuid)
                    FROM users u
                    WHERE tp.user_id = u.id AND tp.tenant_id IS NULL
                    """,
                    default_tenant_id,
                ),
                (
                    """
                    UPDATE student_profiles sp
                    SET tenant_id = COALESCE(sp.tenant_id, u.tenant_id, $1::uuid)
                    FROM users u
                    WHERE sp.user_id = u.id AND sp.tenant_id IS NULL
                    """,
                    default_tenant_id,
                ),
            ]

            for sql, param in backfills:
                try:
                    await execute_write(sql, param)
                except Exception:
                    pass

            logger.info("✅ Default tenant ensured and legacy backfill attempted")
        except Exception as e:
            logger.warning(f"⚠️  Tenant backfill warning: {str(e)}")
    else:
        logger.info("ℹ️  Default tenant auto-creation disabled")

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
                    "INSERT INTO design_templates (name, category, description, is_system, theme_config, style_config, layout_definitions) VALUES ($1, $2, $3, true, $4, $5, $6)",
                    tmpl["name"], tmpl["category"], tmpl["description"],
                    json.dumps(tmpl["theme_config"]), json.dumps({"font": "'Inter', sans-serif", "border_radius": "12px"}),
                    json.dumps([])
                )
            logger.info(f"✅ Seeded {len(default_templates)} design templates")
    except Exception as e:
        logger.warning(f"⚠️  Design template seeding warning: {str(e)}")

    # Bootstrap the sole super-admin user from env vars.
    # If the user already exists it is updated to match the env values;
    # every other user in the table is deactivated so only this admin
    # can log in until additional users are explicitly created.
    try:
        from app.utils.auth import hash_password
        from app.utils.database import execute_write, execute_one

        admin_id = settings.ADMIN_ID
        admin_email = settings.ADMIN_EMAIL
        admin_full_name = settings.ADMIN_FULL_NAME
        admin_role = settings.ADMIN_ROLE
        admin_password_hash = hash_password(settings.ADMIN_PASSWORD)

        default_tenant = await execute_one(
            "SELECT id FROM tenants WHERE name = $1",
            "Default Tenant",
        )
        default_tenant_id = default_tenant["id"] if default_tenant else None

        # Upsert the admin user
        await execute_write(
            """
            INSERT INTO users (id, email, full_name, role, tenant_id, password_hash, must_change_password, is_active)
            VALUES (
                $1, $2, $3, $4, $5::uuid, $6, false, true
            )
            ON CONFLICT (id) DO UPDATE
                SET email         = EXCLUDED.email,
                    full_name     = EXCLUDED.full_name,
                    role          = EXCLUDED.role,
                    tenant_id     = COALESCE(EXCLUDED.tenant_id, users.tenant_id),
                    password_hash = EXCLUDED.password_hash,
                    must_change_password = false,
                    is_active     = true,
                    updated_at    = NOW();
            """,
            admin_id,
            admin_email,
            admin_full_name,
            admin_role,
            default_tenant_id,
            admin_password_hash,
        )

        # Optional safety gate for initial bootstrap only.
        # We intentionally avoid deactivating existing non-admin users on every restart.
        if settings.DEACTIVATE_NON_ADMIN_USERS:
            non_admin_count_row = await execute_one(
                "SELECT COUNT(*)::int AS total FROM users WHERE id <> $1::uuid",
                admin_id,
            )
            non_admin_count = int((non_admin_count_row or {}).get("total") or 0)
            if non_admin_count == 0:
                await execute_write(
                    """
                    UPDATE users
                    SET is_active = false
                    WHERE id <> $1::uuid;
                    """,
                    admin_id,
                )
            else:
                logger.info(
                    "ℹ️  Skipped DEACTIVATE_NON_ADMIN_USERS because non-admin users already exist"
                )

        logger.info(f"✅ Super admin user bootstrapped: {admin_email}")
    except Exception as e:
        logger.error(f"❌ Admin bootstrap failed: {str(e)}")

    # Start background job schedulers
    try:
        import asyncio
        from app.utils.historical_metrics import run_daily_metrics_job
        from app.utils.ai_predictions import run_weekly_ai_analysis_job
        from apscheduler.schedulers.asyncio import AsyncIOScheduler

        scheduler = AsyncIOScheduler()

        # Daily metrics job: 00:00 UTC every day
        scheduler.add_job(run_daily_metrics_job, 'cron', hour=0, minute=0, id='daily_metrics_job')
        logger.info("✅ Daily metrics job scheduled (00:00 UTC)")

        # Weekly AI analysis job: Monday at 06:00 UTC (analyze at-risk students)
        scheduler.add_job(run_weekly_ai_analysis_job, 'cron', day_of_week='mon', hour=6, minute=0, id='weekly_ai_job')
        logger.info("✅ Weekly AI analysis job scheduled (Monday 06:00 UTC)")

        scheduler.start()
        app.state.scheduler = scheduler
        logger.info("✅ All background job schedulers started")
    except ImportError:
        logger.warning("⚠️  APScheduler not installed. Background jobs will not run automatically.")
    except Exception as e:
        logger.warning(f"⚠️  Could not start background job schedulers: {str(e)}")

    logger.info("✅ Education Platform API Started Successfully!")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("🛑 Education Platform API Shutting Down...")

    # Shutdown scheduler
    try:
        if hasattr(app.state, 'scheduler') and app.state.scheduler.running:
            app.state.scheduler.shutdown()
            logger.info("✅ Metrics scheduler shutdown")
    except Exception as e:
        logger.warning(f"⚠️  Error shutting down scheduler: {str(e)}")

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

# ============================================
# SOCKET.IO ASGI WRAPPER
# ============================================
# /socket.io/* → handled by python-socketio
# everything else → FastAPI (with all its middleware)
socket_app = socketio.ASGIApp(sio, app)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:socket_app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info" if settings.DEBUG else "warning",
        timeout_keep_alive=300,
        timeout_graceful_shutdown=300,
    )
